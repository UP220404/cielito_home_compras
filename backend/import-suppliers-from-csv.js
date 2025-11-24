/**
 * Script para importar proveedores desde archivos CSV
 * Uso: node import-suppliers-from-csv.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Configuración de la base de datos (usar URL externa)
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://sistema_compras_user:bjklvVXKh8MhrQ4H7pITygLFLYFFx7dS@dpg-d47460euk2gs73ei2nog-a.oregon-postgres.render.com/sistema_compras";

console.log('🔌 Conectando a la base de datos...');

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 5
});

// Mapeo de archivos CSV a categorías
const csvFiles = [
  { file: 'Base de datos proveedores - Agencias de viajes.csv', category: 'Agencias de Viajes' },
  { file: 'Base de datos proveedores - Blancos.csv', category: 'Blancos' },
  { file: 'Base de datos proveedores - Bases y cabeceras.csv', category: 'Bases y Cabeceras' },
  { file: 'Base de datos proveedores - Cerrajero.csv', category: 'Cerrajería' },
  { file: 'Base de datos proveedores - Chefs.csv', category: 'Chefs' },
  { file: 'Base de datos proveedores - Doctores.csv', category: 'Doctores' },
  { file: 'Base de datos proveedores - Eventos y salones.csv', category: 'Eventos y Salones' },
  { file: 'Base de datos proveedores - Extintores.csv', category: 'Extintores' },
  { file: 'Base de datos proveedores - Ferreterias .csv', category: 'Ferretería' },
  { file: 'Base de datos proveedores - Juridico.csv', category: 'Jurídico' },
  { file: 'Base de datos proveedores - lavadoras.csv', category: 'Lavadoras' },
  { file: 'Base de datos proveedores - Llaveros.csv', category: 'Llaveros' },
  { file: 'Base de datos proveedores - Mariachis .csv', category: 'Mariachis' },
  { file: 'Base de datos proveedores - mobiliario casas.csv', category: 'Mobiliario' },
  { file: 'Base de datos proveedores - Pasteleria.csv', category: 'Pastelería' },
  { file: 'Base de datos proveedores - Persianas .csv', category: 'Persianas' },
  { file: 'Base de datos proveedores - Playeras .csv', category: 'Playeras' },
  { file: 'Base de datos proveedores - Productos de limpieza.csv', category: 'Productos de Limpieza' },
  { file: 'Base de datos proveedores - Tecnicos.csv', category: 'Técnicos' }
];

async function importSuppliers() {
  const client = await pool.connect();

  try {
    console.log('🚀 Iniciando importación de proveedores...\n');

    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const csvInfo of csvFiles) {
      const csvPath = path.join(__dirname, '..', 'Img_Referencia', csvInfo.file);

      if (!fs.existsSync(csvPath)) {
        console.log(`⚠️  Archivo no encontrado: ${csvInfo.file}`);
        continue;
      }

      console.log(`📂 Procesando: ${csvInfo.file}`);

      const fileContent = fs.readFileSync(csvPath, 'utf-8');

      let records;
      try {
        records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true
        });
      } catch (parseError) {
        console.log(`   ❌ Error parseando CSV: ${parseError.message}`);
        totalErrors++;
        continue;
      }

      let categoryImported = 0;
      let categorySkipped = 0;

      for (const record of records) {
        // Obtener nombre del proveedor (puede estar en diferentes columnas)
        const name = record['Vendor'] || record['vendor'] || record['Nombre'] || '';

        if (!name || name.trim() === '' || name.trim() === ',') {
          continue;
        }

        // Limpiar y preparar datos
        const cleanName = name.trim().toUpperCase();
        const phone = (record['Numero telefonico '] || record['Numero telefonico'] || record['Telefono'] || '').toString().trim();
        const rfc = (record['RFC'] || record['rfc'] || '').toString().trim();
        const address = (record['Lugar'] || record['Direccion'] || '').toString().trim();
        const contactName = (record['Contacto preferente'] || record['Contacto'] || '').toString().trim();
        const hasInvoice = (record['FACTURA?'] || '').toString().toLowerCase().includes('s');
        const notes = (record['Notas'] || record['Column 1'] || '').toString().trim();
        const vendorType = (record['Vendor type'] || '').toString().trim();

        // Verificar si ya existe
        const existing = await client.query(
          'SELECT id FROM suppliers WHERE UPPER(name) = $1',
          [cleanName]
        );

        if (existing.rows.length > 0) {
          categorySkipped++;
          continue;
        }

        // Insertar proveedor
        try {
          await client.query(`
            INSERT INTO suppliers (
              name, phone, rfc, address, contact_name, category,
              notes, is_active, rating, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
          `, [
            cleanName,
            phone || null,
            rfc && rfc !== '-' ? rfc : null,
            address || null,
            contactName || null,
            csvInfo.category,
            notes ? `${vendorType ? `Tamaño: ${vendorType}. ` : ''}${hasInvoice ? 'Factura: Sí. ' : ''}${notes}` : (vendorType ? `Tamaño: ${vendorType}` : null),
            true,
            3.0
          ]);

          categoryImported++;
        } catch (insertError) {
          console.log(`   ❌ Error insertando ${cleanName}: ${insertError.message}`);
          totalErrors++;
        }
      }

      console.log(`   ✅ Importados: ${categoryImported}, Omitidos (duplicados): ${categorySkipped}`);
      totalImported += categoryImported;
      totalSkipped += categorySkipped;
    }

    console.log('\n========================================');
    console.log('📊 RESUMEN DE IMPORTACIÓN');
    console.log('========================================');
    console.log(`✅ Total importados: ${totalImported}`);
    console.log(`⏭️  Total omitidos (duplicados): ${totalSkipped}`);
    console.log(`❌ Total errores: ${totalErrors}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
importSuppliers().catch(console.error);
