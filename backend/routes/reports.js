const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateDateRange } = require('../utils/validators');
const { apiResponse, formatCurrency } = require('../utils/helpers');
const pdfService = require('../services/pdfService');

// Detección automática de base de datos
const DB_TYPE = process.env.DATABASE_URL ? 'postgres' : 'sqlite';

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
    res.sendFile(fullPath);

  } catch (error) {
    next(error);
  }
});

// GET /api/reports/analytics - Reporte analítico completo
router.get('/analytics', authMiddleware, requireRole('admin', 'director'), async (req, res, next) => {
  try {
    // Estadísticas generales
    const monthAgoCondition = DB_TYPE === 'postgres'
      ? "DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'"
      : "DATE(created_at) >= DATE('now', '-30 days')";

    const completionDaysCalc = DB_TYPE === 'postgres'
      ? "EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400"
      : "(julianday(updated_at) - julianday(created_at))";

    const generalStats = await db.getAsync(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'entregada' THEN 1 END) as completed_requests,
        AVG(CASE WHEN status = 'entregada' AND authorized_at IS NOT NULL
            THEN ${completionDaysCalc} END) as avg_completion_days
      FROM requests
    `);

    // Consulta separada para month_requests
    const monthRequests = await db.getAsync(`
      SELECT COUNT(*) as month_requests
      FROM requests
      WHERE ${monthAgoCondition}
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
    const monthFormat = DB_TYPE === 'postgres'
      ? "TO_CHAR(created_at, 'YYYY-MM')"
      : "strftime('%Y-%m', created_at)";

    const monthsAgo = DB_TYPE === 'postgres'
      ? "created_at >= CURRENT_DATE - INTERVAL '12 months'"
      : "created_at >= datetime('now', '-12 months')";

    const monthlyTrends = await db.allAsync(`
      SELECT
        ${monthFormat} as month,
        COUNT(*) as requests_count,
        COUNT(CASE WHEN status = 'entregada' THEN 1 END) as completed_count
      FROM requests
      WHERE ${monthsAgo}
      GROUP BY ${monthFormat}
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

module.exports = router;
