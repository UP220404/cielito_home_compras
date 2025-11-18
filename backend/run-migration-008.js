const migration = require('./migrations/008_add_area_schedules');

async function runMigration() {
  try {
    console.log('🚀 Ejecutando migración 008...');
    await migration.up();
    console.log('✅ Migración completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

runMigration();
