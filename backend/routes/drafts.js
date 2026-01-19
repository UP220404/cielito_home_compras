const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { apiResponse, generateRequestFolio, formatDateForDB } = require('../utils/helpers');
const logger = require('../utils/logger');

// GET /api/drafts - Obtener borradores del usuario
router.get('/',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;

      const drafts = await db.allAsync(`
        SELECT
          r.*,
          COUNT(ri.id) as items_count
        FROM requests r
        LEFT JOIN request_items ri ON r.id = ri.request_id
        WHERE r.user_id = ?
          AND r.is_draft = TRUE
        GROUP BY r.id
        ORDER BY r.updated_at DESC
      `, [user.id]);

      res.json(apiResponse(true, drafts));

    } catch (error) {
      logger.error('Error en GET /drafts: %o', error);
      next(error);
    }
  }
);

// GET /api/drafts/:id - Obtener un borrador específico
router.get('/:id',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Buscar borrador O solicitud programada (ambos son editables)
      const draft = await db.getAsync(`
        SELECT * FROM requests
        WHERE id = ? AND user_id = ? AND (is_draft = TRUE OR status = 'programada')
      `, [id, user.id]);

      if (!draft) {
        return res.status(404).json(apiResponse(false, null, 'Borrador o solicitud programada no encontrada'));
      }

      // Obtener items del borrador
      const items = await db.allAsync(`
        SELECT * FROM request_items WHERE request_id = ?
      `, [id]);

      // Combinar draft con sus items
      const draftWithItems = {
        ...draft,
        items
      };

      res.json(apiResponse(true, draftWithItems));

    } catch (error) {
      logger.error('Error en GET /drafts/:id: %o', error);
      next(error);
    }
  }
);

// POST /api/drafts - Guardar borrador
router.post('/',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;
      const { justification, urgency, priority, delivery_date, items, scheduled_for } = req.body;

      // Generar folio temporal
      const folio = await generateRequestFolio();

      // Guardar datos como JSON en draft_data
      const draftData = JSON.stringify({
        justification,
        urgency,
        priority,
        delivery_date,
        items,
        scheduled_for
      });

      // Determinar el status: si tiene scheduled_for es 'programada', sino 'borrador'
      const status = scheduled_for ? 'programada' : 'borrador';

      // Insertar borrador con fecha en zona horaria de México
      const currentDate = formatDateForDB(new Date());
      const result = await db.runAsync(`
        INSERT INTO requests (
          folio,
          user_id,
          area,
          request_date,
          justification,
          urgency,
          priority,
          delivery_date,
          status,
          is_draft,
          draft_data,
          scheduled_for,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        folio,
        user.id,
        user.area,
        currentDate,
        justification || '',
        urgency || 'media',
        priority || 'normal',
        delivery_date || null,
        status,
        draftData,
        scheduled_for || null
      ]);

      const draftId = result.id;

      if (!draftId) {
        logger.error('Error: INSERT no retornó ID. Result: %o', result);
        throw new Error('No se pudo obtener el ID del borrador creado');
      }

      // Guardar items si existen
      if (items && items.length > 0) {
        for (const item of items) {
          await db.runAsync(`
            INSERT INTO request_items (
              request_id,
              material,
              specifications,
              approximate_cost,
              quantity,
              unit,
              in_stock,
              location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            draftId,
            item.material || item.description,
            item.specifications || '',
            item.approximate_cost || 0,
            item.quantity,
            item.unit || 'unidad',
            item.in_stock || 0,
            item.location || ''
          ]);
        }
      }

      res.json(apiResponse(true, { id: draftId, folio }, 'Borrador guardado'));

    } catch (error) {
      logger.error('Error en POST /drafts: %o', error);
      next(error);
    }
  }
);

// PUT /api/drafts/:id - Actualizar borrador
router.put('/:id',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { justification, urgency, priority, delivery_date, items, scheduled_for } = req.body;

      // Verificar que el borrador pertenece al usuario
      const draft = await db.getAsync(`
        SELECT * FROM requests WHERE id = ? AND user_id = ? AND is_draft = TRUE
      `, [id, user.id]);

      if (!draft) {
        return res.status(404).json(apiResponse(false, null, 'Borrador no encontrado'));
      }

      // Actualizar datos
      const draftData = JSON.stringify({
        justification,
        urgency,
        priority,
        delivery_date,
        items,
        scheduled_for
      });

      // Determinar el status: si tiene scheduled_for es 'programada', sino 'borrador'
      const status = scheduled_for ? 'programada' : 'borrador';

      await db.runAsync(`
        UPDATE requests SET
          justification = ?,
          urgency = ?,
          priority = ?,
          delivery_date = ?,
          status = ?,
          draft_data = ?,
          scheduled_for = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        justification || draft.justification,
        urgency || draft.urgency,
        priority || draft.priority,
        delivery_date || draft.delivery_date,
        status,
        draftData,
        scheduled_for || null,
        id
      ]);

      // Eliminar items anteriores
      await db.runAsync('DELETE FROM request_items WHERE request_id = ?', [id]);

      // Insertar nuevos items
      if (items && items.length > 0) {
        for (const item of items) {
          await db.runAsync(`
            INSERT INTO request_items (
              request_id,
              material,
              specifications,
              approximate_cost,
              quantity,
              unit,
              in_stock,
              location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            item.material || item.description,
            item.specifications || '',
            item.approximate_cost || 0,
            item.quantity,
            item.unit || 'unidad',
            item.in_stock || 0,
            item.location || ''
          ]);
        }
      }

      res.json(apiResponse(true, { id }, 'Borrador actualizado'));

    } catch (error) {
      logger.error('Error en PUT /drafts/:id: %o', error);
      next(error);
    }
  }
);

// DELETE /api/drafts/:id - Eliminar borrador
router.delete('/:id',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Verificar que el borrador pertenece al usuario
      const draft = await db.getAsync(`
        SELECT * FROM requests WHERE id = ? AND user_id = ? AND is_draft = TRUE
      `, [id, user.id]);

      if (!draft) {
        return res.status(404).json(apiResponse(false, null, 'Borrador no encontrado'));
      }

      // Eliminar items
      await db.runAsync('DELETE FROM request_items WHERE request_id = ?', [id]);

      // Eliminar borrador
      await db.runAsync('DELETE FROM requests WHERE id = ?', [id]);

      res.json(apiResponse(true, null, 'Borrador eliminado'));

    } catch (error) {
      logger.error('Error en DELETE /drafts/:id: %o', error);
      next(error);
    }
  }
);

// POST /api/drafts/:id/submit - Convertir borrador en solicitud real
router.post('/:id/submit',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Verificar que el borrador pertenece al usuario
      const draft = await db.getAsync(`
        SELECT * FROM requests WHERE id = ? AND user_id = ? AND is_draft = TRUE
      `, [id, user.id]);

      if (!draft) {
        return res.status(404).json(apiResponse(false, null, 'Borrador no encontrado'));
      }

      // Verificar que tiene items
      const items = await db.allAsync(`
        SELECT * FROM request_items WHERE request_id = ?
      `, [id]);

      if (items.length === 0) {
        return res.status(400).json(apiResponse(false, null, 'El borrador debe tener al menos un artículo'));
      }

      // Convertir a solicitud real
      await db.runAsync(`
        UPDATE requests SET
          is_draft = FALSE,
          status = 'pendiente',
          draft_data = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [id]);

      // Enviar notificación al director
      const notificationService = require('../services/notificationService');
      await notificationService.notifyDirector(draft, user);

      res.json(apiResponse(true, { id }, 'Solicitud enviada correctamente'));

    } catch (error) {
      logger.error('Error en POST /drafts/:id/submit: %o', error);
      next(error);
    }
  }
);

module.exports = router;

