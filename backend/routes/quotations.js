const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateQuotation, validateId } = require('../utils/validators');
const { apiResponse, getClientIP, paginate } = require('../utils/helpers');
const notificationService = require('../services/notificationService');

// GET /api/quotations - Obtener todas las cotizaciones (para purchaser/admin)
router.get('/', authMiddleware, requireRole('purchaser', 'director', 'admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, supplier_id } = req.query;
    const { limit: pageLimit, offset } = paginate(page, limit);

    // Construir filtros
    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND q.status = ?';
      params.push(status);
    }

    if (supplier_id) {
      whereClause += ' AND q.supplier_id = ?';
      params.push(supplier_id);
    }

    // Obtener cotizaciones
    const quotations = await db.allAsync(`
      SELECT
        q.*,
        s.name as supplier_name,
        s.contact_name,
        s.phone,
        s.email as supplier_email,
        r.folio as request_folio,
        u.name as quoted_by_name
      FROM quotations q
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN requests r ON q.request_id = r.id
      JOIN users u ON q.quoted_by = u.id
      WHERE ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageLimit, offset]);

    // Contar total
    const total = await db.getAsync(`
      SELECT COUNT(*) as count
      FROM quotations q
      WHERE ${whereClause}
    `, params);

    res.json(apiResponse(true, quotations, null, null, {
      total: total.count,
      page: parseInt(page),
      limit: pageLimit,
      pages: Math.ceil(total.count / pageLimit)
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/quotations/:id - Obtener una cotización específica
router.get('/:id', authMiddleware, validateId, async (req, res, next) => {
  try {
    const quotationId = req.params.id;

    const quotation = await db.getAsync(`
      SELECT
        q.*,
        s.name as supplier_name,
        s.contact_name,
        s.phone,
        s.email as supplier_email,
        r.folio as request_folio,
        r.user_id as request_user_id,
        u.name as quoted_by_name
      FROM quotations q
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN requests r ON q.request_id = r.id
      JOIN users u ON q.quoted_by = u.id
      WHERE q.id = ?
    `, [quotationId]);

    if (!quotation) {
      return res.status(404).json(apiResponse(false, null, null, 'Cotización no encontrada'));
    }

    // Verificar permisos (propietario de la solicitud o roles elevados)
    if (req.user.role === 'requester' && quotation.request_user_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    // Obtener items de la cotización
    quotation.items = await db.allAsync(`
      SELECT * FROM quotation_items WHERE quotation_id = ?
    `, [quotationId]);

    res.json(apiResponse(true, quotation));

  } catch (error) {
    next(error);
  }
});

// GET /api/quotations/request/:requestId - Obtener cotizaciones de una solicitud
router.get('/request/:requestId', authMiddleware, async (req, res, next) => {
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

// GET /api/quotations/request/:requestId/comparison - Obtener cotizaciones agrupadas por material
router.get('/request/:requestId/comparison', authMiddleware, requireRole('purchaser', 'director', 'admin'), async (req, res, next) => {
  try {
    const requestId = req.params.requestId;

    // Verificar que la solicitud existe
    const request = await db.getAsync('SELECT * FROM requests WHERE id = ?', [requestId]);
    if (!request) {
      return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
    }

    // Obtener todos los materiales de la solicitud
    const materials = await db.allAsync(`
      SELECT id, material, specifications, quantity, unit
      FROM request_items
      WHERE request_id = ?
      ORDER BY id ASC
    `, [requestId]);

    // Para cada material, obtener todas las cotizaciones de diferentes proveedores
    const comparison = [];

    for (const material of materials) {
      const quotationsForMaterial = await db.allAsync(`
        SELECT
          qi.id as quotation_item_id,
          qi.quotation_id,
          qi.unit_price,
          qi.subtotal,
          qi.notes,
          qi.has_invoice,
          qi.delivery_date,
          q.is_selected,
          q.quotation_number,
          q.supplier_id,
          q.payment_terms,
          q.validity_days,
          s.name as supplier_name,
          s.category as supplier_category,
          u.name as quoted_by_name
        FROM quotation_items qi
        JOIN quotations q ON qi.quotation_id = q.id
        JOIN suppliers s ON q.supplier_id = s.id
        JOIN users u ON q.quoted_by = u.id
        WHERE qi.request_item_id = ?
        ORDER BY qi.unit_price ASC
      `, [material.id]);

      comparison.push({
        material_id: material.id,
        material: material.material,
        specifications: material.specifications,
        quantity: material.quantity,
        unit: material.unit,
        quotations: quotationsForMaterial
      });
    }

    res.json(apiResponse(true, {
      request_folio: request.folio,
      request_status: request.status,
      materials: comparison
    }));

  } catch (error) {
    next(error);
  }
});

// POST /api/quotations - Crear nueva cotización
router.post('/', authMiddleware, requireRole('purchaser', 'admin'), validateQuotation, async (req, res, next) => {
  try {
    console.log('📝 Creating quotation with data:', JSON.stringify(req.body, null, 2));

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
      'SELECT id FROM suppliers WHERE id = ? AND is_active = true',
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
      RETURNING id
    `, [
      request_id, supplier_id, quotation_number, total_amount,
      delivery_days, payment_terms, validity_days || 30, notes, req.user.id
    ]);

    const quotationId = quotationResult.id;
    console.log('✅ Quotation created with ID:', quotationId);

    // Insertar items de la cotización (si se proporcionaron)
    if (items && items.length > 0) {
      console.log('📦 Inserting', items.length, 'items');
      for (const item of items) {
        const subtotal = item.quantity * item.unit_price;
        console.log('  - Item:', { request_item_id: item.request_item_id, quantity: item.quantity, unit_price: item.unit_price, subtotal });

        await db.runAsync(`
          INSERT INTO quotation_items (
            quotation_id, request_item_id, unit_price, subtotal, notes, has_invoice, delivery_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          quotationId, item.request_item_id,
          item.unit_price, subtotal, item.notes || null,
          item.has_invoice || 0, item.delivery_date || null
        ]);
      }
      console.log('✅ All items inserted');
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

    // Notificar a los interesados
    await notificationService.notifyNewQuotation(quotationId);

    res.status(201).json(apiResponse(true, { id: quotationId }, 'Cotización creada exitosamente'));

  } catch (error) {
    next(error);
  }
});

// PATCH /api/quotations/:id/select - Seleccionar cotización ganadora
router.patch('/:id/select', authMiddleware, requireRole('purchaser', 'director', 'admin'), validateId, async (req, res, next) => {
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
      'UPDATE quotations SET is_selected = FALSE WHERE request_id = ?',
      [quotation.request_id]
    );

    // Marcar esta cotización como seleccionada
    await db.runAsync(
      'UPDATE quotations SET is_selected = TRUE WHERE id = ?',
      [quotationId]
    );

    // Log de auditoría
    await db.auditLog('quotations', quotationId, 'update',
      { is_selected: 0 },
      { is_selected: 1 },
      req.user.id,
      getClientIP(req)
    );

    // Notificar a directores para que aprueben la cotización seleccionada
    await notificationService.notifyQuotationSelected(quotation.request_id, quotationId);

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
            quotation_id, request_item_id, unit_price, subtotal, notes, has_invoice, delivery_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          quotationId, item.request_item_id,
          item.unit_price, subtotal, item.notes || null,
          item.has_invoice || 0, item.delivery_date || null
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

// POST /api/quotations/items/select - Seleccionar ítems individuales de cotizaciones
router.post('/items/select', authMiddleware, requireRole('purchaser', 'director', 'admin'), async (req, res, next) => {
  try {
    const { request_id, selected_items } = req.body;
    // selected_items es un array de objetos: [{ request_item_id, quotation_item_id }, ...]

    if (!request_id || !selected_items || !Array.isArray(selected_items)) {
      return res.status(400).json(apiResponse(false, null, null, 'Datos inválidos'));
    }

    // Verificar que la solicitud existe y está en estado válido para selección
    const request = await db.getAsync('SELECT status FROM requests WHERE id = ?', [request_id]);
    if (!request) {
      return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
    }

    // Permitir selección en estado "cotizando" o "autorizada"
    if (!['cotizando', 'autorizada'].includes(request.status)) {
      return res.status(400).json(apiResponse(false, null, null, 'La solicitud debe estar en estado cotizando o autorizada'));
    }

    // Desmarcar todos los ítems de todas las cotizaciones de esta solicitud
    await db.runAsync(`
      UPDATE quotation_items
      SET is_selected = FALSE
      WHERE quotation_id IN (
        SELECT id FROM quotations WHERE request_id = ?
      )
    `, [request_id]);

    // Marcar los ítems seleccionados
    for (const item of selected_items) {
      await db.runAsync(
        'UPDATE quotation_items SET is_selected = TRUE WHERE id = ?',
        [item.quotation_item_id]
      );
    }

    // Actualizar is_selected en quotations basado en si todos sus ítems están seleccionados
    const quotations = await db.allAsync(
      'SELECT DISTINCT quotation_id FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE request_id = ?)',
      [request_id]
    );

    for (const quot of quotations) {
      const totalItems = await db.getAsync(
        'SELECT COUNT(*) as count FROM quotation_items WHERE quotation_id = ?',
        [quot.quotation_id]
      );
      const selectedItems = await db.getAsync(
        'SELECT COUNT(*) as count FROM quotation_items WHERE quotation_id = ? AND is_selected = TRUE',
        [quot.quotation_id]
      );

      // Si todos los ítems de una cotización están seleccionados, marcar la cotización como seleccionada
      const isFullySelected = totalItems.count === selectedItems.count && selectedItems.count > 0;
      await db.runAsync(
        'UPDATE quotations SET is_selected = ? WHERE id = ?',
        [isFullySelected ? 1 : 0, quot.quotation_id]
      );
    }

    // Log de auditoría
    await db.auditLog('quotation_items', request_id, 'update', null, {
      selected_items: selected_items.length,
      action: 'select_items'
    }, req.user.id, getClientIP(req));

    res.json(apiResponse(true, { selected_count: selected_items.length }, 'Ítems seleccionados exitosamente'));

  } catch (error) {
    next(error);
  }
});

// GET /api/quotations/request/:requestId/selected-items - Obtener ítems seleccionados
router.get('/request/:requestId/selected-items', authMiddleware, async (req, res, next) => {
  try {
    const requestId = req.params.requestId;

    const selectedItems = await db.allAsync(`
      SELECT
        qi.*,
        q.supplier_id,
        s.name as supplier_name,
        ri.material,
        ri.quantity,
        ri.unit
      FROM quotation_items qi
      JOIN quotations q ON qi.quotation_id = q.id
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN request_items ri ON qi.request_item_id = ri.id
      WHERE q.request_id = ? AND qi.is_selected = TRUE
      ORDER BY qi.request_item_id ASC
    `, [requestId]);

    res.json(apiResponse(true, selectedItems));

  } catch (error) {
    next(error);
  }
});

// DELETE /api/quotations/:id - Eliminar cotización
router.delete('/:id', authMiddleware, requireRole('purchaser', 'admin'), validateId, async (req, res, next) => {
  try {
    const quotationId = req.params.id;

    // Verificar que la cotización existe y obtener datos de la solicitud
    const quotation = await db.getAsync(`
      SELECT q.*, r.status as request_status
      FROM quotations q
      JOIN requests r ON q.request_id = r.id
      WHERE q.id = ?
    `, [quotationId]);

    if (!quotation) {
      return res.status(404).json(apiResponse(false, null, null, 'Cotización no encontrada'));
    }

    // Solo bloquear si la solicitud ya fue autorizada (aprobada por dirección)
    if (quotation.request_status === 'autorizada') {
      return res.status(400).json(apiResponse(false, null, null, 'No se puede eliminar una cotización de una solicitud ya autorizada'));
    }

    // Eliminar cotización (cascade eliminará los items)
    await db.runAsync('DELETE FROM quotations WHERE id = ?', [quotationId]);

    // Verificar si quedan cotizaciones para esta solicitud
    const remainingQuotations = await db.getAsync(
      'SELECT COUNT(*) as count FROM quotations WHERE request_id = ?',
      [quotation.request_id]
    );

    // Si no quedan cotizaciones, cambiar el estado de la solicitud a 'pendiente'
    if (remainingQuotations.count === 0 && quotation.request_status === 'cotizando') {
      await db.runAsync(
        'UPDATE requests SET status = ? WHERE id = ?',
        ['pendiente', quotation.request_id]
      );

      // Log de auditoría para el cambio de estado
      await db.auditLog('requests', quotation.request_id, 'status_change',
        { status: 'cotizando' },
        { status: 'pendiente', reason: 'Se eliminaron todas las cotizaciones' },
        req.user.id,
        getClientIP(req)
      );
    }

    // Log de auditoría
    await db.auditLog('quotations', quotationId, 'delete', quotation, null, req.user.id, getClientIP(req));

    res.json(apiResponse(true, null, 'Cotización eliminada exitosamente'));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
