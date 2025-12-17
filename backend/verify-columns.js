const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-noisy-poetry-ah5mmbjh-pooler.c-3.us-east-1.aws.neon.tech',
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_qkPQnBZbv4o2',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    // Verificar columnas de invoices
    const invoicesCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoices' ORDER BY ordinal_position;
    `);
    console.log('📋 Columnas en invoices:');
    invoicesCols.rows.forEach(r => console.log(`   - ${r.column_name}`));

    // Verificar columnas de quotations
    const quotationsCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quotations' ORDER BY ordinal_position;
    `);
    console.log('\n📋 Columnas en quotations:');
    quotationsCols.rows.forEach(r => console.log(`   - ${r.column_name}`));

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

verify();
