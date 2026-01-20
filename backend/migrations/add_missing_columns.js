/**
 * Script para agregar columnas faltantes a la base de datos PostgreSQL
 * Ejecutar: node migrations/add_missing_columns.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addMissingColumns() {
  console.log('🔧 Agregando columnas faltantes a la base de datos...\n');

  const client = await pool.connect();

  try {
    // 1. Agregar has_invoice a suppliers
    console.log('📦 Verificando tabla suppliers...');
    try {
      await client.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT false`);
      console.log('   ✅ Columna has_invoice agregada a suppliers');
    } catch (error) {
      if (error.code === '42701') { // columna ya existe
        console.log('   ℹ️ Columna has_invoice ya existe en suppliers');
      } else {
        throw error;
      }
    }

    // 2. Agregar columnas faltantes a quotation_items
    console.log('\n📦 Verificando tabla quotation_items...');

    const quotationItemsColumns = [
      { name: 'notes', type: 'TEXT' },
      { name: 'delivery_date', type: 'DATE' },
      { name: 'has_invoice', type: 'BOOLEAN DEFAULT false' },
      { name: 'has_warranty', type: 'BOOLEAN DEFAULT false' },
      { name: 'warranty_duration', type: 'VARCHAR(100)' },
      { name: 'garantia', type: 'TEXT' }
    ];

    for (const col of quotationItemsColumns) {
      try {
        await client.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`   ✅ Columna ${col.name} agregada a quotation_items`);
      } catch (error) {
        if (error.code === '42701') {
          console.log(`   ℹ️ Columna ${col.name} ya existe en quotation_items`);
        } else {
          throw error;
        }
      }
    }

    // 3. Verificar columna recipient en email_log (puede que se llame diferente)
    console.log('\n📦 Verificando tabla email_log...');
    try {
      // Intentar renombrar to_email a recipient si es necesario
      const result = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'email_log' AND column_name = 'recipient'
      `);

      if (result.rows.length === 0) {
        // La columna no existe, verificar si existe to_email
        const result2 = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'email_log' AND column_name = 'to_email'
        `);

        if (result2.rows.length > 0) {
          // Renombrar to_email a recipient
          await client.query(`ALTER TABLE email_log RENAME COLUMN to_email TO recipient`);
          console.log('   ✅ Columna to_email renombrada a recipient');
        } else {
          // Agregar columna recipient
          await client.query(`ALTER TABLE email_log ADD COLUMN recipient VARCHAR(255)`);
          console.log('   ✅ Columna recipient agregada');
        }
      } else {
        console.log('   ℹ️ Columna recipient ya existe en email_log');
      }
    } catch (error) {
      console.log('   ⚠️ Error verificando email_log:', error.message);
    }

    // 4. Agregar columnas faltantes a no_requirements
    console.log('\n📦 Verificando tabla no_requirements...');
    const noReqColumns = [
      { name: 'week_start', type: 'DATE' },
      { name: 'week_end', type: 'DATE' }
    ];

    for (const col of noReqColumns) {
      try {
        await client.query(`ALTER TABLE no_requirements ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`   ✅ Columna ${col.name} agregada a no_requirements`);
      } catch (error) {
        if (error.code === '42701') {
          console.log(`   ℹ️ Columna ${col.name} ya existe en no_requirements`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✨ ¡Columnas actualizadas correctamente!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingColumns()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
