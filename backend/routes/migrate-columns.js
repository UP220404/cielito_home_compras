const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { apiResponse } = require('../utils/helpers');

// POST /api/migrate-columns/apply - Aplicar migraciones de columnas opcionales
router.post('/apply', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const migrations = [];
    const errors = [];

    // 1. Agregar columnas a quotation_items
    const columns = [
      'ubicacion',
      'cliente',
      'garantia',
      'instalacion',
      'entrega',
      'metodo_pago'
    ];

    for (const col of columns) {
      try {
        await db.runAsync(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS ${col} TEXT`);
        migrations.push(`✅ Columna '${col}' agregada`);
      } catch (error) {
        if (error.message.includes('duplicate column')) {
          migrations.push(`⚠️  Columna '${col}' ya existe`);
        } else {
          errors.push(`❌ Error agregando '${col}': ${error.message}`);
        }
      }
    }

    // 2. Crear tabla area_column_config
    try {
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS area_column_config (
          id SERIAL PRIMARY KEY,
          area TEXT NOT NULL UNIQUE,
          enabled_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      migrations.push('✅ Tabla area_column_config creada');
    } catch (error) {
      if (error.message.includes('already exists')) {
        migrations.push('⚠️  Tabla area_column_config ya existe');
      } else {
        errors.push(`❌ Error creando tabla: ${error.message}`);
      }
    }

    // 3. Insertar configuraciones por defecto
    const defaultConfigs = [
      { area: 'Farmacia', columns: ['ubicacion', 'cliente', 'garantia'] },
      { area: 'Mantenimiento', columns: ['ubicacion', 'garantia', 'instalacion', 'entrega'] },
      { area: 'Tecnología', columns: ['ubicacion', 'garantia', 'instalacion'] },
      { area: 'General', columns: [] }
    ];

    for (const config of defaultConfigs) {
      try {
        await db.runAsync(`
          INSERT INTO area_column_config (area, enabled_columns)
          VALUES ($1, $2)
          ON CONFLICT (area) DO NOTHING
        `, [config.area, JSON.stringify(config.columns)]);
        migrations.push(`✅ Configuración para '${config.area}' insertada`);
      } catch (error) {
        errors.push(`❌ Error insertando config de '${config.area}': ${error.message}`);
      }
    }

    // 4. Crear índice
    try {
      await db.runAsync(`
        CREATE INDEX IF NOT EXISTS idx_area_column_config_area ON area_column_config(area)
      `);
      migrations.push('✅ Índice idx_area_column_config_area creado');
    } catch (error) {
      if (error.message.includes('already exists')) {
        migrations.push('⚠️  Índice ya existe');
      } else {
        errors.push(`❌ Error creando índice: ${error.message}`);
      }
    }

    // 5. Verificar columnas agregadas
    const verifyResult = await db.allAsync(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quotation_items'
      AND column_name IN ('ubicacion', 'cliente', 'garantia', 'instalacion', 'entrega', 'metodo_pago')
      ORDER BY column_name
    `);

    const response = {
      success: errors.length === 0,
      migrations,
      errors,
      verified_columns: verifyResult.map(r => r.column_name),
      timestamp: new Date().toISOString()
    };

    if (errors.length > 0) {
      return res.status(500).json(apiResponse(false, response, 'Migraciones completadas con errores'));
    }

    res.json(apiResponse(true, response, 'Migraciones aplicadas exitosamente'));

  } catch (error) {
    next(error);
  }
});

// GET /api/migrate-columns/status - Verificar estado de las migraciones
router.get('/status', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    // Verificar columnas en quotation_items
    const columns = await db.allAsync(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quotation_items'
      AND column_name IN ('ubicacion', 'cliente', 'garantia', 'instalacion', 'entrega', 'metodo_pago')
      ORDER BY column_name
    `);

    // Verificar tabla area_column_config
    const tableExists = await db.getAsync(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'area_column_config'
      ) as exists
    `);

    // Obtener configuraciones
    let configs = [];
    if (tableExists.exists) {
      configs = await db.allAsync('SELECT * FROM area_column_config ORDER BY area');
    }

    res.json(apiResponse(true, {
      columns_added: columns.map(c => c.column_name),
      table_exists: tableExists.exists,
      configurations: configs,
      all_columns_present: columns.length === 6,
      ready: columns.length === 6 && tableExists.exists
    }));

  } catch (error) {
    next(error);
  }
});

module.exports = router;
