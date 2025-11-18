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

    // Filtrar según el rol
    if (req.user.role === 'requester') {
      // Los requesters solo ven órdenes de sus solicitudes
      whereClause += ' AND r.user_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'director') {
      // Los directores solo ven órdenes de su área
      whereClause += ' AND r.area = ?';
      params.push(req.user.area);
    }
    // purchaser y admin ven todas las órdenes (sin filtro)

    if (status) {
      // Soportar múltiples status separados por coma
      const statusList = status.split(',').map(s => s.trim());
      if (statusList.length > 1) {
        whereClause += ` AND po.status IN (${statusList.map(() => '?').join(',')})`;
        params.push(...statusList);
      } else {
        whereClause += ' AND po.status = ?';
        params.push(status);
      }
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
        s.name as supplier_name,
        s.rfc as supplier_rfc,
        s.contact_name as supplier_contact,
        s.phone as supplier_phone,
        s.email as supplier_email,
        s.address as supplier_address,
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
    const { request_id, quotation_id, expected_delivery, notes, requires_invoice } = req.body;

    // Verificar que la cotización existe y está seleccionada
    const quotation = await db.getAsync(`
      SELECT 
        q.*,
        r.status as request_status,
        s.name as supplier_name
      FROM quotations q
      JOIN requests r ON q.request_id = r.id
      JOIN suppliers s ON q.supplier_id = s.id
      WHERE q.id = ? AND q.is_selected = TRUE
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
        expected_delivery, total_amount, notes, requires_invoice, created_by
      ) VALUES (?, ?, ?, ?, DATE('now'), ?, ?, ?, ?, ?)
    `, [
      folio, request_id, quotation_id, quotation.supplier_id,
      formatDateForDB(expected_delivery), quotation.total_amount,
      notes || null, requires_invoice ? 1 : 0, req.user.id
    ]);

    const orderId = orderResult.id;

    // Actualizar estado de la solicitud a "emitida" (orden generada)
    await db.runAsync(
      'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['emitida', request_id]
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

    // Actualizar solicitud según el estado de la orden
    if (status === 'en_transito') {
      await db.runAsync(
        'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['en_transito', order.request_id]
      );
    } else if (status === 'recibida') {
      if (actual_delivery) {
        updateFields.push('actual_delivery = ?');
        updateParams.push(formatDateForDB(actual_delivery));
      }

      // Actualizar solicitud a recibida
      await db.runAsync(
        'UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['recibida', order.request_id]
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

    // Notificar cambio de estado
    await notificationService.notifyOrderStatusChange(orderId, status);

    res.json(apiResponse(true, null, `Orden de compra ${status} exitosamente`));

  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id/pdf - Descargar PDF de orden de compra
router.get('/:id/pdf', authMiddleware, validateId, async (req, res, next) => {
  try {
    const orderId = req.params.id;
    console.log('📄 Solicitando PDF para orden:', orderId);
    console.log('👤 Usuario:', req.user?.id, 'Rol:', req.user?.role);

    const order = await db.getAsync(`
      SELECT po.pdf_path, po.folio, r.user_id as requester_id
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      WHERE po.id = ?
    `, [orderId]);

    console.log('📋 Orden encontrada:', order);

    if (!order) {
      console.error('❌ Orden no encontrada en BD');
      return res.status(404).json(apiResponse(false, null, null, 'Orden de compra no encontrada'));
    }

    // Verificar permisos
    if (req.user.role === 'requester' && order.requester_id !== req.user.id) {
      console.log('🚫 Permiso denegado');
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    const path = require('path');
    const fs = require('fs');

    // Verificar si el PDF existe físicamente
    let fullPath = order.pdf_path ? path.join(__dirname, '..', order.pdf_path) : null;
    console.log('🔍 Verificando PDF en:', fullPath);
    console.log('📁 Existe?', fullPath && fs.existsSync(fullPath));

    if (!order.pdf_path || !fs.existsSync(fullPath)) {
      // Generar PDF si no existe
      console.log('📝 Generando PDF nuevo...');
      try {
        const pdfPath = await pdfService.generatePurchaseOrderPDF(orderId);
        console.log('✅ PDF generado:', pdfPath);
        await db.runAsync(
          'UPDATE purchase_orders SET pdf_path = ? WHERE id = ?',
          [pdfPath, orderId]
        );
        order.pdf_path = pdfPath;
        fullPath = path.join(__dirname, '..', pdfPath);
      } catch (pdfError) {
        console.error('❌ Error generando PDF:', pdfError);
        return res.status(500).json(apiResponse(false, null, null, 'Error generando PDF: ' + pdfError.message));
      }
    }

    console.log('📤 Enviando PDF:', fullPath);

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

    // Filtrar según el rol
    if (req.user.role === 'requester') {
      whereClause = 'WHERE r.user_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'director') {
      whereClause = 'WHERE r.area = ?';
      params.push(req.user.area);
    }
    // purchaser y admin ven todas las estadísticas (sin filtro)

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

// GET /api/orders/:id/history - Obtener historial completo de cambios de una orden
router.get('/:id/history', authMiddleware, validateId, async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Verificar que la orden existe y permisos
    const order = await db.getAsync(`
      SELECT po.id, r.user_id as requester_id
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

    // Obtener todos los registros de audit_log para esta orden
    const history = await db.allAsync(`
      SELECT
        al.*,
        u.name as user_name
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.table_name = 'purchase_orders'
        AND al.record_id = ?
      ORDER BY al.created_at ASC
    `, [orderId]);

    res.json(apiResponse(true, history));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
