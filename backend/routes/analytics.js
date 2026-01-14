const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateDateRange } = require('../utils/validators');
const { apiResponse } = require('../utils/helpers');

// Helper para obtener filtro de período
function getPeriodFilter(period) {
  switch (period) {
    case 'month':
      return "created_at >= CURRENT_DATE - INTERVAL '1 month'";
    case 'quarter':
      return "created_at >= CURRENT_DATE - INTERVAL '3 months'";
    case 'semester':
      return "created_at >= CURRENT_DATE - INTERVAL '6 months'";
    case 'year':
      return "created_at >= CURRENT_DATE - INTERVAL '1 year'";
    case 'all':
      return "1=1"; // Sin filtro de fecha, mostrar todo
    default:
      return "1=1"; // Default: mostrar todo en lugar de solo 1 año
  }
}

// GET /api/analytics/summary - Resumen general del dashboard
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const { period = 'all' } = req.query; // Default: todos los datos
    const periodFilter = getPeriodFilter(period);

    let userFilter = '';
    let params = [];

    // Dashboard PERSONAL para requesters, GLOBAL para admins/directors/purchasers
    if (req.user.role === 'requester') {
      userFilter = 'WHERE user_id = ?';
      params.push(req.user.id);
    } else {
      // Admins, Directors y Purchasers ven estadísticas de TODO el sistema
      userFilter = 'WHERE 1=1';
    }

    // Agregar filtro de período
    const whereClause = `${userFilter} AND ${periodFilter}`;

    // Estadísticas generales con subconsultas para evitar problemas de sintaxis
    const generalStats = await db.getAsync(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pending_requests,
        SUM(CASE WHEN status = 'cotizando' THEN 1 ELSE 0 END) as cotizando,
        SUM(CASE WHEN status = 'autorizada' THEN 1 ELSE 0 END) as authorized_requests,
        SUM(CASE WHEN status IN ('entregada', 'recibida') THEN 1 ELSE 0 END) as completed_requests,
        SUM(CASE WHEN status = 'rechazada' THEN 1 ELSE 0 END) as rejected_requests,
        SUM(CASE WHEN status = 'comprada' THEN 1 ELSE 0 END) as purchased_requests
      FROM requests ${whereClause}
    `, params);

    // Consultas separadas para today y week con sintaxis correcta
    const todayStats = await db.getAsync(`
      SELECT COUNT(*) as today_requests
      FROM requests
      ${userFilter} AND DATE(created_at) = CURRENT_DATE
    `, params);

    const weekStats = await db.getAsync(`
      SELECT COUNT(*) as week_requests
      FROM requests
      ${userFilter} AND DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days'
    `, params);

    // Combinar resultados
    Object.assign(generalStats, todayStats, weekStats);

    // Estadísticas de órdenes de compra
    let orderStats = { total_orders: 0, total_amount: 0, avg_order_amount: 0 };

    // Filtrar órdenes según rol
    let orderFilter = '';
    let orderParams = [];

    if (req.user.role === 'requester') {
      // Requesters: solo órdenes de sus solicitudes
      orderFilter = `WHERE po.request_id IN (SELECT id FROM requests WHERE user_id = ?)`;
      orderParams = [req.user.id];
    } else {
      // Admins/Directors/Purchasers: todas las órdenes del sistema
      orderFilter = 'WHERE 1=1';
    }

    orderStats = await db.getAsync(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(AVG(total_amount), 0) as avg_order_amount
      FROM purchase_orders po
      ${orderFilter}
    `, orderParams);

    // Tiempo promedio de procesamiento
    const avgProcessingTime = await db.getAsync(`
      SELECT
        AVG(
          CASE
            WHEN status = 'entregada' AND authorized_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (updated_at - authorized_at)) / 86400
            ELSE NULL
          END
        ) as avg_days
      FROM requests ${userFilter}
    `, params);

    const responseData = {
      ...generalStats,
      ...orderStats,
      total_value: orderStats.total_amount || 0,
      avg_processing_time: Math.round(avgProcessingTime.avg_days || 0),
      avg_processing_days: Math.round(avgProcessingTime.avg_days || 0),
      completion_rate: generalStats.total_requests > 0
        ? Math.round((generalStats.completed_requests / generalStats.total_requests) * 100)
        : 0
    };

    // Log para debugging
    console.log(`📊 Dashboard /analytics/summary para usuario ${req.user.id} (${req.user.role}):`, responseData);

    res.json(apiResponse(true, responseData));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/spending-by-area - Gastos por área
router.get('/spending-by-area', authMiddleware, requireRole('purchaser', 'admin', 'director'), validateDateRange, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let whereClause = 'WHERE po.id IS NOT NULL';
    let params = [];

    if (startDate) {
      whereClause += ' AND po.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND po.created_at <= ?';
      params.push(endDate);
    }

    const spendingByArea = await db.allAsync(`
      SELECT 
        r.area,
        COUNT(po.id) as total_orders,
        SUM(po.total_amount) as total_spent,
        AVG(po.total_amount) as avg_order_amount,
        MAX(po.total_amount) as max_order_amount
      FROM purchase_orders po
      JOIN requests r ON po.request_id = r.id
      ${whereClause}
      GROUP BY r.area
      ORDER BY total_spent DESC
    `, params);

    res.json(apiResponse(true, spendingByArea));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/requests-by-month - Solicitudes por mes
router.get('/requests-by-month', authMiddleware, async (req, res, next) => {
  try {
    let userFilter = '';
    let params = [];

    if (req.user.role === 'requester') {
      userFilter = 'WHERE user_id = ?';
      params.push(req.user.id);
    }

    const whereClause = userFilter
      ? `${userFilter} AND created_at >= CURRENT_DATE - INTERVAL '12 months'`
      : `WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'`;

    const requestsByMonth = await db.allAsync(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'entregada' THEN 1 ELSE 0 END) as completed_requests,
        SUM(CASE WHEN status = 'rechazada' THEN 1 ELSE 0 END) as rejected_requests
      FROM requests
      ${whereClause}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `, params);

    res.json(apiResponse(true, requestsByMonth));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/top-suppliers - Top proveedores
router.get('/top-suppliers', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const periodFilter = getPeriodFilter(period).replace('created_at', 'q.created_at');

    // Calcular por proveedor basado en items seleccionados, no en órdenes completas
    const topSuppliers = await db.allAsync(`
      SELECT
        s.id,
        s.name,
        s.category,
        COUNT(DISTINCT q.id) as orders_count,
        COALESCE(SUM(qi.unit_price * ri.quantity), 0) as total_value,
        COALESCE(AVG(qi.unit_price * ri.quantity), 0) as avg_order_amount,
        COALESCE(s.rating, 0) as rating
      FROM suppliers s
      LEFT JOIN quotations q ON s.id = q.supplier_id AND q.is_selected = TRUE
      LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
      LEFT JOIN request_items ri ON qi.request_item_id = ri.id
      WHERE ${periodFilter} OR q.id IS NULL
      GROUP BY s.id, s.name, s.category, s.rating
      HAVING SUM(qi.unit_price * ri.quantity) > 0
      ORDER BY total_value DESC
      LIMIT 10
    `);

    res.json(apiResponse(true, topSuppliers));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/status-distribution - Distribución por estatus
router.get('/status-distribution', authMiddleware, async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const periodFilter = getPeriodFilter(period);

    let userFilter = '';
    let params = [];

    if (req.user.role === 'requester') {
      userFilter = `user_id = $1 AND`;
      params.push(req.user.id);
    }

    const statusDistribution = await db.allAsync(`
      SELECT
        status,
        COUNT(*) as count
      FROM requests
      WHERE ${userFilter} ${periodFilter}
      GROUP BY status
      ORDER BY count DESC
    `, params);

    // Mapear nombres de status a español
    const statusNames = {
      'pendiente': 'Pendiente',
      'cotizando': 'Cotizando',
      'autorizada': 'Autorizada',
      'rechazada': 'Rechazada',
      'emitida': 'Emitida',
      'en_transito': 'En Tránsito',
      'recibida': 'Recibida',
      'entregada': 'Entregada'
    };

    res.json(apiResponse(true, {
      labels: statusDistribution.map(s => statusNames[s.status] || s.status),
      values: statusDistribution.map(s => parseInt(s.count))
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/urgency-priority - Análisis de urgencia y prioridad
router.get('/urgency-priority', authMiddleware, async (req, res, next) => {
  try {
    let userFilter = '';
    let params = [];

    if (req.user.role === 'requester') {
      userFilter = 'WHERE user_id = ?';
      params.push(req.user.id);
    }

    const urgencyAnalysis = await db.allAsync(`
      SELECT
        urgency,
        priority,
        COUNT(*) as count,
        AVG(
          CASE
            WHEN status = 'entregada' AND authorized_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400
            ELSE NULL
          END
        ) as avg_completion_days
      FROM requests ${userFilter}
      GROUP BY urgency, priority
      ORDER BY urgency, priority
    `, params);

    res.json(apiResponse(true, urgencyAnalysis));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/monthly-spending - Gastos mensuales
router.get('/monthly-spending', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const monthlySpending = await db.allAsync(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(id) as total_orders,
        SUM(total_amount) as total_spent,
        AVG(total_amount) as avg_order_amount
      FROM purchase_orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    res.json(apiResponse(true, monthlySpending));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/response-times - Tiempos de respuesta
router.get('/response-times', authMiddleware, requireRole('purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const responseTimes = await db.getAsync(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (authorized_at - created_at)) / 86400) as avg_authorization_days,
        AVG(
          CASE
            WHEN status IN ('comprada', 'entregada')
            THEN EXTRACT(EPOCH FROM (updated_at - authorized_at)) / 86400
            ELSE NULL
          END
        ) as avg_purchase_days,
        COUNT(CASE WHEN EXTRACT(EPOCH FROM (authorized_at - created_at)) / 86400 > 3 THEN 1 END) as delayed_authorizations
      FROM requests
      WHERE authorized_at IS NOT NULL
    `);

    res.json(apiResponse(true, {
      avg_authorization_days: Math.round((responseTimes.avg_authorization_days || 0) * 10) / 10,
      avg_purchase_days: Math.round((responseTimes.avg_purchase_days || 0) * 10) / 10,
      delayed_authorizations: responseTimes.delayed_authorizations || 0
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/trends - Tendencias mensuales
router.get('/trends', authMiddleware, requireRole('director', 'admin'), async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const months = period === 'month' ? 1 : period === 'quarter' ? 3 : period === 'semester' ? 6 : 12;

    const trends = await db.allAsync(`
      SELECT
        TO_CHAR(created_at, 'Mon') as month_name,
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as created,
        SUM(CASE WHEN status IN ('entregada', 'recibida') THEN 1 ELSE 0 END) as completed
      FROM requests
      WHERE created_at >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'Mon')
      ORDER BY month ASC
    `);

    res.json(apiResponse(true, {
      labels: trends.map(t => t.month_name),
      created: trends.map(t => parseInt(t.created)),
      completed: trends.map(t => parseInt(t.completed)),
      growth_rate: trends.length > 1
        ? Math.round(((trends[trends.length-1].created - trends[0].created) / Math.max(trends[0].created, 1)) * 100)
        : 0
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/by-area - Solicitudes por área
router.get('/by-area', authMiddleware, requireRole('director', 'admin'), async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const periodFilter = getPeriodFilter(period);

    const byArea = await db.allAsync(`
      SELECT
        area,
        COUNT(*) as count
      FROM requests
      WHERE ${periodFilter}
      GROUP BY area
      ORDER BY count DESC
    `);

    res.json(apiResponse(true, {
      labels: byArea.map(a => a.area),
      values: byArea.map(a => parseInt(a.count))
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/processing-time - Tiempo de procesamiento por mes
router.get('/processing-time', authMiddleware, requireRole('director', 'admin'), async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const months = period === 'month' ? 1 : period === 'quarter' ? 3 : period === 'semester' ? 6 : 12;

    const processingTime = await db.allAsync(`
      SELECT
        TO_CHAR(created_at, 'Mon') as month_name,
        TO_CHAR(created_at, 'YYYY-MM') as month,
        AVG(
          CASE
            WHEN status IN ('entregada', 'recibida') AND authorized_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400
            ELSE NULL
          END
        ) as avg_days
      FROM requests
      WHERE created_at >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'Mon')
      ORDER BY month ASC
    `);

    res.json(apiResponse(true, {
      labels: processingTime.map(t => t.month_name),
      values: processingTime.map(t => Math.round((parseFloat(t.avg_days) || 0) * 10) / 10)
    }));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/user-activity - Actividad de usuarios
router.get('/user-activity', authMiddleware, requireRole('director', 'admin'), async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const periodFilter = getPeriodFilter(period);

    // FIX: Mostrar TODOS los usuarios que hacen solicitudes, no solo requesters
    // Esto permite que admins/purchasers/directors que también crean solicitudes aparezcan
    const userActivity = await db.allAsync(`
      SELECT
        u.id,
        u.name,
        u.area,
        u.role,
        COUNT(r.id) as requests_count
      FROM users u
      LEFT JOIN requests r ON u.id = r.user_id AND ${periodFilter.replace('created_at', 'r.created_at')}
      GROUP BY u.id, u.name, u.area, u.role
      HAVING COUNT(r.id) > 0
      ORDER BY requests_count DESC
      LIMIT 10
    `);

    res.json(apiResponse(true, userActivity));

  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/cost-analysis - Análisis de costos por área
router.get('/cost-analysis', authMiddleware, requireRole('director', 'admin'), async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const periodFilter = getPeriodFilter(period).replace('created_at', 'po.created_at');

    const costAnalysis = await db.allAsync(`
      SELECT
        r.area,
        COALESCE(SUM(po.total_amount), 0) as total_value
      FROM requests r
      LEFT JOIN purchase_orders po ON r.id = po.request_id AND ${periodFilter}
      GROUP BY r.area
      ORDER BY total_value DESC
    `);

    res.json(apiResponse(true, {
      labels: costAnalysis.map(c => c.area),
      values: costAnalysis.map(c => parseFloat(c.total_value) || 0)
    }));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
