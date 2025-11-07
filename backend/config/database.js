const path = require('path');

// Determinar qué base de datos usar según el entorno
const DB_TYPE = process.env.DATABASE_URL ? 'postgres' : 'sqlite';

let db;

if (DB_TYPE === 'postgres') {
  // ====== POSTGRESQL (PRODUCCIÓN - RENDER) ======
  const { Pool } = require('pg');

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

  // Wrapper para mantener compatibilidad con la API de SQLite
  db = {
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

  // Función helper para convertir placeholders de SQLite (?) a PostgreSQL ($1, $2, etc.)
  function convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => {
      index++;
      return `$${index}`;
    });
  }

} else {
  // ====== SQLITE (DESARROLLO LOCAL) ======
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');

  const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Error connecting to database:', err.message);
    } else {
      console.log('✅ Connected to SQLite database');

      // Habilitar foreign keys
      sqliteDb.run('PRAGMA foreign_keys = ON');
    }
  });

  // Función helper para promisify queries
  sqliteDb.getAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.get(sql, params, (err, result) => {
        if (err) {
          console.error('Database GET error:', err.message);
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };

  sqliteDb.allAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database ALL error:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  };

  sqliteDb.runAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.run(sql, params, function(err) {
        if (err) {
          console.error('Database RUN error:', err.message);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  };

  // Función para obtener configuración del sistema
  sqliteDb.getConfig = async function(key) {
    try {
      const result = await this.getAsync('SELECT config_value FROM system_config WHERE config_key = ?', [key]);
      return result ? result.config_value : null;
    } catch (error) {
      console.error(`Error obteniendo configuración ${key}:`, error);
      return null;
    }
  };

  // Función para logs de auditoría
  sqliteDb.auditLog = async function(tableName, recordId, action, oldValues = null, newValues = null, userId = null, ipAddress = null) {
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
  };

  db = sqliteDb;
}

console.log(`📊 Using ${DB_TYPE.toUpperCase()} database`);

module.exports = db;
