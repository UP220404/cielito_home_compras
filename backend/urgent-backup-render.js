const { Pool } = require('pg');
const fs = require('fs');

// Intentar con ambas URLs de Render
const databases = [
  {
    name: 'Internal',
    url: 'postgresql://sistema_compras_user:bjklvVXKh8MhrQ4H7pITygLFLYFFx7dS@dpg-d47460euk2gs73ei2nog-a/sistema_compras'
  },
  {
    name: 'External',
    url: 'postgresql://sistema_compras_user:bjklvVXKh8MhrQ4H7pITygLFLYFFx7dS@dpg-d47460euk2gs73ei2nog-a.oregon-postgres.render.com/sistema_compras'
  }
];

async function tryBackup(dbConfig) {
  console.log(`\n🔄 Intentando conectar a ${dbConfig.name}...`);

  const pool = new Pool({
    connectionString: dbConfig.url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log(`✅ Conexión exitosa a ${dbConfig.name}!`);

    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`📋 Encontradas ${tables.length} tablas`);

    let sqlDump = `-- Backup de Render Database\n-- Fecha: ${new Date().toISOString()}\n\n`;

    for (const table of tables) {
      console.log(`  📦 Exportando ${table}...`);

      const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(countResult.rows[0].count);

      if (count === 0) {
        console.log(`     ⊘ 0 registros`);
        continue;
      }

      const dataResult = await pool.query(`SELECT * FROM ${table}`);
      console.log(`     ✅ ${count} registros`);

      // Generate INSERT statements
      for (const row of dataResult.rows) {
        const columns = Object.keys(row);
        const values = columns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          return val;
        });

        sqlDump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
      }

      sqlDump += '\n';
    }

    // Save to file
    const filename = `backup_render_${Date.now()}.sql`;
    fs.writeFileSync(filename, sqlDump);
    console.log(`\n✅ Backup guardado en: ${filename}`);

    await pool.end();
    return filename;

  } catch (error) {
    console.error(`❌ Error con ${dbConfig.name}:`, error.message);
    await pool.end();
    return null;
  }
}

async function main() {
  console.log('🚨 INTENTO URGENTE DE BACKUP DE RENDER');

  for (const db of databases) {
    const result = await tryBackup(db);
    if (result) {
      console.log('\n🎉 ¡Backup exitoso!');
      process.exit(0);
    }
  }

  console.log('\n❌ No se pudo conectar a ninguna base de datos de Render');
  console.log('La base de datos ya no está disponible.');
  process.exit(1);
}

main();
