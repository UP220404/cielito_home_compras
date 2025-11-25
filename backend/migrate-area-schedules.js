// Script para migrar la tabla area_schedules de hour/minute a start_time/end_time
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateAreaSchedules() {
  console.log('🔄 Iniciando migración de area_schedules...\n');

  try {
    // 1. Verificar si las columnas antiguas existen
    const columnsCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'area_schedules'
        AND column_name IN ('hour', 'minute', 'start_time', 'end_time')
    `);

    const columns = columnsCheck.rows.map(r => r.column_name);
    console.log('📋 Columnas actuales:', columns);

    // 2. Si ya tiene start_time y end_time, no hacer nada
    if (columns.includes('start_time') && columns.includes('end_time') &&
        !columns.includes('hour') && !columns.includes('minute')) {
      console.log('✅ La tabla ya está migrada. No se requieren cambios.');
      return;
    }

    // 3. Si tiene las columnas antiguas, migrar
    if (columns.includes('hour') && columns.includes('minute')) {
      console.log('🔧 Migrando desde hour/minute a start_time/end_time...');

      // Obtener datos existentes
      const existingData = await pool.query(`
        SELECT id, area, day_of_week, hour, minute, is_active
        FROM area_schedules
      `);

      console.log(`📊 Registros encontrados: ${existingData.rows.length}`);

      // Eliminar la tabla antigua
      await pool.query('DROP TABLE IF EXISTS area_schedules CASCADE');
      console.log('🗑️  Tabla antigua eliminada');

      // Crear nueva tabla
      await pool.query(`
        CREATE TABLE area_schedules (
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
      console.log('✅ Nueva tabla creada');

      // Insertar datos migrados
      // Como ahora necesitamos start_time y end_time, vamos a asumir:
      // - start_time será la hora/minuto original
      // - end_time será 2 horas después por defecto
      for (const row of existingData.rows) {
        const startTime = `${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}:00`;
        const endHour = (row.hour + 2) % 24;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}:00`;

        await pool.query(`
          INSERT INTO area_schedules (area, day_of_week, start_time, end_time, is_active)
          VALUES ($1, $2, $3, $4, $5)
        `, [row.area, row.day_of_week, startTime, endTime, row.is_active]);
      }

      console.log(`✅ ${existingData.rows.length} registros migrados`);
      console.log('⚠️  NOTA: Se asignó un end_time 2 horas después del start_time por defecto.');
      console.log('   Por favor, verifica y ajusta los horarios según sea necesario.\n');
    } else {
      // La tabla no existe o está en un estado desconocido
      console.log('🆕 Creando tabla desde cero...');
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
      console.log('✅ Tabla creada');
    }

    console.log('\n✨ ¡Migración completada exitosamente!\n');

  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar migración
migrateAreaSchedules()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
