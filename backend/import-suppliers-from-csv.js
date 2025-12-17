const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const pool = new Pool({
  host: 'ep-noisy-poetry-ah5mmbjh-pooler.c-3.us-east-1.aws.neon.tech',
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_qkPQnBZbv4o2',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

const CSV_DIR = path.join(__dirname, '..', 'Img_Referencia');

// Mapeo de nombres de archivos a categorías
const CATEGORY_MAP = {
  'Servicios control': 'Servicios (Agua, Luz, Gas, Internet)',
  'Tecnicos': 'Técnicos',
  'Ferreterias': 'Ferretería',
  'Productos de limpieza': 'Productos de Limpieza',
  'Blancos': 'Blancos',
  'Agencias de viajes': 'Agencias de Viajes',
  'Cerrajero': 'Cerrajero',
  'Juridico': 'Jurídico',
  'Bases y cabeceras': 'Bases y Cabeceras',
  'lavadoras': 'Lavadoras',
  'Chefs': 'Chefs',
  'mobiliario casas': 'Mobiliario',
  'Persianas': 'Persianas',
  'Extintores': 'Extintores',
  'Mariachis': 'Mariachis',
  'Eventos y salones': 'Eventos y Salones',
  'Doctores': 'Doctores',
  'Playeras': 'Playeras',
  'Pasteleria': 'Pastelería',
  'Llaveros': 'Llaveros'
};

async function importSuppliers() {
  console.log('📦 Importando proveedores desde CSVs...\n');
  
  try {
    const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
    console.log(`📁 Encontrados ${files.length} archivos CSV\n`);

    let totalImported = 0;
    let totalSkipped = 0;

    for (const file of files) {
      const filePath = path.join(CSV_DIR, file);
      const categoryKey = file.replace('Base de datos proveedores - ', '').replace('.csv', '').trim();
      const category = CATEGORY_MAP[categoryKey] || categoryKey;

      console.log(`\n📄 Procesando: ${file}`);
      console.log(`   Categoría: ${category}`);

      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true
        });

        console.log(`   Registros encontrados: ${records.length}`);

        for (const record of records) {
          const vendorName = record.Vendor || record.vendor || record.VENDOR;
          
          if (!vendorName || vendorName.trim() === '' || vendorName === '-') {
            totalSkipped++;
            continue;
          }

          // Verificar si ya existe
          const existing = await pool.query(
            'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)',
            [vendorName.trim()]
          );

          if (existing.rows.length > 0) {
            console.log(`   ⊘  ${vendorName} ya existe`);
            totalSkipped++;
            continue;
          }

          // Mapear campos
          const rfc = record.RFC || record.rfc || null;
          const contact = record['Contacto preferente'] || record.contacto || null;
          const phone = record['Numero telefonico'] || record['Numero telefonico '] || record.telefono || null;
          const address = record.Lugar || record.lugar || null;
          const hasInvoice = (record['FACTURA?'] || record.factura || '').toUpperCase() === 'SI';
          const notes = record.Notas || record.notas || null;

          await pool.query(`
            INSERT INTO suppliers (name, rfc, contact_name, phone, address, category, rating, has_invoice, notes, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            vendorName.trim(),
            rfc,
            contact,
            phone,
            address,
            category,
            4.0, // rating por defecto
            hasInvoice,
            notes,
            true
          ]);

          console.log(`   ✅ ${vendorName}`);
          totalImported++;
        }

      } catch (error) {
        console.error(`   ❌ Error procesando ${file}:`, error.message);
      }
    }

    console.log(`\n\n✅ Importación completada!`);
    console.log(`   📊 Total importados: ${totalImported}`);
    console.log(`   ⊘  Total omitidos: ${totalSkipped}`);

    // Mostrar resumen por categoría
    const summary = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM suppliers
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log(`\n📋 Resumen por categoría:`);
    summary.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} proveedores`);
    });

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

importSuppliers();
