// Script para verificar el schema actual de Neon
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://comprasch_user:Rq53mHVvFVgeihs8yElI9Cs3GyB99sM5@dpg-d473m71r0fns73f7fmv0-a.oregon-postgres.render.com/comprasch?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    console.log('🔍 Verificando schema de tabla requests...\n');

    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'requests'
      ORDER BY ordinal_position
    `);

    console.log('📋 Columnas en tabla requests:');
    console.log('=====================================');
    result.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)';
      console.log(`  • ${row.column_name.padEnd(20)} ${row.data_type.padEnd(15)} ${nullable}`);
    });

    // Verificar específicamente urgency y priority
    const hasUrgency = result.rows.find(r => r.column_name === 'urgency');
    const hasPriority = result.rows.find(r => r.column_name === 'priority');

    console.log('\n🔍 Estado de campos críticos:');
    console.log(`  • urgency: ${hasUrgency ? '❌ EXISTE (debe eliminarse)' : '✅ NO EXISTE (correcto)'}`);
    console.log(`  • priority: ${hasPriority ? '✅ EXISTE (correcto)' : '❌ NO EXISTE (problema)'}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
