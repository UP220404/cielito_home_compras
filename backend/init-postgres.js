// Script para inicializar el esquema de PostgreSQL
// Ejecutar esto la primera vez que se despliega en Render

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function initDatabase() {
  console.log('🚀 Iniciando creación de base de datos PostgreSQL...\n');

  try {
    // Crear tablas en orden (respetando foreign keys)

    // 1. Tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('requester', 'purchaser', 'director', 'admin')),
        area VARCHAR(100),
        position VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla users creada');

    // 2. Tabla de proveedores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rfc VARCHAR(20),
        contact_name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        category VARCHAR(100),
        rating DECIMAL(3,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla suppliers creada');

    // 3. Tabla de solicitudes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        folio VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        area VARCHAR(100) NOT NULL,
        request_date DATE NOT NULL,
        delivery_date DATE,
        priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgente', 'critica')),
        justification TEXT,
        status VARCHAR(50) DEFAULT 'pendiente' CHECK (status IN ('borrador', 'programada', 'pendiente', 'cotizando', 'autorizada', 'rechazada', 'emitida', 'en_transito', 'recibida', 'cancelada')),
        authorized_by INTEGER REFERENCES users(id),
        authorized_at TIMESTAMP,
        rejection_reason TEXT,
        budget_approved BOOLEAN DEFAULT false,
        is_draft BOOLEAN DEFAULT false,
        draft_data TEXT,
        scheduled_for TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla requests creada');

    // 4. Tabla de items de solicitud
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        material VARCHAR(255) NOT NULL,
        specifications TEXT,
        approximate_cost DECIMAL(10,2),
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(50) DEFAULT 'unidad',
        in_stock BOOLEAN DEFAULT false,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla request_items creada');

    // 5. Tabla de cotizaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        quoted_by INTEGER NOT NULL REFERENCES users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        delivery_date DATE,
        delivery_time VARCHAR(100),
        payment_terms VARCHAR(255),
        validity_days INTEGER DEFAULT 30,
        notes TEXT,
        is_selected BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla quotations creada');

    // 6. Tabla de items de cotización
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        request_item_id INTEGER REFERENCES request_items(id) ON DELETE SET NULL,
        material VARCHAR(255) NOT NULL,
        specifications TEXT,
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(50) DEFAULT 'unidad',
        unit_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla quotation_items creada');

    // 7. Tabla de órdenes de compra
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        folio VARCHAR(50) UNIQUE NOT NULL,
        request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'emitida' CHECK (status IN ('emitida', 'en_transito', 'recibida', 'cancelada')),
        expected_delivery DATE,
        actual_delivery DATE,
        notes TEXT,
        pdf_path VARCHAR(255),
        requires_invoice BOOLEAN DEFAULT false,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla purchase_orders creada');

    // 8. Tabla de presupuestos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        area VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        spent_amount DECIMAL(12,2) DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(area, year)
      )
    `);
    console.log('✅ Tabla budgets creada');

    // 9. Tabla de facturas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100),
        invoice_date DATE NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        tax_amount DECIMAL(10,2) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        file_path VARCHAR(255),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla invoices creada');

    // 10. Tabla de horarios de áreas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS area_schedules (
        id SERIAL PRIMARY KEY,
        area VARCHAR(100) NOT NULL,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(area, day_of_week)
      )
    `);
    console.log('✅ Tabla area_schedules creada');

    // 11. Tabla de no requerimientos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS no_requirements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        area VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla no_requirements creada');

    // 12. Tabla de notificaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(255),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla notifications creada');

    // 13. Tabla de logs de auditoría
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        record_id INTEGER,
        action VARCHAR(50) NOT NULL,
        old_values TEXT,
        new_values TEXT,
        user_id INTEGER REFERENCES users(id),
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla audit_log creada');

    // 14. Tabla de configuración del sistema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla system_config creada');

    // 15. Tabla de log de emails
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_log (
        id SERIAL PRIMARY KEY,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla email_log creada');

    // Crear índices para mejorar performance
    console.log('\n📊 Creando índices...');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_requests_folio ON requests(folio)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_quotations_request_id ON quotations(request_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_quotations_supplier_id ON quotations(supplier_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_purchase_orders_request_id ON purchase_orders(request_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)');

    console.log('✅ Índices creados');

    console.log('\n✨ ¡Base de datos PostgreSQL inicializada correctamente!');
    console.log('📝 Nota: Ahora debes ejecutar el script para migrar datos de SQLite a PostgreSQL\n');

  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  // Si se requiere como módulo, ejecutar y devolver promesa
  module.exports = initDatabase();
}
