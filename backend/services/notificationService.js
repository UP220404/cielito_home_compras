const db = require('../config/database');
const emailService = require('./emailService');
const socketService = require('./socketService');

class NotificationService {
  // Crear notificación en base de datos
  async createNotification(userId, title, message, type = 'info', link = null) {
    try {
      const result = await db.runAsync(
        'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
        [userId, title, message, type, link]
      );

      // Obtener la notificación creada
      const notification = await db.getAsync(
        'SELECT * FROM notifications WHERE id = ?',
        [result.id]
      );

      // Emitir evento Socket.IO en tiempo real
      if (notification) {
        socketService.emitNewNotification(userId, notification);
        console.log(`📤 Notificación emitida vía Socket.IO a usuario ${userId}`);
      }

      // Actualizar contador de no leídas
      const unreadCount = await this.getUnreadCount(userId);
      socketService.emitUnreadCount(userId, unreadCount);
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
        WHERE role IN ('purchaser', 'director', 'admin') AND is_active = TRUE
      `);

      const title = `Nueva Solicitud: ${request.folio}`;
      const message = `${request.requester_name} ha creado una nueva solicitud de compra del área ${request.area}`;
      const link = `pages/detalle-solicitud.html?id=${requestId}`;

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
        pedido: 'ha sido pedida',
        entregada: 'ha sido entregada',
        cancelada: 'ha sido cancelada'
      };

      const statusTypes = {
        cotizando: 'info',
        autorizada: 'success',
        rechazada: 'danger',
        pedido: 'info',
        entregada: 'success',
        cancelada: 'warning'
      };

      const title = `Solicitud ${request.folio} - ${newStatus.toUpperCase()}`;
      const message = `Tu solicitud ${statusMessages[newStatus] || 'ha cambiado de estado'}`;
      const type = statusTypes[newStatus] || 'info';
      const link = `pages/detalle-solicitud.html?id=${requestId}`;

      // Notificar al solicitante
      await this.createNotification(request.user_id, title, message, type, link);

      // Si es autorizada/rechazada, también notificar a compras
      if (['autorizada', 'rechazada'].includes(newStatus)) {
        const purchasers = await db.allAsync(`
          SELECT id FROM users 
          WHERE role IN ('purchaser', 'admin') AND is_active = TRUE
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
      const link = `pages/detalle-orden.html?id=${orderId}`;

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
        query += ' AND is_read = FALSE';
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
        'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
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
        'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
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
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
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
         WHERE created_at < datetime('now', '-30 days') AND is_read = TRUE`
      );
      console.log('✅ Notificaciones antiguas limpiadas');
    } catch (error) {
      console.error('Error limpiando notificaciones antiguas:', error);
    }
  }

  // Notificar cuando se selecciona una cotización ganadora
  async notifyQuotationSelected(requestId, quotationId) {
    try {
      // Obtener datos de la solicitud y cotización
      const data = await db.getAsync(`
        SELECT
          r.folio as request_folio,
          r.user_id as requester_id,
          q.total_amount,
          s.name as supplier_name,
          u.name as requester_name
        FROM requests r
        JOIN quotations q ON q.id = ?
        JOIN suppliers s ON q.supplier_id = s.id
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `, [quotationId, requestId]);

      if (!data) return;

      // Notificar a directores para aprobación
      const directors = await db.allAsync(`
        SELECT id, name, email
        FROM users
        WHERE role IN ('director', 'admin') AND is_active = TRUE
      `);

      const title = `Cotización Lista para Aprobación: ${data.request_folio}`;
      const message = `El equipo de compras ha seleccionado la cotización de ${data.supplier_name} por ${this.formatCurrency(data.total_amount)}. Requiere tu aprobación.`;
      const link = `pages/aprobacion-cotizaciones.html`;

      for (const director of directors) {
        await this.createNotification(director.id, title, message, 'warning', link);
      }

      console.log(`✅ Notificado a ${directors.length} directores sobre cotización seleccionada`);

    } catch (error) {
      console.error('Error notificando cotización seleccionada:', error);
    }
  }

  // Notificar cuando el director aprueba una cotización
  async notifyQuotationApproved(requestId) {
    try {
      // Obtener datos de la solicitud
      const request = await db.getAsync(`
        SELECT
          r.folio,
          r.user_id as requester_id,
          u.name as requester_name
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `, [requestId]);

      if (!request) return;

      // Notificar a compras
      const purchasers = await db.allAsync(`
        SELECT id, name, email
        FROM users
        WHERE role IN ('purchaser', 'admin') AND is_active = TRUE
      `);

      const title = `Cotización Aprobada: ${request.folio}`;
      const message = `El director ha aprobado la cotización. Puedes proceder a crear la orden de compra.`;
      const link = `pages/detalle-solicitud.html?id=${requestId}`;

      for (const purchaser of purchasers) {
        await this.createNotification(purchaser.id, title, message, 'success', link);
      }

      // También notificar al solicitante
      await this.createNotification(
        request.requester_id,
        `Solicitud Autorizada: ${request.folio}`,
        'Tu solicitud ha sido autorizada por el director y está en proceso de compra.',
        'success',
        `pages/detalle-solicitud.html?id=${requestId}`
      );

      console.log(`✅ Notificado sobre aprobación de ${request.folio}`);

    } catch (error) {
      console.error('Error notificando aprobación:', error);
    }
  }

  // Notificar cuando el director rechaza una cotización
  async notifyQuotationRejected(requestId, reason) {
    try {
      // Obtener datos de la solicitud
      const request = await db.getAsync(`
        SELECT
          r.folio,
          r.user_id as requester_id,
          u.name as requester_name
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `, [requestId]);

      if (!request) return;

      // Notificar a compras
      const purchasers = await db.allAsync(`
        SELECT id, name, email
        FROM users
        WHERE role IN ('purchaser', 'admin') AND is_active = TRUE
      `);

      const title = `Cotización Rechazada: ${request.folio}`;
      const message = `El director ha rechazado la cotización seleccionada. Motivo: ${reason}`;
      const link = `pages/detalle-solicitud.html?id=${requestId}`;

      for (const purchaser of purchasers) {
        await this.createNotification(purchaser.id, title, message, 'error', link);
      }

      console.log(`✅ Notificado sobre rechazo de ${request.folio}`);

    } catch (error) {
      console.error('Error notificando rechazo:', error);
    }
  }

  // Notificar cuando se crea una nueva cotización
  async notifyNewQuotation(quotationId) {
    try {
      const quotation = await db.getAsync(`
        SELECT
          q.*,
          s.name as supplier_name,
          r.folio as request_folio,
          r.user_id as requester_id,
          u.name as requester_name
        FROM quotations q
        JOIN suppliers s ON q.supplier_id = s.id
        JOIN requests r ON q.request_id = r.id
        JOIN users u ON r.user_id = u.id
        WHERE q.id = ?
      `, [quotationId]);

      if (!quotation) return;

      // Notificar al solicitante
      const title = `Nueva Cotización: ${quotation.request_folio}`;
      const message = `Se ha registrado una cotización de ${quotation.supplier_name} por ${this.formatCurrency(quotation.total_amount)} para tu solicitud.`;
      const link = `pages/detalle-solicitud.html?id=${quotation.request_id}`;

      await this.createNotification(
        quotation.requester_id,
        title,
        message,
        'info',
        link
      );

      // También notificar a directores (para que estén al tanto del proceso)
      const directors = await db.allAsync(`
        SELECT id FROM users
        WHERE role IN ('director', 'admin') AND is_active = TRUE
      `);

      for (const director of directors) {
        await this.createNotification(
          director.id,
          title,
          `Se ha registrado una cotización de ${quotation.supplier_name} por ${this.formatCurrency(quotation.total_amount)} para la solicitud ${quotation.request_folio}.`,
          'info',
          link
        );
      }

      console.log(`✅ Notificado sobre nueva cotización ${quotation.quotation_number}`);

    } catch (error) {
      console.error('Error notificando nueva cotización:', error);
    }
  }

  // Notificar cuando cambia el estado de una orden de compra
  async notifyOrderStatusChange(orderId, newStatus) {
    try {
      const order = await db.getAsync(`
        SELECT
          po.*,
          r.folio as request_folio,
          r.user_id as requester_id,
          u.name as requester_name,
          s.name as supplier_name
        FROM purchase_orders po
        JOIN requests r ON po.request_id = r.id
        JOIN users u ON r.user_id = u.id
        JOIN suppliers s ON po.supplier_id = s.id
        WHERE po.id = ?
      `, [orderId]);

      if (!order) return;

      const statusMessages = {
        emitida: 'ha sido emitida',
        en_transito: 'está en tránsito',
        recibida: 'ha sido recibida',
        cancelada: 'ha sido cancelada'
      };

      const statusTypes = {
        emitida: 'info',
        en_transito: 'info',
        recibida: 'success',
        cancelada: 'warning'
      };

      const title = `Orden de Compra ${order.folio} - ${newStatus.toUpperCase()}`;
      const message = `La orden de compra para tu solicitud ${order.request_folio} ${statusMessages[newStatus] || 'ha cambiado de estado'}`;
      const type = statusTypes[newStatus] || 'info';
      // Enviar al solicitante al detalle de su solicitud, no a detalle-orden
      const link = `pages/detalle-solicitud.html?id=${order.request_id}`;

      // Notificar al solicitante
      await this.createNotification(order.requester_id, title, message, type, link);

      // Si es recibida o cancelada, también notificar a compras
      if (['recibida', 'cancelada'].includes(newStatus)) {
        const purchasers = await db.allAsync(`
          SELECT id FROM users
          WHERE role IN ('purchaser', 'admin') AND is_active = TRUE
        `);

        for (const purchaser of purchasers) {
          await this.createNotification(
            purchaser.id,
            title,
            `La orden ${order.folio} de ${order.requester_name} ${statusMessages[newStatus]}`,
            type,
            link
          );
        }
      }

      console.log(`✅ Notificado cambio de estado de orden ${order.folio} a ${newStatus}`);

    } catch (error) {
      console.error('Error notificando cambio de estado de orden:', error);
    }
  }

  // Notificaciones para No Requerimientos

  // Notificar creación de formato de no requerimiento (a directores/admin)
  async notifyNoRequirementCreated(noRequirementId) {
    try {
      const noReq = await db.getAsync(`
        SELECT nr.*, u.name as created_by_name, u.email as created_by_email
        FROM no_requirements nr
        JOIN users u ON nr.user_id = u.id
        WHERE nr.id = ?
      `, [noRequirementId]);

      if (!noReq) return;

      // Obtener directores y admins
      const approvers = await db.allAsync(`
        SELECT id FROM users
        WHERE role IN ('director', 'admin')
      `);

      const title = `Nuevo Formato de No Requerimiento: ${noReq.area}`;
      const weekStart = new Date(noReq.week_start).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      const weekEnd = new Date(noReq.week_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      const message = `${noReq.created_by_name} del área de ${noReq.area} ha declarado no requerimiento para la semana del ${weekStart} al ${weekEnd}. Requiere aprobación.`;
      const link = `pages/no-requerimientos.html`;

      for (const approver of approvers) {
        await this.createNotification(approver.id, title, message, 'warning', link);
      }

      console.log(`✅ Notificado a ${approvers.length} aprobadores sobre nuevo formato de no requerimiento`);
    } catch (error) {
      console.error('Error notificando creación de no requerimiento:', error);
    }
  }

  // Notificar aprobación de formato de no requerimiento (al creador)
  async notifyNoRequirementApproved(noRequirementId) {
    try {
      const noReq = await db.getAsync(`
        SELECT nr.*, u.name as created_by_name, approver.name as approved_by_name
        FROM no_requirements nr
        JOIN users u ON nr.user_id = u.id
        LEFT JOIN users approver ON nr.approved_by = approver.id
        WHERE nr.id = ?
      `, [noRequirementId]);

      if (!noReq) return;

      const title = `Formato de No Requerimiento Aprobado`;
      const weekStart = new Date(noReq.week_start).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      const weekEnd = new Date(noReq.week_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      const message = `Tu formato de no requerimiento del área ${noReq.area} para la semana del ${weekStart} al ${weekEnd} ha sido aprobado por ${noReq.approved_by_name}. Ya puedes descargar el PDF firmado.`;
      const link = `pages/no-requerimientos.html`;

      await this.createNotification(noReq.user_id, title, message, 'success', link);

      console.log(`✅ Notificado a ${noReq.created_by_name} sobre aprobación de formato`);
    } catch (error) {
      console.error('Error notificando aprobación de no requerimiento:', error);
    }
  }

  // Notificar rechazo de formato de no requerimiento (al creador)
  async notifyNoRequirementRejected(noRequirementId) {
    try {
      const noReq = await db.getAsync(`
        SELECT nr.*, u.name as created_by_name, approver.name as rejected_by_name
        FROM no_requirements nr
        JOIN users u ON nr.user_id = u.id
        LEFT JOIN users approver ON nr.approved_by = approver.id
        WHERE nr.id = ?
      `, [noRequirementId]);

      if (!noReq) return;

      const title = `Formato de No Requerimiento Rechazado`;
      const weekStart = new Date(noReq.week_start).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      const weekEnd = new Date(noReq.week_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      const message = `Tu formato de no requerimiento del área ${noReq.area} para la semana del ${weekStart} al ${weekEnd} ha sido rechazado por ${noReq.rejected_by_name}. Motivo: ${noReq.rejection_reason}`;
      const link = `pages/no-requerimientos.html`;

      await this.createNotification(noReq.user_id, title, message, 'error', link);

      console.log(`✅ Notificado a ${noReq.created_by_name} sobre rechazo de formato`);
    } catch (error) {
      console.error('Error notificando rechazo de no requerimiento:', error);
    }
  }

  // Helper para formatear moneda
  formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }
}

module.exports = new NotificationService();
