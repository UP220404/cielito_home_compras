const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateDateRange } = require('../utils/validators');
const { apiResponse, formatCurrency } = require('../utils/helpers');
const pdfService = require('../services/pdfService');

// GET /api/reports/requests/excel - Exportar solicitudes a Excel
router.get('/requests/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const { startDate, endDate, area, status } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (startDate) {
      whereClause += ' AND r.request_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND r.request_date <= ?';
      params.push(endDate);
    }
    if (area) {
      whereClause += ' AND r.area = ?';
      params.push(area);
    }
    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }

    const requests = await db.allAsync(`
      SELECT 
        r.*,
        u.name as requester_name,
        auth.name as authorized_by_name,
        COUNT(ri.id) as items_count,
        COALESCE(SUM(ri.approximate_cost * ri.quantity), 0) as estimated_total
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users auth ON r.authorized_by = auth.id
      LEFT JOIN request_items ri ON r.id = ri.request_id
      ${whereClause}
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `, params);

    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Solicitudes de Compra');

    // Headers
    worksheet.columns = [
      { header: 'Folio', key: 'folio', width: 15 },
      { header: 'Fecha Solicitud', key: 'request_date', width: 15 },
      { header: 'Solicitante', key: 'requester_name', width: 20 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Urgencia', key: 'urgency', width: 12 },
      { header: 'Prioridad', key: 'priority', width: 12 },
      { header: 'Items', key: 'items_count', width: 10 },
      { header: 'Total Estimado', key: 'estimated_total', width: 15 },
      { header: 'Fecha Entrega', key: 'delivery_date', width: 15 },
      { header: 'Autorizado Por', key: 'authorized_by_name', width: 20 },
      { header: 'Justificación', key: 'justification', width: 40 }
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF007BFF' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Agregar datos
    requests.forEach(request => {
      worksheet.addRow({
        folio: request.folio,
        request_date: new Date(request.request_date).toLocaleDateString('es-MX'),
        requester_name: request.requester_name,
        area: request.area,
        status: request.status.toUpperCase(),
        urgency: request.urgency.toUpperCase(),
        priority: request.priority.toUpperCase(),
        items_count: request.items_count,
        estimated_total: request.estimated_total,
        delivery_date: new Date(request.delivery_date).toLocaleDateString('es-MX'),
        authorized_by_name: request.authorized_by_name || 'N/A',
        justification: request.justification
      });
    });

    // Formatear columna de moneda
    worksheet.getColumn('estimated_total').numFmt = '$#,##0.00';

    // Auto-ajustar columnas
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width, 10);
    });

    // Configurar respuesta
    const filename = `solicitudes_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/suppliers/excel - Exportar proveedores a Excel
router.get('/suppliers/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const suppliers = await db.allAsync(`
      SELECT 
        s.*,
        COUNT(q.id) as total_quotations,
        COUNT(CASE WHEN q.is_selected = TRUE THEN 1 END) as selected_quotations,
        COUNT(po.id) as total_orders,
        COALESCE(SUM(po.total_amount), 0) as total_purchased
      FROM suppliers s
      LEFT JOIN quotations q ON s.id = q.supplier_id
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Proveedores');

    worksheet.columns = [
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'RFC', key: 'rfc', width: 15 },
      { header: 'Contacto', key: 'contact_name', width: 20 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Categoría', key: 'category', width: 15 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Cotizaciones', key: 'total_quotations', width: 12 },
      { header: 'Seleccionadas', key: 'selected_quotations', width: 12 },
      { header: 'Órdenes', key: 'total_orders', width: 12 },
      { header: 'Total Comprado', key: 'total_purchased', width: 15 },
      { header: 'Estado', key: 'is_active', width: 12 }
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF28A745' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    suppliers.forEach(supplier => {
      worksheet.addRow({
        name: supplier.name,
        rfc: supplier.rfc || 'N/A',
        contact_name: supplier.contact_name || 'N/A',
        phone: supplier.phone || 'N/A',
        email: supplier.email || 'N/A',
        category: supplier.category || 'N/A',
        rating: supplier.rating,
        total_quotations: supplier.total_quotations,
        selected_quotations: supplier.selected_quotations,
        total_orders: supplier.total_orders,
        total_purchased: supplier.total_purchased,
        is_active: supplier.is_active ? 'Activo' : 'Inactivo'
      });
    });

    worksheet.getColumn('total_purchased').numFmt = '$#,##0.00';
    worksheet.getColumn('rating').numFmt = '0.0';

    const filename = `proveedores_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/purchase-orders/excel - Exportar órdenes de compra a Excel
router.get('/purchase-orders/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const { startDate, endDate, status, supplier_id } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    if (startDate) {
      whereClause += ' AND po.order_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND po.order_date <= ?';
      params.push(endDate);
    }
    if (status) {
      whereClause += ' AND po.status = ?';
      params.push(status);
    }
    if (supplier_id) {
      whereClause += ' AND po.supplier_id = ?';
      params.push(supplier_id);
    }

    const orders = await db.allAsync(`
      SELECT 
        po.*,
        r.folio as request_folio,
        r.area,
        u.name as requester_name,
        s.name as supplier_name,
        creator.name as created_by_name
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      JOIN users u ON r.user_id = u.id
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN users creator ON po.created_by = creator.id
      ${whereClause}
      ORDER BY po.created_at DESC
    `, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Órdenes de Compra');

    worksheet.columns = [
      { header: 'Folio Orden', key: 'folio', width: 15 },
      { header: 'Folio Solicitud', key: 'request_folio', width: 15 },
      { header: 'Fecha Orden', key: 'order_date', width: 15 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Solicitante', key: 'requester_name', width: 20 },
      { header: 'Proveedor', key: 'supplier_name', width: 25 },
      { header: 'Monto Total', key: 'total_amount', width: 15 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Entrega Esperada', key: 'expected_delivery', width: 15 },
      { header: 'Entrega Real', key: 'actual_delivery', width: 15 },
      { header: 'Creado Por', key: 'created_by_name', width: 20 }
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6F42C1' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    orders.forEach(order => {
      worksheet.addRow({
        folio: order.folio,
        request_folio: order.request_folio,
        order_date: new Date(order.order_date).toLocaleDateString('es-MX'),
        area: order.area,
        requester_name: order.requester_name,
        supplier_name: order.supplier_name,
        total_amount: order.total_amount,
        status: order.status.toUpperCase(),
        expected_delivery: new Date(order.expected_delivery).toLocaleDateString('es-MX'),
        actual_delivery: order.actual_delivery ? new Date(order.actual_delivery).toLocaleDateString('es-MX') : 'N/A',
        created_by_name: order.created_by_name
      });
    });

    worksheet.getColumn('total_amount').numFmt = '$#,##0.00';

    const filename = `ordenes_compra_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/requests/pdf - Exportar solicitudes a PDF
router.get('/requests/pdf', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      area: req.query.area
    };

    const pdfPath = await pdfService.generateRequestsReport(filters);
    const fullPath = path.join(__dirname, '..', pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_solicitudes.pdf"');

    // Enviar archivo y eliminarlo después
    res.sendFile(fullPath, (err) => {
      if (err && !res.headersSent) next(err);
      // Eliminar archivo temporal
      const fs = require('fs');
      fs.unlink(fullPath, (unlinkErr) => {
        if (unlinkErr) console.error('Error eliminando PDF temporal:', unlinkErr);
      });
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/analytics - Reporte analítico completo
router.get('/analytics', authMiddleware, requireRole('admin', 'director'), async (req, res, next) => {
  try {
    // Estadísticas generales
    const generalStats = await db.getAsync(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'entregada' THEN 1 END) as completed_requests,
        AVG(CASE WHEN status = 'entregada' AND authorized_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400 END) as avg_completion_days
      FROM requests
    `);

    // Consulta separada para month_requests
    const monthRequests = await db.getAsync(`
      SELECT COUNT(*) as month_requests
      FROM requests
      WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'
    `);

    Object.assign(generalStats, monthRequests);

    // Gastos por área
    const spendingByArea = await db.allAsync(`
      SELECT 
        r.area,
        COUNT(po.id) as orders_count,
        SUM(po.total_amount) as total_spent
      FROM requests r
      LEFT JOIN purchase_orders po ON r.id = po.request_id
      GROUP BY r.area
      ORDER BY total_spent DESC
    `);

    // Top proveedores
    const topSuppliers = await db.allAsync(`
      SELECT 
        s.name,
        COUNT(po.id) as orders_count,
        SUM(po.total_amount) as total_amount
      FROM suppliers s
      JOIN purchase_orders po ON s.id = po.supplier_id
      GROUP BY s.id, s.name
      ORDER BY total_amount DESC
      LIMIT 5
    `);

    // Tendencias mensuales
    const monthlyTrends = await db.allAsync(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as requests_count,
        COUNT(CASE WHEN status = 'entregada' THEN 1 END) as completed_count
      FROM requests
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    res.json(apiResponse(true, {
      general_stats: generalStats,
      spending_by_area: spendingByArea,
      top_suppliers: topSuppliers,
      monthly_trends: monthlyTrends,
      generated_at: new Date().toISOString()
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/orders/excel - Alias para purchase-orders/excel
router.get('/orders/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const { startDate, endDate, status, supplier_id } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (startDate) {
      whereClause += ' AND po.order_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND po.order_date <= ?';
      params.push(endDate);
    }
    if (status) {
      whereClause += ' AND po.status = ?';
      params.push(status);
    }
    if (supplier_id) {
      whereClause += ' AND po.supplier_id = ?';
      params.push(supplier_id);
    }

    const orders = await db.allAsync(`
      SELECT
        po.*,
        r.folio as request_folio,
        r.area,
        u.name as requester_name,
        s.name as supplier_name,
        creator.name as created_by_name
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      JOIN users u ON r.user_id = u.id
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN users creator ON po.created_by = creator.id
      ${whereClause}
      ORDER BY po.created_at DESC
    `, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Órdenes de Compra');

    worksheet.columns = [
      { header: 'Folio Orden', key: 'folio', width: 15 },
      { header: 'Folio Solicitud', key: 'request_folio', width: 15 },
      { header: 'Fecha Orden', key: 'order_date', width: 15 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Solicitante', key: 'requester_name', width: 20 },
      { header: 'Proveedor', key: 'supplier_name', width: 25 },
      { header: 'Monto Total', key: 'total_amount', width: 15 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Entrega Esperada', key: 'expected_delivery', width: 15 },
      { header: 'Entrega Real', key: 'actual_delivery', width: 15 },
      { header: 'Creado Por', key: 'created_by_name', width: 20 }
    ];

    // Estilo del header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6F42C1' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    orders.forEach(order => {
      worksheet.addRow({
        folio: order.folio,
        request_folio: order.request_folio,
        order_date: new Date(order.order_date).toLocaleDateString('es-MX'),
        area: order.area,
        requester_name: order.requester_name,
        supplier_name: order.supplier_name,
        total_amount: order.total_amount,
        status: order.status.toUpperCase(),
        expected_delivery: new Date(order.expected_delivery).toLocaleDateString('es-MX'),
        actual_delivery: order.actual_delivery ? new Date(order.actual_delivery).toLocaleDateString('es-MX') : 'N/A',
        created_by_name: order.created_by_name
      });
    });

    worksheet.getColumn('total_amount').numFmt = '$#,##0.00';

    const filename = `ordenes_compra_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/orders/pdf - Reporte de órdenes en PDF
router.get('/orders/pdf', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status
    };

    const pdfPath = await pdfService.generateOrdersReport(filters);
    const fullPath = path.join(__dirname, '..', pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_ordenes.pdf"');

    // Enviar archivo y eliminarlo después
    res.sendFile(fullPath, (err) => {
      if (err && !res.headersSent) next(err);
      const fs = require('fs');
      fs.unlink(fullPath, (unlinkErr) => {
        if (unlinkErr) console.error('Error eliminando PDF temporal:', unlinkErr);
      });
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/suppliers/pdf - Reporte de proveedores en PDF
router.get('/suppliers/pdf', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const pdfPath = await pdfService.generateSuppliersReport();
    const fullPath = path.join(__dirname, '..', pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_proveedores.pdf"');

    // Enviar archivo y eliminarlo después
    res.sendFile(fullPath, (err) => {
      if (err && !res.headersSent) next(err);
      const fs = require('fs');
      fs.unlink(fullPath, (unlinkErr) => {
        if (unlinkErr) console.error('Error eliminando PDF temporal:', unlinkErr);
      });
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/requests-by-area/excel - Solicitudes por área
router.get('/requests-by-area/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (startDate) {
      whereClause += ' AND r.request_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND r.request_date <= ?';
      params.push(endDate);
    }

    const requests = await db.allAsync(`
      SELECT
        r.area,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN r.status = 'entregada' THEN 1 END) as completed,
        COUNT(CASE WHEN r.status = 'pendiente' THEN 1 END) as pending,
        COALESCE(SUM(ri.approximate_cost * ri.quantity), 0) as estimated_total
      FROM requests r
      LEFT JOIN request_items ri ON r.id = ri.request_id
      ${whereClause}
      GROUP BY r.area
      ORDER BY total_requests DESC
    `, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Solicitudes por Área');

    worksheet.columns = [
      { header: 'Área', key: 'area', width: 25 },
      { header: 'Total Solicitudes', key: 'total_requests', width: 18 },
      { header: 'Completadas', key: 'completed', width: 15 },
      { header: 'Pendientes', key: 'pending', width: 15 },
      { header: 'Total Estimado', key: 'estimated_total', width: 18 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF007BFF' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    requests.forEach(row => {
      worksheet.addRow(row);
    });

    worksheet.getColumn('estimated_total').numFmt = '$#,##0.00';

    const filename = `solicitudes_por_area_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/requests-by-status/excel - Solicitudes por estado
router.get('/requests-by-status/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const { startDate, endDate, area } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (startDate) {
      whereClause += ' AND r.request_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND r.request_date <= ?';
      params.push(endDate);
    }
    if (area) {
      whereClause += ' AND r.area = ?';
      params.push(area);
    }

    const requests = await db.allAsync(`
      SELECT
        r.status,
        COUNT(*) as total,
        COALESCE(SUM(ri.approximate_cost * ri.quantity), 0) as estimated_total
      FROM requests r
      LEFT JOIN request_items ri ON r.id = ri.request_id
      ${whereClause}
      GROUP BY r.status
      ORDER BY total DESC
    `, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Solicitudes por Estado');

    worksheet.columns = [
      { header: 'Estado', key: 'status', width: 20 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Monto Estimado', key: 'estimated_total', width: 18 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF17A2B8' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    requests.forEach(row => {
      worksheet.addRow({
        status: row.status.toUpperCase(),
        total: row.total,
        estimated_total: row.estimated_total
      });
    });

    worksheet.getColumn('estimated_total').numFmt = '$#,##0.00';

    const filename = `solicitudes_por_estado_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/requests-pending/excel - Solicitudes pendientes de autorización
router.get('/requests-pending/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const requests = await db.allAsync(`
      SELECT
        r.*,
        u.name as requester_name,
        COUNT(ri.id) as items_count,
        COALESCE(SUM(ri.approximate_cost * ri.quantity), 0) as estimated_total
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN request_items ri ON r.id = ri.request_id
      WHERE r.status = 'pendiente'
      GROUP BY r.id
      ORDER BY r.created_at ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pendientes de Autorización');

    worksheet.columns = [
      { header: 'Folio', key: 'folio', width: 15 },
      { header: 'Fecha', key: 'request_date', width: 15 },
      { header: 'Solicitante', key: 'requester_name', width: 20 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Urgencia', key: 'urgency', width: 12 },
      { header: 'Items', key: 'items_count', width: 10 },
      { header: 'Total Estimado', key: 'estimated_total', width: 15 },
      { header: 'Días Esperando', key: 'days_waiting', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC107' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FF000000' } };

    requests.forEach(request => {
      const daysWaiting = Math.floor((new Date() - new Date(request.created_at)) / (1000 * 60 * 60 * 24));
      worksheet.addRow({
        folio: request.folio,
        request_date: new Date(request.request_date).toLocaleDateString('es-MX'),
        requester_name: request.requester_name,
        area: request.area,
        urgency: request.urgency.toUpperCase(),
        items_count: request.items_count,
        estimated_total: request.estimated_total,
        days_waiting: daysWaiting
      });
    });

    worksheet.getColumn('estimated_total').numFmt = '$#,##0.00';

    const filename = `solicitudes_pendientes_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/suppliers-active/excel - Solo proveedores activos
router.get('/suppliers-active/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const suppliers = await db.allAsync(`
      SELECT
        s.*,
        COUNT(q.id) as total_quotations,
        COUNT(CASE WHEN q.is_selected = TRUE THEN 1 END) as selected_quotations
      FROM suppliers s
      LEFT JOIN quotations q ON s.id = q.supplier_id
      WHERE s.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.name ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Proveedores Activos');

    worksheet.columns = [
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'RFC', key: 'rfc', width: 15 },
      { header: 'Contacto', key: 'contact_name', width: 20 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Categoría', key: 'category', width: 15 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Cotizaciones', key: 'total_quotations', width: 12 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF28A745' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    suppliers.forEach(supplier => {
      worksheet.addRow({
        name: supplier.name,
        rfc: supplier.rfc || 'N/A',
        contact_name: supplier.contact_name || 'N/A',
        phone: supplier.phone || 'N/A',
        email: supplier.email || 'N/A',
        category: supplier.category || 'N/A',
        rating: supplier.rating,
        total_quotations: supplier.total_quotations
      });
    });

    const filename = `proveedores_activos_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/suppliers-by-category/excel - Proveedores por categoría
router.get('/suppliers-by-category/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const suppliers = await db.allAsync(`
      SELECT
        s.category,
        COUNT(*) as total,
        COUNT(CASE WHEN s.is_active = TRUE THEN 1 END) as active,
        AVG(s.rating) as avg_rating
      FROM suppliers s
      GROUP BY s.category
      ORDER BY total DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Proveedores por Categoría');

    worksheet.columns = [
      { header: 'Categoría', key: 'category', width: 25 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Activos', key: 'active', width: 15 },
      { header: 'Rating Promedio', key: 'avg_rating', width: 18 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6C757D' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    suppliers.forEach(row => {
      worksheet.addRow({
        category: row.category || 'Sin categoría',
        total: row.total,
        active: row.active,
        avg_rating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(1) : 'N/A'
      });
    });

    const filename = `proveedores_por_categoria_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/suppliers-rating/excel - Proveedores por calificación
router.get('/suppliers-rating/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const suppliers = await db.allAsync(`
      SELECT
        s.*,
        COUNT(po.id) as total_orders,
        COALESCE(SUM(po.total_amount), 0) as total_purchased
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      GROUP BY s.id
      ORDER BY s.rating DESC, total_orders DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Proveedores por Calificación');

    worksheet.columns = [
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'Categoría', key: 'category', width: 15 },
      { header: 'Órdenes', key: 'total_orders', width: 12 },
      { header: 'Total Comprado', key: 'total_purchased', width: 18 },
      { header: 'Estado', key: 'is_active', width: 12 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC107' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FF000000' } };

    suppliers.forEach(supplier => {
      worksheet.addRow({
        rating: supplier.rating,
        name: supplier.name,
        category: supplier.category || 'N/A',
        total_orders: supplier.total_orders,
        total_purchased: supplier.total_purchased,
        is_active: supplier.is_active ? 'Activo' : 'Inactivo'
      });
    });

    worksheet.getColumn('total_purchased').numFmt = '$#,##0.00';

    const filename = `proveedores_rating_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/orders-pending/excel - Órdenes pendientes de recepción
router.get('/orders-pending/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const orders = await db.allAsync(`
      SELECT
        po.*,
        r.folio as request_folio,
        r.area,
        s.name as supplier_name,
        s.phone as supplier_phone
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.status IN ('emitida', 'en_transito')
      ORDER BY po.expected_delivery ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Órdenes Pendientes');

    worksheet.columns = [
      { header: 'Folio', key: 'folio', width: 15 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Proveedor', key: 'supplier_name', width: 25 },
      { header: 'Teléfono', key: 'supplier_phone', width: 15 },
      { header: 'Área', key: 'area', width: 20 },
      { header: 'Monto', key: 'total_amount', width: 15 },
      { header: 'Entrega Esperada', key: 'expected_delivery', width: 18 },
      { header: 'Días Restantes', key: 'days_remaining', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDC3545' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    orders.forEach(order => {
      const daysRemaining = Math.ceil((new Date(order.expected_delivery) - new Date()) / (1000 * 60 * 60 * 24));
      worksheet.addRow({
        folio: order.folio,
        status: order.status.toUpperCase(),
        supplier_name: order.supplier_name,
        supplier_phone: order.supplier_phone || 'N/A',
        area: order.area,
        total_amount: order.total_amount,
        expected_delivery: new Date(order.expected_delivery).toLocaleDateString('es-MX'),
        days_remaining: daysRemaining
      });
    });

    worksheet.getColumn('total_amount').numFmt = '$#,##0.00';

    const filename = `ordenes_pendientes_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/orders-by-supplier/excel - Órdenes por proveedor
router.get('/orders-by-supplier/excel', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (startDate) {
      whereClause += ' AND po.order_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND po.order_date <= ?';
      params.push(endDate);
    }

    const data = await db.allAsync(`
      SELECT
        s.name as supplier_name,
        s.category,
        COUNT(po.id) as total_orders,
        SUM(po.total_amount) as total_amount,
        COUNT(CASE WHEN po.status = 'recibida' THEN 1 END) as delivered,
        COUNT(CASE WHEN po.status IN ('emitida', 'en_transito') THEN 1 END) as pending
      FROM suppliers s
      JOIN purchase_orders po ON s.id = po.supplier_id
      ${whereClause}
      GROUP BY s.id, s.name, s.category
      ORDER BY total_amount DESC
    `, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Órdenes por Proveedor');

    worksheet.columns = [
      { header: 'Proveedor', key: 'supplier_name', width: 25 },
      { header: 'Categoría', key: 'category', width: 15 },
      { header: 'Total Órdenes', key: 'total_orders', width: 15 },
      { header: 'Monto Total', key: 'total_amount', width: 18 },
      { header: 'Entregadas', key: 'delivered', width: 12 },
      { header: 'Pendientes', key: 'pending', width: 12 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6F42C1' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    data.forEach(row => {
      worksheet.addRow({
        supplier_name: row.supplier_name,
        category: row.category || 'N/A',
        total_orders: row.total_orders,
        total_amount: row.total_amount,
        delivered: row.delivered,
        pending: row.pending
      });
    });

    worksheet.getColumn('total_amount').numFmt = '$#,##0.00';

    const filename = `ordenes_por_proveedor_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/analytics-summary/excel - Resumen ejecutivo en Excel
router.get('/analytics-summary/excel', authMiddleware, requireRole('admin', 'director'), async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // Hoja 1: Resumen General
    const summarySheet = workbook.addWorksheet('Resumen General');

    const generalStats = await db.getAsync(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'entregada' THEN 1 END) as completed_requests,
        COUNT(CASE WHEN status = 'pendiente' THEN 1 END) as pending_requests
      FROM requests
    `);

    const orderStats = await db.getAsync(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_spent
      FROM purchase_orders
    `);

    const supplierStats = await db.getAsync(`
      SELECT
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_suppliers
      FROM suppliers
    `);

    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 30 },
      { header: 'Valor', key: 'value', width: 20 }
    ];

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF007BFF' }
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    summarySheet.addRow({ metric: 'Total Solicitudes', value: generalStats.total_requests });
    summarySheet.addRow({ metric: 'Solicitudes Completadas', value: generalStats.completed_requests });
    summarySheet.addRow({ metric: 'Solicitudes Pendientes', value: generalStats.pending_requests });
    summarySheet.addRow({ metric: 'Total Órdenes de Compra', value: orderStats.total_orders });
    summarySheet.addRow({ metric: 'Total Gastado', value: `$${parseFloat(orderStats.total_spent).toLocaleString('es-MX', {minimumFractionDigits: 2})}` });
    summarySheet.addRow({ metric: 'Total Proveedores', value: supplierStats.total_suppliers });
    summarySheet.addRow({ metric: 'Proveedores Activos', value: supplierStats.active_suppliers });

    // Hoja 2: Gastos por Área
    const areaSheet = workbook.addWorksheet('Gastos por Área');

    const spendingByArea = await db.allAsync(`
      SELECT
        r.area,
        COUNT(po.id) as orders_count,
        COALESCE(SUM(po.total_amount), 0) as total_spent
      FROM requests r
      LEFT JOIN purchase_orders po ON r.id = po.request_id
      GROUP BY r.area
      ORDER BY total_spent DESC
    `);

    areaSheet.columns = [
      { header: 'Área', key: 'area', width: 25 },
      { header: 'Órdenes', key: 'orders_count', width: 15 },
      { header: 'Total Gastado', key: 'total_spent', width: 20 }
    ];

    areaSheet.getRow(1).font = { bold: true };
    areaSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF28A745' }
    };
    areaSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    spendingByArea.forEach(row => {
      areaSheet.addRow(row);
    });

    areaSheet.getColumn('total_spent').numFmt = '$#,##0.00';

    const filename = `resumen_ejecutivo_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/analytics-summary/pdf - Resumen ejecutivo en PDF
router.get('/analytics-summary/pdf', authMiddleware, requireRole('admin', 'director'), async (req, res, next) => {
  try {
    const pdfPath = await pdfService.generateAnalyticsSummaryReport();
    const fullPath = path.join(__dirname, '..', pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resumen_ejecutivo.pdf"');

    // Enviar archivo y eliminarlo después
    res.sendFile(fullPath, (err) => {
      if (err) {
        console.error('Error enviando PDF:', err);
        if (!res.headersSent) {
          next(err);
        }
      }
      // Eliminar archivo después de enviar
      const fs = require('fs');
      fs.unlink(fullPath, (unlinkErr) => {
        if (unlinkErr) console.error('Error eliminando PDF temporal:', unlinkErr);
      });
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/analytics-monthly/excel - Tendencias mensuales
router.get('/analytics-monthly/excel', authMiddleware, requireRole('admin', 'director'), async (req, res, next) => {
  try {
    const monthlyData = await db.allAsync(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as requests_count,
        COUNT(CASE WHEN status = 'entregada' THEN 1 END) as completed_count
      FROM requests
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tendencias Mensuales');

    worksheet.columns = [
      { header: 'Mes', key: 'month', width: 15 },
      { header: 'Solicitudes', key: 'requests_count', width: 15 },
      { header: 'Completadas', key: 'completed_count', width: 15 },
      { header: '% Completado', key: 'completion_rate', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF17A2B8' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    monthlyData.forEach(row => {
      const rate = row.requests_count > 0 ? ((row.completed_count / row.requests_count) * 100).toFixed(1) : '0.0';
      worksheet.addRow({
        month: row.month,
        requests_count: row.requests_count,
        completed_count: row.completed_count,
        completion_rate: `${rate}%`
      });
    });

    const filename = `tendencias_mensuales_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/analytics-costs/excel - Análisis de costos
router.get('/analytics-costs/excel', authMiddleware, requireRole('admin', 'director'), async (req, res, next) => {
  try {
    const costData = await db.allAsync(`
      SELECT
        TO_CHAR(po.order_date, 'YYYY-MM') as month,
        COUNT(po.id) as orders_count,
        SUM(po.total_amount) as total_spent,
        AVG(po.total_amount) as avg_order
      FROM purchase_orders po
      WHERE po.order_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(po.order_date, 'YYYY-MM')
      ORDER BY month ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Análisis de Costos');

    worksheet.columns = [
      { header: 'Mes', key: 'month', width: 15 },
      { header: 'Órdenes', key: 'orders_count', width: 12 },
      { header: 'Total Gastado', key: 'total_spent', width: 18 },
      { header: 'Promedio por Orden', key: 'avg_order', width: 18 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6F42C1' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    costData.forEach(row => {
      worksheet.addRow({
        month: row.month,
        orders_count: row.orders_count,
        total_spent: parseFloat(row.total_spent) || 0,
        avg_order: parseFloat(row.avg_order) || 0
      });
    });

    worksheet.getColumn('total_spent').numFmt = '$#,##0.00';
    worksheet.getColumn('avg_order').numFmt = '$#,##0.00';

    const filename = `analisis_costos_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/analytics-efficiency/excel - Eficiencia de procesos
router.get('/analytics-efficiency/excel', authMiddleware, requireRole('admin', 'director'), async (req, res, next) => {
  try {
    const efficiencyData = await db.allAsync(`
      SELECT
        r.area,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN r.status = 'entregada' THEN 1 END) as completed,
        AVG(CASE
          WHEN r.status = 'entregada' AND r.authorized_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 86400
        END) as avg_days_to_complete
      FROM requests r
      WHERE r.created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY r.area
      ORDER BY avg_days_to_complete ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Eficiencia de Procesos');

    worksheet.columns = [
      { header: 'Área', key: 'area', width: 25 },
      { header: 'Total Solicitudes', key: 'total_requests', width: 18 },
      { header: 'Completadas', key: 'completed', width: 15 },
      { header: '% Completado', key: 'completion_rate', width: 15 },
      { header: 'Días Promedio', key: 'avg_days', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF20C997' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    efficiencyData.forEach(row => {
      const rate = row.total_requests > 0 ? ((row.completed / row.total_requests) * 100).toFixed(1) : '0.0';
      worksheet.addRow({
        area: row.area,
        total_requests: row.total_requests,
        completed: row.completed,
        completion_rate: `${rate}%`,
        avg_days: row.avg_days_to_complete ? parseFloat(row.avg_days_to_complete).toFixed(1) : 'N/A'
      });
    });

    const filename = `eficiencia_procesos_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
});

module.exports = router;
