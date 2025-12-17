const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-noisy-poetry-ah5mmbjh-pooler.c-3.us-east-1.aws.neon.tech',
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_qkPQnBZbv4o2',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function addRemaining() {
  try {
    // Ferreteria FIX con RFC acortado
    await pool.query(`
      INSERT INTO suppliers (name, rfc, phone, category, has_invoice, notes, rating, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
    `, ['FERRETERIA FIX', 'MXS DERL CV', '4499685955', 'Ferretería', true, 'No volver a comprar', 4.0, true]);
    
    console.log('✅ FERRETERIA FIX agregada');

    // Ferreteria Las Trojes
    await pool.query(`
      INSERT INTO suppliers (name, rfc, phone, category, has_invoice, rating, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT DO NOTHING
    `, ['FERRETERIA LAS TROJES', 'CADH830924B99', '4492930864', 'Ferretería', true, 4.0, true]);
    
    console.log('✅ FERRETERIA LAS TROJES agregada');

    const count = await pool.query('SELECT COUNT(*) FROM suppliers');
    console.log(`\n📊 Total de proveedores: ${count.rows[0].count}`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

addRemaining();
