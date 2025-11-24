/**
 * Script para aplicar migraciones de columnas opcionales
 * Ejecutar con: node apply-column-migrations.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'production'}`
});

async function applyMigrations() {
  // Verificar que tenemos DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está configurado');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔄 Conectando a la base de datos...');
    await pool.query('SELECT 1');
    console.log('✅ Conectado a PostgreSQL');

    // Leer el archivo de migración
    const migrationFile = path.join(__dirname, 'migrations', 'add-optional-columns-quotations-postgres.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    console.log('\n🔄 Aplicando migración de columnas opcionales...');

    // Dividir por punto y coma y ejecutar cada sentencia
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await pool.query(statement);
        console.log('✅ Ejecutado:', statement.substring(0, 60) + '...');
      } catch (error) {
        // Ignorar errores de "ya existe"
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('⚠️  Ya existe, continuando...');
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Migraciones aplicadas exitosamente');

    // Verificar las columnas
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quotation_items'
      AND column_name IN ('ubicacion', 'cliente', 'garantia', 'instalacion', 'entrega', 'metodo_pago')
      ORDER BY column_name
    `);

    console.log('\n✅ Columnas opcionales agregadas:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });

    // Verificar configuraciones de área
    const configs = await pool.query('SELECT * FROM area_column_config ORDER BY area');
    console.log('\n✅ Configuraciones de área:');
    configs.rows.forEach(config => {
      console.log(`   - ${config.area}: ${JSON.stringify(config.enabled_columns)}`);
    });

  } catch (error) {
    console.error('\n❌ Error aplicando migraciones:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigrations();
