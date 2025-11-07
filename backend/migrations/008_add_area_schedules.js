const db = require('../config/database');

async function up() {
  console.log('📅 Creando tabla area_schedules...');

  // Tabla para configurar días y horarios permitidos por área
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS area_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT NOT NULL,
      day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, 2=Martes... 6=Sábado
      start_time TEXT NOT NULL, -- Formato 'HH:MM' (ej: '09:00')
      end_time TEXT NOT NULL, -- Formato 'HH:MM' (ej: '17:00')
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(area, day_of_week)
    )
  `);

  console.log('✅ Tabla area_schedules creada');

  // Insertar horarios por defecto para cada área (Lunes a Viernes, 9:00-17:00)
  const areas = ['Sistemas', 'Recursos Humanos', 'Operaciones', 'Ventas', 'Finanzas'];

  for (const area of areas) {
    for (let day = 1; day <= 5; day++) { // Lunes a Viernes
      await db.runAsync(`
        INSERT INTO area_schedules (area, day_of_week, start_time, end_time, is_active)
        VALUES (?, ?, '09:00', '17:00', 1)
      `, [area, day]);
    }
  }

  console.log('✅ Horarios por defecto insertados');

  // Agregar campos a la tabla requests para borradores y programación
  console.log('📝 Agregando campos a tabla requests...');

  await db.runAsync(`
    ALTER TABLE requests ADD COLUMN is_draft BOOLEAN DEFAULT 0
  `);

  await db.runAsync(`
    ALTER TABLE requests ADD COLUMN scheduled_for DATETIME NULL
  `);

  await db.runAsync(`
    ALTER TABLE requests ADD COLUMN draft_data TEXT NULL
  `);

  console.log('✅ Campos agregados a requests');
}

async function down() {
  console.log('🔄 Revirtiendo migración area_schedules...');

  await db.runAsync('DROP TABLE IF EXISTS area_schedules');

  // No podemos eliminar columnas en SQLite fácilmente
  // Pero documentamos qué campos fueron agregados:
  // - is_draft
  // - scheduled_for
  // - draft_data

  console.log('✅ Migración revertida');
}

module.exports = { up, down };
