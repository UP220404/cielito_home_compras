const { Pool } = require('pg');

// ====== POSTGRESQL ONLY (LOCAL Y PRODUCCIÓN) ======

// Requerir DATABASE_URL en todos los ambientes
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada');
  console.error('Por favor configura DATABASE_URL en tu archivo .env');
  process.exit(1);
}

// Para Neon: NO usar pool, crear conexiones frescas cada vez
// El pool reutiliza conexiones que Neon ya cerró
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
};

// Función para obtener un cliente nuevo cada vez
async function getFreshClient() {
  const { Client } = require('pg');
  const client = new Client(poolConfig);
  await client.connect();
  return client;
}

// Función helper para ejecutar queries con reintentos agresivos para Neon
async function executeWithRetry(queryFn, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (err) {
      lastError = err;
      // Solo reintentar en errores de conexión
      if (err.message && (err.message.includes('Connection terminated') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('Connection closed') ||
          err.message.includes('ECONNREFUSED'))) {
        if (attempt < maxRetries) {
          const waitTime = Math.min(2000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
          console.log(`⚠️ Neon DB suspendida, reintentando en ${waitTime/1000}s (${attempt + 2}/${maxRetries + 1})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError;
}

// Wrapper para API consistente
const db = {
  // GET - obtener un solo registro
  getAsync: async function(sql, params = []) {
    return executeWithRetry(async () => {
      const client = await getFreshClient();
      try {
        const pgSql = convertPlaceholders(sql);
        const result = await client.query(pgSql, params);
        return result.rows[0] || null;
      } catch (err) {
        console.error('Database GET error:', err.message);
        console.error('SQL:', sql);
        throw err;
      } finally {
        await client.end();
      }
    });
  },

  // ALL - obtener múltiples registros
  allAsync: async function(sql, params = []) {
    return executeWithRetry(async () => {
      const client = await getFreshClient();
      try {
        const pgSql = convertPlaceholders(sql);
        const result = await client.query(pgSql, params);
        return result.rows;
      } catch (err) {
        console.error('Database ALL error:', err.message);
        console.error('SQL:', sql);
        throw err;
      } finally {
        await client.end();
      }
    });
  },

  // RUN - ejecutar INSERT, UPDATE, DELETE
  runAsync: async function(sql, params = []) {
    return executeWithRetry(async () => {
      const client = await getFreshClient();
      try {
        let pgSql = convertPlaceholders(sql);

        // Si es un INSERT y no tiene RETURNING, agregar RETURNING id
        if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
          pgSql = pgSql + ' RETURNING id';
        }

        const result = await client.query(pgSql, params);

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
        throw err;
      } finally {
        await client.end();
      }
    });
  },

  // Query directo para casos especiales
  query: async function(sql, params = []) {
    const client = await getFreshClient();
    try {
      const pgSql = convertPlaceholders(sql);
      return await client.query(pgSql, params);
    } finally {
      await client.end();
    }
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

  // Cerrar conexión (no hacer nada porque no hay pool)
  close: async function() {
    // No-op: las conexiones se cierran después de cada query
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
