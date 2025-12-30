const db = require('../config/database');

/**
 * Migración: Eliminar campo redundante 'urgency' y dejar solo 'priority'
 *
 * Antes:
 *   - urgency: baja, media, alta
 *   - priority: normal, urgente, critica
 *
 * Después:
 *   - priority: normal, urgente, critica (ÚNICO campo)
 */

async function up() {
  console.log('🔄 Unificando urgency y priority...');

  // 1. Migrar datos existentes: si urgency era 'alta', actualizar priority a 'urgente'
  console.log('📊 Migrando datos de urgency a priority...');

  await db.runAsync(`
    UPDATE requests
    SET priority = CASE
      WHEN urgency = 'alta' AND priority = 'normal' THEN 'urgente'
      WHEN urgency = 'media' AND priority = 'normal' THEN 'normal'
      ELSE priority
    END
    WHERE urgency IS NOT NULL
  `);

  console.log('✅ Datos migrados correctamente');

  // 2. Eliminar columna urgency (PostgreSQL permite DROP COLUMN)
  console.log('🗑️ Eliminando columna urgency...');

  await db.runAsync(`
    ALTER TABLE requests DROP COLUMN IF EXISTS urgency
  `);

  console.log('✅ Columna urgency eliminada');
  console.log('✅ Migración completada - Solo priority quedará activo');
}

async function down() {
  console.log('🔄 Revirtiendo migración...');

  // Volver a agregar urgency
  await db.runAsync(`
    ALTER TABLE requests
    ADD COLUMN urgency VARCHAR(20) CHECK (urgency IN ('baja', 'media', 'alta'))
  `);

  // Restaurar valores por defecto
  await db.runAsync(`
    UPDATE requests
    SET urgency = CASE
      WHEN priority = 'critica' THEN 'alta'
      WHEN priority = 'urgente' THEN 'alta'
      ELSE 'media'
    END
  `);

  console.log('✅ Migración revertida');
}

module.exports = { up, down };
