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
      LEFT JOIN users u ON q.quoted_by = u.id
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

// GET /api/quotations/history - Obtener historial de cotizaciones completadas
// IMPORTANTE: Esta ruta debe estar ANTES de /:id para evitar que "history" sea tratado como un ID
router.get('/history', authMiddleware, requireRole('purchaser', 'director', 'admin'), async (req, res, next) => {
  try {
    // Obtener solicitudes que tienen cotizaciones seleccionadas
    // NOTA: is_selected está en quotations, no en quotation_items
    const quotations = await db.allAsync(`
      SELECT DISTINCT
        r.id as request_id,
        r.folio,
        r.area,
        r.status as request_status,
        r.created_at as request_date,
        (
          SELECT STRING_AGG(DISTINCT s2.name, ', ')
          FROM quotations q2
          JOIN suppliers s2 ON q2.supplier_id = s2.id
          WHERE q2.request_id = r.id AND q2.is_selected = TRUE
        ) as suppliers,
        (
          SELECT COALESCE(SUM(qi3.subtotal), 0)
          FROM quotation_items qi3
          JOIN quotations q3 ON qi3.quotation_id = q3.id
          WHERE q3.request_id = r.id AND q3.is_selected = TRUE
        ) as total_amount,
        (
          SELECT q4.payment_terms
          FROM quotations q4
          WHERE q4.request_id = r.id AND q4.is_selected = TRUE
          LIMIT 1
        ) as payment_terms
      FROM requests r
      WHERE EXISTS (
        SELECT 1 FROM quotations q5
        WHERE q5.request_id = r.id AND q5.is_selected = TRUE
      )
      ORDER BY r.created_at DESC
      LIMIT 100
    `);

    res.json(apiResponse(true, quotations));

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
      LEFT JOIN users u ON q.quoted_by = u.id
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
      LEFT JOIN users u ON q.quoted_by = u.id
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
          q.notes,
          q.delivery_date,
          q.delivery_time,
          q.is_selected,
          q.supplier_id,
          q.payment_terms,
          q.validity_days,
          s.name as supplier_name,
          s.category as supplier_category,
          s.has_invoice as supplier_has_invoice,
          u.name as quoted_by_name
        FROM quotation_items qi
        JOIN quotations q ON qi.quotation_id = q.id
        JOIN suppliers s ON q.supplier_id = s.id
        LEFT JOIN users u ON q.quoted_by = u.id
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
      total_amount,
      delivery_date,
      delivery_time,
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

    // VALIDACIÓN: Verificar si ya existe una cotización de este proveedor para esta solicitud
    const existingQuotation = await db.getAsync(
      'SELECT id FROM quotations WHERE request_id = ? AND supplier_id = ?',
      [request_id, supplier_id]
    );

    if (existingQuotation) {
      return res.status(409).json(apiResponse(
        false,
        null,
        null,
        `Ya existe una cotización del proveedor para esta solicitud. No se permiten duplicados.`
      ));
    }

    // Insertar cotización
    const quotationResult = await db.runAsync(`
      INSERT INTO quotations (
        request_id, supplier_id, total_amount,
        delivery_date, delivery_time, payment_terms, validity_days, notes, quoted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      request_id, supplier_id, total_amount,
      delivery_date || null, delivery_time || null, payment_terms, validity_days || 30, notes, req.user.id
    ]);

    const quotationId = quotationResult.id;
    console.log('✅ Quotation created with ID:', quotationId);

    // Insertar items de la cotización (si se proporcionaron)
    if (items && items.length > 0) {
      console.log('📦 Inserting', items.length, 'items');

      // Columnas opcionales disponibles (deben coincidir con las columnas en quotation_items)
      const OPTIONAL_COLUMNS = ['ubicacion', 'cliente', 'garantia', 'instalacion', 'entrega', 'metodo_pago'];

      for (const item of items) {
        // Obtener información del material desde request_items
        const requestItem = await db.getAsync(
          'SELECT material, quantity, unit FROM request_items WHERE id = ?',
          [item.request_item_id]
        );

        if (!requestItem) {
          console.error('❌ Request item not found:', item.request_item_id);
          continue;
        }

        const quantity = item.quantity || requestItem.quantity;
        const subtotal = quantity * item.unit_price;

        // Construir dinámicamente las columnas y valores para el INSERT
        // quotation_items solo tiene: id, quotation_id, request_item_id, material, specifications, quantity, unit, unit_price, subtotal
        const baseColumns = ['quotation_id', 'request_item_id', 'material', 'specifications', 'quantity', 'unit', 'unit_price', 'subtotal'];
        const baseValues = [
          quotationId, item.request_item_id,
          requestItem.material, item.specifications || null, quantity, requestItem.unit,
          item.unit_price, subtotal
        ];

        // Agregar columnas opcionales si vienen en el item
        const additionalColumns = [];
        const additionalValues = [];

        OPTIONAL_COLUMNS.forEach(col => {
          if (item[col] !== undefined && item[col] !== null && item[col] !== '') {
            additionalColumns.push(col);
            additionalValues.push(item[col]);
          }
        });

        const allColumns = [...baseColumns, ...additionalColumns];
        const allValues = [...baseValues, ...additionalValues];
        const placeholders = allColumns.map(() => '?').join(', ');

        console.log('  - Item:', {
          request_item_id: item.request_item_id,
          material: requestItem.material,
          quantity,
          unit_price: item.unit_price,
          subtotal,
          optional_columns: additionalColumns.length > 0 ? additionalColumns : 'none'
        });

        await db.runAsync(`
          INSERT INTO quotation_items (${allColumns.join(', ')})
          VALUES (${placeholders})
        `, allValues);
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
      total_amount,
      delivery_date,
      delivery_time,
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
      SET total_amount = ?, delivery_date = ?, delivery_time = ?,
          payment_terms = ?, validity_days = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      total_amount, delivery_date || null, delivery_time || null,
      payment_terms, validity_days || 30, notes, quotationId
    ]);

    // Eliminar items anteriores
    await db.runAsync('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);

    // Insertar nuevos items
    if (items && items.length > 0) {
      for (const item of items) {
        // Obtener información del material desde request_items
        const requestItem = await db.getAsync(
          'SELECT material, quantity, unit FROM request_items WHERE id = ?',
          [item.request_item_id]
        );

        if (!requestItem) continue;

        const quantity = item.quantity || requestItem.quantity;
        const subtotal = quantity * item.unit_price;

        await db.runAsync(`
          INSERT INTO quotation_items (
            quotation_id, request_item_id, material, specifications, quantity, unit, unit_price, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          quotationId, item.request_item_id,
          requestItem.material, item.specifications || null, quantity, requestItem.unit,
          item.unit_price, subtotal
        ]);
      }
    }

    // Log de auditoría
    await db.auditLog('quotations', quotationId, 'update', null, {
      total_amount, delivery_date, updated_by: req.user.id
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

    // Permitir selección en estado "pendiente", "cotizando" o "autorizada"
    if (!['pendiente', 'cotizando', 'autorizada'].includes(request.status)) {
      return res.status(400).json(apiResponse(false, null, null, 'La solicitud debe estar en estado pendiente, cotizando o autorizada'));
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
        [isFullySelected, quot.quotation_id]
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

// GET /api/quotations/request/:requestId/selected-items - Obtener ítems de cotizaciones seleccionadas
router.get('/request/:requestId/selected-items', authMiddleware, async (req, res, next) => {
  try {
    const requestId = req.params.requestId;

    // Obtener todos los items individuales que están seleccionados (is_selected en quotation_items)
    // Esto permite seleccionar diferentes proveedores para diferentes materiales
    const selectedItems = await db.allAsync(`
      SELECT
        qi.*,
        q.supplier_id,
        q.is_selected as quotation_is_selected,
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

// DELETE /api/quotations/items/:id - Eliminar un item de cotización
router.delete('/items/:id', authMiddleware, requireRole('purchaser', 'admin'), validateId, async (req, res, next) => {
  try {
    const itemId = req.params.id;

    // Obtener el item y su cotización asociada
    const item = await db.getAsync(`
      SELECT
        qi.*,
        q.request_id,
        r.status as request_status
      FROM quotation_items qi
      JOIN quotations q ON qi.quotation_id = q.id
      JOIN requests r ON q.request_id = r.id
      WHERE qi.id = ?
    `, [itemId]);

    if (!item) {
      return res.status(404).json(apiResponse(false, null, null, 'Item de cotización no encontrado'));
    }

    // Solo bloquear si la solicitud ya fue autorizada
    if (item.request_status === 'autorizada') {
      return res.status(400).json(apiResponse(false, null, null, 'No se puede eliminar un item de una solicitud ya autorizada'));
    }

    const quotationId = item.quotation_id;

    // Eliminar el item
    await db.runAsync('DELETE FROM quotation_items WHERE id = ?', [itemId]);

    // Verificar si quedan items en esta cotización
    const remainingItems = await db.getAsync(
      'SELECT COUNT(*) as count FROM quotation_items WHERE quotation_id = ?',
      [quotationId]
    );

    // Si no quedan items, eliminar la cotización también
    if (remainingItems.count === 0) {
      await db.runAsync('DELETE FROM quotations WHERE id = ?', [quotationId]);

      // Verificar si quedan cotizaciones para esta solicitud
      const remainingQuotations = await db.getAsync(
        'SELECT COUNT(*) as count FROM quotations WHERE request_id = ?',
        [item.request_id]
      );

      // Si no quedan cotizaciones, cambiar estado a 'pendiente'
      if (remainingQuotations.count === 0 && item.request_status === 'cotizando') {
        await db.runAsync(
          'UPDATE requests SET status = ? WHERE id = ?',
          ['pendiente', item.request_id]
        );
      }
    } else {
      // Actualizar el total de la cotización
      const newTotal = await db.getAsync(
        'SELECT SUM(subtotal) as total FROM quotation_items WHERE quotation_id = ?',
        [quotationId]
      );

      await db.runAsync(
        'UPDATE quotations SET total_amount = ? WHERE id = ?',
        [newTotal.total || 0, quotationId]
      );
    }

    // Log de auditoría
    await db.auditLog('quotation_items', itemId, 'delete', item, null, req.user.id, getClientIP(req));

    res.json(apiResponse(true, null, 'Item de cotización eliminado exitosamente'));

  } catch (error) {
    next(error);
  }
});

// GET /api/quotations/item/:id - Obtener detalle de un item de cotización
router.get('/item/:id', authMiddleware, requireRole('purchaser', 'director', 'admin'), async (req, res, next) => {
  try {
    const itemId = req.params.id;

    const item = await db.getAsync(`
      SELECT
        qi.*,
        q.payment_terms,
        q.delivery_date,
        q.delivery_time,
        q.validity_days,
        q.notes as quotation_notes,
        s.id as supplier_id,
        s.name as supplier_name,
        s.contact_name,
        s.phone as supplier_phone,
        s.email as supplier_email,
        r.id as request_id,
        r.folio as request_folio,
        r.area,
        r.status as request_status,
        ri.material,
        ri.quantity,
        ri.unit,
        ri.specifications,
        u.name as quoted_by_name
      FROM quotation_items qi
      JOIN quotations q ON qi.quotation_id = q.id
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN requests r ON q.request_id = r.id
      JOIN request_items ri ON qi.request_item_id = ri.id
      LEFT JOIN users u ON q.quoted_by = u.id
      WHERE qi.id = ?
    `, [itemId]);

    if (!item) {
      return res.status(404).json(apiResponse(false, null, null, 'Item no encontrado'));
    }

    res.json(apiResponse(true, item));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
