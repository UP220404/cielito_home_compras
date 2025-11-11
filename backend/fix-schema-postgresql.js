// Script para corregir el esquema PostgreSQL en producción
// Ejecutar esto si la base de datos ya existe con el esquema antiguo

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function fixSchema() {
  console.log('🔧 Iniciando corrección del esquema PostgreSQL...\n');

  try {
    // 1. Corregir tabla budgets
    console.log('📊 Corrigiendo tabla budgets...');

    // Verificar si existen las columnas antiguas
    const budgetsColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'budgets'
    `);

    const columnNames = budgetsColumns.rows.map(r => r.column_name);

    if (columnNames.includes('annual_budget')) {
      console.log('  - Renombrando annual_budget a total_amount...');
      await pool.query('ALTER TABLE budgets RENAME COLUMN annual_budget TO total_amount');
    }

    if (columnNames.includes('fiscal_year')) {
      console.log('  - Renombrando fiscal_year a year...');
      await pool.query('ALTER TABLE budgets RENAME COLUMN fiscal_year TO year');
    }

    if (!columnNames.includes('created_by')) {
      console.log('  - Agregando columna created_by...');
      await pool.query('ALTER TABLE budgets ADD COLUMN created_by INTEGER REFERENCES users(id)');
    }

    // Eliminar UNIQUE constraint en area si existe y agregar UNIQUE(area, year)
    console.log('  - Corrigiendo constraints...');
    await pool.query(`
      DO $$
      BEGIN
        -- Eliminar constraint UNIQUE en area si existe
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'budgets_area_key'
        ) THEN
          ALTER TABLE budgets DROP CONSTRAINT budgets_area_key;
        END IF;

        -- Agregar UNIQUE(area, year) si no existe
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'budgets_area_year_key'
        ) THEN
          ALTER TABLE budgets ADD CONSTRAINT budgets_area_year_key UNIQUE(area, year);
        END IF;
      END $$;
    `);

    console.log('✅ Tabla budgets corregida\n');

    // 2. Corregir tabla invoices
    console.log('💳 Corrigiendo tabla invoices...');

    const invoicesColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'invoices'
    `);

    const invoiceColumnNames = invoicesColumns.rows.map(r => r.column_name);

    if (invoiceColumnNames.includes('purchase_order_id')) {
      console.log('  - Renombrando purchase_order_id a order_id...');
      await pool.query('ALTER TABLE invoices RENAME COLUMN purchase_order_id TO order_id');
    }

    if (!invoiceColumnNames.includes('subtotal')) {
      console.log('  - Agregando columna subtotal...');
      await pool.query('ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(10,2)');
      await pool.query('UPDATE invoices SET subtotal = total_amount - COALESCE(tax_amount, 0) WHERE subtotal IS NULL');
      await pool.query('ALTER TABLE invoices ALTER COLUMN subtotal SET NOT NULL');
    }

    if (!invoiceColumnNames.includes('file_path')) {
      console.log('  - Agregando columna file_path...');
      await pool.query('ALTER TABLE invoices ADD COLUMN file_path VARCHAR(255)');
    }

    if (!invoiceColumnNames.includes('created_by')) {
      console.log('  - Agregando columna created_by...');
      await pool.query('ALTER TABLE invoices ADD COLUMN created_by INTEGER REFERENCES users(id)');
    }

    // Eliminar columnas que no se usan
    if (invoiceColumnNames.includes('due_date')) {
      console.log('  - Eliminando columnas no usadas...');
      await pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS due_date');
    }
    if (invoiceColumnNames.includes('status')) {
      await pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS status');
    }
    if (invoiceColumnNames.includes('payment_date')) {
      await pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS payment_date');
    }
    if (invoiceColumnNames.includes('pdf_path')) {
      await pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS pdf_path');
    }
    if (invoiceColumnNames.includes('xml_path')) {
      await pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS xml_path');
    }

    console.log('✅ Tabla invoices corregida\n');

    // 3. Corregir tabla suppliers
    console.log('🏢 Corrigiendo tabla suppliers...');

    const suppliersColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'suppliers'
    `);

    const supplierColumnNames = suppliersColumns.rows.map(r => r.column_name);

    if (supplierColumnNames.includes('contact_person')) {
      console.log('  - Renombrando contact_person a contact_name...');
      await pool.query('ALTER TABLE suppliers RENAME COLUMN contact_person TO contact_name');
    }

    if (!supplierColumnNames.includes('category')) {
      console.log('  - Agregando columna category...');
      await pool.query('ALTER TABLE suppliers ADD COLUMN category VARCHAR(100)');
    }

    // Eliminar columnas no usadas
    if (supplierColumnNames.includes('bank_account')) {
      console.log('  - Eliminando columnas no usadas...');
      await pool.query('ALTER TABLE suppliers DROP COLUMN IF EXISTS bank_account');
    }
    if (supplierColumnNames.includes('payment_terms')) {
      await pool.query('ALTER TABLE suppliers DROP COLUMN IF EXISTS payment_terms');
    }

    console.log('✅ Tabla suppliers corregida\n');

    // 4. Corregir tabla purchase_orders
    console.log('📦 Corrigiendo tabla purchase_orders...');

    const ordersColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'purchase_orders'
    `);

    const orderColumnNames = ordersColumns.rows.map(r => r.column_name);

    if (!orderColumnNames.includes('requires_invoice')) {
      console.log('  - Agregando columna requires_invoice...');
      await pool.query('ALTER TABLE purchase_orders ADD COLUMN requires_invoice BOOLEAN DEFAULT false');
    }

    console.log('✅ Tabla purchase_orders corregida\n');

    // 5. Corregir tabla requests
    console.log('📋 Corrigiendo tabla requests...');

    const requestsColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'requests'
    `);

    const requestColumnNames = requestsColumns.rows.map(r => r.column_name);

    if (!requestColumnNames.includes('budget_approved')) {
      console.log('  - Agregando columna budget_approved...');
      await pool.query('ALTER TABLE requests ADD COLUMN budget_approved BOOLEAN DEFAULT false');
    }

    console.log('✅ Tabla requests corregida\n');

    console.log('✨ ¡Esquema PostgreSQL corregido exitosamente!\n');

  } catch (error) {
    console.error('❌ Error corrigiendo esquema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar
if (require.main === module) {
  fixSchema()
    .then(() => {
      console.log('✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = fixSchema;
