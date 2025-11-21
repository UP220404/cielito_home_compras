const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, param, query } = require('express-validator');

const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../utils/validators');
const { apiResponse, getClientIP } = require('../utils/helpers');
const logger = require('../utils/logger');

// Configurar directorio para almacenar facturas
const INVOICES_DIR = path.join(__dirname, '../invoices');
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, INVOICES_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Solo aceptar PDFs e imágenes
  const allowedTypes = /pdf|jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF, JPG, JPEG o PNG'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: fileFilter
});

// GET /api/invoices - Listar todas las facturas
router.get('/',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { month, year, order_id } = req.query;

      // Verificar si la columna supplier_id existe
      let hasSupplierColumn = false;
      try {
        const columnCheck = await db.getAsync(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'supplier_id'
        `);
        hasSupplierColumn = !!columnCheck;
      } catch (e) {
        hasSupplierColumn = false;
      }

      let query;
      if (hasSupplierColumn) {
        query = `
          SELECT
            i.*,
            po.folio as order_number,
            r.area,
            COALESCE(inv_s.name, s.name) as supplier_name,
            u.name as created_by_name
          FROM invoices i
          LEFT JOIN purchase_orders po ON i.order_id = po.id
          LEFT JOIN requests r ON po.request_id = r.id
          LEFT JOIN suppliers s ON po.supplier_id = s.id
          LEFT JOIN suppliers inv_s ON i.supplier_id = inv_s.id
          LEFT JOIN users u ON i.created_by = u.id
          WHERE 1=1
        `;
      } else {
        query = `
          SELECT
            i.*,
            po.folio as order_number,
            r.area,
            s.name as supplier_name,
            u.name as created_by_name
          FROM invoices i
          LEFT JOIN purchase_orders po ON i.order_id = po.id
          LEFT JOIN requests r ON po.request_id = r.id
          LEFT JOIN suppliers s ON po.supplier_id = s.id
          LEFT JOIN users u ON i.created_by = u.id
          WHERE 1=1
        `;
      }
      const params = [];

      if (month && year) {
        query += ` AND EXTRACT(MONTH FROM i.invoice_date)::TEXT = ? AND EXTRACT(YEAR FROM i.invoice_date)::TEXT = ?`;
        params.push(month.toString().padStart(2, '0'), year.toString());
      }

      if (order_id) {
        query += ` AND i.order_id = ?`;
        params.push(order_id);
      }

      query += ` ORDER BY i.invoice_date DESC, i.created_at DESC`;

      const invoices = await db.allAsync(query, params);

      // Para cada factura, obtener todos los proveedores únicos de la orden
      for (let invoice of invoices) {
        if (invoice.order_id) {
          // Obtener request_id de la orden
          const orderInfo = await db.getAsync(
            'SELECT request_id FROM purchase_orders WHERE id = ?',
            [invoice.order_id]
          );

          if (orderInfo) {
            // Obtener proveedores únicos de los items seleccionados
            const suppliers = await db.allAsync(`
              SELECT DISTINCT s.name
              FROM quotation_items qi
              JOIN quotations q ON qi.quotation_id = q.id
              JOIN suppliers s ON q.supplier_id = s.id
              WHERE q.request_id = $1 AND qi.is_selected = TRUE
              ORDER BY s.name
            `, [orderInfo.request_id]);

            invoice.all_suppliers = suppliers.map(s => s.name).join(', ');
            invoice.suppliers_count = suppliers.length;
          }
        }
      }

      res.json(apiResponse(true, invoices));

    } catch (error) {
      logger.error('Error en GET /invoices: %o', error);
      next(error);
    }
  }
);

// GET /api/invoices/report/monthly - Reporte mensual de facturación
router.get('/report/monthly',
  authMiddleware,
  async (req, res, next) => {
    try {
      const { year } = req.query;
      const currentYear = year || new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Obtener gastos del mes actual (usando created_at)
      const expenses = await db.getAsync(`
        SELECT
          COALESCE(SUM(po.total_amount), 0) as total_expenses
        FROM purchase_orders po
        WHERE EXTRACT(YEAR FROM po.created_at)::TEXT = ?
          AND EXTRACT(MONTH FROM po.created_at)::TEXT = ?
          AND po.status IN ('emitida', 'en_transito', 'recibida')
      `, [currentYear.toString(), currentMonth.toString().padStart(2, '0')]);

      // Obtener facturas del mes actual
      const invoices = await db.getAsync(`
        SELECT
          COALESCE(SUM(i.total_amount), 0) as total_invoiced,
          COALESCE(SUM(i.tax_amount), 0) as total_tax
        FROM invoices i
        WHERE EXTRACT(YEAR FROM i.invoice_date)::TEXT = ?
          AND EXTRACT(MONTH FROM i.invoice_date)::TEXT = ?
      `, [currentYear.toString(), currentMonth.toString().padStart(2, '0')]);

      // Calcular lo que se necesita facturar (asumiendo IVA del 16%)
      const totalExpenses = parseFloat(expenses.total_expenses) || 0;
      const totalInvoiced = parseFloat(invoices.total_invoiced) || 0;
      const totalTax = parseFloat(invoices.total_tax) || 0;

      // LÓGICA CORRECTA:
      // Si gastamos $116 (con IVA incluido), pagamos $16 de IVA
      // Para recuperar esos $16 de IVA, necesitamos COBRAR $16 de IVA
      // Eso significa facturar al menos $116 (subtotal $100 + IVA $16)
      // El IVA de las compras es: totalExpenses / 1.16 * 0.16
      const expensesSubtotal = totalExpenses / 1.16;
      const expensesIVA = expensesSubtotal * 0.16;

      // Balance: IVA cobrado - IVA pagado
      const taxBalance = totalTax - expensesIVA;
      const isHealthy = taxBalance >= 0;

      // Cuánto necesitas facturar aún para cubrir el IVA
      const stillNeedToInvoice = Math.max(0, totalExpenses - totalInvoiced);

      const percentageOfRequired = totalExpenses > 0
        ? ((totalInvoiced / totalExpenses) * 100).toFixed(2)
        : 0;

      // Obtener desglose por mes del año
      const monthlyData = await db.allAsync(`
        SELECT
          EXTRACT(MONTH FROM i.invoice_date)::TEXT as month,
          COALESCE(SUM(i.total_amount), 0) as invoiced,
          COALESCE(SUM(i.tax_amount), 0) as tax_collected,
          COUNT(*) as invoice_count
        FROM invoices i
        WHERE EXTRACT(YEAR FROM i.invoice_date)::TEXT = ?
        GROUP BY EXTRACT(MONTH FROM i.invoice_date)::TEXT
        ORDER BY month
      `, [currentYear.toString()]);

      const response = {
        year: parseInt(currentYear),
        month: currentMonth,
        current_month: {
          total_expenses: totalExpenses,
          total_invoiced: totalInvoiced,
          total_tax_collected: totalTax,
          expenses_iva_paid: expensesIVA,
          tax_balance: taxBalance,
          still_need_to_invoice: stillNeedToInvoice,
          is_healthy: isHealthy,
          percentage_of_required: parseFloat(percentageOfRequired),
          message: isHealthy
            ? `¡Excelente! Has cobrado $${Math.abs(taxBalance).toFixed(2)} más de IVA de lo que pagaste`
            : `Necesitas cobrar $${Math.abs(taxBalance).toFixed(2)} más de IVA para recuperar lo que pagaste`
        },
        monthly_breakdown: monthlyData
      };

      res.json(apiResponse(true, response));

    } catch (error) {
      logger.error('Error en GET /invoices/report/monthly: %o', error);
      next(error);
    }
  }
);

// GET /api/invoices/order/:orderId - Obtener facturas de una orden específica
router.get('/order/:orderId',
  authMiddleware,
  param('orderId').isInt().withMessage('ID de orden inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { orderId } = req.params;

      const invoices = await db.allAsync(`
        SELECT
          i.*,
          u.name as created_by_name
        FROM invoices i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.order_id = ?
        ORDER BY i.invoice_date DESC
      `, [orderId]);

      res.json(apiResponse(true, invoices));

    } catch (error) {
      logger.error('Error en GET /invoices/order/:orderId: %o', error);
      next(error);
    }
  }
);

// GET /api/invoices/:id - Obtener una factura específica
router.get('/:id',
  authMiddleware,
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const invoiceId = req.params.id;

      const invoice = await db.getAsync(`
        SELECT
          i.*,
          po.folio as order_number,
          r.area,
          po.total_amount as order_total,
          s.name as supplier_name,
          u.name as created_by_name
        FROM invoices i
        LEFT JOIN purchase_orders po ON i.order_id = po.id
        LEFT JOIN requests r ON po.request_id = r.id
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.id = ?
      `, [invoiceId]);

      if (!invoice) {
        return res.status(404).json(apiResponse(false, null, null, 'Factura no encontrada'));
      }

      // Obtener todos los proveedores de la orden
      if (invoice.order_id) {
        const orderInfo = await db.getAsync(
          'SELECT request_id FROM purchase_orders WHERE id = ?',
          [invoice.order_id]
        );

        if (orderInfo) {
          const suppliers = await db.allAsync(`
            SELECT DISTINCT s.name
            FROM quotation_items qi
            JOIN quotations q ON qi.quotation_id = q.id
            JOIN suppliers s ON q.supplier_id = s.id
            WHERE q.request_id = $1 AND qi.is_selected = TRUE
            ORDER BY s.name
          `, [orderInfo.request_id]);

          invoice.all_suppliers = suppliers.map(s => s.name).join(', ');
          invoice.suppliers_count = suppliers.length;
        }
      }

      res.json(apiResponse(true, invoice));

    } catch (error) {
      logger.error('Error en GET /invoices/:id: %o', error);
      next(error);
    }
  }
);

// POST /api/invoices - Crear una factura
router.post('/',
  authMiddleware,
  requireRole('purchaser', 'admin'),
  upload.single('file'),
  [
    body('order_id').isInt().withMessage('ID de orden inválido'),
    body('invoice_number').optional().trim(),
    body('invoice_date').isISO8601().withMessage('Fecha inválida'),
    body('subtotal').isFloat({ min: 0 }).withMessage('Subtotal inválido'),
    body('tax_amount').isFloat({ min: 0 }).withMessage('Monto de IVA inválido'),
    body('total_amount').isFloat({ min: 0 }).withMessage('Total inválido'),
    body('notes').optional().trim(),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const { order_id, supplier_id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, notes } = req.body;
      const filePath = req.file ? req.file.filename : null;

      // Verificar que la orden existe
      const order = await db.getAsync('SELECT id, request_id, requires_invoice FROM purchase_orders WHERE id = ?', [order_id]);
      if (!order) {
        // Si se subió un archivo, eliminarlo
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json(apiResponse(false, null, null, 'Orden de compra no encontrada'));
      }

      // Verificar si la columna supplier_id existe
      let hasSupplierColumn = false;
      try {
        const columnCheck = await db.getAsync(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'supplier_id'
        `);
        hasSupplierColumn = !!columnCheck;
      } catch (e) {
        hasSupplierColumn = false;
      }

      // Si se especifica un proveedor y la columna existe, verificar que no exista ya una factura
      if (supplier_id && hasSupplierColumn) {
        const existingInvoice = await db.getAsync(
          'SELECT id FROM invoices WHERE order_id = ? AND supplier_id = ?',
          [order_id, supplier_id]
        );
        if (existingInvoice) {
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json(apiResponse(false, null, null, 'Ya existe una factura para este proveedor en esta orden'));
        }
      }

      // Crear la factura
      let result;
      if (hasSupplierColumn) {
        result = await db.runAsync(`
          INSERT INTO invoices (order_id, supplier_id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, file_path, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [order_id, supplier_id || null, invoice_number, invoice_date, subtotal, tax_amount, total_amount, filePath, notes, req.user.id]);
      } else {
        result = await db.runAsync(`
          INSERT INTO invoices (order_id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, file_path, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [order_id, invoice_number, invoice_date, subtotal, tax_amount, total_amount, filePath, notes, req.user.id]);
      }

      await db.auditLog('invoices', result.id, 'create', null,
        { order_id, invoice_number, invoice_date, subtotal, tax_amount, total_amount },
        req.user.id,
        getClientIP(req)
      );

      res.status(201).json(apiResponse(true, { id: result.id }, 'Factura creada exitosamente'));

    } catch (error) {
      // Si hay error y se subió un archivo, eliminarlo
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error eliminando archivo: %o', unlinkError);
        }
      }
      logger.error('Error en POST /invoices: %o', error);
      next(error);
    }
  }
);

// PUT /api/invoices/:id - Actualizar una factura
router.put('/:id',
  authMiddleware,
  requireRole('purchaser', 'admin'),
  upload.single('file'),
  [
    param('id').isInt().withMessage('ID inválido'),
    body('invoice_number').optional().trim(),
    body('invoice_date').optional().isISO8601().withMessage('Fecha inválida'),
    body('subtotal').optional().isFloat({ min: 0 }).withMessage('Subtotal inválido'),
    body('tax_amount').optional().isFloat({ min: 0 }).withMessage('Monto de IVA inválido'),
    body('total_amount').optional().isFloat({ min: 0 }).withMessage('Total inválido'),
    body('notes').optional().trim(),
    handleValidationErrors
  ],
  async (req, res, next) => {
    try {
      const invoiceId = req.params.id;
      const { invoice_number, invoice_date, subtotal, tax_amount, total_amount, notes } = req.body;

      const invoice = await db.getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
      if (!invoice) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json(apiResponse(false, null, null, 'Factura no encontrada'));
      }

      // Preparar datos para actualizar
      const updates = [];
      const params = [];

      if (invoice_number !== undefined) {
        updates.push('invoice_number = ?');
        params.push(invoice_number);
      }
      if (invoice_date !== undefined) {
        updates.push('invoice_date = ?');
        params.push(invoice_date);
      }
      if (subtotal !== undefined) {
        updates.push('subtotal = ?');
        params.push(subtotal);
      }
      if (tax_amount !== undefined) {
        updates.push('tax_amount = ?');
        params.push(tax_amount);
      }
      if (total_amount !== undefined) {
        updates.push('total_amount = ?');
        params.push(total_amount);
      }
      if (notes !== undefined) {
        updates.push('notes = ?');
        params.push(notes);
      }

      // Si se subió un nuevo archivo
      if (req.file) {
        updates.push('file_path = ?');
        params.push(req.file.filename);

        // Eliminar el archivo anterior si existe
        if (invoice.file_path) {
          const oldFilePath = path.join(INVOICES_DIR, invoice.file_path);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(invoiceId);

      if (updates.length > 1) { // > 1 porque updated_at siempre se agrega
        await db.runAsync(`
          UPDATE invoices
          SET ${updates.join(', ')}
          WHERE id = ?
        `, params);

        await db.auditLog('invoices', invoiceId, 'update', invoice, req.body, req.user.id, getClientIP(req));
      }

      res.json(apiResponse(true, null, 'Factura actualizada exitosamente'));

    } catch (error) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error eliminando archivo: %o', unlinkError);
        }
      }
      logger.error('Error en PUT /invoices/:id: %o', error);
      next(error);
    }
  }
);

// DELETE /api/invoices/:id - Eliminar una factura
router.delete('/:id',
  authMiddleware,
  requireRole('purchaser', 'admin'),
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const invoiceId = req.params.id;

      const invoice = await db.getAsync('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
      if (!invoice) {
        return res.status(404).json(apiResponse(false, null, null, 'Factura no encontrada'));
      }

      // Eliminar el archivo si existe
      if (invoice.file_path) {
        const filePath = path.join(INVOICES_DIR, invoice.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await db.runAsync('DELETE FROM invoices WHERE id = ?', [invoiceId]);

      await db.auditLog('invoices', invoiceId, 'delete', invoice, null, req.user.id, getClientIP(req));

      res.json(apiResponse(true, null, 'Factura eliminada exitosamente'));

    } catch (error) {
      logger.error('Error en DELETE /invoices/:id: %o', error);
      next(error);
    }
  }
);

// GET /api/invoices/order/:orderId/suppliers - Obtener proveedores de una orden con estado de facturación
router.get('/order/:orderId/suppliers',
  authMiddleware,
  param('orderId').isInt().withMessage('ID de orden inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const orderId = req.params.orderId;

      // Obtener la orden y su request_id
      const order = await db.getAsync('SELECT request_id FROM purchase_orders WHERE id = ?', [orderId]);
      if (!order) {
        return res.status(404).json(apiResponse(false, null, null, 'Orden no encontrada'));
      }

      // Obtener proveedores únicos de los items seleccionados con su monto
      const suppliers = await db.allAsync(`
        SELECT
          s.id,
          s.name,
          COALESCE(SUM(qi.unit_price * ri.quantity), 0) as total_amount,
          (SELECT id FROM invoices WHERE order_id = $1 AND supplier_id = s.id LIMIT 1) as invoice_id
        FROM quotation_items qi
        JOIN quotations q ON qi.quotation_id = q.id
        JOIN suppliers s ON q.supplier_id = s.id
        JOIN request_items ri ON qi.request_item_id = ri.id
        WHERE q.request_id = $2 AND qi.is_selected = TRUE
        GROUP BY s.id, s.name
        ORDER BY s.name
      `, [orderId, order.request_id]);

      // Marcar cuáles ya tienen factura
      const result = suppliers.map(s => ({
        ...s,
        total_amount: parseFloat(s.total_amount),
        has_invoice: s.invoice_id !== null
      }));

      res.json(apiResponse(true, result));

    } catch (error) {
      logger.error('Error en GET /invoices/order/:orderId/suppliers: %o', error);
      next(error);
    }
  }
);

// GET /api/invoices/:id/download - Descargar archivo de factura
router.get('/:id/download',
  authMiddleware,
  param('id').isInt().withMessage('ID inválido'),
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const invoiceId = req.params.id;

      const invoice = await db.getAsync('SELECT file_path FROM invoices WHERE id = ?', [invoiceId]);
      if (!invoice) {
        return res.status(404).json(apiResponse(false, null, null, 'Factura no encontrada'));
      }

      if (!invoice.file_path) {
        return res.status(404).json(apiResponse(false, null, null, 'Esta factura no tiene archivo adjunto'));
      }

      const filePath = path.join(INVOICES_DIR, invoice.file_path);
      if (!fs.existsSync(filePath)) {
        logger.error('Archivo no encontrado:', filePath);
        return res.status(404).json(apiResponse(false, null, null, 'Archivo no encontrado en el servidor'));
      }

      // Determinar el tipo de contenido basado en la extensión
      const ext = path.extname(invoice.file_path).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.pdf') {
        contentType = 'application/pdf';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (ext === '.png') {
        contentType = 'image/png';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${invoice.file_path}"`);
      res.sendFile(filePath);

    } catch (error) {
      logger.error('Error en GET /invoices/:id/download: %o', error);
      next(error);
    }
  }
);

module.exports = router;
