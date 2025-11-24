const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { apiResponse } = require('../utils/helpers');

// Columnas opcionales disponibles
const AVAILABLE_COLUMNS = [
  { id: 'ubicacion', label: 'Ubicación' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'garantia', label: 'Garantía' },
  { id: 'instalacion', label: 'Instalación' },
  { id: 'entrega', label: 'Entrega' },
  { id: 'metodo_pago', label: 'Método de Pago' }
];

// GET /api/area-columns - Obtener todas las configuraciones de columnas
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const configs = await db.allAsync(`
      SELECT * FROM area_column_config
      ORDER BY area
    `);

    res.json(apiResponse(true, {
      configs,
      available_columns: AVAILABLE_COLUMNS
    }));
  } catch (error) {
    next(error);
  }
});

// GET /api/area-columns/:area - Obtener configuración de columnas para un área específica
router.get('/:area', authMiddleware, async (req, res, next) => {
  try {
    const { area } = req.params;

    let config = await db.getAsync(`
      SELECT * FROM area_column_config WHERE area = ?
    `, [area]);

    // Si no existe configuración para esta área, retornar vacío
    if (!config) {
      config = {
        area,
        enabled_columns: '[]'
      };
    }

    // Parsear enabled_columns si es string
    if (typeof config.enabled_columns === 'string') {
      config.enabled_columns = JSON.parse(config.enabled_columns);
    }

    res.json(apiResponse(true, {
      config,
      available_columns: AVAILABLE_COLUMNS
    }));
  } catch (error) {
    next(error);
  }
});

// POST /api/area-columns - Crear o actualizar configuración de columnas para un área
router.post('/', authMiddleware, requireRole('purchaser', 'admin'), async (req, res, next) => {
  try {
    const { area, enabled_columns } = req.body;

    if (!area) {
      return res.status(400).json(apiResponse(false, null, 'El área es requerida'));
    }

    if (!Array.isArray(enabled_columns)) {
      return res.status(400).json(apiResponse(false, null, 'enabled_columns debe ser un array'));
    }

    // Validar que las columnas existen
    const validColumns = AVAILABLE_COLUMNS.map(c => c.id);
    const invalidColumns = enabled_columns.filter(col => !validColumns.includes(col));
    if (invalidColumns.length > 0) {
      return res.status(400).json(apiResponse(false, null, `Columnas inválidas: ${invalidColumns.join(', ')}`));
    }

    const enabledColumnsJson = JSON.stringify(enabled_columns);

    // Insertar o actualizar
    await db.runAsync(`
      INSERT INTO area_column_config (area, enabled_columns)
      VALUES (?, ?)
      ON CONFLICT(area) DO UPDATE SET
        enabled_columns = excluded.enabled_columns,
        updated_at = CURRENT_TIMESTAMP
    `, [area, enabledColumnsJson]);

    const config = await db.getAsync(`
      SELECT * FROM area_column_config WHERE area = ?
    `, [area]);

    res.json(apiResponse(true, config, 'Configuración guardada exitosamente'));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/area-columns/:area - Eliminar configuración de un área
router.delete('/:area', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { area } = req.params;

    await db.runAsync(`
      DELETE FROM area_column_config WHERE area = ?
    `, [area]);

    res.json(apiResponse(true, null, 'Configuración eliminada exitosamente'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
