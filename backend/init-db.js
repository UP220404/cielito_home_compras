const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = process.env.DATABASE_URL || './database.sqlite';

console.log('🚀 Inicializando base de datos...');

// Crear conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a SQLite database');
});

// Función para ejecutar queries con promesas
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

// Crear todas las tablas
async function createTables() {
  try {
    console.log('📝 Creando tablas...');

    // Tabla de usuarios
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        area TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('requester', 'purchaser', 'director', 'admin')),
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de solicitudes
    await runQuery(`
      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        area TEXT NOT NULL,
        urgency TEXT NOT NULL CHECK (urgency IN ('baja', 'media', 'alta')),
        priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgente', 'critica')),
        justification TEXT NOT NULL,
        delivery_date DATE NOT NULL,
        status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'cotizando', 'autorizada', 'rechazada', 'comprada', 'entregada', 'cancelada')),
        authorized_by INTEGER,
        authorized_at DATETIME,
        rejection_reason TEXT,
        request_date DATE DEFAULT (DATE('now')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (authorized_by) REFERENCES users(id)
      )
    `);

    // Tabla de items de solicitud
    await runQuery(`
      CREATE TABLE IF NOT EXISTS request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        material TEXT NOT NULL,
        specifications TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT DEFAULT 'pza',
        approximate_cost DECIMAL(10,2),
        in_stock INTEGER DEFAULT 0,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
      )
    `);

    // Tabla de proveedores
    await runQuery(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rfc TEXT,
        contact_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        category TEXT,
        rating DECIMAL(2,1) DEFAULT 5.0,
        is_active INTEGER DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de cotizaciones
    await runQuery(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        quotation_number TEXT,
        total_amount DECIMAL(10,2) NOT NULL,
        delivery_days INTEGER,
        payment_terms TEXT,
        validity_days INTEGER DEFAULT 30,
        notes TEXT,
        is_selected INTEGER DEFAULT 0,
        quoted_by INTEGER NOT NULL,
        quoted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (quoted_by) REFERENCES users(id)
      )
    `);

    // Tabla de items de cotización
    await runQuery(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        request_item_id INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        notes TEXT,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
        FOREIGN KEY (request_item_id) REFERENCES request_items(id)
      )
    `);

    // Tabla de órdenes de compra
    await runQuery(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT UNIQUE NOT NULL,
        request_id INTEGER NOT NULL,
        quotation_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        order_date DATE NOT NULL,
        expected_delivery DATE,
        actual_delivery DATE,
        total_amount DECIMAL(10,2) NOT NULL,
        status TEXT DEFAULT 'emitida' CHECK (status IN ('emitida', 'en_transito', 'recibida', 'cancelada')),
        notes TEXT,
        pdf_path TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id),
        FOREIGN KEY (quotation_id) REFERENCES quotations(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Tabla de notificaciones
    await runQuery(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'danger')),
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Tabla de log de emails
    await runQuery(`
      CREATE TABLE IF NOT EXISTS email_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        request_id INTEGER,
        status TEXT DEFAULT 'sent',
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id)
      )
    `);

    // Tabla de auditoría
    await runQuery(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'login', 'logout')),
        old_values TEXT,
        new_values TEXT,
        user_id INTEGER,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    console.log('✅ Todas las tablas creadas exitosamente');

  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    throw error;
  }
}

// Crear usuario administrador por defecto (solo si no existe)
async function createDefaultAdmin() {
  return new Promise((resolve, reject) => {
    // Verificar si ya existe un admin
    db.get('SELECT id FROM users WHERE role = "admin" LIMIT 1', (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (row) {
        console.log('✅ Usuario administrador ya existe');
        resolve();
        return;
      }

      // Crear admin por defecto
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      
      db.run(`
        INSERT INTO users (name, email, password, area, role)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'Administrador del Sistema',
        'admin@sistema.com',
        hashedPassword,
        'Sistemas',
        'admin'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Usuario administrador creado:');
          console.log('   Email: admin@sistema.com');
          console.log('   Password: admin123');
          console.log('   ⚠️  Cambia la contraseña después del primer login');
          resolve();
        }
      });
    });
  });
}

// Función principal
async function initializeDatabase() {
  try {
    await createTables();
    await createDefaultAdmin();
    
    console.log('🎉 Base de datos inicializada correctamente');
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('1. Copia .env.example a .env y configura tus variables');
    console.log('2. Inicia el servidor con: npm start');
    console.log('3. Accede con admin@sistema.com / admin123');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Error cerrando base de datos:', err.message);
      }
      process.exit(0);
    });
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };