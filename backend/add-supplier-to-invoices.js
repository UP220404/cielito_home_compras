// Script para agregar columna supplier_id a la tabla invoices
// Ejecutar con: node add-supplier-to-invoices.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔄 Iniciando migración...');

    // Verificar si la columna ya existe
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'invoices' AND column_name = 'supplier_id'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ La columna supplier_id ya existe en la tabla invoices');
      return;
    }

    // Agregar columna supplier_id
    await client.query(`
      ALTER TABLE invoices
      ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)
    `);

    console.log('✅ Columna supplier_id agregada exitosamente');

    // Crear índice para mejorar búsquedas
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id)
    `);

    console.log('✅ Índice creado exitosamente');

  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log('🎉 Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migración fallida:', error);
    process.exit(1);
  });
