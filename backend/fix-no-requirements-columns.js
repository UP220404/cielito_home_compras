// Script para agregar columnas faltantes a la tabla no_requirements
const { Pool } = require('pg');

const postgresUrl = process.env.DATABASE_URL;

if (!postgresUrl) {
  console.error('❌ DATABASE_URL no está configurada');
  process.exit(1);
}

const useSSL = postgresUrl.includes('render.com') || postgresUrl.includes('amazonaws.com');

const pool = new Pool({
  connectionString: postgresUrl,
  ssl: useSSL ? {
    rejectUnauthorized: false
  } : false
});

async function fixNoRequirementsTable() {
  console.log('🔧 Agregando columnas faltantes a no_requirements...\n');

  try {
    // Verificar si las columnas ya existen
    const checkColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'no_requirements'
    `);

    const existingColumns = checkColumns.rows.map(row => row.column_name);
    console.log('📋 Columnas existentes:', existingColumns.join(', '));

    // Agregar user_id si no existe
    if (!existingColumns.includes('user_id')) {
      console.log('➕ Agregando columna user_id...');
      await pool.query(`
        ALTER TABLE no_requirements
        ADD COLUMN user_id INTEGER REFERENCES users(id)
      `);
      console.log('✅ Columna user_id agregada');
    } else {
      console.log('✓ Columna user_id ya existe');
    }

    // Agregar approved_by si no existe
    if (!existingColumns.includes('approved_by')) {
      console.log('➕ Agregando columna approved_by...');
      await pool.query(`
        ALTER TABLE no_requirements
        ADD COLUMN approved_by INTEGER REFERENCES users(id)
      `);
      console.log('✅ Columna approved_by agregada');
    } else {
      console.log('✓ Columna approved_by ya existe');
    }

    // Agregar approved_at si no existe
    if (!existingColumns.includes('approved_at')) {
      console.log('➕ Agregando columna approved_at...');
      await pool.query(`
        ALTER TABLE no_requirements
        ADD COLUMN approved_at TIMESTAMP
      `);
      console.log('✅ Columna approved_at agregada');
    } else {
      console.log('✓ Columna approved_at ya existe');
    }

    // Agregar status si no existe
    if (!existingColumns.includes('status')) {
      console.log('➕ Agregando columna status...');
      await pool.query(`
        ALTER TABLE no_requirements
        ADD COLUMN status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado'))
      `);
      console.log('✅ Columna status agregada');
    } else {
      console.log('✓ Columna status ya existe');
    }

    console.log('\n✨ Tabla no_requirements actualizada correctamente!');

  } catch (error) {
    console.error('❌ Error actualizando tabla:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar
fixNoRequirementsTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
