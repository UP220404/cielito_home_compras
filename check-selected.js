const db = require('./backend/config/database');

async function check() {
  try {
    // Ver las últimas solicitudes autorizadas
    const requests = await db.allAsync(`
      SELECT id, folio, status
      FROM requests
      WHERE status IN ('autorizada', 'emitida')
      ORDER BY id DESC
      LIMIT 5
    `);
    console.log('Solicitudes autorizadas/emitidas:', requests);

    if (requests.length > 0) {
      const reqId = requests[0].id;

      // Ver items de la solicitud
      const items = await db.allAsync(`
        SELECT id, material, quantity
        FROM request_items
        WHERE request_id = $1
      `, [reqId]);
      console.log('\nItems de solicitud', reqId, ':', items);

      // Ver items de cotización y su estado is_selected
      const qItems = await db.allAsync(`
        SELECT
          qi.id, qi.request_item_id, qi.is_selected, qi.unit_price,
          ri.material,
          s.name as supplier
        FROM quotation_items qi
        JOIN quotations q ON qi.quotation_id = q.id
        JOIN request_items ri ON qi.request_item_id = ri.id
        JOIN suppliers s ON q.supplier_id = s.id
        WHERE q.request_id = $1
        ORDER BY ri.id, qi.unit_price
      `, [reqId]);
      console.log('\nItems de cotización:', qItems);

      // Contar seleccionados
      const selected = qItems.filter(i => i.is_selected === true || i.is_selected === 1);
      console.log('\nItems seleccionados:', selected.length);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
