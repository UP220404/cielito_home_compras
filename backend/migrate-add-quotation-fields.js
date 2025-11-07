const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

async function migrate() {
  const db = new sqlite3.Database(dbPath);

  // Promisificar métodos de db
  const runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  };

  const allAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  console.log('🔄 Iniciando migración: Agregar campos has_invoice y delivery_date a quotation_items...\n');

  try {
    // Verificar si las columnas ya existen
    const tableInfo = await allAsync("PRAGMA table_info(quotation_items)");
    const hasInvoiceExists = tableInfo.some(col => col.name === 'has_invoice');
    const deliveryDateExists = tableInfo.some(col => col.name === 'delivery_date');

    if (hasInvoiceExists && deliveryDateExists) {
      console.log('✅ Las columnas has_invoice y delivery_date ya existen. No es necesario migrar.');
      db.close();
      return;
    }

    await runAsync('BEGIN TRANSACTION');

    // Crear tabla temporal con la nueva estructura
    console.log('📝 Creando tabla temporal con nuevos campos...');
    await runAsync(`
      CREATE TABLE quotation_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        request_item_id INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        notes TEXT,
        has_invoice INTEGER DEFAULT 0,
        delivery_date DATE,
        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
        FOREIGN KEY (request_item_id) REFERENCES request_items(id)
      )
    `);

    // Copiar datos de la tabla antigua a la nueva
    console.log('📦 Copiando datos existentes...');
    await runAsync(`
      INSERT INTO quotation_items_new
        (id, quotation_id, request_item_id, unit_price, subtotal, notes, has_invoice, delivery_date)
      SELECT
        id, quotation_id, request_item_id, unit_price, subtotal, notes, 0, NULL
      FROM quotation_items
    `);

    // Eliminar tabla antigua
    console.log('🗑️  Eliminando tabla antigua...');
    await runAsync('DROP TABLE quotation_items');

    // Renombrar tabla nueva
    console.log('✏️  Renombrando tabla nueva...');
    await runAsync('ALTER TABLE quotation_items_new RENAME TO quotation_items');

    await runAsync('COMMIT');

    console.log('\n✅ Migración completada exitosamente!');
    console.log('   - Campo has_invoice agregado (0 = No, 1 = Sí)');
    console.log('   - Campo delivery_date agregado (fecha de entrega específica por item)');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    await runAsync('ROLLBACK').catch(() => {});
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();
