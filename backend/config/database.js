const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    
    // Habilitar foreign keys
    db.run('PRAGMA foreign_keys = ON');
  }
});

// Función helper para promisify queries
db.getAsync = function(sql, params = []) {
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

db.allAsync = function(sql, params = []) {
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

db.runAsync = function(sql, params = []) {
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
db.getConfig = async function(key) {
  try {
    const result = await this.getAsync('SELECT config_value FROM system_config WHERE config_key = ?', [key]);
    return result ? result.config_value : null;
  } catch (error) {
    console.error(`Error obteniendo configuración ${key}:`, error);
    return null;
  }
};

// Función para logs de auditoría
db.auditLog = async function(tableName, recordId, action, oldValues = null, newValues = null, userId = null, ipAddress = null) {
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

module.exports = db;
