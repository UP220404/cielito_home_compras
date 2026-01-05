/**
 * Script para ejecutar migraciones pendientes en el inicio del servidor
 * Se ejecuta automáticamente en Render
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.log('⚠️  DATABASE_URL no configurada, saltando migraciones');
  process.exit(0);
}

async function runMigrations() {
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  let client;

  try {
    console.log('🔧 [MIGRATIONS] Conectando a la base de datos...');
    client = await pool.connect();
    console.log('✅ [MIGRATIONS] Conexión establecida');

    // Crear tabla de migraciones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migración: Campos de garantía
    const warrantyMigrationName = 'add_warranty_fields';
    const warrantyMigrationExists = await client.query(
      'SELECT id FROM migrations WHERE name = $1',
      [warrantyMigrationName]
    );

    if (warrantyMigrationExists.rows.length === 0) {
      console.log('📝 [MIGRATIONS] Aplicando migración: Campos de garantía...');

      await client.query('BEGIN');

      try {
        await client.query(
          'ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS has_warranty BOOLEAN DEFAULT FALSE'
        );
        console.log('   ✅ Columna has_warranty agregada');

        await client.query(
          'ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS warranty_duration INTEGER'
        );
        console.log('   ✅ Columna warranty_duration agregada');

        // Registrar migración
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [warrantyMigrationName]
        );

        await client.query('COMMIT');
        console.log('✅ [MIGRATIONS] Migración de garantías completada');

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } else {
      console.log('ℹ️  [MIGRATIONS] Migración de garantías ya aplicada');
    }

    console.log('✅ [MIGRATIONS] Todas las migraciones completadas');

  } catch (error) {
    console.error('❌ [MIGRATIONS] Error:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('✅ [MIGRATIONS] Script finalizado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ [MIGRATIONS] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = runMigrations;
