/**
 * Migración: Agregar selección por ítem individual
 * Permite seleccionar diferentes proveedores para cada ítem
 */

const db = require('./config/database');

async function migrate() {
  try {
    console.log('🔄 Iniciando migración para selección por ítem...');

    // 1. Agregar columna is_selected a quotation_items
    await db.runAsync(`
      ALTER TABLE quotation_items
      ADD COLUMN is_selected INTEGER DEFAULT 0
    `);
    console.log('✅ Columna is_selected agregada a quotation_items');

    // 2. Migrar datos existentes: si una cotización está seleccionada (quotations.is_selected = 1),
    //    marcar todos sus ítems como seleccionados
    await db.runAsync(`
      UPDATE quotation_items
      SET is_selected = 1
      WHERE quotation_id IN (
        SELECT id FROM quotations WHERE is_selected = 1
      )
    `);
    console.log('✅ Datos migrados: ítems de cotizaciones seleccionadas marcados');

    console.log('✅ Migración completada exitosamente');
    console.log('');
    console.log('Ahora puedes:');
    console.log('- Seleccionar diferentes proveedores para cada ítem');
    console.log('- Comparar precios por ítem individual');
    console.log('- Crear órdenes combinadas o separadas por proveedor');

  } catch (error) {
    if (error.message.includes('duplicate column name')) {
      console.log('⚠️  La columna is_selected ya existe en quotation_items');
      console.log('✅ No se requiere migración');
    } else {
      console.error('❌ Error en migración:', error);
      throw error;
    }
  } finally {
    process.exit(0);
  }
}

migrate();
