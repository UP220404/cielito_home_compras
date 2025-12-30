// Script para ejecutar migración 011 en Neon manualmente
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://comprasch_user:Rq53mHVvFVgeihs8yElI9Cs3GyB99sM5@dpg-d473m71r0fns73f7fmv0-a.oregon-postgres.render.com/comprasch?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000
});

async function migrate() {
  try {
    console.log('🔄 Ejecutando migración 011: Eliminar campo urgency\n');

    // 1. Verificar si existe el campo urgency
    console.log('1️⃣ Verificando campo urgency...');
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'requests' AND column_name = 'urgency'
    `);

    if (checkResult.rows.length === 0) {
      console.log('✅ Campo urgency ya fue eliminado anteriormente');
      process.exit(0);
    }

    console.log('⚠️ Campo urgency detectado, procediendo con migración...\n');

    // 2. Migrar datos: urgency alta -> priority urgente
    console.log('2️⃣ Migrando datos de urgency a priority...');
    await pool.query(`
      UPDATE requests
      SET priority = CASE
        WHEN urgency = 'alta' AND priority = 'normal' THEN 'urgente'
        WHEN urgency = 'media' AND priority = 'normal' THEN 'normal'
        ELSE priority
      END
      WHERE urgency IS NOT NULL
    `);
    console.log('✅ Datos migrados');

    // 3. Eliminar columna urgency
    console.log('3️⃣ Eliminando columna urgency...');
    await pool.query(`
      ALTER TABLE requests DROP COLUMN IF EXISTS urgency
    `);
    console.log('✅ Columna urgency eliminada');

    // 4. Verificar que priority tenga valor por defecto
    console.log('4️⃣ Verificando columna priority...');
    await pool.query(`
      ALTER TABLE requests
      ALTER COLUMN priority SET DEFAULT 'normal'
    `);
    console.log('✅ Columna priority configurada con default');

    console.log('\n🎉 Migración 011 completada exitosamente!\n');

    // Verificar resultado final
    const finalCheck = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'requests'
      AND column_name IN ('urgency', 'priority')
      ORDER BY column_name
    `);

    console.log('📋 Estado final:');
    finalCheck.rows.forEach(row => {
      console.log(`  • ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'none'})`);
    });

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error ejecutando migración:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar con reintentos por si la DB está dormida
let retries = 0;
const maxRetries = 3;

async function executeWithRetry() {
  try {
    await migrate();
  } catch (error) {
    if (retries < maxRetries && error.message.includes('terminated unexpectedly')) {
      retries++;
      console.log(`\n⏳ DB suspendida, reintentando (${retries}/${maxRetries}) en 5 segundos...\n`);
      setTimeout(executeWithRetry, 5000);
    } else {
      console.error('\n❌ Error final:', error.message);
      process.exit(1);
    }
  }
}

executeWithRetry();
