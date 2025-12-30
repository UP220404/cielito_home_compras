// Script para ejecutar la migración 011: Eliminar urgency y unificar con priority
const db = require('./config/database');
const migration = require('./migrations/011_remove_urgency_unify_priority');

async function runMigration() {
  console.log('🚀 Iniciando migración 011...\n');

  try {
    await migration.up();
    console.log('\n✅ Migración 011 completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error ejecutando migración:', error);
    process.exit(1);
  }
}

runMigration();
