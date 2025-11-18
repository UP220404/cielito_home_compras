// Script para migrar datos de SQLite a PostgreSQL
// Ejecutar después de init-postgres.js

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Configuración
const sqlitePath = path.join(__dirname, 'database.sqlite');
const postgresUrl = process.env.DATABASE_URL;

if (!postgresUrl) {
  console.error('❌ DATABASE_URL no está configurada');
  console.log('💡 Tip: Ejecuta: export DATABASE_URL="postgresql://user:pass@host:5432/dbname"');
  process.exit(1);
}

// Determinar si usar SSL basado en si es una conexión remota
const useSSL = postgresUrl.includes('render.com') || postgresUrl.includes('amazonaws.com');

const pool = new Pool({
  connectionString: postgresUrl,
  ssl: useSSL ? {
    rejectUnauthorized: false
  } : false
});

async function migrateData() {
  console.log('🚀 Iniciando migración de SQLite a PostgreSQL...\n');

  const sqliteDb = new sqlite3.Database(sqlitePath, (err) => {
    if (err) {
      console.error('❌ Error conectando a SQLite:', err);
      process.exit(1);
    }
  });

  // Helper para promisify SQLite queries
  const sqliteAll = (sql) => {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  try {
    // 1. Migrar usuarios
    console.log('👤 Migrando usuarios...');
    const users = await sqliteAll('SELECT * FROM users');
    for (const user of users) {
      await pool.query(`
        INSERT INTO users (id, name, email, password, role, area, position, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (email) DO NOTHING
      `, [user.id, user.name, user.email, user.password, user.role, user.area, user.position,
          user.is_active, user.created_at, user.updated_at]);
    }
    console.log(`✅ ${users.length} usuarios migrados`);

    // 2. Migrar proveedores
    console.log('🏢 Migrando proveedores...');
    const suppliers = await sqliteAll('SELECT * FROM suppliers');
    for (const supplier of suppliers) {
      await pool.query(`
        INSERT INTO suppliers (id, name, contact_person, email, phone, address, rfc, bank_account,
                               payment_terms, rating, is_active, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT DO NOTHING
      `, [supplier.id, supplier.name, supplier.contact_person, supplier.email, supplier.phone,
          supplier.address, supplier.rfc, supplier.bank_account, supplier.payment_terms,
          supplier.rating, supplier.is_active, supplier.notes, supplier.created_at, supplier.updated_at]);
    }
    console.log(`✅ ${suppliers.length} proveedores migrados`);

    // 3. Migrar solicitudes
    console.log('📝 Migrando solicitudes...');
    const requests = await sqliteAll('SELECT * FROM requests');
    for (const request of requests) {
      await pool.query(`
        INSERT INTO requests (id, folio, user_id, area, request_date, delivery_date, urgency, priority,
                              justification, status, authorized_by, authorized_at, rejection_reason,
                              is_draft, draft_data, scheduled_for, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (folio) DO NOTHING
      `, [request.id, request.folio, request.user_id, request.area, request.request_date,
          request.delivery_date, request.urgency, request.priority, request.justification,
          request.status, request.authorized_by, request.authorized_at, request.rejection_reason,
          request.is_draft, request.draft_data, request.scheduled_for, request.created_at, request.updated_at]);
    }
    console.log(`✅ ${requests.length} solicitudes migradas`);

    // 4. Migrar items de solicitud
    console.log('📦 Migrando items de solicitud...');
    const requestItems = await sqliteAll('SELECT * FROM request_items');
    for (const item of requestItems) {
      await pool.query(`
        INSERT INTO request_items (id, request_id, material, specifications, approximate_cost,
                                    quantity, unit, in_stock, location, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT DO NOTHING
      `, [item.id, item.request_id, item.material, item.specifications, item.approximate_cost,
          item.quantity, item.unit, item.in_stock, item.location, item.created_at]);
    }
    console.log(`✅ ${requestItems.length} items de solicitud migrados`);

    // 5. Migrar cotizaciones
    console.log('💰 Migrando cotizaciones...');
    const quotations = await sqliteAll('SELECT * FROM quotations');
    for (const quotation of quotations) {
      await pool.query(`
        INSERT INTO quotations (id, request_id, supplier_id, quoted_by, total_amount, delivery_date,
                                delivery_time, payment_terms, validity_days, notes, is_selected,
                                created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT DO NOTHING
      `, [quotation.id, quotation.request_id, quotation.supplier_id, quotation.quoted_by,
          quotation.total_amount, quotation.delivery_date, quotation.delivery_time,
          quotation.payment_terms, quotation.validity_days, quotation.notes, quotation.is_selected,
          quotation.created_at, quotation.updated_at]);
    }
    console.log(`✅ ${quotations.length} cotizaciones migradas`);

    // 6. Migrar items de cotización
    console.log('📋 Migrando items de cotización...');
    const quotationItems = await sqliteAll('SELECT * FROM quotation_items');
    for (const item of quotationItems) {
      await pool.query(`
        INSERT INTO quotation_items (id, quotation_id, request_item_id, material, specifications,
                                      quantity, unit, unit_price, subtotal, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT DO NOTHING
      `, [item.id, item.quotation_id, item.request_item_id, item.material, item.specifications,
          item.quantity, item.unit, item.unit_price, item.subtotal, item.created_at]);
    }
    console.log(`✅ ${quotationItems.length} items de cotización migrados`);

    // 7. Migrar órdenes de compra
    console.log('🛒 Migrando órdenes de compra...');
    const purchaseOrders = await sqliteAll('SELECT * FROM purchase_orders');
    for (const order of purchaseOrders) {
      await pool.query(`
        INSERT INTO purchase_orders (id, folio, request_id, quotation_id, supplier_id, total_amount,
                                      status, expected_delivery, actual_delivery, notes, pdf_path,
                                      created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (folio) DO NOTHING
      `, [order.id, order.folio, order.request_id, order.quotation_id, order.supplier_id,
          order.total_amount, order.status, order.expected_delivery, order.actual_delivery,
          order.notes, order.pdf_path, order.created_by, order.created_at, order.updated_at]);
    }
    console.log(`✅ ${purchaseOrders.length} órdenes de compra migradas`);

    // 8. Migrar presupuestos
    console.log('💵 Migrando presupuestos...');
    const budgets = await sqliteAll('SELECT * FROM budgets').catch(() => []);
    for (const budget of budgets) {
      // Asegurar que annual_budget no sea NULL (usar 0 como default)
      const annualBudget = budget.annual_budget || 0;
      const fiscalYear = budget.fiscal_year || new Date().getFullYear();

      await pool.query(`
        INSERT INTO budgets (id, area, annual_budget, spent_amount, fiscal_year, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (area) DO NOTHING
      `, [budget.id, budget.area, annualBudget, budget.spent_amount, fiscalYear,
          budget.created_at, budget.updated_at]);
    }
    console.log(`✅ ${budgets.length} presupuestos migrados`);

    // 9. Migrar horarios de áreas
    console.log('⏰ Migrando horarios de áreas...');
    const schedules = await sqliteAll('SELECT * FROM area_schedules').catch(() => []);
    for (const schedule of schedules) {
      // Saltar horarios con datos incompletos
      if (schedule.hour === null || schedule.hour === undefined ||
          schedule.minute === null || schedule.minute === undefined) {
        console.log(`⚠️ Saltando horario incompleto para ${schedule.area}`);
        continue;
      }

      await pool.query(`
        INSERT INTO area_schedules (id, area, day_of_week, hour, minute, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [schedule.id, schedule.area, schedule.day_of_week, schedule.hour, schedule.minute,
          schedule.is_active, schedule.created_at]);
    }
    console.log(`✅ ${schedules.length} horarios procesados`);

    // 10. Migrar no requerimientos
    console.log('🚫 Migrando no requerimientos...');
    const noReqs = await sqliteAll('SELECT * FROM no_requirements').catch(() => []);
    for (const noReq of noReqs) {
      // Saltar no requerimientos con datos incompletos
      if (!noReq.start_date || !noReq.end_date || !noReq.area) {
        console.log(`⚠️ Saltando no requerimiento incompleto para ${noReq.area || 'área desconocida'}`);
        continue;
      }

      await pool.query(`
        INSERT INTO no_requirements (id, area, start_date, end_date, reason, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [noReq.id, noReq.area, noReq.start_date, noReq.end_date, noReq.reason,
          noReq.created_by, noReq.created_at]);
    }
    console.log(`✅ ${noReqs.length} no requerimientos procesados`);

    // 11. Migrar notificaciones
    console.log('🔔 Migrando notificaciones...');
    const notifications = await sqliteAll('SELECT * FROM notifications');
    for (const notif of notifications) {
      await pool.query(`
        INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [notif.id, notif.user_id, notif.type, notif.title, notif.message, notif.link,
          notif.is_read, notif.created_at]);
    }
    console.log(`✅ ${notifications.length} notificaciones migradas`);

    // Actualizar secuencias (importante para PostgreSQL)
    console.log('\n🔄 Actualizando secuencias...');
    await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
    await pool.query("SELECT setval('suppliers_id_seq', (SELECT MAX(id) FROM suppliers))");
    await pool.query("SELECT setval('requests_id_seq', (SELECT MAX(id) FROM requests))");
    await pool.query("SELECT setval('request_items_id_seq', (SELECT MAX(id) FROM request_items))");
    await pool.query("SELECT setval('quotations_id_seq', (SELECT MAX(id) FROM quotations))");
    await pool.query("SELECT setval('quotation_items_id_seq', (SELECT MAX(id) FROM quotation_items))");
    await pool.query("SELECT setval('purchase_orders_id_seq', (SELECT MAX(id) FROM purchase_orders))");
    console.log('✅ Secuencias actualizadas');

    console.log('\n✨ ¡Migración completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await pool.end();
  }
}

// Ejecutar
migrateData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
