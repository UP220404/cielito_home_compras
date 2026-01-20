const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { apiResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// GET /api/schedules - Obtener horarios permitidos por área
router.get('/',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { area } = req.query;
      const user = req.user;

      let query = 'SELECT * FROM area_schedules WHERE is_active = TRUE';
      const params = [];

      // Si no es admin, solo puede ver el horario de su área
      if (user.role !== 'admin' && area) {
        query += ' AND area = ?';
        params.push(area);
      } else if (area) {
        query += ' AND area = ?';
        params.push(area);
      }

      query += ' ORDER BY area, day_of_week, start_time';

      const schedules = await db.allAsync(query, params);

      res.json(apiResponse(true, schedules));

    } catch (error) {
      logger.error('Error en GET /schedules: %o', error);
      next(error);
    }
  }
);

// GET /api/schedules/check - Verificar si el área puede crear solicitud ahora
router.get('/check',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Domingo, 1=Lunes... 6=Sábado
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Obtener configuración del área
      const schedule = await db.getAsync(`
        SELECT * FROM area_schedules
        WHERE area = ?
          AND day_of_week = ?
          AND is_active = TRUE
      `, [user.area, dayOfWeek]);

      if (!schedule) {
        return res.json(apiResponse(true, {
          can_create: false,
          message: `Tu área no tiene permitido crear solicitudes los ${getDayName(dayOfWeek)}`,
          current_day: dayOfWeek,
          current_time: currentTime
        }));
      }

      // Verificar si está dentro del horario
      const canCreate = currentTime >= schedule.start_time && currentTime <= schedule.end_time;

      res.json(apiResponse(true, {
        can_create: canCreate,
        message: canCreate
          ? 'Puedes crear solicitudes en este momento'
          : `Tu área solo puede crear solicitudes de ${schedule.start_time} a ${schedule.end_time}`,
        schedule: {
          day: getDayName(dayOfWeek),
          start_time: schedule.start_time,
          end_time: schedule.end_time
        },
        current_time: currentTime
      }));

    } catch (error) {
      logger.error('Error en GET /schedules/check: %o', error);
      next(error);
    }
  }
);

// GET /api/schedules/next-available - Obtener próximo horario disponible
router.get('/next-available',
  authMiddleware,
  async (req, res, next) => {
    try {
      const user = req.user;
      // Permitir que admin especifique el área, si no usa el área del usuario
      const targetArea = (user.role === 'admin' && req.query.area) ? req.query.area : user.area;

      // Usar hora de México para calcular el próximo horario
      const now = new Date();
      const mexicoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));

      // Obtener todos los horarios del área
      const schedules = await db.allAsync(`
        SELECT * FROM area_schedules
        WHERE area = ? AND is_active = TRUE
        ORDER BY day_of_week, start_time
      `, [targetArea]);

      if (schedules.length === 0) {
        return res.json(apiResponse(true, {
          next_available: null,
          message: `El área "${targetArea}" no tiene horarios configurados`
        }));
      }

      // Encontrar el próximo horario disponible (usando hora de México)
      const currentDayOfWeek = mexicoTime.getDay();
      const currentTime = `${mexicoTime.getHours().toString().padStart(2, '0')}:${mexicoTime.getMinutes().toString().padStart(2, '0')}`;

      let nextSchedule = null;

      // Buscar en los días siguientes de esta semana
      for (const schedule of schedules) {
        if (schedule.day_of_week > currentDayOfWeek ||
           (schedule.day_of_week === currentDayOfWeek && schedule.start_time > currentTime)) {
          nextSchedule = schedule;
          break;
        }
      }

      // Si no encontró nada, usar el primer horario de la próxima semana
      if (!nextSchedule) {
        nextSchedule = schedules[0];
      }

      // Calcular la fecha del próximo horario (en hora de México)
      let daysUntilNext;
      if (nextSchedule.day_of_week > currentDayOfWeek) {
        daysUntilNext = nextSchedule.day_of_week - currentDayOfWeek;
      } else if (nextSchedule.day_of_week === currentDayOfWeek && nextSchedule.start_time > currentTime) {
        daysUntilNext = 0; // Hoy mismo
      } else {
        daysUntilNext = 7 - currentDayOfWeek + nextSchedule.day_of_week;
      }

      // Crear fecha en zona horaria de México
      const nextDate = new Date(mexicoTime);
      nextDate.setDate(nextDate.getDate() + daysUntilNext);
      const [hours, minutes] = nextSchedule.start_time.split(':');
      nextDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Convertir a UTC para almacenamiento consistente
      // Obtener offset de México (puede ser -6 o -5 dependiendo de horario de verano)
      const mexicoOffset = -6 * 60; // México central UTC-6 (simplificado)
      const utcDate = new Date(nextDate.getTime() - (mexicoOffset * 60 * 1000));

      res.json(apiResponse(true, {
        next_available: utcDate.toISOString(),
        next_available_local: `${nextDate.getFullYear()}-${(nextDate.getMonth()+1).toString().padStart(2,'0')}-${nextDate.getDate().toString().padStart(2,'0')}T${nextSchedule.start_time}:00`,
        schedule: {
          day: getDayName(nextSchedule.day_of_week),
          start_time: nextSchedule.start_time,
          end_time: nextSchedule.end_time
        },
        area: targetArea,
        message: `Próximo horario disponible: ${getDayName(nextSchedule.day_of_week)} a las ${nextSchedule.start_time}`
      }));

    } catch (error) {
      logger.error('Error en GET /schedules/next-available: %o', error);
      next(error);
    }
  }
);

// POST /api/schedules - Crear o actualizar horario (solo admin)
router.post('/',
  authMiddleware,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { area, day_of_week, start_time, end_time, is_active } = req.body;

      // Validaciones
      if (!area || day_of_week === undefined || !start_time || !end_time) {
        return res.status(400).json(apiResponse(false, null, 'Faltan campos requeridos'));
      }

      if (day_of_week < 0 || day_of_week > 6) {
        return res.status(400).json(apiResponse(false, null, 'Día de la semana inválido (0-6)'));
      }

      // Verificar si ya existe un horario para ese día
      const existing = await db.getAsync(`
        SELECT * FROM area_schedules WHERE area = ? AND day_of_week = ?
      `, [area, day_of_week]);

      if (existing) {
        // Actualizar
        await db.runAsync(`
          UPDATE area_schedules
          SET start_time = ?, end_time = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE area = ? AND day_of_week = ?
        `, [start_time, end_time, is_active !== undefined ? is_active : true, area, day_of_week]);

        res.json(apiResponse(true, { id: existing.id, updated: true }, 'Horario actualizado'));
      } else {
        // Crear nuevo
        const result = await db.runAsync(`
          INSERT INTO area_schedules (area, day_of_week, start_time, end_time, is_active)
          VALUES (?, ?, ?, ?, ?)
        `, [area, day_of_week, start_time, end_time, is_active !== undefined ? is_active : true]);

        res.json(apiResponse(true, { id: result.id }, 'Horario creado'));
      }

    } catch (error) {
      logger.error('Error en POST /schedules: %o', error);
      next(error);
    }
  }
);

// DELETE /api/schedules/:id - Eliminar horario (solo admin)
router.delete('/:id',
  authMiddleware,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await db.runAsync('DELETE FROM area_schedules WHERE id = ?', [id]);

      res.json(apiResponse(true, null, 'Horario eliminado'));

    } catch (error) {
      logger.error('Error en DELETE /schedules/:id: %o', error);
      next(error);
    }
  }
);

// Función helper para nombres de días
function getDayName(dayOfWeek) {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[dayOfWeek] || 'Desconocido';
}

module.exports = router;
