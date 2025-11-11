const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../utils/validators');
const { apiResponse, getClientIP, paginate } = require('../utils/helpers');
const logger = require('../utils/logger');
const pdfService = require('../services/pdfService');
const notificationService = require('../services/notificationService');

// POST /api/no-requirements - Crear nuevo no requerimiento
router.post('/',
  authMiddleware,
  [
    body('week_start').isDate().withMessage('Fecha de inicio de semana inválida'),
    body('week_end').isDate().withMessage('Fecha de fin de semana inválida'),
    body('notes').optional().isString().trim(),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const { week_start, week_end, notes } = req.body;
      const userId = req.user.id;

      // Obtener información del usuario (área)
      const user = await db.getAsync(
        'SELECT area FROM users WHERE id = ?',
        [userId]
      );

      if (!user || !user.area) {
        return res.status(400).json(apiResponse(false, null, null, 'Usuario sin área asignada'));
      }

      // Verificar que no haya solapamiento de fechas
      const existing = await db.getAsync(`
        SELECT id FROM no_requirements
        WHERE area = ?
        AND status != 'rechazado'
        AND (
          (start_date <= ? AND end_date >= ?)
          OR (start_date >= ? AND start_date <= ?)
        )
      `, [user.area, week_start, week_start, week_start, week_end]);

      if (existing) {
        return res.status(409).json(apiResponse(false, null, null,
          'Ya existe un formato de no requerimiento activo para esta área en el periodo seleccionado'));
      }

      // Crear no requerimiento
      const result = await db.getAsync(`
        INSERT INTO no_requirements (user_id, area, start_date, end_date, notes, status)
        VALUES (?, ?, ?, ?, ?, 'pendiente')
        RETURNING id
      `, [userId, user.area, week_start, week_end, notes || null]);

      const noReqId = result.id;

      // Log de auditoría
      await db.auditLog('no_requirements', noReqId, 'create', null, {
        area: user.area,
        start_date: week_start,
        end_date: week_end
      }, userId, getClientIP(req));

      logger.info(`No requerimiento creado: ID ${noReqId} - Área ${user.area} - Semana ${week_start} a ${week_end}`);

      // Enviar notificación a directores/admin
      await notificationService.notifyNoRequirementCreated(noReqId);

      res.status(201).json(apiResponse(true, {
        id: noReqId,
        area: user.area,
        start_date: week_start,
        end_date: week_end,
        status: 'pendiente'
      }, 'Formato de no requerimiento creado exitosamente'));

    } catch (error) {
      logger.error('Error creando no requerimiento: %o', error);
      next(error);
    }
  }
);

// GET /api/no-requirements - Listar no requerimientos
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, area, week_start } = req.query;
    const { limit: limitNum, offset } = paginate(parseInt(page), parseInt(limit));

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Si no es admin o director, solo ver los de su área
    if (!['admin', 'director'].includes(req.user.role)) {
      const user = await db.getAsync('SELECT area FROM users WHERE id = ?', [req.user.id]);
      whereClause += ' AND nr.area = ?';
      params.push(user.area);
    }

    if (status) {
      whereClause += ' AND nr.status = ?';
      params.push(status);
    }

    if (area) {
      whereClause += ' AND nr.area = ?';
      params.push(area);
    }

    if (week_start) {
      whereClause += ' AND nr.start_date = ?';
      params.push(week_start);
    }

    const query = `
      SELECT
        nr.*,
        u.name as created_by_name,
        u.email as created_by_email,
        approver.name as approved_by_name
      FROM no_requirements nr
      JOIN users u ON nr.user_id = u.id
      LEFT JOIN users approver ON nr.approved_by = approver.id
      ${whereClause}
      ORDER BY nr.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const noRequirements = await db.allAsync(query, [...params, limitNum, offset]);

    // Contar total
    const countQuery = `SELECT COUNT(*) as total FROM no_requirements nr ${whereClause}`;
    const { total } = await db.getAsync(countQuery, params);

    res.json(apiResponse(true, {
      no_requirements: noRequirements,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }));

  } catch (error) {
    logger.error('Error listando no requerimientos: %o', error);
    next(error);
  }
});

// GET /api/no-requirements/my - Mis no requerimientos
router.get('/my', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { month, year, status } = req.query;

    let whereClause = 'WHERE nr.user_id = ?';
    let params = [userId];

    // Filtro por mes y año
    if (month && year) {
      whereClause += ` AND EXTRACT(YEAR FROM nr.start_date)::TEXT = ? AND EXTRACT(MONTH FROM nr.start_date)::TEXT = ?`;
      params.push(year, month);
    }

    // Filtro por estado
    if (status) {
      whereClause += ' AND nr.status = ?';
      params.push(status);
    }

    const noRequirements = await db.allAsync(`
      SELECT
        nr.*,
        approver.name as approved_by_name
      FROM no_requirements nr
      LEFT JOIN users approver ON nr.approved_by = approver.id
      ${whereClause}
      ORDER BY nr.created_at DESC
      LIMIT 200
    `, params);

    res.json(apiResponse(true, noRequirements));

  } catch (error) {
    logger.error('Error obteniendo mis no requerimientos: %o', error);
    next(error);
  }
});

// GET /api/no-requirements/pending - Pendientes de aprobación (solo director/admin)
router.get('/pending',
  authMiddleware,
  requireRole('director', 'admin'),
  async (req, res, next) => {
    try {
      const { month, year } = req.query;

      let whereClause = 'WHERE nr.status = \'pendiente\'';
      let params = [];

      // Filtro por mes y año
      if (month && year) {
        whereClause += ` AND EXTRACT(YEAR FROM nr.start_date)::TEXT = ? AND EXTRACT(MONTH FROM nr.start_date)::TEXT = ?`;
        params.push(year, month);
      }

      const noRequirements = await db.allAsync(`
        SELECT
          nr.*,
          u.name as created_by_name,
          u.email as created_by_email
        FROM no_requirements nr
        JOIN users u ON nr.user_id = u.id
        ${whereClause}
        ORDER BY nr.created_at DESC
      `, params);

      res.json(apiResponse(true, noRequirements));

    } catch (error) {
      logger.error('Error obteniendo no requerimientos pendientes: %o', error);
      next(error);
    }
  }
);

// GET /api/no-requirements/completed - Completados (aprobados y rechazados, solo director/admin)
router.get('/completed',
  authMiddleware,
  requireRole('director', 'admin'),
  async (req, res, next) => {
    try {
      const { month, year, status } = req.query;

      let whereClause = 'WHERE nr.status IN (\'aprobado\', \'rechazado\')';
      let params = [];

      // Filtro por mes y año
      if (month && year) {
        whereClause += ` AND EXTRACT(YEAR FROM nr.start_date)::TEXT = ? AND EXTRACT(MONTH FROM nr.start_date)::TEXT = ?`;
        params.push(year, month);
      }

      // Filtro específico por estado (aprobado o rechazado)
      if (status && (status === 'aprobado' || status === 'rechazado')) {
        whereClause = 'WHERE nr.status = ?';
        params = [status];

        // Re-aplicar filtro de mes/año si existe
        if (month && year) {
          whereClause += ` AND EXTRACT(YEAR FROM nr.start_date)::TEXT = ? AND EXTRACT(MONTH FROM nr.start_date)::TEXT = ?`;
          params.push(year, month);
        }
      }

      const noRequirements = await db.allAsync(`
        SELECT
          nr.*,
          u.name as created_by_name,
          u.email as created_by_email,
          approver.name as approved_by_name
        FROM no_requirements nr
        JOIN users u ON nr.user_id = u.id
        LEFT JOIN users approver ON nr.approved_by = approver.id
        ${whereClause}
        ORDER BY nr.approved_at DESC, nr.created_at DESC
      `, params);

      res.json(apiResponse(true, noRequirements));

    } catch (error) {
      logger.error('Error obteniendo no requerimientos completados: %o', error);
      next(error);
    }
  }
);

// GET /api/no-requirements/:id - Obtener no requerimiento específico
router.get('/:id',
  authMiddleware,
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const noRequirementId = req.params.id;

      const noRequirement = await db.getAsync(`
        SELECT
          nr.*,
          u.name as created_by_name,
          u.email as created_by_email,
          approver.name as approved_by_name
        FROM no_requirements nr
        JOIN users u ON nr.user_id = u.id
        LEFT JOIN users approver ON nr.approved_by = approver.id
        WHERE nr.id = ?
      `, [noRequirementId]);

      if (!noRequirement) {
        return res.status(404).json(apiResponse(false, null, null, 'No requerimiento no encontrado'));
      }

      // Verificar permisos: solo el creador, director o admin pueden verlo
      if (noRequirement.user_id !== req.user.id &&
          !['admin', 'director'].includes(req.user.role)) {
        return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
      }

      res.json(apiResponse(true, noRequirement));

    } catch (error) {
      logger.error('Error obteniendo no requerimiento: %o', error);
      next(error);
    }
  }
);

// PATCH /api/no-requirements/:id/approve - Aprobar no requerimiento (solo director/admin)
router.patch('/:id/approve',
  authMiddleware,
  requireRole('director', 'admin'),
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const noRequirementId = req.params.id;
      const approverId = req.user.id;

      // Verificar que existe y está pendiente
      const noRequirement = await db.getAsync(
        'SELECT * FROM no_requirements WHERE id = ?',
        [noRequirementId]
      );

      if (!noRequirement) {
        return res.status(404).json(apiResponse(false, null, null, 'No requerimiento no encontrado'));
      }

      if (noRequirement.status !== 'pendiente') {
        return res.status(400).json(apiResponse(false, null, null,
          `Este no requerimiento ya está ${noRequirement.status}`));
      }

      // Aprobar
      await db.runAsync(`
        UPDATE no_requirements
        SET status = 'aprobado',
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [approverId, noRequirementId]);

      // Log de auditoría
      await db.auditLog('no_requirements', noRequirementId, 'update',
        { status: 'pendiente' },
        { status: 'aprobado', approved_by: approverId },
        approverId,
        getClientIP(req)
      );

      logger.info(`No requerimiento aprobado: ID ${noRequirementId} por usuario ${approverId}`);

      // Enviar notificación al creador
      await notificationService.notifyNoRequirementApproved(noRequirementId);

      res.json(apiResponse(true, null, 'No requerimiento aprobado exitosamente'));

    } catch (error) {
      logger.error('Error aprobando no requerimiento: %o', error);
      next(error);
    }
  }
);

// PATCH /api/no-requirements/:id/reject - Rechazar no requerimiento (solo director/admin)
router.patch('/:id/reject',
  authMiddleware,
  requireRole('director', 'admin'),
  [
    param('id').isInt().withMessage('ID inválido'),
    body('reason').notEmpty().withMessage('Razón del rechazo requerida'),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const noRequirementId = req.params.id;
      const approverId = req.user.id;
      const { reason } = req.body;

      // Verificar que existe y está pendiente
      const noRequirement = await db.getAsync(
        'SELECT * FROM no_requirements WHERE id = ?',
        [noRequirementId]
      );

      if (!noRequirement) {
        return res.status(404).json(apiResponse(false, null, null, 'No requerimiento no encontrado'));
      }

      if (noRequirement.status !== 'pendiente') {
        return res.status(400).json(apiResponse(false, null, null,
          `Este no requerimiento ya está ${noRequirement.status}`));
      }

      // Rechazar
      await db.runAsync(`
        UPDATE no_requirements
        SET status = 'rechazado',
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP,
            rejection_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [approverId, reason, noRequirementId]);

      // Log de auditoría
      await db.auditLog('no_requirements', noRequirementId, 'update',
        { status: 'pendiente' },
        { status: 'rechazado', approved_by: approverId, rejection_reason: reason },
        approverId,
        getClientIP(req)
      );

      logger.info(`No requerimiento rechazado: ID ${noRequirementId} por usuario ${approverId} - Razón: ${reason}`);

      // Enviar notificación al creador
      await notificationService.notifyNoRequirementRejected(noRequirementId);

      res.json(apiResponse(true, null, 'No requerimiento rechazado'));

    } catch (error) {
      logger.error('Error rechazando no requerimiento: %o', error);
      next(error);
    }
  }
);

// DELETE /api/no-requirements/:id - Eliminar no requerimiento (solo creador o admin)
router.delete('/:id',
  authMiddleware,
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const noRequirementId = req.params.id;

      const noRequirement = await db.getAsync(
        'SELECT * FROM no_requirements WHERE id = ?',
        [noRequirementId]
      );

      if (!noRequirement) {
        return res.status(404).json(apiResponse(false, null, null, 'No requerimiento no encontrado'));
      }

      // Solo el creador o admin pueden eliminar
      if (noRequirement.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
      }

      // Solo se puede eliminar si está pendiente o rechazado
      if (!['pendiente', 'rechazado'].includes(noRequirement.status)) {
        return res.status(400).json(apiResponse(false, null, null, 'No se puede eliminar un no requerimiento aprobado'));
      }

      await db.runAsync('DELETE FROM no_requirements WHERE id = ?', [noRequirementId]);

      // Log de auditoría
      await db.auditLog('no_requirements', noRequirementId, 'delete',
        { area: noRequirement.area, start_date: noRequirement.start_date },
        null,
        req.user.id,
        getClientIP(req)
      );

      res.json(apiResponse(true, null, 'No requerimiento eliminado'));

    } catch (error) {
      logger.error('Error eliminando no requerimiento: %o', error);
      next(error);
    }
  }
);

// GET /api/no-requirements/:id/pdf - Generar PDF (solo aprobados)
router.get('/:id/pdf',
  authMiddleware,
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const noRequirementId = req.params.id;

      const noRequirement = await db.getAsync(`
        SELECT
          nr.*,
          u.name as created_by_name,
          u.email as created_by_email,
          approver.name as approved_by_name
        FROM no_requirements nr
        JOIN users u ON nr.user_id = u.id
        LEFT JOIN users approver ON nr.approved_by = approver.id
        WHERE nr.id = ?
      `, [noRequirementId]);

      if (!noRequirement) {
        return res.status(404).json(apiResponse(false, null, null, 'No requerimiento no encontrado'));
      }

      // Solo se puede generar PDF de formatos aprobados
      if (noRequirement.status !== 'aprobado') {
        return res.status(400).json(apiResponse(false, null, null, 'Solo se puede generar PDF de formatos aprobados'));
      }

      // Verificar permisos: solo el creador, director o admin pueden generar el PDF
      if (noRequirement.user_id !== req.user.id &&
          !['admin', 'director'].includes(req.user.role)) {
        return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
      }

      // Generar PDF
      const pdfBuffer = await pdfService.generateNoRequirementPDF(noRequirement);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="no-requerimiento-${noRequirementId}.pdf"`);
      res.send(pdfBuffer);

    } catch (error) {
      logger.error('Error generando PDF: %o', error);
      next(error);
    }
  }
);

module.exports = router;