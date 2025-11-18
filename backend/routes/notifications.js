const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { validateId, validatePagination } = require('../utils/validators');
const { apiResponse, paginate } = require('../utils/helpers');
const notificationService = require('../services/notificationService');

// GET /api/notifications - Obtener notificaciones del usuario
router.get('/', authMiddleware, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread_only = 'false' } = req.query;
    const { limit: limitNum, offset } = paginate(parseInt(page), parseInt(limit));
    
    let whereClause = 'WHERE user_id = ?';
    let params = [req.user.id];

    if (unread_only === 'true') {
      whereClause += ' AND is_read = FALSE';
    }

    const notifications = await db.allAsync(`
      SELECT * FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    // Contar total para paginación
    const countQuery = `SELECT COUNT(*) as total FROM notifications ${whereClause}`;
    const { total } = await db.getAsync(countQuery, params);

    // Contar no leídas
    const unreadCount = await notificationService.getUnreadCount(req.user.id);

    res.json(apiResponse(true, {
      notifications,
      unread_count: unreadCount,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/unread-count - Contador de no leídas
router.get('/unread-count', authMiddleware, async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json(apiResponse(true, { count }));

  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/:id/read - Marcar notificación como leída
router.patch('/:id/read', authMiddleware, validateId, async (req, res, next) => {
  try {
    const notificationId = req.params.id;

    // Verificar que la notificación pertenece al usuario
    const notification = await db.getAsync(
      'SELECT user_id FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (!notification) {
      return res.status(404).json(apiResponse(false, null, null, 'Notificación no encontrada'));
    }

    if (notification.user_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    await notificationService.markAsRead(notificationId, req.user.id);

    res.json(apiResponse(true, null, 'Notificación marcada como leída'));

  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/mark-all-read - Marcar todas como leídas
router.patch('/mark-all-read', authMiddleware, async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);

    res.json(apiResponse(true, null, 'Todas las notificaciones marcadas como leídas'));

  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications/:id - Eliminar notificación
router.delete('/:id', authMiddleware, validateId, async (req, res, next) => {
  try {
    const notificationId = req.params.id;

    // Verificar que la notificación pertenece al usuario
    const notification = await db.getAsync(
      'SELECT user_id FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (!notification) {
      return res.status(404).json(apiResponse(false, null, null, 'Notificación no encontrada'));
    }

    if (notification.user_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    await db.runAsync('DELETE FROM notifications WHERE id = ?', [notificationId]);

    res.json(apiResponse(true, null, 'Notificación eliminada'));

  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/test - Crear notificación de prueba (solo desarrollo)
router.post('/test', authMiddleware, async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json(apiResponse(false, null, null, 'No disponible en producción'));
    }

    const { title = 'Notificación de Prueba', message = 'Esta es una notificación de prueba', type = 'info' } = req.body;

    await notificationService.createNotification(
      req.user.id,
      title,
      message,
      type
    );

    res.json(apiResponse(true, null, 'Notificación de prueba creada'));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
