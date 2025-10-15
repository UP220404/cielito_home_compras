const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateQuotation, validateId } = require('../utils/validators');
const { apiResponse, getClientIP } = require('../utils/helpers');
const notificationService = require('../services/notificationService');

// GET /api/quotations/request/:requestId - Obtener cotizaciones de una solicitud
router.get('/request/:requestId', authMiddleware, validateId, async (req, res, next) => {
  try {
    const requestId = req.params.requestId;

    // Verificar que la solicitud existe
    const request = await db.getAsync('SELECT user_id FROM requests WHERE id = ?', [requestId]);
    if (!request) {
      return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
    }

    // Verificar permisos (propietario o roles elevados)
    if (req.user.role === 'requester' && request.user_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    const quotations = await db.allAsync(`
      SELECT 
        q.*,
        s.name as supplier_name,
        s.contact_name,
        s.phone,
        s.email as supplier_email,
        u.name as quoted_by_name
      FROM quotations q
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN users u ON q.quoted_by = u.id
      WHERE q.request_id = ?
      ORDER BY q.total_amount ASC
    `, [requestId]);

    // Obtener items de cada cotización
    for (let quotation of quotations) {
      quotation.items = await db.allAsync(`
        SELECT 
          qi.*,
          ri.material,
          ri.specifications as original_specifications,
          ri.unit
        FROM quotation_items qi
        JOIN request_items ri ON qi.request_item_id = ri.id
        WHERE qi.quotation_id = ?
        ORDER BY qi.id ASC
      `, [quotation.id]);
    }

    res.json(apiResponse(true, quotations));

  } catch (error) {
    next(error);
  }
});

// POST /api/quotations - Crear nueva cotización
router.post('/', authMiddleware, requireRole('purchaser', 'admin'), validateQuotation, async (req, res, next) => {
  try {
    const {
      request_id,
      supplier_id,
      quotation_number,
      total_amount,
      delivery_days,
      payment_terms,
      validity_days,
      notes,
      items
    } = req.body;

    // Verificar que la solicitud existe y está en estado cotizable
    const request = await db.getAsync(
      'SELECT status FROM requests WHERE id = ?',
      [request_id]
    );

    if (!request) {
      return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
    }

    if (!['pendiente', 'cotizando'].includes(request.status)) {
      return res.status(400).json(apiResponse(false, null, null, 'La solicitud no está disponible para cotización'));
    }

    // Verificar que el proveedor existe
    const supplier = await db.getAsync(
      'SELECT id FROM suppliers WHERE id = ? AND is_active = 1',
      [supplier_id]
    );

    if (!supplier) {
      return res.status(404).json(apiResponse(false, null, null, 'Proveedor no encontrado o inactivo'));
    }

    // Insertar cotización
    const quotationResult = await db.runAsync(`
      INSERT INTO quotations (
        request_id, supplier_id, quotation_number, total_amount,
        delivery_days, payment_terms, validity_days, notes, quoted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      request_id, supplier_id, quotation_number, total_amount,
      delivery_days, payment_terms, validity_days || 30, notes, req.user.id
    ]);

    const quotationId = quotationResult.id;

    // Insertar items de la cotización
    for (const item of items) {
      const subtotal = item.quantity * item.unit_price;

      await db.runAsync(`
        INSERT INTO quotation_items (
          quotation_id, request_item_id, unit_price, subtotal, notes
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        quotationId, item.request_item_id,
        item.unit_price, subtotal, item.notes || null
      ]);
    }

    // Actualizar estado de la solicitud a 'cotizando' si es la primera cotización
    const quotationCount = await db.getAsync(
      'SELECT COUNT(*) as count FROM quotations WHERE request_id = ?',
      [request_id]
    );

    if (quotationCount.count === 1 && request.status === 'pendiente') {
      await db.runAsync(
        'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['cotizando', request_id]
      );
    }

    // Log de auditoría
    await db.auditLog('quotations', quotationId, 'create', null, {
      request_id, supplier_id, total_amount
    }, req.user.id, getClientIP(req));

    res.status(201).json(apiResponse(true, { id: quotationId }, 'Cotización creada exitosamente'));

  } catch (error) {
    next(error);
  }
});

// PATCH /api/quotations/:id/select - Seleccionar cotización ganadora
router.patch('/:id/select', authMiddleware, requireRole('director', 'admin'), validateId, async (req, res, next) => {
  try {
    const quotationId = req.params.id;

    // Obtener cotización
    const quotation = await db.getAsync(`
      SELECT q.*, r.status as request_status
      FROM quotations q
      JOIN requests r ON q.request_id = r.id
      WHERE q.id = ?
    `, [quotationId]);

    if (!quotation) {
      return res.status(404).json(apiResponse(false, null, null, 'Cotización no encontrada'));
    }

    if (quotation.request_status !== 'autorizada') {
      return res.status(400).json(apiResponse(false, null, null, 'La solicitud debe estar autorizada para seleccionar cotización'));
    }

    // Desmarcar otras cotizaciones de la misma solicitud
    await db.runAsync(
      'UPDATE quotations SET is_selected = 0 WHERE request_id = ?',
      [quotation.request_id]
    );

    // Marcar esta cotización como seleccionada
    await db.runAsync(
      'UPDATE quotations SET is_selected = 1 WHERE id = ?',
      [quotationId]
    );

    // Log de auditoría
    await db.auditLog('quotations', quotationId, 'update', 
      { is_selected: 0 }, 
      { is_selected: 1 }, 
      req.user.id, 
      getClientIP(req)
    );

    res.json(apiResponse(true, null, 'Cotización seleccionada exitosamente'));

  } catch (error) {
    next(error);
  }
});

// PUT /api/quotations/:id - Actualizar cotización
router.put('/:id', authMiddleware, requireRole('purchaser', 'admin'), validateId, async (req, res, next) => {
  try {
    const quotationId = req.params.id;
    const {
      quotation_number,
      total_amount,
      delivery_days,
      payment_terms,
      validity_days,
      notes,
      items
    } = req.body;

    // Verificar que la cotización existe y no está seleccionada
    const quotation = await db.getAsync(
      'SELECT is_selected FROM quotations WHERE id = ?',
      [quotationId]
    );

    if (!quotation) {
      return res.status(404).json(apiResponse(false, null, null, 'Cotización no encontrada'));
    }

    if (quotation.is_selected) {
      return res.status(400).json(apiResponse(false, null, null, 'No se puede modificar una cotización seleccionada'));
    }

    // Actualizar cotización
    await db.runAsync(`
      UPDATE quotations 
      SET quotation_number = ?, total_amount = ?, delivery_days = ?,
          payment_terms = ?, validity_days = ?, notes = ?,
          quoted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      quotation_number, total_amount, delivery_days,
      payment_terms, validity_days || 30, notes, quotationId
    ]);

    // Eliminar items anteriores
    await db.runAsync('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);

    // Insertar nuevos items
    if (items && items.length > 0) {
      for (const item of items) {
        const subtotal = item.quantity * item.unit_price;

        await db.runAsync(`
          INSERT INTO quotation_items (
            quotation_id, request_item_id, unit_price, subtotal, notes
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          quotationId, item.request_item_id,
          item.unit_price, subtotal, item.notes || null
        ]);
      }
    }

    // Log de auditoría
    await db.auditLog('quotations', quotationId, 'update', null, {
      total_amount, delivery_days, updated_by: req.user.id
    }, req.user.id, getClientIP(req));

    res.json(apiResponse(true, null, 'Cotización actualizada exitosamente'));

  } catch (error) {
    next(error);
  }
});

// DELETE /api/quotations/:id - Eliminar cotización
router.delete('/:id', authMiddleware, requireRole('purchaser', 'admin'), validateId, async (req, res, next) => {
  try {
    const quotationId = req.params.id;

    // Verificar que la cotización existe y no está seleccionada
    const quotation = await db.getAsync(
      'SELECT is_selected FROM quotations WHERE id = ?',
      [quotationId]
    );

    if (!quotation) {
      return res.status(404).json(apiResponse(false, null, null, 'Cotización no encontrada'));
    }

    if (quotation.is_selected) {
      return res.status(400).json(apiResponse(false, null, null, 'No se puede eliminar una cotización seleccionada'));
    }

    // Eliminar cotización (cascade eliminará los items)
    await db.runAsync('DELETE FROM quotations WHERE id = ?', [quotationId]);

    // Log de auditoría
    await db.auditLog('quotations', quotationId, 'delete', quotation, null, req.user.id, getClientIP(req));

    res.json(apiResponse(true, null, 'Cotización eliminada exitosamente'));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
