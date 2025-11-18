const sqlite3 = require('./backend/node_modules/sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Verificando fechas en la base de datos...\n');

db.all(`
  SELECT folio, request_date, delivery_date, scheduled_for, created_at, status
  FROM requests
  WHERE folio = 'REQ-2025-012'
`, [], (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
  } else {
    console.log('📊 Datos en BD:');
    rows.forEach(row => {
      console.log('\n  Folio:', row.folio);
      console.log('  Status:', row.status);
      console.log('  Request Date (BD):', row.request_date);
      console.log('  Delivery Date (BD):', row.delivery_date);
      console.log('  Scheduled For (BD):', row.scheduled_for);
      console.log('  Created At (BD):', row.created_at);
    });
  }

  db.close();
});
