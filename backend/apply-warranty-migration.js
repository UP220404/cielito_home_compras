const { Pool } = require('pg');
const fs = require('fs');

const connectionString = process.env.DATABASE_URL || "postgresql://comprasch_user:Rq53mHVvFVgeihs8yElI9Cs3GyB99sM5@dpg-d473m71r0fns73f7fmv0-a.oregon-postgres.render.com/comprasch?sslmode=require";

async function applyMigration() {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  let client;

  try {
    console.log('🔧 Conectando a Neon PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Conexión establecida');

    // Leer el archivo de migración
    const sql = fs.readFileSync('migrations/add-warranty-fields-postgres.sql', 'utf8');

    console.log('📝 Aplicando migración de campos de garantía...');

    // Ejecutar cada línea por separado
    const statements = sql.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('  - Ejecutando:', statement.substring(0, 50) + '...');
        await client.query(statement);
      }
    }

    console.log('✅ Migración aplicada exitosamente');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Detalles:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('🔒 Conexión cerrada');
  }
}

applyMigration();
