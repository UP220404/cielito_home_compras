const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { apiResponse } = require('../utils/helpers');
const notificationService = require('../services/notificationService');

// POST /api/cron/process-scheduled-requests
// Procesa solicitudes programadas cuya fecha/hora ya llegó
router.post('/process-scheduled-requests', async (req, res, next) => {
  try {
    console.log('🕐 Iniciando proceso de solicitudes programadas...');

    // Verificar token de seguridad (opcional pero recomendado)
    const cronToken = req.headers['x-cron-token'];
    if (process.env.CRON_SECRET && cronToken !== process.env.CRON_SECRET) {
      console.log('❌ Token de cron inválido');
      return res.status(401).json(apiResponse(false, null, 'No autorizado'));
    }

    // Buscar solicitudes programadas cuya fecha/hora ya llegó
    const now = new Date().toISOString();
    const scheduledRequests = await db.allAsync(`
      SELECT r.*, u.name as user_name, u.email as user_email
      FROM requests r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.is_scheduled = TRUE
        AND r.scheduled_send_date <= ?
        AND r.status = 'programada'
      ORDER BY r.scheduled_send_date ASC
    `, [now]);

    console.log(`📊 Solicitudes programadas a procesar: ${scheduledRequests.length}`);

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
        console.log(`📨 Procesando solicitud programada ID: ${request.id}, Folio: ${request.folio}`);

        // Actualizar solicitud: cambiar estado y marcar como enviada
        await db.runAsync(`
          UPDATE requests
          SET status = 'pendiente',
              is_scheduled = FALSE
          WHERE id = ?
        `, [request.id]);

        // Registrar en audit log
        await db.runAsync(`
          INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
          VALUES (?, 'update', 'requests', ?, ?)
        `, [
          request.user_id,
          request.id,
          JSON.stringify({
            from: { status: 'programada', is_scheduled: true },
            to: { status: 'pendiente', is_scheduled: false },
            note: 'Solicitud enviada automáticamente por programación'
          })
        ]);

        // Enviar notificaciones
        try {
          // Notificar a compradores
          const purchasers = await db.allAsync(`
            SELECT email FROM users WHERE role = 'purchaser'
          `);

          for (const purchaser of purchasers) {
            await notificationService.sendEmail(
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
          await notificationService.sendEmail(
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

          console.log(`✅ Notificaciones enviadas para solicitud ${request.folio}`);
        } catch (notifError) {
          console.error(`⚠️ Error enviando notificaciones para ${request.folio}:`, notifError.message);
          // No fallar el proceso por errores de notificación
        }

        processed.push({
          id: request.id,
          folio: request.folio,
          user_name: request.user_name,
          scheduled_date: request.scheduled_send_date,
          processed_at: new Date().toISOString()
        });

        console.log(`✅ Solicitud ${request.folio} procesada exitosamente`);

      } catch (error) {
        console.error(`❌ Error procesando solicitud ${request.id}:`, error);
        errors.push({
          id: request.id,
          folio: request.folio,
          error: error.message
        });
      }
    }

    console.log(`✅ Proceso completado. Procesadas: ${processed.length}, Errores: ${errors.length}`);

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
    console.error('❌ Error en proceso de solicitudes programadas:', error);
    next(error);
  }
});

// GET /api/cron/scheduled-requests-status
// Obtener estadísticas de solicitudes programadas
router.get('/scheduled-requests-status', async (req, res, next) => {
  try {
    const now = new Date().toISOString();

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
    console.error('❌ Error obteniendo estadísticas de programadas:', error);
    next(error);
  }
});

module.exports = router;
