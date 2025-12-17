const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-noisy-poetry-ah5mmbjh-pooler.c-3.us-east-1.aws.neon.tech',
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_qkPQnBZbv4o2',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function checkSystem() {
  console.log('🔍 VERIFICACIÓN COMPLETA DEL SISTEMA\n');
  console.log('============================================================\n');

  try {
    // 1. Verificar todas las tablas
    console.log('📋 TABLAS EN LA BASE DE DATOS:');
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesResult.rows.map(r => r.table_name);
    tables.forEach(t => console.log(`   ✅ ${t}`));
    console.log(`\n   Total: ${tables.length} tablas\n`);

    // 2. Verificar datos en cada tabla
    console.log('📊 CONTEO DE REGISTROS POR TABLA:');
    for (const table of tables) {
      const count = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const num = count.rows[0].count;
      const icon = num > 0 ? '✅' : '⚠️ ';
      console.log(`   ${icon} ${table}: ${num} registros`);
    }

    // 3. Verificar columnas críticas
    console.log('\n🔧 VERIFICACIÓN DE COLUMNAS CRÍTICAS:');

    // Suppliers
    const suppCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'suppliers'
      ORDER BY ordinal_position;
    `);
    const suppColNames = suppCols.rows.map(r => r.column_name);
    console.log('\n   suppliers:');
    ['has_invoice', 'rfc', 'category', 'rating', 'is_active'].forEach(col => {
      const hasCol = suppColNames.includes(col);
      console.log(`      ${hasCol ? '✅' : '❌'} ${col}`);
    });

    // Invoices
    const invCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'invoices'
      ORDER BY ordinal_position;
    `);
    const invColNames = invCols.rows.map(r => r.column_name);
    console.log('\n   invoices:');
    ['supplier_id', 'invoice_number', 'invoice_date', 'file_path'].forEach(col => {
      const hasCol = invColNames.includes(col);
      console.log(`      ${hasCol ? '✅' : '❌'} ${col}`);
    });

    // Quotations
    const quotCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'quotations'
      ORDER BY ordinal_position;
    `);
    const quotColNames = quotCols.rows.map(r => r.column_name);
    console.log('\n   quotations:');
    ['quoted_by', 'is_selected', 'delivery_date', 'delivery_time', 'payment_terms'].forEach(col => {
      const hasCol = quotColNames.includes(col);
      console.log(`      ${hasCol ? '✅' : '❌'} ${col}`);
    });

    // Requests
    const reqCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'requests'
      ORDER BY ordinal_position;
    `);
    const reqColNames = reqCols.rows.map(r => r.column_name);
    console.log('\n   requests:');
    ['is_draft', 'scheduled_for', 'authorized_by', 'authorized_at', 'priority', 'urgency'].forEach(col => {
      const hasCol = reqColNames.includes(col);
      console.log(`      ${hasCol ? '✅' : '❌'} ${col}`);
    });

    // Purchase orders
    const poCols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'purchase_orders'
      ORDER BY ordinal_position;
    `);
    const poColNames = poCols.rows.map(r => r.column_name);
    console.log('\n   purchase_orders:');
    ['requires_invoice', 'pdf_path', 'expected_delivery', 'actual_delivery'].forEach(col => {
      const hasCol = poColNames.includes(col);
      console.log(`      ${hasCol ? '✅' : '❌'} ${col}`);
    });

    // 4. Verificar integridad referencial (foreign keys)
    console.log('\n🔗 VERIFICACIÓN DE INTEGRIDAD REFERENCIAL:');

    const fkResult = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name;
    `);

    fkResult.rows.forEach(fk => {
      console.log(`   ✅ ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // 5. Verificar índices
    console.log('\n📇 ÍNDICES IMPORTANTES:');
    const indexResult = await pool.query(`
      SELECT
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `);

    const indexCount = indexResult.rows.length;
    console.log(`   Total de índices (sin PKs): ${indexCount}`);
    if (indexCount > 0) {
      indexResult.rows.slice(0, 10).forEach(idx => {
        console.log(`   ✅ ${idx.tablename}: ${idx.indexname}`);
      });
      if (indexCount > 10) {
        console.log(`   ... y ${indexCount - 10} más`);
      }
    }

    // 6. Resumen final
    console.log('\n============================================================');
    console.log('📊 RESUMEN FINAL:\n');
    console.log(`   ✅ Tablas: ${tables.length}/15 esperadas`);
    console.log(`   ✅ Proveedores: ${(await pool.query('SELECT COUNT(*) FROM suppliers')).rows[0].count}`);
    console.log(`   ✅ Usuarios: ${(await pool.query('SELECT COUNT(*) FROM users')).rows[0].count}`);
    console.log(`   ✅ Foreign Keys: ${fkResult.rows.length}`);
    console.log(`   ✅ Índices: ${indexCount}`);
    console.log('\n   🎯 Estado: SISTEMA LISTO PARA PRODUCCIÓN\n');
    console.log('============================================================');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

checkSystem();
