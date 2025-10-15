const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validatePurchaseOrder, validateId, validatePagination } = require('../utils/validators');
const { apiResponse, generateOrderFolio, formatDateForDB, getClientIP, paginate } = require('../utils/helpers');
const pdfService = require('../services/pdfService');
const notificationService = require('../services/notificationService');

// GET /api/orders - Obtener todas las órdenes de compra
router.get('/', authMiddleware, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, supplier_id } = req.query;
    const { limit: limitNum, offset } = paginate(parseInt(page), parseInt(limit));
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    // Solo los solicitantes ven órdenes de sus solicitudes
    if (req.user.role === 'requester') {
      whereClause += ' AND r.user_id = ?';
      params.push(req.user.id);
    }

    if (status) {
      whereClause += ' AND po.status = ?';
      params.push(status);
    }
    
    if (supplier_id) {
      whereClause += ' AND po.supplier_id = ?';
      params.push(supplier_id);
    }

    const query = `
      SELECT 
        po.*,
        r.folio as request_folio,
        r.area,
        r.user_id as requester_id,
        u.name as requester_name,
        s.name as supplier_name,
        s.contact_name,
        s.phone as supplier_phone,
        creator.name as created_by_name
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      JOIN users u ON r.user_id = u.id
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN users creator ON po.created_by = creator.id
      ${whereClause}
      ORDER BY po.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const orders = await db.allAsync(query, [...params, limitNum, offset]);

    // Contar total para paginación
    const countQuery = `
      SELECT COUNT(*) as total
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      ${whereClause}
    `;
    const { total } = await db.getAsync(countQuery, params);

    res.json(apiResponse(true, {
      orders,
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

// GET /api/orders/:id - Obtener orden específica con detalles
router.get('/:id', authMiddleware, validateId, async (req, res, next) => {
  try {
    const orderId = req.params.id;

    const order = await db.getAsync(`
      SELECT 
        po.*,
        r.folio as request_folio,
        r.area,
        r.justification,
        r.user_id as requester_id,
        u.name as requester_name,
        u.email as requester_email,
        s.*,
        creator.name as created_by_name,
        q.quotation_number,
        q.payment_terms,
        q.validity_days
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      JOIN users u ON r.user_id = u.id
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN users creator ON po.created_by = creator.id
      JOIN quotations q ON po.quotation_id = q.id
      WHERE po.id = ?
    `, [orderId]);

    if (!order) {
      return res.status(404).json(apiResponse(false, null, null, 'Orden de compra no encontrada'));
    }

    // Verificar permisos
    if (req.user.role === 'requester' && order.requester_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    // Obtener items de la cotización
    const items = await db.allAsync(`
      SELECT 
        qi.*,
        ri.material,
        ri.specifications,
        ri.unit
      FROM quotation_items qi
      JOIN request_items ri ON qi.request_item_id = ri.id
      WHERE qi.quotation_id = ?
      ORDER BY qi.id ASC
    `, [order.quotation_id]);

    res.json(apiResponse(true, {
      ...order,
      items
    }));

  } catch (error) {
    next(error);
  }
});

// POST /api/orders - Crear nueva orden de compra
router.post('/', authMiddleware, requireRole('purchaser', 'admin'), validatePurchaseOrder, async (req, res, next) => {
  try {
    const { request_id, quotation_id, expected_delivery, notes } = req.body;

    // Verificar que la cotización existe y está seleccionada
    const quotation = await db.getAsync(`
      SELECT 
        q.*,
        r.status as request_status,
        s.name as supplier_name
      FROM quotations q
      JOIN requests r ON q.request_id = r.id
      JOIN suppliers s ON q.supplier_id = s.id
      WHERE q.id = ? AND q.is_selected = 1
    `, [quotation_id]);

    if (!quotation) {
      return res.status(404).json(apiResponse(false, null, null, 'Cotización no encontrada o no seleccionada'));
    }

    if (quotation.request_status !== 'autorizada') {
      return res.status(400).json(apiResponse(false, null, null, 'La solicitud debe estar autorizada'));
    }

    // Verificar que no existe ya una orden para esta solicitud
    const existingOrder = await db.getAsync(
      'SELECT id FROM purchase_orders WHERE request_id = ?',
      [request_id]
    );

    if (existingOrder) {
      return res.status(409).json(apiResponse(false, null, null, 'Ya existe una orden de compra para esta solicitud'));
    }

    // Generar folio único
    const folio = await generateOrderFolio(db);

    // Crear orden de compra
    const orderResult = await db.runAsync(`
      INSERT INTO purchase_orders (
        folio, request_id, quotation_id, supplier_id, order_date,
        expected_delivery, total_amount, notes, created_by
      ) VALUES (?, ?, ?, ?, DATE('now'), ?, ?, ?, ?)
    `, [
      folio, request_id, quotation_id, quotation.supplier_id,
      formatDateForDB(expected_delivery), quotation.total_amount,
      notes || null, req.user.id
    ]);

    const orderId = orderResult.id;

    // Actualizar estado de la solicitud
    await db.runAsync(
      'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['comprada', request_id]
    );

    // Generar PDF
    try {
      const pdfPath = await pdfService.generatePurchaseOrderPDF(orderId);
      await db.runAsync(
        'UPDATE purchase_orders SET pdf_path = ? WHERE id = ?',
        [pdfPath, orderId]
      );
    } catch (pdfError) {
      console.error('Error generando PDF:', pdfError);
      // No fallar la creación de la orden por el PDF
    }

    // Log de auditoría
    await db.auditLog('purchase_orders', orderId, 'create', null, {
      folio, request_id, quotation_id, total_amount: quotation.total_amount
    }, req.user.id, getClientIP(req));

    // Enviar notificaciones
    await notificationService.notifyPurchaseOrderCreated(orderId);

    res.status(201).json(apiResponse(true, {
      id: orderId,
      folio,
      total_amount: quotation.total_amount
    }, 'Orden de compra creada exitosamente'));

  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id/status - Actualizar estado de orden
router.patch('/:id/status', authMiddleware, requireRole('purchaser', 'admin'), validateId, async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const { status, actual_delivery, notes } = req.body;

    const validStatuses = ['emitida', 'en_transito', 'recibida', 'cancelada'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(apiResponse(false, null, null, 'Estado no válido'));
    }

    const order = await db.getAsync('SELECT * FROM purchase_orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json(apiResponse(false, null, null, 'Orden de compra no encontrada'));
    }

    // Preparar campos a actualizar
    const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams = [status];

    if (notes) {
      updateFields.push('notes = ?');
      updateParams.push(notes);
    }

    if (status === 'recibida' && actual_delivery) {
      updateFields.push('actual_delivery = ?');
      updateParams.push(formatDateForDB(actual_delivery));
      
      // Actualizar solicitud a entregada
      await db.runAsync(
        'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['entregada', order.request_id]
      );
    }

    updateParams.push(orderId);

    await db.runAsync(`
      UPDATE purchase_orders 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateParams);

    // Log de auditoría
    await db.auditLog('purchase_orders', orderId, 'update',
      { status: order.status },
      { status, actual_delivery, notes },
      req.user.id,
      getClientIP(req)
    );

    res.json(apiResponse(true, null, `Orden de compra ${status} exitosamente`));

  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id/pdf - Descargar PDF de orden de compra
router.get('/:id/pdf', authMiddleware, validateId, async (req, res, next) => {
  try {
    const orderId = req.params.id;

    const order = await db.getAsync(`
      SELECT po.pdf_path, po.folio, r.user_id as requester_id
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      WHERE po.id = ?
    `, [orderId]);

    if (!order) {
      return res.status(404).json(apiResponse(false, null, null, 'Orden de compra no encontrada'));
    }

    // Verificar permisos
    if (req.user.role === 'requester' && order.requester_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    if (!order.pdf_path) {
      // Generar PDF si no existe
      try {
        const pdfPath = await pdfService.generatePurchaseOrderPDF(orderId);
        await db.runAsync(
          'UPDATE purchase_orders SET pdf_path = ? WHERE id = ?',
          [pdfPath, orderId]
        );
        order.pdf_path = pdfPath;
      } catch (pdfError) {
        return res.status(500).json(apiResponse(false, null, null, 'Error generando PDF'));
      }
    }

    const path = require('path');
    const fs = require('fs');
    const fullPath = path.join(__dirname, '..', order.pdf_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json(apiResponse(false, null, null, 'Archivo PDF no encontrado'));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Orden_${order.folio}.pdf"`);
    res.sendFile(fullPath);

  } catch (error) {
    next(error);
  }
});

// GET /api/orders/stats/summary - Estadísticas de órdenes
router.get('/stats/summary', authMiddleware, async (req, res, next) => {
  try {
    let whereClause = '';
    let params = [];

    if (req.user.role === 'requester') {
      whereClause = 'WHERE r.user_id = ?';
      params.push(req.user.id);
    }

    const stats = await db.getAsync(`
      SELECT 
        COUNT(po.id) as total,
        SUM(CASE WHEN po.status = 'emitida' THEN 1 ELSE 0 END) as emitidas,
        SUM(CASE WHEN po.status = 'en_transito' THEN 1 ELSE 0 END) as en_transito,
        SUM(CASE WHEN po.status = 'recibida' THEN 1 ELSE 0 END) as recibidas,
        SUM(CASE WHEN po.status = 'cancelada' THEN 1 ELSE 0 END) as canceladas,
        COALESCE(SUM(po.total_amount), 0) as total_amount,
        COALESCE(AVG(po.total_amount), 0) as avg_amount
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      ${whereClause}
    `, params);

    res.json(apiResponse(true, stats));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
