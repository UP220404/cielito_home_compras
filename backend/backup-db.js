/**
 * Script para exportar datos de la base de datos Neon
 * Ejecutar: node backup-db.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function backup() {
  console.log('🔄 Iniciando backup de la base de datos...\n');

  const client = await pool.connect();
  const backup = {
    timestamp: new Date().toISOString(),
    tables: {}
  };

  try {
    // Obtener lista de tablas
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`📋 Tablas encontradas: ${tables.join(', ')}\n`);

    // Exportar cada tabla
    for (const table of tables) {
      console.log(`📦 Exportando ${table}...`);
      const result = await client.query(`SELECT * FROM ${table}`);
      backup.tables[table] = {
        count: result.rows.length,
        data: result.rows
      };
      console.log(`   ✅ ${result.rows.length} registros`);
    }

    // Guardar backup
    const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

    console.log(`\n✅ Backup completado: ${filename}`);
    console.log(`📊 Total de tablas: ${tables.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('quota')) {
      console.log('\n⚠️  El quota de Neon está agotado.');
      console.log('👉 Opción 1: Espera al 1ro del mes');
      console.log('👉 Opción 2: Haz backup desde https://console.neon.tech');
      console.log('👉 Opción 3: Upgrade tu plan de Neon');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

backup();
