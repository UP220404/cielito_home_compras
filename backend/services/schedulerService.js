const db = require('../config/database');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

class SchedulerService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  // Iniciar el scheduler (se ejecuta cada minuto)
  start() {
    if (this.isRunning) {
      logger.warn('⚠️ Scheduler ya está ejecutándose');
      return;
    }

    logger.info('🕐 Iniciando scheduler de solicitudes programadas...');
    this.isRunning = true;

    // Ejecutar inmediatamente
    this.checkScheduledRequests();

    // Luego cada minuto
    this.intervalId = setInterval(() => {
      this.checkScheduledRequests();
    }, 60000); // 60 segundos

    logger.info('✅ Scheduler iniciado correctamente');
  }

  // Detener el scheduler
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('⏹️ Scheduler detenido');
    }
  }

  // Verificar y enviar solicitudes programadas
  async checkScheduledRequests() {
    try {
      const now = new Date().toISOString();

      // Buscar solicitudes que están programadas y cuya hora ya llegó
      const scheduledRequests = await db.allAsync(`
        SELECT
          r.*,
          u.name as user_name,
          u.email as user_email
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.is_draft = 1
          AND r.scheduled_for IS NOT NULL
          AND r.scheduled_for <= ?
      `, [now]);

      if (scheduledRequests.length > 0) {
        logger.info(`📤 Enviando ${scheduledRequests.length} solicitudes programadas...`);
      }

      for (const request of scheduledRequests) {
        await this.submitScheduledRequest(request);
      }

    } catch (error) {
      logger.error('❌ Error en checkScheduledRequests:', error);
    }
  }

  // Enviar una solicitud programada
  async submitScheduledRequest(request) {
    try {
      logger.info(`📨 Enviando solicitud programada: ${request.folio}`);

      // Verificar que tiene items
      const items = await db.allAsync(`
        SELECT * FROM request_items WHERE request_id = ?
      `, [request.id]);

      if (items.length === 0) {
        logger.warn(`⚠️ Solicitud ${request.folio} no tiene artículos, eliminando...`);
        await db.runAsync('DELETE FROM requests WHERE id = ?', [request.id]);
        return;
      }

      // Convertir a solicitud real
      await db.runAsync(`
        UPDATE requests SET
          is_draft = 0,
          status = 'pendiente',
          draft_data = NULL,
          scheduled_for = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [request.id]);

      // Enviar notificación al director
      const user = {
        id: request.user_id,
        name: request.user_name,
        email: request.user_email,
        area: request.area
      };

      await notificationService.notifyDirector(request, user);

      logger.info(`✅ Solicitud ${request.folio} enviada automáticamente`);

      // Notificar al usuario que su solicitud fue enviada
      await notificationService.createNotification(
        request.user_id,
        'success',
        `Tu solicitud programada ${request.folio} ha sido enviada automáticamente`,
        `/detalle-solicitud.html?id=${request.id}`
      );

    } catch (error) {
      logger.error(`❌ Error enviando solicitud programada ${request.id}:`, error);
    }
  }
}

// Singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;
