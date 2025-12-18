const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateSupplier, validateId, validatePagination } = require('../utils/validators');
const { apiResponse, getClientIP, paginate } = require('../utils/helpers');

// GET /api/suppliers - Obtener todos los proveedores
router.get('/', authMiddleware, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 1000, category, active_only = 'true' } = req.query;
    const { limit: limitNum, offset } = paginate(parseInt(page), parseInt(limit));
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (active_only === 'true') {
      whereClause += ' AND is_active = true';
    }

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    const query = `
      SELECT
        id, name, rfc, contact_name, phone, email, address,
        category, rating, is_active, has_invoice, notes, created_at
      FROM suppliers
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;

    const suppliers = await db.allAsync(query, [...params, limitNum, offset]);

    // Contar total para paginación
    const countQuery = `SELECT COUNT(*) as total FROM suppliers ${whereClause}`;
    const { total } = await db.getAsync(countQuery, params);

    res.json(apiResponse(true, {
      suppliers,
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

// GET /api/suppliers/categories/list - Obtener categorías de proveedores
// IMPORTANTE: Este endpoint debe estar ANTES de /:id para que funcione correctamente
router.get('/categories/list', authMiddleware, async (req, res, next) => {
  try {
    const categories = await db.allAsync(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM suppliers
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY category ASC
    `);

    res.json(apiResponse(true, categories));

  } catch (error) {
    next(error);
  }
});

// GET /api/suppliers/stats - Obtener estadísticas de proveedores
router.get('/stats', authMiddleware, async (req, res, next) => {
  try {
    // Total de proveedores
    const { total } = await db.getAsync('SELECT COUNT(*) as total FROM suppliers');

    // Proveedores activos
    const { active } = await db.getAsync('SELECT COUNT(*) as active FROM suppliers WHERE is_active = true');

    // Categorías únicas
    const { categories } = await db.getAsync(`
      SELECT COUNT(DISTINCT category) as categories
      FROM suppliers
      WHERE category IS NOT NULL AND category != ''
    `);

    // Rating promedio
    const ratingResult = await db.getAsync(`
      SELECT COALESCE(AVG(rating), 5.0) as avgRating
      FROM suppliers
      WHERE rating IS NOT NULL
    `);

    const avgRating = ratingResult && ratingResult.avgRating ? parseFloat(ratingResult.avgRating) : 5.0;

    res.json(apiResponse(true, {
      total,
      active,
      categories,
      avgRating: avgRating.toFixed(1)
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/suppliers/:id - Obtener proveedor específico
router.get('/:id', authMiddleware, validateId, async (req, res, next) => {
  try {
    const supplierId = req.params.id;

    const supplier = await db.getAsync(`
      SELECT * FROM suppliers WHERE id = ?
    `, [supplierId]);

    if (!supplier) {
      return res.status(404).json(apiResponse(false, null, null, 'Proveedor no encontrado'));
    }

    // Obtener estadísticas del proveedor
    const stats = await db.getAsync(`
      SELECT 
        COUNT(q.id) as total_quotations,
        AVG(q.total_amount) as avg_quotation_amount,
        COUNT(CASE WHEN q.is_selected = TRUE THEN 1 END) as selected_quotations,
        COUNT(po.id) as total_orders,
        SUM(po.total_amount) as total_purchased
      FROM suppliers s
      LEFT JOIN quotations q ON s.id = q.supplier_id
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      WHERE s.id = ?
      GROUP BY s.id
    `, [supplierId]);

    res.json(apiResponse(true, {
      ...supplier,
      stats: stats || {
        total_quotations: 0,
        avg_quotation_amount: 0,
        selected_quotations: 0,
        total_orders: 0,
        total_purchased: 0
      }
    }));

  } catch (error) {
    next(error);
  }
});

// POST /api/suppliers - Crear nuevo proveedor
router.post('/', authMiddleware, requireRole('purchaser', 'admin'), validateSupplier, async (req, res, next) => {
  try {
    const {
      name, rfc, contact_name, phone, email, address, category, rating = 5.0, notes,
      vendor_size, specialty, has_invoice, business_name
    } = req.body;

    // Verificar que no existe otro proveedor con el mismo nombre
    const existingSupplier = await db.getAsync(
      'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)',
      [name]
    );

    if (existingSupplier) {
      return res.status(409).json(apiResponse(false, null, null, 'Ya existe un proveedor con este nombre'));
    }

    // Verificar que no existe otro proveedor con el mismo RFC (si se proporciona)
    if (rfc) {
      const existingRfc = await db.getAsync(
        'SELECT id, name FROM suppliers WHERE rfc = ?',
        [rfc]
      );

      if (existingRfc) {
        return res.status(409).json(apiResponse(false, null, null, `El RFC ya está registrado para el proveedor "${existingRfc.name}"`));
      }
    }

    // Insertar proveedor
    const result = await db.runAsync(`
      INSERT INTO suppliers (
        name, rfc, contact_name, phone, email, address, category, rating, notes,
        vendor_size, specialty, has_invoice, business_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, rfc || null, contact_name || null, phone || null,
      email || null, address || null, category || null, rating, notes || null,
      vendor_size || null, specialty || null, has_invoice, business_name || null
    ]);

    // Log de auditoría
    await db.auditLog('suppliers', result.id, 'create', null, {
      name, category, created_by: req.user.id
    }, req.user.id, getClientIP(req));

    res.status(201).json(apiResponse(true, {
      id: result.id,
      name,
      category,
      rating
    }, 'Proveedor creado exitosamente'));

  } catch (error) {
    next(error);
  }
});

// PUT /api/suppliers/:id - Actualizar proveedor
router.put('/:id', authMiddleware, requireRole('purchaser', 'admin'), validateId, validateSupplier, async (req, res, next) => {
  try {
    const supplierId = req.params.id;
    const {
      name, rfc, contact_name, phone, email, address, category, rating, notes,
      vendor_size, specialty, has_invoice, business_name
    } = req.body;

    // Verificar que el proveedor existe
    const supplier = await db.getAsync('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
    if (!supplier) {
      return res.status(404).json(apiResponse(false, null, null, 'Proveedor no encontrado'));
    }

    // Verificar nombre único (excluyendo el actual)
    const existingSupplier = await db.getAsync(
      'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?) AND id != ?',
      [name, supplierId]
    );

    if (existingSupplier) {
      return res.status(409).json(apiResponse(false, null, null, 'Ya existe otro proveedor con este nombre'));
    }

    // Verificar RFC único (excluyendo el actual, si se proporciona)
    if (rfc) {
      const existingRfc = await db.getAsync(
        'SELECT id, name FROM suppliers WHERE rfc = ? AND id != ?',
        [rfc, supplierId]
      );

      if (existingRfc) {
        return res.status(409).json(apiResponse(false, null, null, `El RFC ya está registrado para el proveedor "${existingRfc.name}"`));
      }
    }

    // Actualizar proveedor
    await db.runAsync(`
      UPDATE suppliers
      SET name = ?, rfc = ?, contact_name = ?, phone = ?, email = ?,
          address = ?, category = ?, rating = ?, notes = ?,
          vendor_size = ?, specialty = ?, has_invoice = ?, business_name = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, rfc || null, contact_name || null, phone || null,
      email || null, address || null, category || null, rating || supplier.rating,
      notes || null, vendor_size || null, specialty || null, has_invoice, business_name || null,
      supplierId
    ]);

    // Log de auditoría
    await db.auditLog('suppliers', supplierId, 'update', 
      { name: supplier.name, category: supplier.category },
      { name, category, updated_by: req.user.id },
      req.user.id, 
      getClientIP(req)
    );

    res.json(apiResponse(true, null, 'Proveedor actualizado exitosamente'));

  } catch (error) {
    next(error);
  }
});

// PATCH /api/suppliers/:id/toggle - Activar/desactivar proveedor
router.patch('/:id/toggle', authMiddleware, requireRole('purchaser', 'admin'), validateId, async (req, res, next) => {
  try {
    const supplierId = req.params.id;

    const supplier = await db.getAsync('SELECT is_active FROM suppliers WHERE id = ?', [supplierId]);
    if (!supplier) {
      return res.status(404).json(apiResponse(false, null, null, 'Proveedor no encontrado'));
    }

    const newStatus = !supplier.is_active;

    await db.runAsync(
      'UPDATE suppliers SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, supplierId]
    );

    // Log de auditoría
    await db.auditLog('suppliers', supplierId, 'update',
      { is_active: supplier.is_active },
      { is_active: newStatus },
      req.user.id,
      getClientIP(req)
    );

    res.json(apiResponse(true, { is_active: newStatus }, 
      `Proveedor ${newStatus ? 'activado' : 'desactivado'} exitosamente`));

  } catch (error) {
    next(error);
  }
});

// PATCH /api/suppliers/:id/rate - Calificar proveedor después de recibir orden
router.patch('/:id/rate', authMiddleware, requireRole('purchaser', 'admin'), validateId, async (req, res, next) => {
  try {
    const supplierId = req.params.id;
    const { rating, order_id } = req.body;

    // Validar rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json(apiResponse(false, null, null, 'Rating debe estar entre 1 y 5'));
    }

    // Verificar que el proveedor existe
    const supplier = await db.getAsync('SELECT id, name, rating FROM suppliers WHERE id = ?', [supplierId]);
    if (!supplier) {
      return res.status(404).json(apiResponse(false, null, null, 'Proveedor no encontrado'));
    }

    // Calcular nuevo rating promedio (si ya tiene rating, hacer promedio)
    // Por ahora, simplemente actualizamos con el nuevo rating
    // En el futuro se podría hacer un promedio ponderado de todas las calificaciones
    const newRating = rating;

    await db.runAsync(
      'UPDATE suppliers SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newRating, supplierId]
    );

    // Log de auditoría
    await db.auditLog('suppliers', supplierId, 'rate',
      { rating: supplier.rating },
      { rating: newRating, order_id },
      req.user.id,
      getClientIP(req)
    );

    res.json(apiResponse(true, {
      id: supplierId,
      name: supplier.name,
      rating: newRating
    }, 'Proveedor calificado exitosamente'));

  } catch (error) {
    next(error);
  }
});

// DELETE /api/suppliers/:id - Eliminar proveedor permanentemente
router.delete('/:id', authMiddleware, requireRole('purchaser', 'admin'), validateId, async (req, res, next) => {
  try {
    const supplierId = req.params.id;

    // Verificar que el proveedor existe
    const supplier = await db.getAsync('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
    if (!supplier) {
      return res.status(404).json(apiResponse(false, null, null, 'Proveedor no encontrado'));
    }

    // Verificar que el proveedor está inactivo
    if (supplier.is_active === true) {
      return res.status(400).json(apiResponse(false, null, null, 'Solo se pueden eliminar proveedores inactivos. Desactívalo primero.'));
    }

    // Verificar que no tiene cotizaciones o órdenes asociadas
    const hasRelations = await db.getAsync(`
      SELECT
        (SELECT COUNT(*) FROM quotations WHERE supplier_id = ?) as quotations_count,
        (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = ?) as orders_count
    `, [supplierId, supplierId]);

    if (hasRelations.quotations_count > 0 || hasRelations.orders_count > 0) {
      return res.status(400).json(apiResponse(false, null, null,
        `No se puede eliminar el proveedor porque tiene ${hasRelations.quotations_count} cotización(es) y ${hasRelations.orders_count} orden(es) asociadas. Considera desactivarlo en lugar de eliminarlo.`
      ));
    }

    // Eliminar proveedor
    await db.runAsync('DELETE FROM suppliers WHERE id = ?', [supplierId]);

    // Log de auditoría
    await db.auditLog('suppliers', supplierId, 'delete',
      { name: supplier.name, category: supplier.category },
      null,
      req.user.id,
      getClientIP(req)
    );

    res.json(apiResponse(true, null, 'Proveedor eliminado permanentemente'));

  } catch (error) {
    next(error);
  }
});

// GET /api/suppliers/:id/quotations - Obtener cotizaciones del proveedor
router.get('/:id/quotations', authMiddleware, validateId, async (req, res, next) => {
  try {
    const supplierId = req.params.id;

    const quotations = await db.allAsync(`
      SELECT
        q.*,
        r.folio as request_folio,
        r.area,
        u.name as requester_name,
        qb.name as quoted_by_name,
        CASE
          WHEN q.is_selected = TRUE THEN TRUE
          ELSE FALSE
        END as has_selected_items
      FROM quotations q
      JOIN requests r ON q.request_id = r.id
      JOIN users u ON r.user_id = u.id
      JOIN users qb ON q.quoted_by = qb.id
      WHERE q.supplier_id = ?
      ORDER BY q.quoted_at DESC
      LIMIT 50
    `, [supplierId]);

    res.json(apiResponse(true, { quotations }));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
