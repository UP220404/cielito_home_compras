const { Pool } = require('pg');
require('dotenv').config();

console.log('Testing connection to Neon...');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connection successful!');
    console.log('Current time:', result.rows[0].now);

    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('✅ Users in database:', userCount.rows[0].count);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
