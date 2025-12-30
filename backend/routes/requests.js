const express = require('express');
const router = express.Router();

const db = require('../config/database');
const { authMiddleware, requireRole, requireOwnershipOrRole } = require('../middleware/auth');
const { validateRequest, validateStatusChange, validateId, validatePagination } = require('../utils/validators');
const { apiResponse, generateRequestFolio, formatDateForDB, getClientIP, paginate } = require('../utils/helpers');
const notificationService = require('../services/notificationService');

// GET /api/requests - Obtener todas las solicitudes (con filtros)
router.get('/', authMiddleware, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, area, urgency, user_id } = req.query;
    const { limit: limitNum, offset } = paginate(parseInt(page), parseInt(limit));
    
    let whereClause = 'WHERE 1=1';
    let params = [];

    // Solo los solicitantes ven sus propias solicitudes, otros roles ven todas
    if (req.user.role === 'requester') {
      whereClause += ' AND r.user_id = ?';
      params.push(req.user.id);
    }

    // Filtros adicionales
    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }
    if (area && req.user.role !== 'requester') {
      whereClause += ' AND r.area = ?';
      params.push(area);
    }
    if (req.query.priority) {
      whereClause += ' AND r.priority = ?';
      params.push(req.query.priority);
    }
    if (user_id && req.user.role !== 'requester') {
      whereClause += ' AND r.user_id = ?';
      params.push(user_id);
    }

    // Consulta principal
    const query = `
      SELECT
        r.id, r.folio, r.user_id, r.area, r.request_date, r.delivery_date,
        r.priority, r.justification, r.status, r.authorized_by,
        r.authorized_at, r.rejection_reason, r.created_at, r.updated_at,
        u.name as requester_name,
        u.email as requester_email,
        auth.name as authorized_by_name,
        COUNT(ri.id) as items_count,
        COALESCE(SUM(ri.approximate_cost * ri.quantity), 0) as estimated_total,
        (SELECT COUNT(*) FROM quotations q WHERE q.request_id = r.id) as quotations_count,
        (SELECT COUNT(*) FROM quotations q WHERE q.request_id = r.id AND q.is_selected = TRUE) as has_selected_quotation
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users auth ON r.authorized_by = auth.id
      LEFT JOIN request_items ri ON r.id = ri.request_id
      ${whereClause}
      GROUP BY r.id, r.folio, r.user_id, r.area, r.request_date, r.delivery_date,
               r.priority, r.justification, r.status, r.authorized_by,
               r.authorized_at, r.rejection_reason, r.created_at, r.updated_at,
               u.name, u.email, auth.name
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const requests = await db.allAsync(query, [...params, limitNum, offset]);

    // Contar total para paginación
    const countQuery = `
      SELECT COUNT(DISTINCT r.id) as total
      FROM requests r
      JOIN users u ON r.user_id = u.id
      ${whereClause}
    `;
    const { total } = await db.getAsync(countQuery, params);

    res.json(apiResponse(true, {
      requests,
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

// GET /api/requests/my - Obtener mis solicitudes
router.get('/my', authMiddleware, validatePagination, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const { limit: limitNum, offset } = paginate(parseInt(page), parseInt(limit));
    
    let whereClause = 'WHERE r.user_id = ?';
    let params = [req.user.id];

    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }

    const query = `
      SELECT
        r.id, r.folio, r.user_id, r.area, r.request_date, r.delivery_date,
        r.priority, r.justification, r.status, r.authorized_by,
        r.authorized_at, r.rejection_reason, r.created_at, r.updated_at,
        u.name as requester_name,
        u.email as requester_email,
        auth.name as authorized_by_name,
        COUNT(ri.id) as items_count,
        COALESCE(SUM(ri.approximate_cost * ri.quantity), 0) as estimated_total,
        (SELECT COUNT(*) FROM quotations q WHERE q.request_id = r.id AND q.is_selected = TRUE) as has_selected_quotation,
        po.id as purchase_order_id,
        po.status as purchase_order_status,
        po.folio as purchase_order_folio,
        po.total_amount as purchase_order_total
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users auth ON r.authorized_by = auth.id
      LEFT JOIN request_items ri ON r.id = ri.request_id
      LEFT JOIN purchase_orders po ON r.id = po.request_id
      ${whereClause}
      GROUP BY r.id, r.folio, r.user_id, r.area, r.request_date, r.delivery_date,
               r.priority, r.justification, r.status, r.authorized_by,
               r.authorized_at, r.rejection_reason, r.created_at, r.updated_at,
               u.name, u.email, auth.name, po.id, po.status, po.folio, po.total_amount
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const requests = await db.allAsync(query, [...params, limitNum, offset]);

    const countQuery = `SELECT COUNT(*) as total FROM requests r ${whereClause}`;
    const { total } = await db.getAsync(countQuery, params);

    res.json(apiResponse(true, {
      requests,
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

// GET /api/requests/:id - Obtener solicitud específica con items
router.get('/:id', authMiddleware, validateId, requireOwnershipOrRole('user_id', 'purchaser', 'admin', 'director'), async (req, res, next) => {
  try {
    const requestId = req.params.id;

    // Obtener solicitud
    const request = await db.getAsync(`
      SELECT 
        r.*,
        u.name as requester_name,
        u.email as requester_email,
        auth.name as authorized_by_name
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users auth ON r.authorized_by = auth.id
      WHERE r.id = ?
    `, [requestId]);

    if (!request) {
      return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
    }

    // Obtener items
    const items = await db.allAsync(`
      SELECT * FROM request_items 
      WHERE request_id = ? 
      ORDER BY id ASC
    `, [requestId]);

    // Obtener cotizaciones si las hay
    const quotations = await db.allAsync(`
      SELECT
        q.*,
        s.name as supplier_name,
        u.name as quoted_by_name
      FROM quotations q
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN users u ON q.quoted_by = u.id
      WHERE q.request_id = ?
      ORDER BY q.total_amount ASC
    `, [requestId]);

    // Obtener orden de compra si existe
    const purchaseOrder = await db.getAsync(`
      SELECT
        po.*,
        s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.request_id = ?
    `, [requestId]);

    res.json(apiResponse(true, {
      ...request,
      items,
      quotations,
      purchase_order: purchaseOrder || null
    }));

  } catch (error) {
    next(error);
  }
});

// POST /api/requests - Crear nueva solicitud
router.post('/', authMiddleware, validateRequest, async (req, res, next) => {
  try {
    console.log('📝 Iniciando creación de solicitud...');
    console.log('📦 Datos recibidos:', JSON.stringify(req.body, null, 2));
    console.log('👤 Usuario:', req.user.id, req.user.role, req.user.area);
    const { area, delivery_date, priority, justification, items } = req.body;

    // ========== VALIDACIÓN DE HORARIOS ==========
    // Solo validar si el usuario es requester (los admin/purchaser pueden crear en cualquier momento)
    if (req.user.role === 'requester') {
      console.log('⏰ Validando horario de solicitud para área:', area);

      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Domingo, 1=Lunes... 6=Sábado
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Verificar si existe configuración de horario para este área y día
      const schedule = await db.getAsync(`
        SELECT * FROM area_schedules
        WHERE area = ? AND day_of_week = ? AND is_active = TRUE
      `, [area, dayOfWeek]);

      if (schedule) {
        // Verificar si está dentro del horario permitido
        const isWithinSchedule = currentTime >= schedule.start_time && currentTime <= schedule.end_time;

        if (!isWithinSchedule) {
          console.log(`❌ Fuera de horario. Actual: ${currentTime}, Permitido: ${schedule.start_time}-${schedule.end_time}`);

          // Obtener próximo horario disponible
          const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          const nextSchedules = await db.allAsync(`
            SELECT * FROM area_schedules
            WHERE area = ? AND is_active = TRUE
            ORDER BY day_of_week, start_time
          `, [area]);

          let nextAvailable = null;
          if (nextSchedules.length > 0) {
            // Buscar el siguiente horario disponible
            for (const sch of nextSchedules) {
              if (sch.day_of_week > dayOfWeek ||
                 (sch.day_of_week === dayOfWeek && sch.start_time > currentTime)) {
                nextAvailable = `${daysOfWeek[sch.day_of_week]} de ${sch.start_time} a ${sch.end_time}`;
                break;
              }
            }
            // Si no encontró, usar el primero de la próxima semana
            if (!nextAvailable) {
              const first = nextSchedules[0];
              nextAvailable = `${daysOfWeek[first.day_of_week]} de ${first.start_time} a ${first.end_time}`;
            }
          }

          return res.status(403).json(apiResponse(
            false,
            {
              reason: 'outside_schedule',
              current_time: currentTime,
              current_day: daysOfWeek[dayOfWeek],
              allowed_schedule: `${schedule.start_time} - ${schedule.end_time}`,
              next_available: nextAvailable,
              can_save_draft: true
            },
            `Tu área solo puede crear solicitudes los ${daysOfWeek[dayOfWeek]} de ${schedule.start_time} a ${schedule.end_time}. Próximo horario: ${nextAvailable || 'No configurado'}`
          ));
        }
        console.log('✅ Dentro del horario permitido');
      } else {
        console.log(`⚠️ No hay configuración de horario para ${area} los ${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayOfWeek]}`);
      }
    } else {
      console.log('ℹ️ Usuario admin/purchaser, saltando validación de horarios');
    }

    // Generar folio único
    console.log('🔢 Generando folio...');
    const folio = await generateRequestFolio(db);
    console.log('✅ Folio generado:', folio);

    // Insertar solicitud con fecha en zona horaria de México
    console.log('💾 Insertando solicitud principal...');
    const currentDate = formatDateForDB(new Date());

    // TEMPORAL: Verificar si la tabla tiene el campo urgency (migración pendiente)
    let insertQuery;
    let insertParams;

    try {
      // Intentar verificar si existe urgency
      const checkUrgency = await db.getAsync(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'requests' AND column_name = 'urgency'
      `);

      if (checkUrgency) {
        // BD todavía tiene urgency, usar query antigua (compatibilidad)
        console.log('⚠️ Migración pendiente: usando query con urgency');
        insertQuery = `
          INSERT INTO requests (
            folio, user_id, area, request_date, delivery_date,
            urgency, priority, justification, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
          RETURNING id
        `;
        // Usar priority como urgency temporalmente
        const urgencyValue = priority === 'critica' ? 'alta' : priority === 'urgente' ? 'media' : 'baja';
        insertParams = [folio, req.user.id, area, currentDate, formatDateForDB(delivery_date), urgencyValue, priority, justification];
      } else {
        // Migración completada
        insertQuery = `
          INSERT INTO requests (
            folio, user_id, area, request_date, delivery_date,
            priority, justification, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')
          RETURNING id
        `;
        insertParams = [folio, req.user.id, area, currentDate, formatDateForDB(delivery_date), priority, justification];
      }
    } catch (checkError) {
      // Si falla la verificación, usar query nueva (sin urgency)
      console.log('ℹ️ No se pudo verificar schema, usando query sin urgency');
      insertQuery = `
        INSERT INTO requests (
          folio, user_id, area, request_date, delivery_date,
          priority, justification, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')
        RETURNING id
      `;
      insertParams = [folio, req.user.id, area, currentDate, formatDateForDB(delivery_date), priority, justification];
    }

    const requestResult = await db.getAsync(insertQuery, insertParams);

    const requestId = requestResult.id;
    console.log('✅ Solicitud creada con ID:', requestId);

    // Insertar items
    console.log('📋 Insertando items...');
    for (const item of items) {
      await db.runAsync(`
        INSERT INTO request_items (
          request_id, material, specifications, approximate_cost, 
          quantity, unit, in_stock, location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        requestId,
        item.material,
        item.specifications,
        item.approximate_cost || null,
        item.quantity,
        item.unit,
        item.in_stock || 0,
        item.location || null
      ]);
    }
    console.log('✅ Items insertados');

    // Log de auditoría
    console.log('📊 Registrando auditoría...');
    try {
      await db.auditLog('requests', requestId, 'create', null, { folio, area, priority }, req.user.id, getClientIP(req));
      console.log('✅ Auditoría registrada');
    } catch (auditError) {
      console.log('⚠️ Error en auditoría (continuando):', auditError.message);
    }

    // Enviar notificaciones
    console.log('🔔 Enviando notificaciones...');
    try {
      await notificationService.notifyNewRequest(requestId);
      console.log('✅ Notificaciones enviadas');
    } catch (notifError) {
      console.log('⚠️ Error en notificaciones (continuando):', notifError.message);
    }

    // Obtener solicitud completa para respuesta
    console.log('🔍 Obteniendo solicitud completa...');
    const newRequest = await db.getAsync(`
      SELECT r.*, u.name as requester_name
      FROM requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [requestId]);

    console.log('🎉 Solicitud creada exitosamente:', requestId);
    res.status(201).json(apiResponse(true, newRequest, 'Solicitud creada exitosamente'));

  } catch (error) {
    console.error('❌ Error creando solicitud:', error);
    next(error);
  }
});

// PATCH /api/requests/:id/status - Actualizar estatus de solicitud
router.patch('/:id/status', authMiddleware, validateId, validateStatusChange, async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const { status, reason } = req.body;

    // Verificar que la solicitud existe
    const request = await db.getAsync('SELECT * FROM requests WHERE id = ?', [requestId]);
    if (!request) {
      return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
    }

    // Verificar permisos según el cambio de estatus
    const canChangeStatus = (currentStatus, newStatus, userRole) => {
      // Directores y admin pueden autorizar/rechazar
      if (['autorizada', 'rechazada'].includes(newStatus) && !['director', 'admin'].includes(userRole)) {
        return false;
      }

      // Solo compras y admin puede marcar como cotizando, comprada, entregada
      if (['cotizando', 'comprada', 'entregada'].includes(newStatus) && !['purchaser', 'admin'].includes(userRole)) {
        return false;
      }

      // El solicitante solo puede cancelar sus propias solicitudes pendientes
      if (newStatus === 'cancelada' && userRole === 'requester') {
        return request.user_id === req.user.id && currentStatus === 'pendiente';
      }

      return true;
    };

    if (!canChangeStatus(request.status, status, req.user.role)) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado para cambiar a este estatus'));
    }

    // Actualizar solicitud
    const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams = [status];

    if (['autorizada', 'rechazada'].includes(status)) {
      updateFields.push('authorized_by = ?', 'authorized_at = CURRENT_TIMESTAMP');
      updateParams.push(req.user.id);
      
      if (status === 'rechazada' && reason) {
        updateFields.push('rejection_reason = ?');
        updateParams.push(reason);
      }
    }

    updateParams.push(requestId);

    await db.runAsync(`
      UPDATE requests 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateParams);

    // Log de auditoría
    await db.auditLog('requests', requestId, 'update',
      { status: request.status },
      { status, reason, changed_by: req.user.id },
      req.user.id,
      getClientIP(req)
    );

    // Enviar notificaciones según el cambio de estado
    if (status === 'autorizada') {
      // Director aprobó: notificar a compras
      await notificationService.notifyQuotationApproved(requestId);
    } else if (status === 'rechazada') {
      // Director rechazó: notificar a compras
      await notificationService.notifyQuotationRejected(requestId, reason || 'No especificado');
    } else {
      // Otras notificaciones genéricas
      await notificationService.notifyStatusChange(requestId, status, reason);
    }

    res.json(apiResponse(true, null, `Solicitud ${status} exitosamente`));

  } catch (error) {
    next(error);
  }
});

// DELETE /api/requests/:id - Eliminar solicitud (solo admin o propietario si está pendiente)
router.delete('/:id', authMiddleware, validateId, async (req, res, next) => {
  try {
    const requestId = req.params.id;

    const request = await db.getAsync('SELECT * FROM requests WHERE id = ?', [requestId]);
    if (!request) {
      return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
    }

    // Solo admin o el propietario puede eliminar si está pendiente
    if (req.user.role !== 'admin' && 
        (request.user_id !== req.user.id || request.status !== 'pendiente')) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado para eliminar esta solicitud'));
    }

    // Eliminar solicitud (cascade eliminará los items)
    await db.runAsync('DELETE FROM requests WHERE id = ?', [requestId]);

    // Log de auditoría
    await db.auditLog('requests', requestId, 'delete', request, null, req.user.id, getClientIP(req));

    res.json(apiResponse(true, null, 'Solicitud eliminada exitosamente'));

  } catch (error) {
    next(error);
  }
});

// GET /api/requests/stats/summary - Estadísticas resumidas
router.get('/stats/summary', authMiddleware, async (req, res, next) => {
  try {
    // El dashboard es PERSONAL - siempre filtrar por el usuario actual
    // No importa el rol, cada usuario ve sus propias estadísticas en el dashboard
    const whereClause = 'WHERE user_id = ?';
    const params = [req.user.id];

    const stats = await db.getAsync(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'borrador' THEN 1 ELSE 0 END) as borradores,
        SUM(CASE WHEN status = 'programada' THEN 1 ELSE 0 END) as programadas,
        SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN status = 'cotizando' THEN 1 ELSE 0 END) as cotizando,
        SUM(CASE WHEN status = 'autorizada' THEN 1 ELSE 0 END) as autorizadas,
        SUM(CASE WHEN status = 'rechazada' THEN 1 ELSE 0 END) as rechazadas,
        SUM(CASE WHEN status = 'emitida' THEN 1 ELSE 0 END) as emitidas,
        SUM(CASE WHEN status = 'en_transito' THEN 1 ELSE 0 END) as en_transito,
        SUM(CASE WHEN status = 'recibida' THEN 1 ELSE 0 END) as recibidas,
        SUM(CASE WHEN status = 'entregada' THEN 1 ELSE 0 END) as entregadas,
        SUM(CASE WHEN status = 'cancelada' THEN 1 ELSE 0 END) as canceladas
      FROM requests ${whereClause}
    `, params);

    res.json(apiResponse(true, stats));

  } catch (error) {
    next(error);
  }
});

// GET /api/requests/:id/history - Obtener historial completo de cambios de una solicitud
router.get('/:id/history', authMiddleware, validateId, async (req, res, next) => {
  try {
    const requestId = req.params.id;

    // Verificar que la solicitud existe
    const request = await db.getAsync('SELECT id, user_id FROM requests WHERE id = $1', [requestId]);
    if (!request) {
      return res.status(404).json(apiResponse(false, null, null, 'Solicitud no encontrada'));
    }

    // Verificar permisos (solicitante solo ve sus propias solicitudes)
    if (req.user.role === 'requester' && request.user_id !== req.user.id) {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    // Obtener historial desde audit_log
    const history = await db.allAsync(`
      SELECT
        al.id,
        al.action,
        al.old_values,
        al.new_values,
        al.created_at,
        u.name as user_name
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.table_name = 'requests' AND al.record_id = $1
      ORDER BY al.created_at ASC
    `, [requestId]);

    res.json(apiResponse(true, history));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
