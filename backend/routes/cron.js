const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { apiResponse, getCurrentTimestamp } = require('../utils/helpers');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// POST /api/cron/process-scheduled-requests
// Procesa solicitudes programadas cuya fecha/hora ya llegó
router.post('/process-scheduled-requests', async (req, res, next) => {
  try {
    logger.info('Starting scheduled requests processing');

    // Verificar token de seguridad (opcional pero recomendado)
    const cronToken = req.headers['x-cron-token'];
    if (process.env.CRON_SECRET && cronToken !== process.env.CRON_SECRET) {
      logger.warn('Invalid cron token received');
      return res.status(401).json(apiResponse(false, null, 'No autorizado'));
    }

    // Buscar solicitudes programadas cuya fecha/hora ya llegó (usar hora de México)
    const now = getCurrentTimestamp();
    logger.info(`Hora México actual: ${now}`);
    const scheduledRequests = await db.allAsync(`
      SELECT r.*, u.name as user_name, u.email as user_email
      FROM requests r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.is_scheduled = TRUE
        AND r.scheduled_send_date <= ?
        AND r.status = 'programada'
      ORDER BY r.scheduled_send_date ASC
    `, [now]);

    logger.info(`Scheduled requests to process: ${scheduledRequests.length}`);

    if (scheduledRequests.length === 0) {
      return res.json(apiResponse(
        true,
        { processed: 0, requests: [] },
        'No hay solicitudes programadas para procesar'
      ));
    }

    const processed = [];
    const errors = [];

    for (const request of scheduledRequests) {
      try {
        logger.info(`Processing scheduled request ID: ${request.id}`);

        // Actualizar solicitud: cambiar estado y marcar como enviada
        await db.runAsync(`
          UPDATE requests
          SET status = 'pendiente',
              is_scheduled = FALSE
          WHERE id = ?
        `, [request.id]);

        // Registrar en audit log
        await db.runAsync(`
          INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
          VALUES (?, 'update', 'requests', ?, ?, ?)
        `, [
          request.user_id,
          request.id,
          JSON.stringify({ status: 'programada', is_scheduled: true }),
          JSON.stringify({ status: 'pendiente', is_scheduled: false, note: 'Solicitud enviada automáticamente por programación' })
        ]);

        // Enviar notificaciones
        try {
          // Notificar a compradores
          const purchasers = await db.allAsync(`
            SELECT email FROM users WHERE role = 'purchaser'
          `);

          for (const purchaser of purchasers) {
            await emailService.sendEmail(
              purchaser.email,
              'Nueva Solicitud de Compra (Programada)',
              `
                <h2>Nueva Solicitud de Compra Programada</h2>
                <p>Se ha enviado automáticamente una solicitud programada:</p>
                <ul>
                  <li><strong>Folio:</strong> ${request.folio}</li>
                  <li><strong>Solicitante:</strong> ${request.user_name}</li>
                  <li><strong>Área:</strong> ${request.area}</li>
                  <li><strong>Prioridad:</strong> ${request.priority || request.urgency}</li>
                  <li><strong>Programada para:</strong> ${new Date(request.scheduled_send_date).toLocaleString('es-MX')}</li>
                </ul>
                <p>Por favor, revisa la solicitud en el sistema.</p>
              `
            );
          }

          // Notificar al solicitante
          await emailService.sendEmail(
            request.user_email,
            'Tu Solicitud Programada ha sido Enviada',
            `
              <h2>Solicitud Enviada Automáticamente</h2>
              <p>Tu solicitud programada ha sido enviada exitosamente:</p>
              <ul>
                <li><strong>Folio:</strong> ${request.folio}</li>
                <li><strong>Estado:</strong> Pendiente</li>
                <li><strong>Fecha de envío:</strong> ${new Date().toLocaleString('es-MX')}</li>
              </ul>
              <p>El equipo de compras la revisará próximamente.</p>
            `
          );

          // Notifications sent successfully
        } catch (notifError) {
          logger.warn(`Error sending notifications for request ${request.id}: ${notifError.message}`);
          // No fallar el proceso por errores de notificación
        }

        processed.push({
          id: request.id,
          folio: request.folio,
          user_name: request.user_name,
          scheduled_date: request.scheduled_send_date,
          processed_at: new Date().toISOString()
        });

        // Request processed successfully

      } catch (error) {
        logger.error(`Error processing request ${request.id}: ${error.message}`);
        errors.push({
          id: request.id,
          folio: request.folio,
          error: error.message
        });
      }
    }

    logger.info(`Scheduled processing completed. Processed: ${processed.length}, Errors: ${errors.length}`);

    res.json(apiResponse(
      true,
      {
        processed: processed.length,
        errors: errors.length,
        requests: processed,
        error_details: errors
      },
      `Procesadas ${processed.length} solicitudes programadas${errors.length > 0 ? `, ${errors.length} con errores` : ''}`
    ));

  } catch (error) {
    logger.error('Error in scheduled requests process: %o', error);
    next(error);
  }
});

// GET /api/cron/scheduled-requests-status
// Obtener estadísticas de solicitudes programadas
router.get('/scheduled-requests-status', async (req, res, next) => {
  try {
    // Usar hora de México para comparar
    const now = getCurrentTimestamp();

    const stats = await db.getAsync(`
      SELECT
        COUNT(*) as total_scheduled,
        COUNT(CASE WHEN scheduled_send_date <= ? THEN 1 END) as ready_to_send,
        COUNT(CASE WHEN scheduled_send_date > ? THEN 1 END) as pending_future
      FROM requests
      WHERE is_scheduled = TRUE AND status = 'programada'
    `, [now, now]);

    const nextToProcess = await db.allAsync(`
      SELECT id, folio, user_id, scheduled_send_date, area
      FROM requests
      WHERE is_scheduled = TRUE
        AND status = 'programada'
        AND scheduled_send_date <= ?
      ORDER BY scheduled_send_date ASC
      LIMIT 10
    `, [now]);

    res.json(apiResponse(true, {
      ...stats,
      next_to_process: nextToProcess
    }));

  } catch (error) {
    logger.error('Error getting scheduled stats: %o', error);
    next(error);
  }
});

module.exports = router;
