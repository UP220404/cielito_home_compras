// Migración para agregar columna is_selected a quotation_items
require('dotenv').config();
const { Pool } = require('pg');

// Usar la URL de Neon desde las variables de entorno
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está configurada en el archivo .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  console.log('🔄 Iniciando migración: agregar is_selected a quotation_items...\n');

  try {
    // Verificar si la columna ya existe
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quotation_items'
      AND column_name = 'is_selected'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('⚠️  La columna is_selected ya existe en quotation_items');
      await pool.end();
      return;
    }

    // Agregar columna is_selected a quotation_items
    await pool.query(`
      ALTER TABLE quotation_items
      ADD COLUMN is_selected BOOLEAN DEFAULT false
    `);
    console.log('✅ Columna is_selected agregada a quotation_items');

    // Crear índice para mejorar rendimiento en consultas de items seleccionados
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_quotation_items_is_selected
      ON quotation_items(is_selected)
    `);
    console.log('✅ Índice creado en quotation_items.is_selected');

    // Actualizar items existentes: marcar como seleccionados los items de cotizaciones seleccionadas
    const updateResult = await pool.query(`
      UPDATE quotation_items qi
      SET is_selected = true
      FROM quotations q
      WHERE qi.quotation_id = q.id
      AND q.is_selected = true
    `);
    console.log(`✅ ${updateResult.rowCount} items actualizados con is_selected = true (de cotizaciones ya seleccionadas)`);

    console.log('\n✅ Migración completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
