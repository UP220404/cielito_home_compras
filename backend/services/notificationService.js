const db = require('../config/database');
const emailService = require('./emailService');

class NotificationService {
  // Crear notificación en base de datos
  async createNotification(userId, title, message, type = 'info', link = null) {
    try {
      await db.runAsync(
        'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
        [userId, title, message, type, link]
      );
    } catch (error) {
      console.error('Error creando notificación:', error);
    }
  }

  // Notificar nueva solicitud
  async notifyNewRequest(requestId) {
    try {
      // Obtener datos de la solicitud
      const request = await db.getAsync(`
        SELECT r.*, u.name as requester_name, u.email as requester_email
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `, [requestId]);

      if (!request) return;

      // Notificar a compras y directores
      const recipients = await db.allAsync(`
        SELECT id, name, email 
        FROM users 
        WHERE role IN ('purchaser', 'director', 'admin') AND is_active = 1
      `);

      const title = `Nueva Solicitud: ${request.folio}`;
      const message = `${request.requester_name} ha creado una nueva solicitud de compra del área ${request.area}`;
      const link = `/pages/detalle-solicitud.html?id=${requestId}`;

      // Crear notificaciones en DB
      for (const recipient of recipients) {
        await this.createNotification(recipient.id, title, message, 'info', link);
      }

      // Enviar emails
      await emailService.sendNewRequestNotification(request, recipients);

    } catch (error) {
      console.error('Error notificando nueva solicitud:', error);
    }
  }

  // Notificar cambio de estatus
  async notifyStatusChange(requestId, newStatus, reason = null) {
    try {
      const request = await db.getAsync(`
        SELECT r.*, u.name as requester_name, u.email as requester_email
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `, [requestId]);

      if (!request) return;

      const statusMessages = {
        cotizando: 'está siendo cotizada',
        autorizada: 'ha sido autorizada',
        rechazada: 'ha sido rechazada',
        comprada: 'ha sido comprada',
        entregada: 'ha sido entregada',
        cancelada: 'ha sido cancelada'
      };

      const statusTypes = {
        cotizando: 'info',
        autorizada: 'success',
        rechazada: 'danger',
        comprada: 'info',
        entregada: 'success',
        cancelada: 'warning'
      };

      const title = `Solicitud ${request.folio} - ${newStatus.toUpperCase()}`;
      const message = `Tu solicitud ${statusMessages[newStatus] || 'ha cambiado de estado'}`;
      const type = statusTypes[newStatus] || 'info';
      const link = `/pages/detalle-solicitud.html?id=${requestId}`;

      // Notificar al solicitante
      await this.createNotification(request.user_id, title, message, type, link);

      // Si es autorizada/rechazada, también notificar a compras
      if (['autorizada', 'rechazada'].includes(newStatus)) {
        const purchasers = await db.allAsync(`
          SELECT id FROM users 
          WHERE role IN ('purchaser', 'admin') AND is_active = 1
        `);

        for (const purchaser of purchasers) {
          await this.createNotification(
            purchaser.id,
            title,
            `La solicitud ${request.folio} de ${request.requester_name} ${statusMessages[newStatus]}`,
            type,
            link
          );
        }
      }

      // Enviar email
      await emailService.sendStatusChangeNotification(request, newStatus, reason);

    } catch (error) {
      console.error('Error notificando cambio de estatus:', error);
    }
  }

  // Notificar orden de compra generada
  async notifyPurchaseOrderCreated(orderId) {
    try {
      const order = await db.getAsync(`
        SELECT 
          po.*,
          r.folio as request_folio,
          r.user_id as requester_id,
          u.name as requester_name,
          u.email as requester_email,
          s.name as supplier_name
        FROM purchase_orders po
        JOIN requests r ON po.request_id = r.id
        JOIN users u ON r.user_id = u.id
        JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.id = ?
      `, [orderId]);

      if (!order) return;

      const title = `Orden de Compra Generada: ${order.folio}`;
      const message = `Se ha generado la orden de compra para tu solicitud ${order.request_folio}`;
      const link = `/pages/ordenes-compra.html`;

      // Notificar al solicitante
      await this.createNotification(order.requester_id, title, message, 'success', link);

      // Enviar email
      await emailService.sendPurchaseOrderNotification(order);

    } catch (error) {
      console.error('Error notificando orden de compra:', error);
    }
  }

  // Obtener notificaciones de usuario
  async getUserNotifications(userId, limit = 10, unreadOnly = false) {
    try {
      let query = `
        SELECT * FROM notifications 
        WHERE user_id = ?
      `;
      let params = [userId];

      if (unreadOnly) {
        query += ' AND is_read = 0';
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      return await db.allAsync(query, params);
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error);
      return [];
    }
  }

  // Marcar notificación como leída
  async markAsRead(notificationId, userId) {
    try {
      await db.runAsync(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  }

  // Marcar todas las notificaciones como leídas
  async markAllAsRead(userId) {
    try {
      await db.runAsync(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId]
      );
    } catch (error) {
      console.error('Error marcando todas las notificaciones como leídas:', error);
    }
  }

  // Obtener contador de notificaciones no leídas
  async getUnreadCount(userId) {
    try {
      const result = await db.getAsync(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      return result ? result.count : 0;
    } catch (error) {
      console.error('Error obteniendo contador de no leídas:', error);
      return 0;
    }
  }

  // Limpiar notificaciones antiguas (más de 30 días)
  async cleanupOldNotifications() {
    try {
      await db.runAsync(
        `DELETE FROM notifications 
         WHERE created_at < datetime('now', '-30 days') AND is_read = 1`
      );
      console.log('✅ Notificaciones antiguas limpiadas');
    } catch (error) {
      console.error('Error limpiando notificaciones antiguas:', error);
    }
  }
}

module.exports = new NotificationService();
