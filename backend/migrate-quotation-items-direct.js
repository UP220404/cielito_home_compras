/**
 * Migración PostgreSQL: Agregar campos faltantes a quotation_items
 * Versión con conexión directa (sin usar db.js)
 */

const { Pool } = require('pg');

// Usar DATABASE_URL del entorno
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔄 Iniciando migración de quotation_items para PostgreSQL...\n');

    // Verificar columnas existentes
    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quotation_items'
    `);

    const existingColumns = columns.rows.map(row => row.column_name);
    console.log('📋 Columnas existentes:', existingColumns);

    // Agregar columna notes si no existe
    if (!existingColumns.includes('notes')) {
      console.log('➕ Agregando columna notes...');
      await client.query(`
        ALTER TABLE quotation_items
        ADD COLUMN notes TEXT
      `);
      console.log('✅ Columna notes agregada');
    } else {
      console.log('✓ Columna notes ya existe');
    }

    // Agregar columna has_invoice si no existe
    if (!existingColumns.includes('has_invoice')) {
      console.log('➕ Agregando columna has_invoice...');
      await client.query(`
        ALTER TABLE quotation_items
        ADD COLUMN has_invoice BOOLEAN DEFAULT false
      `);
      console.log('✅ Columna has_invoice agregada');
    } else {
      console.log('✓ Columna has_invoice ya existe');
    }

    // Agregar columna delivery_date si no existe
    if (!existingColumns.includes('delivery_date')) {
      console.log('➕ Agregando columna delivery_date...');
      await client.query(`
        ALTER TABLE quotation_items
        ADD COLUMN delivery_date DATE
      `);
      console.log('✅ Columna delivery_date agregada');
    } else {
      console.log('✓ Columna delivery_date ya existe');
    }

    // Agregar columna is_selected si no existe
    if (!existingColumns.includes('is_selected')) {
      console.log('➕ Agregando columna is_selected...');
      await client.query(`
        ALTER TABLE quotation_items
        ADD COLUMN is_selected BOOLEAN DEFAULT false
      `);
      console.log('✅ Columna is_selected agregada');

      // Migrar datos existentes: si una cotización está seleccionada,
      // marcar todos sus ítems como seleccionados
      console.log('📦 Migrando datos existentes...');
      await client.query(`
        UPDATE quotation_items
        SET is_selected = true
        WHERE quotation_id IN (
          SELECT id FROM quotations WHERE is_selected = true
        )
      `);
      console.log('✅ Datos migrados');
    } else {
      console.log('✓ Columna is_selected ya existe');
    }

    console.log('\n✅ Migración completada exitosamente!');
    console.log('\n📊 Estructura actualizada de quotation_items:');
    console.log('   - notes: Notas específicas del ítem');
    console.log('   - has_invoice: Si tiene factura (boolean)');
    console.log('   - delivery_date: Fecha de entrega (date)');
    console.log('   - is_selected: Si está seleccionado (boolean)');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

migrate();
