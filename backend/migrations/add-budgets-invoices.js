const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Iniciando migración: Presupuestos y Facturas...\n');

db.serialize(() => {
  // 1. Crear tabla de presupuestos
  console.log('📊 Creando tabla budgets...');
  db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT NOT NULL,
      year INTEGER NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      spent_amount DECIMAL(10, 2) DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      UNIQUE(area, year)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creando tabla budgets:', err.message);
    } else {
      console.log('✅ Tabla budgets creada exitosamente');
    }
  });

  // 2. Crear tabla de facturas
  console.log('🧾 Creando tabla invoices...');
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      invoice_number TEXT,
      invoice_date DATE NOT NULL,
      subtotal DECIMAL(10, 2) NOT NULL,
      tax_amount DECIMAL(10, 2) NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      file_path TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creando tabla invoices:', err.message);
    } else {
      console.log('✅ Tabla invoices creada exitosamente');
    }
  });

  // 3. Agregar campo requires_invoice a purchase_orders
  console.log('🏷️  Agregando campo requires_invoice a purchase_orders...');
  db.run(`
    ALTER TABLE purchase_orders
    ADD COLUMN requires_invoice INTEGER DEFAULT 0
  `, (err) => {
    if (err) {
      // Si el campo ya existe, no es un error fatal
      if (err.message.includes('duplicate column name')) {
        console.log('⚠️  Campo requires_invoice ya existe');
      } else {
        console.error('❌ Error agregando campo requires_invoice:', err.message);
      }
    } else {
      console.log('✅ Campo requires_invoice agregado exitosamente');
    }
  });

  // 4. Agregar campo budget_approved a requests (para órdenes que exceden presupuesto)
  console.log('✔️  Agregando campo budget_approved a requests...');
  db.run(`
    ALTER TABLE requests
    ADD COLUMN budget_approved INTEGER DEFAULT 0
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('⚠️  Campo budget_approved ya existe');
      } else {
        console.error('❌ Error agregando campo budget_approved:', err.message);
      }
    } else {
      console.log('✅ Campo budget_approved agregado exitosamente');
    }
  });

  // 5. Insertar presupuestos iniciales para el año actual (ejemplo)
  const currentYear = new Date().getFullYear();
  console.log(`\n💰 Insertando presupuestos de ejemplo para ${currentYear}...`);

  const areas = [
    'Sistemas',
    'Administración',
    'Operaciones',
    'Ventas',
    'Recursos Humanos',
    'Finanzas',
    'Marketing',
    'Logística'
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO budgets (area, year, total_amount, spent_amount)
    VALUES (?, ?, ?, 0)
  `);

  areas.forEach(area => {
    // Presupuesto de ejemplo: $100,000 por área
    stmt.run(area, currentYear, 100000);
  });

  stmt.finalize((err) => {
    if (err) {
      console.error('❌ Error insertando presupuestos de ejemplo:', err.message);
    } else {
      console.log(`✅ Presupuestos de ejemplo insertados para ${areas.length} áreas`);
    }
  });
});

// Cerrar conexión después de todas las operaciones
db.close((err) => {
  if (err) {
    console.error('\n❌ Error cerrando base de datos:', err.message);
    process.exit(1);
  } else {
    console.log('\n✅ Migración completada exitosamente!');
    console.log('📦 Tablas creadas:');
    console.log('   - budgets (presupuestos por área/año)');
    console.log('   - invoices (facturas de órdenes)');
    console.log('📝 Campos agregados:');
    console.log('   - purchase_orders.requires_invoice');
    console.log('   - requests.budget_approved');
    process.exit(0);
  }
});
