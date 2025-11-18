const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ⚠️ ENDPOINT TEMPORAL PARA CORREGIR ESQUEMA
// Ejecutar UNA VEZ y luego eliminar este archivo
router.post('/fix-schema', async (req, res) => {
  const results = [];

  // Enviar respuesta inmediatamente para evitar timeout
  res.json({
    success: true,
    message: 'Corrección iniciada en segundo plano',
    note: 'Revisa los logs de Render para ver el progreso'
  });

  // Ejecutar correcciones en background
  (async () => {

  try {
    results.push('🔧 Iniciando corrección del esquema PostgreSQL...\n');

    // 1. Corregir tabla budgets
    results.push('📊 Corrigiendo tabla budgets...');

    const budgetsColumns = await db._pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'budgets'
    `);

    const columnNames = budgetsColumns.rows.map(r => r.column_name);

    if (columnNames.includes('annual_budget')) {
      results.push('  - Renombrando annual_budget a total_amount...');
      await db._pool.query('ALTER TABLE budgets RENAME COLUMN annual_budget TO total_amount');
    }

    if (columnNames.includes('fiscal_year')) {
      results.push('  - Renombrando fiscal_year a year...');
      await db._pool.query('ALTER TABLE budgets RENAME COLUMN fiscal_year TO year');
    }

    if (!columnNames.includes('created_by')) {
      results.push('  - Agregando columna created_by...');
      await db._pool.query('ALTER TABLE budgets ADD COLUMN created_by INTEGER REFERENCES users(id)');
    }

    results.push('  - Corrigiendo constraints...');
    await db._pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'budgets_area_key'
        ) THEN
          ALTER TABLE budgets DROP CONSTRAINT budgets_area_key;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'budgets_area_year_key'
        ) THEN
          ALTER TABLE budgets ADD CONSTRAINT budgets_area_year_key UNIQUE(area, year);
        END IF;
      END $$;
    `);

    results.push('✅ Tabla budgets corregida\n');

    // 2. Corregir tabla invoices
    results.push('💳 Corrigiendo tabla invoices...');

    const invoicesColumns = await db._pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'invoices'
    `);

    const invoiceColumnNames = invoicesColumns.rows.map(r => r.column_name);

    if (invoiceColumnNames.includes('purchase_order_id')) {
      results.push('  - Renombrando purchase_order_id a order_id...');
      await db._pool.query('ALTER TABLE invoices RENAME COLUMN purchase_order_id TO order_id');
    }

    if (!invoiceColumnNames.includes('subtotal')) {
      results.push('  - Agregando columna subtotal...');
      await db._pool.query('ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(10,2)');
      await db._pool.query('UPDATE invoices SET subtotal = total_amount - COALESCE(tax_amount, 0) WHERE subtotal IS NULL');
      await db._pool.query('ALTER TABLE invoices ALTER COLUMN subtotal SET NOT NULL');
    }

    if (!invoiceColumnNames.includes('file_path')) {
      results.push('  - Agregando columna file_path...');
      await db._pool.query('ALTER TABLE invoices ADD COLUMN file_path VARCHAR(255)');
    }

    if (!invoiceColumnNames.includes('created_by')) {
      results.push('  - Agregando columna created_by...');
      await db._pool.query('ALTER TABLE invoices ADD COLUMN created_by INTEGER REFERENCES users(id)');
    }

    // Eliminar columnas no usadas
    if (invoiceColumnNames.includes('due_date')) {
      results.push('  - Eliminando columnas no usadas...');
      await db._pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS due_date');
    }
    if (invoiceColumnNames.includes('status')) {
      await db._pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS status');
    }
    if (invoiceColumnNames.includes('payment_date')) {
      await db._pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS payment_date');
    }
    if (invoiceColumnNames.includes('pdf_path')) {
      await db._pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS pdf_path');
    }
    if (invoiceColumnNames.includes('xml_path')) {
      await db._pool.query('ALTER TABLE invoices DROP COLUMN IF EXISTS xml_path');
    }

    results.push('✅ Tabla invoices corregida\n');

    // 3. Corregir tabla suppliers
    results.push('🏢 Corrigiendo tabla suppliers...');

    const suppliersColumns = await db._pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'suppliers'
    `);

    const supplierColumnNames = suppliersColumns.rows.map(r => r.column_name);

    if (supplierColumnNames.includes('contact_person')) {
      results.push('  - Renombrando contact_person a contact_name...');
      await db._pool.query('ALTER TABLE suppliers RENAME COLUMN contact_person TO contact_name');
    }

    if (!supplierColumnNames.includes('category')) {
      results.push('  - Agregando columna category...');
      await db._pool.query('ALTER TABLE suppliers ADD COLUMN category VARCHAR(100)');
    }

    // Eliminar columnas no usadas
    if (supplierColumnNames.includes('bank_account')) {
      results.push('  - Eliminando columnas no usadas...');
      await db._pool.query('ALTER TABLE suppliers DROP COLUMN IF EXISTS bank_account');
    }
    if (supplierColumnNames.includes('payment_terms')) {
      await db._pool.query('ALTER TABLE suppliers DROP COLUMN IF EXISTS payment_terms');
    }

    results.push('✅ Tabla suppliers corregida\n');

    // 4. Corregir tabla purchase_orders
    results.push('📦 Corrigiendo tabla purchase_orders...');

    const ordersColumns = await db._pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'purchase_orders'
    `);

    const orderColumnNames = ordersColumns.rows.map(r => r.column_name);

    if (!orderColumnNames.includes('requires_invoice')) {
      results.push('  - Agregando columna requires_invoice...');
      await db._pool.query('ALTER TABLE purchase_orders ADD COLUMN requires_invoice BOOLEAN DEFAULT false');
    }

    results.push('✅ Tabla purchase_orders corregida\n');

    // 5. Corregir tabla requests
    results.push('📋 Corrigiendo tabla requests...');

    const requestsColumns = await db._pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'requests'
    `);

    const requestColumnNames = requestsColumns.rows.map(r => r.column_name);

    if (!requestColumnNames.includes('budget_approved')) {
      results.push('  - Agregando columna budget_approved...');
      await db._pool.query('ALTER TABLE requests ADD COLUMN budget_approved BOOLEAN DEFAULT false');
    }

    results.push('✅ Tabla requests corregida\n');

    // 6. Corregir tabla no_requirements
    results.push('📝 Corrigiendo tabla no_requirements...');

    const noReqColumns = await db._pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'no_requirements'
    `);

    const noReqColumnNames = noReqColumns.rows.map(r => r.column_name);

    if (!noReqColumnNames.includes('user_id')) {
      results.push('  - Agregando columna user_id...');
      await db._pool.query('ALTER TABLE no_requirements ADD COLUMN user_id INTEGER REFERENCES users(id)');
    }

    if (!noReqColumnNames.includes('notes')) {
      results.push('  - Agregando columna notes...');
      await db._pool.query('ALTER TABLE no_requirements ADD COLUMN notes TEXT');
    }

    if (!noReqColumnNames.includes('status')) {
      results.push('  - Agregando columna status...');
      await db._pool.query("ALTER TABLE no_requirements ADD COLUMN status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado'))");
    }

    if (!noReqColumnNames.includes('approved_by')) {
      results.push('  - Agregando columna approved_by...');
      await db._pool.query('ALTER TABLE no_requirements ADD COLUMN approved_by INTEGER REFERENCES users(id)');
    }

    if (!noReqColumnNames.includes('approved_at')) {
      results.push('  - Agregando columna approved_at...');
      await db._pool.query('ALTER TABLE no_requirements ADD COLUMN approved_at TIMESTAMP');
    }

    if (!noReqColumnNames.includes('rejection_reason')) {
      results.push('  - Agregando columna rejection_reason...');
      await db._pool.query('ALTER TABLE no_requirements ADD COLUMN rejection_reason TEXT');
    }

    if (!noReqColumnNames.includes('updated_at')) {
      results.push('  - Agregando columna updated_at...');
      await db._pool.query('ALTER TABLE no_requirements ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    }

    // Renombrar columnas si existen con nombres diferentes
    if (noReqColumnNames.includes('reason') && !noReqColumnNames.includes('notes')) {
      results.push('  - Renombrando reason a notes...');
      await db._pool.query('ALTER TABLE no_requirements RENAME COLUMN reason TO notes');
    }

    if (noReqColumnNames.includes('created_by') && !noReqColumnNames.includes('user_id')) {
      results.push('  - Renombrando created_by a user_id...');
      await db._pool.query('ALTER TABLE no_requirements RENAME COLUMN created_by TO user_id');
    }

    results.push('✅ Tabla no_requirements corregida\n');

    results.push('✨ ¡Esquema PostgreSQL corregido exitosamente!\n');

    // Log de resultados
    console.log('\n========== CORRECCIÓN DE ESQUEMA COMPLETADA ==========');
    results.forEach(msg => console.log(msg));
    console.log('======================================================\n');

  } catch (error) {
    console.error('\n========== ERROR EN CORRECCIÓN DE ESQUEMA ==========');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    results.forEach(msg => console.log(msg));
    console.error('====================================================\n');
  }
  })(); // Cierre del wrapper async
});

module.exports = router;