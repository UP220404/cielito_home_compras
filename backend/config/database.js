const { Pool } = require('pg');

// ====== POSTGRESQL ONLY (LOCAL Y PRODUCCIÓN) ======

// Requerir DATABASE_URL en todos los ambientes
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada');
  console.error('Por favor configura DATABASE_URL en tu archivo .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
});

// Wrapper para API consistente
const db = {
  _pool: pool,

  // GET - obtener un solo registro
  getAsync: async function(sql, params = []) {
    try {
      // Convertir placeholders ? a $1, $2, etc.
      const pgSql = convertPlaceholders(sql);
      const result = await pool.query(pgSql, params);
      return result.rows[0] || null;
    } catch (err) {
      console.error('Database GET error:', err.message);
      console.error('SQL:', sql);
      console.error('🚨 Error:', err);
      console.error('Stack:', err.stack);
      throw err;
    }
  },

  // ALL - obtener múltiples registros
  allAsync: async function(sql, params = []) {
    try {
      const pgSql = convertPlaceholders(sql);
      const result = await pool.query(pgSql, params);
      return result.rows;
    } catch (err) {
      console.error('Database ALL error:', err.message);
      console.error('SQL:', sql);
      console.error('🚨 Error:', err);
      throw err;
    }
  },

  // RUN - ejecutar INSERT, UPDATE, DELETE
  runAsync: async function(sql, params = []) {
    try {
      const pgSql = convertPlaceholders(sql);
      const result = await pool.query(pgSql, params);

      // Intentar obtener el ID insertado si es un INSERT con RETURNING
      let lastID = null;
      if (sql.trim().toUpperCase().startsWith('INSERT') && result.rows && result.rows[0]) {
        lastID = result.rows[0].id;
      }

      return {
        id: lastID,
        changes: result.rowCount
      };
    } catch (err) {
      console.error('Database RUN error:', err.message);
      console.error('SQL:', sql);
      console.error('🚨 Error:', err);
      throw err;
    }
  },

  // Query directo para casos especiales
  query: async function(sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    return await pool.query(pgSql, params);
  },

  // Función para obtener configuración del sistema
  getConfig: async function(key) {
    try {
      const result = await this.getAsync(
        'SELECT config_value FROM system_config WHERE config_key = ?',
        [key]
      );
      return result ? result.config_value : null;
    } catch (error) {
      console.error(`Error obteniendo configuración ${key}:`, error);
      return null;
    }
  },

  // Función para logs de auditoría
  auditLog: async function(tableName, recordId, action, oldValues = null, newValues = null, userId = null, ipAddress = null) {
    try {
      await this.runAsync(
        `INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tableName,
          recordId,
          action,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          userId,
          ipAddress
        ]
      );
    } catch (error) {
      console.error('Error en audit log:', error);
    }
  },

  // Cerrar conexión
  close: async function() {
    await pool.end();
  }
};

// Función helper para convertir placeholders de ? a PostgreSQL ($1, $2, etc.)
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index++;
    return `$${index}`;
  });
}

console.log('📊 Using POSTGRESQL database');

module.exports = db;
