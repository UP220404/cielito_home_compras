// Script para verificar y inicializar la base de datos si es necesario
// Se ejecuta automáticamente antes de iniciar el servidor en Render

const { Pool } = require('pg');

async function checkAndInitDatabase() {
  // Solo ejecutar si DATABASE_URL está configurada (PostgreSQL en Render)
  if (!process.env.DATABASE_URL) {
    console.log('📊 Usando SQLite (desarrollo local) - Skip inicialización');
    return;
  }

  console.log('🔍 Verificando base de datos PostgreSQL...');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    // Intentar consultar la tabla users
    await pool.query('SELECT * FROM users LIMIT 1');
    console.log('✅ Base de datos ya inicializada');
    await pool.end();
  } catch (error) {
    // Si la tabla no existe, inicializar el esquema
    console.log('🔧 Tablas no encontradas, inicializando esquema...');
    await pool.end();

    // Importar y ejecutar el script de inicialización
    const initScript = require('./init-postgres');
    // El script init-postgres.js se ejecutará automáticamente
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  checkAndInitDatabase()
    .then(() => {
      console.log('✅ Verificación completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = checkAndInitDatabase;
