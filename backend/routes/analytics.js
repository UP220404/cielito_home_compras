const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validateDateRange } = require('../utils/validators');
const { apiResponse } = require('../utils/helpers');

// GET /api/analytics/summary - Resumen general del dashboard
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    let userFilter = '';
    let params = [];

    // El dashboard es PERSONAL para todos los roles
    // Cada usuario ve solo sus propias estadísticas
    userFilter = 'WHERE user_id = ?';
    params.push(req.user.id);

    // Estadísticas generales con subconsultas para evitar problemas de sintaxis
    const generalStats = await db.getAsync(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pending_requests,
        SUM(CASE WHEN status = 'cotizando' THEN 1 ELSE 0 END) as cotizando,
        SUM(CASE WHEN status = 'autorizada' THEN 1 ELSE 0 END) as authorized_requests,
        SUM(CASE WHEN status = 'entregada' THEN 1 ELSE 0 END) as completed_requests,
        SUM(CASE WHEN status = 'rechazada' THEN 1 ELSE 0 END) as rejected_requests,
        SUM(CASE WHEN status = 'comprada' THEN 1 ELSE 0 END) as purchased_requests
      FROM requests ${userFilter}
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

    // El dashboard es PERSONAL: cada usuario ve solo sus órdenes
    // (órdenes generadas a partir de sus solicitudes)
    const orderFilter = `
      WHERE po.request_id IN (
        SELECT id FROM requests WHERE user_id = ?
      )
    `;
    const orderParams = [req.user.id];

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
      avg_processing_days: Math.round(avgProcessingTime.avg_days || 0)
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
    const topSuppliers = await db.allAsync(`
      SELECT 
        s.id,
        s.name,
        s.category,
        COUNT(po.id) as total_orders,
        SUM(po.total_amount) as total_amount,
        AVG(po.total_amount) as avg_order_amount,
        s.rating
      FROM suppliers s
      JOIN purchase_orders po ON s.id = po.supplier_id
      GROUP BY s.id, s.name, s.category, s.rating
      ORDER BY total_amount DESC
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
    let userFilter = '';
    let params = [];

    if (req.user.role === 'requester') {
      userFilter = 'WHERE user_id = ?';
      params.push(req.user.id);
    }

    const statusDistribution = await db.allAsync(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM requests ${userFilter}), 2) as percentage
      FROM requests ${userFilter}
      GROUP BY status
      ORDER BY count DESC
    `, req.user.role === 'requester' ? [req.user.id, req.user.id] : []);

    res.json(apiResponse(true, statusDistribution));

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

module.exports = router;
