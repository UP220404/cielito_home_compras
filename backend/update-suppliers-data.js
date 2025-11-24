/**
 * Script para actualizar proveedores con datos adicionales desde CSVs
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const DATABASE_URL = "postgresql://sistema_compras_user:bjklvVXKh8MhrQ4H7pITygLFLYFFx7dS@dpg-d47460euk2gs73ei2nog-a.oregon-postgres.render.com/sistema_compras";

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

async function updateSuppliers() {
  const client = await pool.connect();

  try {
    console.log('🔄 Actualizando datos de proveedores...\n');

    let totalUpdated = 0;

    for (const csvInfo of csvFiles) {
      const csvPath = path.join(__dirname, '..', 'Img_Referencia', csvInfo.file);

      if (!fs.existsSync(csvPath)) {
        continue;
      }

      const fileContent = fs.readFileSync(csvPath, 'utf-8');

      let records;
      try {
        records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true
        });
      } catch (e) {
        continue;
      }

      let categoryUpdated = 0;

      for (const record of records) {
        const name = record['Vendor'] || record['vendor'] || '';
        if (!name || name.trim() === '') continue;

        const cleanName = name.trim().toUpperCase();

        // Obtener datos adicionales
        const vendorType = (record['Vendor type'] || '').toString().trim();
        const specialty = (record['Ocupacion'] || record['Ocupación'] || '').toString().trim();
        const hasInvoiceStr = (record['FACTURA?'] || '').toString().toLowerCase();
        const hasInvoice = hasInvoiceStr.includes('si') || hasInvoiceStr.includes('sí') ? true :
                          hasInvoiceStr.includes('no') ? false : null;
        const businessName = (record['Razon social'] || record['Razón social'] || '').toString().trim();

        // Actualizar proveedor
        const result = await client.query(`
          UPDATE suppliers
          SET
            vendor_size = COALESCE($1, vendor_size),
            specialty = COALESCE($2, specialty),
            has_invoice = COALESCE($3, has_invoice),
            business_name = COALESCE($4, business_name)
          WHERE UPPER(name) = $5
        `, [
          vendorType || null,
          specialty || null,
          hasInvoice,
          businessName && businessName !== '-' ? businessName : null,
          cleanName
        ]);

        if (result.rowCount > 0) {
          categoryUpdated++;
        }
      }

      if (categoryUpdated > 0) {
        console.log(`📂 ${csvInfo.category}: ${categoryUpdated} actualizados`);
        totalUpdated += categoryUpdated;
      }
    }

    console.log('\n========================================');
    console.log(`✅ Total proveedores actualizados: ${totalUpdated}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

updateSuppliers().catch(console.error);
