const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔄 Creando tabla de no requerimientos...');

  // Crear tabla de no requerimientos
  db.run(`
    CREATE TABLE IF NOT EXISTS no_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      area TEXT NOT NULL,
      week_start DATE NOT NULL,
      week_end DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente', 'aprobado', 'rechazado')),
      approved_by INTEGER,
      approved_at DATETIME,
      rejection_reason TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creando tabla no_requirements:', err);
    } else {
      console.log('✅ Tabla no_requirements creada exitosamente');
    }
  });

  // Crear índices para búsquedas eficientes
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_no_requirements_user_id
    ON no_requirements(user_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_no_requirements_area
    ON no_requirements(area)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_no_requirements_week
    ON no_requirements(week_start, week_end)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_no_requirements_status
    ON no_requirements(status)
  `);

  console.log('✅ Índices creados exitosamente');
});

db.close((err) => {
  if (err) {
    console.error('❌ Error cerrando la base de datos:', err);
  } else {
    console.log('✅ Migración completada. Base de datos cerrada.');
  }
});
