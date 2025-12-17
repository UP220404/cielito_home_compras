const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-noisy-poetry-ah5mmbjh-pooler.c-3.us-east-1.aws.neon.tech',
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_qkPQnBZbv4o2',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  console.log('🔍 Verificando esquema de la base de datos Neon...\n');

  try {
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`📋 Tablas encontradas (${tables.length}):`);
    tables.forEach(t => console.log(`   - ${t}`));

    console.log('\n📊 Estructura de la tabla suppliers:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'suppliers'
      ORDER BY ordinal_position;
    `);

    columnsResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });

    const countResult = await pool.query('SELECT COUNT(*) as count FROM suppliers');
    console.log(`\n📦 Proveedores actuales: ${countResult.rows[0].count}`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

checkSchema();
