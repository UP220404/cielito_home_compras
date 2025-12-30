const { Pool } = require('pg');

// Configuración de bases de datos
const renderDB = new Pool({
  connectionString: 'postgresql://sistema_compras_user:bjklvVXKh8MhrQ4H7pITygLFLYFFx7dS@dpg-d47460euk2gs73ei2nog-a.oregon-postgres.render.com/sistema_compras',
  ssl: { rejectUnauthorized: false }
});

const neonDB = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qkPQnBZbv4o2@ep-noisy-poetry-ah5mmbjh-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🚀 Iniciando migración de Render a Neon...\n');

  try {
    // 1. Obtener el esquema de todas las tablas
    console.log('📋 Paso 1: Obteniendo esquema de tablas...');
    const tablesResult = await renderDB.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`✅ Encontradas ${tables.length} tablas: ${tables.join(', ')}\n`);

    // 2. Para cada tabla, obtener el CREATE TABLE
    console.log('🏗️  Paso 2: Creando estructura en Neon...');
    for (const table of tables) {
      // Obtener la definición de la tabla
      const createTableQuery = await renderDB.query(`
        SELECT
          'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' ||
          string_agg(
            column_name || ' ' ||
            CASE
              WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
              WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
              WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
              ELSE UPPER(data_type)
            END ||
            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
            CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
            ', '
          ) || ');' as create_statement
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        GROUP BY table_name;
      `, [table]);

      if (createTableQuery.rows.length > 0) {
        const createStmt = createTableQuery.rows[0].create_statement;
        try {
          await neonDB.query(createStmt);
          console.log(`  ✅ Tabla ${table} creada`);
        } catch (err) {
          console.log(`  ⚠️  Tabla ${table} ya existe o error: ${err.message}`);
        }
      }
    }

    // 3. Copiar datos de cada tabla
    console.log('\n📦 Paso 3: Copiando datos...');
    for (const table of tables) {
      // Contar registros
      const countResult = await renderDB.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(countResult.rows[0].count);

      if (count === 0) {
        console.log(`  ⊘  Tabla ${table}: 0 registros, omitiendo...`);
        continue;
      }

      // Obtener todos los datos
      const dataResult = await renderDB.query(`SELECT * FROM ${table}`);

      if (dataResult.rows.length > 0) {
        // Obtener nombres de columnas
        const columns = Object.keys(dataResult.rows[0]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

        // Insertar cada fila
        let inserted = 0;
        for (const row of dataResult.rows) {
          const values = columns.map(col => row[col]);
          try {
            await neonDB.query(insertQuery, values);
            inserted++;
          } catch (err) {
            console.log(`    ⚠️  Error insertando en ${table}: ${err.message}`);
          }
        }
        console.log(`  ✅ Tabla ${table}: ${inserted}/${count} registros copiados`);
      }
    }

    // 4. Copiar secuencias (sequences)
    console.log('\n🔢 Paso 4: Actualizando secuencias...');
    for (const table of tables) {
      try {
        const maxIdResult = await neonDB.query(`SELECT MAX(id) as max_id FROM ${table}`);
        if (maxIdResult.rows[0].max_id) {
          const maxId = maxIdResult.rows[0].max_id;
          await neonDB.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), ${maxId})`);
          console.log(`  ✅ Secuencia de ${table} actualizada a ${maxId}`);
        }
      } catch (err) {
        // No todas las tablas tienen id o secuencias
      }
    }

    console.log('\n✅ ¡Migración completada exitosamente!');
    console.log('\n📊 Resumen:');
    for (const table of tables) {
      const count = await neonDB.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  - ${table}: ${count.rows[0].count} registros`);
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    console.error(error.stack);
  } finally {
    await renderDB.end();
    await neonDB.end();
  }
}

migrate();
