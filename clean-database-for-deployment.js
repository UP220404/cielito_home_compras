const sqlite3 = require('./backend/node_modules/sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🧹 Limpiando base de datos para deployment...\n');

// Función para contar registros
function countRecords(table, callback) {
  db.get(`SELECT COUNT(*) as count FROM ${table}`, [], (err, row) => {
    if (err) {
      console.error(`❌ Error contando ${table}:`, err);
      callback(0);
    } else {
      callback(row.count);
    }
  });
}

// Función para eliminar registros
function deleteRecords(table, callback) {
  db.run(`DELETE FROM ${table}`, [], function(err) {
    if (err) {
      console.error(`❌ Error eliminando de ${table}:`, err);
      callback(false);
    } else {
      console.log(`✅ ${table}: ${this.changes} registros eliminados`);
      callback(true);
    }
  });
}

// Proceso de limpieza
db.serialize(() => {
  console.log('📊 Contando registros antes de limpiar...\n');

  // Contar antes de limpiar
  countRecords('requests', (count) => {
    console.log(`   Solicitudes: ${count}`);
  });
  countRecords('request_items', (count) => {
    console.log(`   Items de solicitudes: ${count}`);
  });
  countRecords('quotations', (count) => {
    console.log(`   Cotizaciones: ${count}`);
  });
  countRecords('quotation_items', (count) => {
    console.log(`   Items de cotizaciones: ${count}`);
  });
  countRecords('purchase_orders', (count) => {
    console.log(`   Órdenes de compra: ${count}`);
  });
  countRecords('notifications', (count) => {
    console.log(`   Notificaciones: ${count}`);
  });
  countRecords('audit_log', (count) => {
    console.log(`   Logs de auditoría: ${count}\n`);
  });

  setTimeout(() => {
    console.log('🗑️  Eliminando datos de prueba...\n');

    // Eliminar en orden correcto (respetando foreign keys)
    deleteRecords('purchase_orders', (success) => {
      if (success) {
        deleteRecords('quotation_items', (success) => {
          if (success) {
            deleteRecords('quotations', (success) => {
              if (success) {
                deleteRecords('request_items', (success) => {
                  if (success) {
                    deleteRecords('requests', (success) => {
                      if (success) {
                        deleteRecords('notifications', (success) => {
                          if (success) {
                            deleteRecords('audit_log', (success) => {
                              console.log('\n✨ Limpieza completada!\n');

                              console.log('📋 DATOS CONSERVADOS:');
                              countRecords('users', (count) => {
                                console.log(`   ✓ Usuarios: ${count}`);
                              });
                              countRecords('suppliers', (count) => {
                                console.log(`   ✓ Proveedores: ${count}`);
                              });
                              countRecords('budgets', (count) => {
                                console.log(`   ✓ Presupuestos: ${count}`);
                              });
                              countRecords('area_schedules', (count) => {
                                console.log(`   ✓ Horarios de áreas: ${count}`);
                              });
                              countRecords('no_requirements', (count) => {
                                console.log(`   ✓ No requerimientos: ${count}\n`);
                              });

                              setTimeout(() => {
                                console.log('🎯 Base de datos lista para deployment!\n');
                                console.log('✅ Se eliminaron: solicitudes, cotizaciones, órdenes de compra, notificaciones y logs');
                                console.log('✅ Se conservaron: usuarios, proveedores, presupuestos y horarios\n');
                                db.close();
                              }, 500);
                            });
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }, 500);
});
