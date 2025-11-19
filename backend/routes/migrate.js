const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

/**
 * POST /api/migrate/quotation-items
 * Ejecuta la migración para agregar columnas faltantes a quotation_items
 * Solo accesible por admins
 */
router.post('/quotation-items', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    console.log('🔄 Iniciando migración de quotation_items...');

    // Verificar columnas existentes
    const columns = await db._pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quotation_items'
    `);

    const existingColumns = columns.rows.map(row => row.column_name);
    console.log('📋 Columnas existentes:', existingColumns);

    const results = [];

    // Agregar columna notes si no existe
    if (!existingColumns.includes('notes')) {
      console.log('➕ Agregando columna notes...');
      await db._pool.query(`
        ALTER TABLE quotation_items
        ADD COLUMN notes TEXT
      `);
      console.log('✅ Columna notes agregada');
      results.push('notes: agregada');
    } else {
      console.log('✓ Columna notes ya existe');
      results.push('notes: ya existe');
    }

    // Agregar columna has_invoice si no existe
    if (!existingColumns.includes('has_invoice')) {
      console.log('➕ Agregando columna has_invoice...');
      await db._pool.query(`
        ALTER TABLE quotation_items
        ADD COLUMN has_invoice BOOLEAN DEFAULT false
      `);
      console.log('✅ Columna has_invoice agregada');
      results.push('has_invoice: agregada');
    } else {
      console.log('✓ Columna has_invoice ya existe');
      results.push('has_invoice: ya existe');
    }

    // Agregar columna delivery_date si no existe
    if (!existingColumns.includes('delivery_date')) {
      console.log('➕ Agregando columna delivery_date...');
      await db._pool.query(`
        ALTER TABLE quotation_items
        ADD COLUMN delivery_date DATE
      `);
      console.log('✅ Columna delivery_date agregada');
      results.push('delivery_date: agregada');
    } else {
      console.log('✓ Columna delivery_date ya existe');
      results.push('delivery_date: ya existe');
    }

    // Agregar columna is_selected si no existe
    if (!existingColumns.includes('is_selected')) {
      console.log('➕ Agregando columna is_selected...');
      await db._pool.query(`
        ALTER TABLE quotation_items
        ADD COLUMN is_selected BOOLEAN DEFAULT false
      `);
      console.log('✅ Columna is_selected agregada');

      // Migrar datos existentes
      console.log('📦 Migrando datos existentes...');
      await db._pool.query(`
        UPDATE quotation_items
        SET is_selected = true
        WHERE quotation_id IN (
          SELECT id FROM quotations WHERE is_selected = true
        )
      `);
      console.log('✅ Datos migrados');
      results.push('is_selected: agregada y datos migrados');
    } else {
      console.log('✓ Columna is_selected ya existe');
      results.push('is_selected: ya existe');
    }

    console.log('✅ Migración completada exitosamente!');

    res.json({
      success: true,
      message: 'Migración completada exitosamente',
      results: results
    });

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    next(error);
  }
});

module.exports = router;
