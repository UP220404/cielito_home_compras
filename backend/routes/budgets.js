const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../utils/validators');
const { apiResponse, getClientIP } = require('../utils/helpers');
const logger = require('../utils/logger');

// GET /api/budgets - Obtener todos los presupuestos (filtrar por año)
router.get('/',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { year } = req.query;
      const currentYear = year || new Date().getFullYear();

      const budgets = await db.allAsync(`
        SELECT
          b.*,
          u.name as created_by_name
        FROM budgets b
        LEFT JOIN users u ON b.created_by = u.id
        WHERE b.year = ?
        ORDER BY b.area ASC
      `, [currentYear]);

      // Calcular gastos dinámicamente para cada presupuesto
      const budgetsWithSpent = await Promise.all(budgets.map(async (budget) => {
        const spentResult = await db.getAsync(`
          SELECT COALESCE(SUM(po.total_amount), 0) as spent
          FROM purchase_orders po
          JOIN requests r ON po.request_id = r.id
          WHERE r.area = ?
            AND EXTRACT(YEAR FROM po.order_date)::TEXT = ?
            AND po.status IN ('approved', 'aprobada', 'received', 'recibida', 'completed', 'completada')
        `, [budget.area, currentYear.toString()]);

        const spent_amount = parseFloat(spentResult.spent) || 0;
        const total_amount = parseFloat(budget.total_amount) || 0;
        const available_amount = total_amount - spent_amount;
        const percentage_used = total_amount > 0 ? (spent_amount / total_amount) * 100 : 0;

        return {
          ...budget,
          spent_amount,
          available_amount,
          percentage_used: Math.round(percentage_used * 100) / 100
        };
      }));

      res.json(apiResponse(true, budgetsWithSpent));

    } catch (error) {
      logger.error('Error en GET /budgets: %o', error);
      next(error);
    }
  }
);

// GET /api/budgets/my - Obtener presupuesto de mi área
router.get('/my',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;
      const { year } = req.query;
      const currentYear = year || new Date().getFullYear();

      const budget = await db.getAsync(`
        SELECT b.*
        FROM budgets b
        WHERE b.area = ? AND b.fiscal_year = ?
      `, [user.area, currentYear]);

      if (!budget) {
        return res.json(apiResponse(true, {
          area: user.area,
          year: currentYear,
          total_amount: 0,
          spent_amount: 0,
          available_amount: 0,
          percentage_used: 0,
          message: 'No hay presupuesto asignado para tu área este año'
        }));
      }

      // Calcular gasto dinámicamente desde las órdenes de compra
      const spentResult = await db.getAsync(`
        SELECT COALESCE(SUM(po.total_amount), 0) as spent
        FROM purchase_orders po
        JOIN requests r ON po.request_id = r.id
        WHERE r.area = ?
          AND EXTRACT(YEAR FROM po.order_date)::TEXT = ?
          AND po.status IN ('approved', 'aprobada', 'received', 'recibida', 'completed', 'completada')
      `, [user.area, currentYear.toString()]);

      const spent_amount = parseFloat(spentResult.spent) || 0;
      const total_amount = parseFloat(budget.total_amount) || 0;
      const available_amount = total_amount - spent_amount;
      const percentage_used = total_amount > 0 ? (spent_amount / total_amount) * 100 : 0;

      res.json(apiResponse(true, {
        ...budget,
        spent_amount,
        available_amount,
        percentage_used: Math.round(percentage_used * 100) / 100
      }));

    } catch (error) {
      logger.error('Error en GET /budgets/my: %o', error);
      next(error);
    }
  }
);

// GET /api/budgets/:id - Obtener presupuesto específico
router.get('/:id',
  authMiddleware,
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const budgetId = req.params.id;

      const budget = await db.getAsync(`
        SELECT
          b.*,
          u.name as created_by_name,
          ROUND((b.spent_amount / b.total_amount) * 100, 2) as percentage_used,
          (b.total_amount - b.spent_amount) as available_amount
        FROM budgets b
        LEFT JOIN users u ON b.created_by = u.id
        WHERE b.id = ?
      `, [budgetId]);

      if (!budget) {
        return res.status(404).json(apiResponse(false, null, null, 'Presupuesto no encontrado'));
      }

      res.json(apiResponse(true, budget));

    } catch (error) {
      logger.error('Error en GET /budgets/:id: %o', error);
      next(error);
    }
  }
);

// POST /api/budgets - Crear/actualizar presupuesto (solo compras/admin)
router.post('/',
  authMiddleware,
  requireRole('purchaser', 'admin'),
  [
    body('area').notEmpty().withMessage('El área es requerida'),
    body('year').isInt({ min: 2020 }).withMessage('Año inválido'),
    body('total_amount').isFloat({ min: 0 }).withMessage('Monto inválido'),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const { area, year, total_amount } = req.body;

      // Verificar si ya existe presupuesto para esa área/año
      const existing = await db.getAsync(
        'SELECT id, spent_amount FROM budgets WHERE area = ? AND year = ?',
        [area, year]
      );

      if (existing) {
        // Actualizar presupuesto existente
        await db.runAsync(`
          UPDATE budgets
          SET total_amount = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [total_amount, existing.id]);

        await db.auditLog('budgets', existing.id, 'update',
          { total_amount: existing.total_amount },
          { total_amount },
          req.user.id,
          getClientIP(req)
        );

        res.json(apiResponse(true, { id: existing.id }, 'Presupuesto actualizado exitosamente'));
      } else {
        // Crear nuevo presupuesto
        const result = await db.runAsync(`
          INSERT INTO budgets (area, year, total_amount, spent_amount, created_by)
          VALUES (?, ?, ?, 0, ?)
        `, [area, year, total_amount, req.user.id]);

        await db.auditLog('budgets', result.id, 'create', null,
          { area, year, total_amount },
          req.user.id,
          getClientIP(req)
        );

        res.status(201).json(apiResponse(true, { id: result.id }, 'Presupuesto creado exitosamente'));
      }

    } catch (error) {
      logger.error('Error en POST /budgets: %o', error);
      next(error);
    }
  }
);

// PUT /api/budgets/:id - Actualizar presupuesto (solo compras/admin)
router.put('/:id',
  authMiddleware,
  requireRole('purchaser', 'admin'),
  [
    param('id').isInt().withMessage('ID inválido'),
    body('total_amount').isFloat({ min: 0 }).withMessage('Monto inválido'),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const budgetId = req.params.id;
      const { total_amount } = req.body;

      const budget = await db.getAsync(
        'SELECT total_amount FROM budgets WHERE id = ?',
        [budgetId]
      );

      if (!budget) {
        return res.status(404).json(apiResponse(false, null, null, 'Presupuesto no encontrado'));
      }

      await db.runAsync(`
        UPDATE budgets
        SET total_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [total_amount, budgetId]);

      await db.auditLog('budgets', budgetId, 'update',
        { total_amount: budget.total_amount },
        { total_amount },
        req.user.id,
        getClientIP(req)
      );

      res.json(apiResponse(true, null, 'Presupuesto actualizado exitosamente'));

    } catch (error) {
      logger.error('Error en PUT /budgets/:id: %o', error);
      next(error);
    }
  }
);

// DELETE /api/budgets/:id - Eliminar presupuesto (solo admin)
router.delete('/:id',
  authMiddleware,
  requireRole('admin'),
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const budgetId = req.params.id;

      const budget = await db.getAsync(
        'SELECT * FROM budgets WHERE id = ?',
        [budgetId]
      );

      if (!budget) {
        return res.status(404).json(apiResponse(false, null, null, 'Presupuesto no encontrado'));
      }

      await db.runAsync('DELETE FROM budgets WHERE id = ?', [budgetId]);

      await db.auditLog('budgets', budgetId, 'delete', budget, null, req.user.id, getClientIP(req));

      res.json(apiResponse(true, null, 'Presupuesto eliminado exitosamente'));

    } catch (error) {
      logger.error('Error en DELETE /budgets/:id: %o', error);
      next(error);
    }
  }
);

// GET /api/budgets/check/:area/:amount - Verificar si hay presupuesto disponible
router.get('/check/:area/:amount',
  authMiddleware,
  [
    param('area').notEmpty().withMessage('Área requerida'),
    param('amount').isFloat({ min: 0 }).withMessage('Monto inválido'),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const { area, amount } = req.params;
      const currentYear = new Date().getFullYear();

      const budget = await db.getAsync(`
        SELECT
          id,
          total_amount,
          spent_amount,
          (total_amount - spent_amount) as available_amount,
          ROUND((spent_amount / total_amount) * 100, 2) as percentage_used
        FROM budgets
        WHERE area = ? AND year = ?
      `, [area, currentYear]);

      if (!budget) {
        return res.json(apiResponse(false, null, null, 'No hay presupuesto asignado para esta área'));
      }

      const requestedAmount = parseFloat(amount);
      const available = budget.available_amount;
      const hasAvailable = available >= requestedAmount;
      const exceedsBy = hasAvailable ? 0 : (requestedAmount - available);
      const newPercentage = ((budget.spent_amount + requestedAmount) / budget.total_amount) * 100;

      // Determinar nivel de alerta
      let alertLevel = null;
      let alertMessage = null;

      if (newPercentage >= 100) {
        alertLevel = 'critical';
        alertMessage = `⚠️ CRÍTICO: Esta operación excede el presupuesto en $${exceedsBy.toFixed(2)}. Se requiere aprobación de Dirección.`;
      } else if (newPercentage >= 90) {
        alertLevel = 'warning';
        alertMessage = `⚠️ ADVERTENCIA: Después de esta operación habrás usado el ${newPercentage.toFixed(1)}% de tu presupuesto.`;
      } else if (newPercentage >= 75) {
        alertLevel = 'info';
        alertMessage = `ℹ️ AVISO: Llevarás el ${newPercentage.toFixed(1)}% del presupuesto usado.`;
      }

      const response = {
        has_budget: hasAvailable,
        available_amount: available,
        requested_amount: requestedAmount,
        exceeds_by: exceedsBy,
        current_percentage: budget.percentage_used,
        new_percentage: Math.round(newPercentage * 100) / 100,
        requires_approval: !hasAvailable,
        alert_level: alertLevel,
        alert_message: alertMessage
      };

      res.json(apiResponse(true, response));

    } catch (error) {
      logger.error('Error en GET /budgets/check: %o', error);
      next(error);
    }
  }
);

// POST /api/budgets/approve-excess/:requestId - Aprobar exceso de presupuesto (solo dirección/admin)
router.post('/approve-excess/:requestId',
  authMiddleware,
  requireRole('director', 'admin'),
  [
    param('requestId').isInt().withMessage('ID de solicitud inválido'),
    body('notes').optional().trim(),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { notes } = req.body;

      // Verificar que la solicitud existe
      const request = await db.getAsync(
        'SELECT * FROM requests WHERE id = ?',
        [requestId]
      );

      if (!request) {
        return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
      }

      // Marcar como aprobado el exceso de presupuesto
      await db.runAsync(`
        UPDATE requests
        SET budget_approved = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [requestId]);

      // Crear notificación para el solicitante
      await db.runAsync(`
        INSERT INTO notifications (user_id, type, title, message, related_entity, entity_id)
        VALUES (?, 'budget_approved', 'Presupuesto Excedido Aprobado',
                ?, 'request', ?)
      `, [
        request.user_id,
        `Tu solicitud #${requestId} que excede el presupuesto ha sido aprobada por Dirección. ${notes ? 'Nota: ' + notes : ''}`,
        requestId
      ]);

      await db.auditLog('requests', requestId, 'budget_approved',
        { budget_approved: 0 },
        { budget_approved: 1, notes },
        req.user.id,
        getClientIP(req)
      );

      res.json(apiResponse(true, null, 'Exceso de presupuesto aprobado exitosamente'));

    } catch (error) {
      logger.error('Error en POST /budgets/approve-excess: %o', error);
      next(error);
    }
  }
);

// GET /api/budgets/pending-approvals - Obtener solicitudes pendientes de aprobación por exceso (solo dirección/admin)
router.get('/pending-approvals',
  authMiddleware,
  requireRole('director', 'admin'),
  async (req, res, next) => {
    try {
      // Obtener solicitudes que exceden presupuesto y no han sido aprobadas
      const pendingApprovals = await db.allAsync(`
        SELECT
          r.id,
          r.request_number,
          r.title,
          r.description,
          r.total_estimated_amount,
          r.area,
          r.budget_approved,
          r.status,
          r.created_at,
          u.name as requester_name,
          u.email as requester_email,
          b.total_amount as budget_total,
          b.spent_amount as budget_spent,
          (b.total_amount - b.spent_amount) as budget_available,
          ROUND((b.spent_amount / b.total_amount) * 100, 2) as budget_percentage,
          (r.total_estimated_amount - (b.total_amount - b.spent_amount)) as exceeds_by
        FROM requests r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN budgets b ON r.area = b.area AND b.year = EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
        WHERE r.budget_approved = false
          AND r.total_estimated_amount > (b.total_amount - b.spent_amount)
          AND r.status NOT IN ('cancelled', 'rejected')
        ORDER BY r.created_at DESC
      `);

      res.json(apiResponse(true, pendingApprovals));

    } catch (error) {
      logger.error('Error en GET /budgets/pending-approvals: %o', error);
      next(error);
    }
  }
);

// POST /api/budgets/reject-excess/:requestId - Rechazar exceso de presupuesto (solo dirección/admin)
router.post('/reject-excess/:requestId',
  authMiddleware,
  requireRole('director', 'admin'),
  [
    param('requestId').isInt().withMessage('ID de solicitud inválido'),
    body('reason').notEmpty().withMessage('Razón del rechazo es requerida'),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      const request = await db.getAsync(
        'SELECT * FROM requests WHERE id = ?',
        [requestId]
      );

      if (!request) {
        return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
      }

      // Marcar solicitud como rechazada
      await db.runAsync(`
        UPDATE requests
        SET status = 'rechazada', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [reason, requestId]);

      // Crear notificación para el solicitante
      await db.runAsync(`
        INSERT INTO notifications (user_id, type, title, message, related_entity, entity_id)
        VALUES (?, 'request_rejected', 'Solicitud Rechazada por Exceso de Presupuesto',
                ?, 'request', ?)
      `, [
        request.user_id,
        `Tu solicitud #${requestId} ha sido rechazada por Dirección debido a exceso de presupuesto. Razón: ${reason}`,
        requestId
      ]);

      await db.auditLog('requests', requestId, 'budget_rejected',
        { status: request.status },
        { status: 'rechazada', reason },
        req.user.id,
        getClientIP(req)
      );

      res.json(apiResponse(true, null, 'Solicitud rechazada exitosamente'));

    } catch (error) {
      logger.error('Error en POST /budgets/reject-excess: %o', error);
      next(error);
    }
  }
);

module.exports = router;
