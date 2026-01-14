const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { formatCurrency } = require('../utils/helpers');

class PDFService {
  constructor() {
    this.pdfsDir = path.join(__dirname, '..', 'pdfs');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.pdfsDir)) {
      fs.mkdirSync(this.pdfsDir, { recursive: true });
    }
  }

  // Helper para formatear fechas localmente sin conversión UTC
  formatDateLocal(dateString, format = 'DD/MM/YYYY') {
    if (!dateString) return '';

    // Parsear la fecha como string sin conversión UTC
    const parts = dateString.toString().split(/[-T\s:]/);
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    if (format === 'DD/MM/YYYY') {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    } else if (format === 'long') {
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                         'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${day} de ${monthNames[month - 1]} de ${year}`;
    }

    return `${day}/${month}/${year}`;
  }

  // Generar PDF de orden de compra (devuelve buffer para streaming)
  async generatePurchaseOrderPDF(orderId) {
    try {
      // Obtener datos de la orden
      const order = await db.getAsync(`
        SELECT
          po.*,
          r.folio as request_folio,
          r.area,
          r.justification,
          r.request_date,
          r.delivery_date,
          r.priority,
          r.created_at,
          u.name as requester_name,
          u.email as requester_email,
          auth.name as authorized_by_name,
          s.name as supplier_name,
          s.rfc as supplier_rfc,
          s.contact_name as contact_person,
          s.phone as supplier_phone,
          s.email as supplier_email,
          s.address as supplier_address,
          creator.name as created_by_name
        FROM purchase_orders po
        JOIN requests r ON po.request_id = r.id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN users auth ON r.authorized_by = auth.id
        JOIN suppliers s ON po.supplier_id = s.id
        JOIN quotations q ON po.quotation_id = q.id
        JOIN users creator ON po.created_by = creator.id
        WHERE po.id = ?
      `, [orderId]);

      if (!order) {
        throw new Error('Orden de compra no encontrada');
      }

      // Obtener items seleccionados de la solicitud (pueden ser de diferentes cotizaciones)
      const items = await db.allAsync(`
        SELECT
          qi.*,
          ri.material,
          ri.specifications,
          ri.unit,
          ri.quantity,
          ri.in_stock,
          ri.location,
          s.name as item_supplier_name
        FROM quotation_items qi
        JOIN request_items ri ON qi.request_item_id = ri.id
        JOIN quotations q ON qi.quotation_id = q.id
        JOIN suppliers s ON q.supplier_id = s.id
        WHERE q.request_id = ? AND qi.is_selected = TRUE
        ORDER BY qi.id ASC
      `, [order.request_id]);

      // Crear PDF en memoria (sin guardar en filesystem)
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];

        // Capturar el PDF en buffers
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log('✅ PDF generado en memoria para orden:', orderId);
          resolve(pdfBuffer);
        });
        doc.on('error', (err) => {
          console.error('❌ Error generando PDF:', err);
          reject(err);
        });

        // Header con logo
        this.addHeader(doc, order);

        // Información de la orden
        const infoY = this.addOrderInfo(doc, order);

        // Tabla de items
        const tableY = this.addItemsTable(doc, items, infoY);

        // Firmas
        this.addSignatures(doc, order, tableY);

        doc.end();
      });

    } catch (error) {
      console.error('Error generando PDF:', error);
      throw error;
    }
  }

  addHeader(doc, order) {
    const pageWidth = doc.page.width;

    // Logo de Cielito Home en la esquina superior derecha
    const logoX = pageWidth - 140;

    // Intentar agregar logo real si existe
    const logoPath = path.join(__dirname, '../../frontend/img/cielitohome.png');
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, logoX, 40, { width: 90 });
      } catch (err) {
        // Si falla, mostrar texto
        doc.fontSize(12)
           .fillColor('#216238')
           .font('Helvetica-Bold')
           .text('Cielito Home', logoX, 50, { width: 90, align: 'center' });
      }
    } else {
      doc.fontSize(12)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('Cielito Home', logoX, 50, { width: 90, align: 'center' });
    }

    // Texto "COMPRAS" en rojo debajo del logo
    doc.fontSize(9)
       .fillColor('#d32f2f')
       .font('Helvetica-Bold')
       .text('COMPRAS', logoX, 90, { width: 90, align: 'center' });

    // Título principal centrado - SOLICITUD DE COMPRAS
    doc.fontSize(18)
       .fillColor('#000')
       .font('Helvetica-Bold')
       .text('SOLICITUD DE COMPRAS', 50, 60, { align: 'center', width: pageWidth - 100 });

    // Área/Departamento como subtítulo
    doc.fontSize(14)
       .fillColor('#000')
       .font('Helvetica')
       .text(order.area || 'General', 50, 85, { align: 'center', width: pageWidth - 100 });

    return 120; // Posición Y después del header
  }

  addOrderInfo(doc, order) {
    let currentY = 130;

    doc.fontSize(11).fillColor('#000').font('Helvetica');

    // Fecha de solicitud con valor
    doc.text('Fecha de solicitud: ', 50, currentY, { continued: true });
    const requestDate = order.request_date || order.created_at;
    doc.font('Helvetica-Bold').text(this.formatDateLocal(requestDate));
    currentY += 18;

    // Expectativa de fecha de entrega con valor
    doc.font('Helvetica').text('Expectativa de fecha de entrega: ', 50, currentY, { continued: true });
    doc.font('Helvetica-Bold').text(this.formatDateLocal(order.delivery_date));
    currentY += 18;

    // Urgencia con espacios para marcar (mapeada desde priority)
    doc.font('Helvetica');
    // Mapear priority a urgency para compatibilidad del PDF
    // critica -> alta, urgente -> media, normal -> baja
    const priority = order.priority || 'normal';
    const urgency = priority === 'critica' ? 'alta' : priority === 'urgente' ? 'media' : 'baja';
    let urgencyText = 'Urgencia:    ';
    urgencyText += urgency === 'alta' ? '[X] Alta    ' : '[ ] Alta    ';
    urgencyText += urgency === 'media' ? '[X] Media    ' : '[ ] Media    ';
    urgencyText += urgency === 'baja' ? '[X] Baja' : '[ ] Baja';
    doc.text(urgencyText, 50, currentY);
    currentY += 25;

    // Nombre de jefe de área que lo solicita con valor
    doc.text('Nombre de jefe de área que lo solicita: ', 50, currentY, { continued: true });
    doc.font('Helvetica-Bold').text(order.requester_name || 'N/A');
    currentY += 25;

    // Justificación de material solicitado
    doc.font('Helvetica').text('Justificación de material solicitado:', 50, currentY);
    currentY += 15;
    const justification = order.justification || 'Sin justificación';
    doc.fontSize(10).font('Helvetica').text(justification, 50, currentY, { width: 500, align: 'justify' });
    currentY += 50;

    return currentY;
  }


  addItemsTable(doc, items, startY) {
    const tableTop = startY + 10;

    // Definir columnas según el formato de referencia
    const col1X = 50;   // Material solicitado
    const col1W = 90;
    const col2X = col1X + col1W;  // Costo aproximado
    const col2W = 70;
    const col3X = col2X + col2W;  // Especificaciones del producto
    const col3W = 170;
    const col4X = col3X + col3W;  // Material en stock
    const col4W = 60;
    const col5X = col4X + col4W;  // Ubicación para la que se solicita
    const col5W = 105;

    // Header de la tabla
    doc.fontSize(8)
       .fillColor('#000')
       .font('Helvetica-Bold');

    const headerHeight = 30;

    // Dibujar celdas del header
    doc.rect(col1X, tableTop, col1W, headerHeight).stroke();
    doc.rect(col2X, tableTop, col2W, headerHeight).stroke();
    doc.rect(col3X, tableTop, col3W, headerHeight).stroke();
    doc.rect(col4X, tableTop, col4W, headerHeight).stroke();
    doc.rect(col5X, tableTop, col5W, headerHeight).stroke();

    // Texto del header (multilinea)
    doc.text('Material\nsolicitado', col1X + 3, tableTop + 7, { width: col1W - 6, align: 'center' });
    doc.text('Costo\naproximado', col2X + 3, tableTop + 7, { width: col2W - 6, align: 'center' });
    doc.text('Especificaciones del\nproducto', col3X + 3, tableTop + 7, { width: col3W - 6, align: 'center' });
    doc.text('Material en\nstock', col4X + 3, tableTop + 7, { width: col4W - 6, align: 'center' });
    doc.text('Ubicación para\nla que se\nsolicita', col5X + 3, tableTop + 4, { width: col5W - 6, align: 'center' });

    // Filas de datos
    doc.font('Helvetica').fontSize(8);
    let currentY = tableTop + headerHeight;

    // Mostrar items reales (mínimo 5 filas)
    const rowsToShow = Math.max(items.length, 5);
    const rowHeight = 45;

    for (let i = 0; i < rowsToShow; i++) {
      const item = items[i] || {};

      // Dibujar celdas de la fila
      doc.rect(col1X, currentY, col1W, rowHeight).stroke();
      doc.rect(col2X, currentY, col2W, rowHeight).stroke();
      doc.rect(col3X, currentY, col3W, rowHeight).stroke();
      doc.rect(col4X, currentY, col4W, rowHeight).stroke();
      doc.rect(col5X, currentY, col5W, rowHeight).stroke();

      // Contenido de la fila (si hay datos)
      if (item.material) {
        doc.fontSize(8);
        doc.text(item.material || '', col1X + 3, currentY + 8, { width: col1W - 6, height: rowHeight - 16, lineBreak: true });
        doc.text(formatCurrency(item.unit_price || 0), col2X + 3, currentY + 18, { width: col2W - 6, align: 'center' });
        doc.text(item.specifications || '', col3X + 3, currentY + 8, { width: col3W - 6, height: rowHeight - 16, lineBreak: true });
        doc.text(item.in_stock ? 'Sí' : 'No', col4X + 3, currentY + 18, { width: col4W - 6, align: 'center' });
        doc.text(item.location || '', col5X + 3, currentY + 18, { width: col5W - 6, align: 'center' });
      }

      currentY += rowHeight;

      // Agregar página si nos quedamos sin espacio
      if (currentY > 680 && i < rowsToShow - 1) {
        doc.addPage();
        currentY = 50;
      }
    }

    return currentY + 20;
  }

  addSignatures(doc, order, startY) {
    const pageWidth = doc.page.width;
    const signatureY = startY + 50;

    doc.fontSize(11).fillColor('#000').font('Helvetica');

    // Firma de solicitante (izquierda)
    const leftX = 80;
    const sigWidth = 200;

    doc.text('Firma de solicitante', leftX, signatureY, { width: sigWidth, align: 'center' });

    // Nombre del solicitante como "firma digital" (ARRIBA de la línea)
    doc.fontSize(12).font('Helvetica-Oblique').fillColor('#000');
    doc.text(order.requester_name || 'N/A', leftX, signatureY + 30, { width: sigWidth, align: 'center' });

    // Línea de firma
    const lineY = signatureY + 50;
    doc.moveTo(leftX, lineY)
       .lineTo(leftX + sigWidth, lineY)
       .stroke();

    // Puesto del solicitante (DEBAJO de la línea)
    doc.fontSize(9).font('Helvetica').fillColor('#666');
    doc.text(`Jefe de ${order.area || 'Área'}`, leftX, lineY + 5, { width: sigWidth, align: 'center' });

    // Firma de Dirección General (derecha)
    const rightX = pageWidth - 280;

    doc.fontSize(11).font('Helvetica').fillColor('#000');
    doc.text('Firma de Dirección General', rightX, signatureY, { width: sigWidth, align: 'center' });

    // Nombre de quien autorizó como "firma digital" (ARRIBA de la línea)
    if (order.authorized_by_name) {
      doc.fontSize(12).font('Helvetica-Oblique').fillColor('#000');
      doc.text(order.authorized_by_name, rightX, signatureY + 30, { width: sigWidth, align: 'center' });
    }

    // Línea de firma
    doc.moveTo(rightX, lineY)
       .lineTo(rightX + sigWidth, lineY)
       .stroke();

    // Puesto de Dirección General (DEBAJO de la línea)
    if (order.authorized_by_name) {
      doc.fontSize(9).font('Helvetica').fillColor('#666');
      doc.text('Dirección General', rightX, lineY + 5, { width: sigWidth, align: 'center' });
    }

    return lineY + 30;
  }


  // Generar reporte de solicitudes en PDF
  async generateRequestsReport(filters = {}) {
    try {
      // Construir query con filtros
      let whereClause = 'WHERE 1=1';
      let params = [];

      if (filters.startDate) {
        whereClause += ' AND r.request_date >= ?';
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClause += ' AND r.request_date <= ?';
        params.push(filters.endDate);
      }
      if (filters.status) {
        whereClause += ' AND r.status = ?';
        params.push(filters.status);
      }
      if (filters.area) {
        whereClause += ' AND r.area = ?';
        params.push(filters.area);
      }

      const requests = await db.allAsync(`
        SELECT
          r.*,
          u.name as requester_name,
          auth.name as authorized_by_name,
          COUNT(ri.id) as items_count,
          COALESCE(SUM(ri.approximate_cost * ri.quantity), 0) as estimated_total
        FROM requests r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN users auth ON r.authorized_by = auth.id
        LEFT JOIN request_items ri ON r.id = ri.request_id
        ${whereClause}
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `, params);

      // Crear PDF
      const filename = `reporte_solicitudes_${Date.now()}.pdf`;
      const filepath = path.join(this.pdfsDir, filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      doc.pipe(fs.createWriteStream(filepath));

      const pageWidth = doc.page.width;

      // Logo y Header
      const logoPath = path.join(__dirname, '../../frontend/img/cielitohome.png');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 50, 40, { width: 80 });
        } catch (err) {
          console.warn('No se pudo cargar el logo:', err.message);
        }
      }

      doc.fontSize(20)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('CIELITO HOME', 140, 50, { align: 'left' });

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text('Sistema de Compras', 140, 75);

      // Título del reporte
      doc.fontSize(18)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('REPORTE DE SOLICITUDES DE COMPRA', 50, 130, { align: 'center', width: pageWidth - 100 });

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text(`Generado el: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
               50, 155, { align: 'center', width: pageWidth - 100 });

      // Línea divisoria
      doc.moveTo(50, 175)
         .lineTo(pageWidth - 50, 175)
         .strokeColor('#216238')
         .lineWidth(2)
         .stroke();

      // Resumen estadístico
      const summary = {
        total: requests.length,
        pendientes: requests.filter(r => r.status === 'pendiente').length,
        autorizadas: requests.filter(r => r.status === 'autorizada').length,
        completadas: requests.filter(r => r.status === 'entregada').length,
        total_estimado: requests.reduce((sum, r) => sum + (parseFloat(r.estimated_total) || 0), 0)
      };

      let currentY = 200;

      // Box de resumen
      doc.rect(50, currentY, pageWidth - 100, 100)
         .fillColor('#f8f9fa')
         .fill();

      doc.fontSize(12)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('RESUMEN GENERAL', 60, currentY + 10);

      currentY += 35;

      doc.fontSize(10)
         .font('Helvetica');

      const col1X = 70;
      const col2X = 250;
      const col3X = 430;

      doc.text(`Total: ${summary.total}`, col1X, currentY);
      doc.text(`Pendientes: ${summary.pendientes}`, col2X, currentY);
      doc.text(`Autorizadas: ${summary.autorizadas}`, col3X, currentY);

      currentY += 20;

      doc.text(`Completadas: ${summary.completadas}`, col1X, currentY);
      doc.text(`Total Estimado: ${formatCurrency(summary.total_estimado)}`, col2X, currentY);

      currentY += 50;

      // Detalle de solicitudes
      doc.fontSize(12)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('DETALLE DE SOLICITUDES', 50, currentY);

      currentY += 25;

      requests.forEach((request, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        // Box por solicitud
        const boxHeight = 70;

        doc.rect(50, currentY, pageWidth - 100, boxHeight)
           .fillColor(index % 2 === 0 ? '#ffffff' : '#f8f9fa')
           .fill();

        doc.rect(50, currentY, pageWidth - 100, boxHeight)
           .strokeColor('#dee2e6')
           .lineWidth(1)
           .stroke();

        const contentY = currentY + 10;

        // Folio y Solicitante
        doc.fontSize(11)
           .fillColor('#000')
           .font('Helvetica-Bold')
           .text(`${request.folio}`, 60, contentY)
           .font('Helvetica')
           .text(` - ${request.requester_name}`, 120, contentY);

        // Estado badge
        const statusColors = {
          'pendiente': '#ffc107',
          'autorizada': '#28a745',
          'cotizando': '#17a2b8',
          'comprada': '#6f42c1',
          'entregada': '#007bff',
          'rechazada': '#dc3545',
          'cancelada': '#6c757d'
        };

        const statusColor = statusColors[request.status] || '#6c757d';
        doc.rect(pageWidth - 140, contentY - 2, 80, 16)
           .fillColor(statusColor)
           .fill();

        doc.fontSize(9)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(request.status.toUpperCase(), pageWidth - 135, contentY, { width: 70, align: 'center' });

        // Información adicional
        doc.fontSize(9)
           .fillColor('#666')
           .font('Helvetica')
           .text(`Área: ${request.area}`, 60, contentY + 20);

        doc.text(`Fecha: ${this.formatDateLocal(request.request_date)}`, 60, contentY + 35);

        doc.text(`Items: ${request.items_count}`, 250, contentY + 20);

        doc.text(`Estimado: ${formatCurrency(request.estimated_total)}`, 250, contentY + 35);

        if (request.authorized_by_name) {
          doc.text(`Autorizado por: ${request.authorized_by_name}`, 400, contentY + 20);
        }

        currentY += boxHeight + 5;
      });

      // Footer en cada página
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor('#999')
           .font('Helvetica')
           .text(`Página ${i + 1} de ${range.count}`,
                 50, doc.page.height - 50,
                 { width: pageWidth - 100, align: 'center' });
        doc.text(`Reporte generado por Sistema de Compras Cielito Home - ${new Date().toLocaleDateString('es-MX')}`,
                 50, doc.page.height - 35,
                 { width: pageWidth - 100, align: 'center' });
      }

      doc.end();

      return `pdfs/${filename}`;

    } catch (error) {
      console.error('Error generando reporte PDF:', error);
      throw error;
    }
  }

  // Generar reporte de órdenes de compra en PDF
  async generateOrdersReport(filters = {}) {
    try {
      let whereClause = 'WHERE 1=1';
      let params = [];

      if (filters.startDate) {
        whereClause += ' AND po.order_date >= ?';
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClause += ' AND po.order_date <= ?';
        params.push(filters.endDate);
      }
      if (filters.status) {
        whereClause += ' AND po.status = ?';
        params.push(filters.status);
      }

      const orders = await db.allAsync(`
        SELECT
          po.*,
          r.folio as request_folio,
          r.area,
          u.name as requester_name,
          s.name as supplier_name,
          s.phone as supplier_phone
        FROM purchase_orders po
        JOIN requests r ON po.request_id = r.id
        JOIN users u ON r.user_id = u.id
        JOIN suppliers s ON po.supplier_id = s.id
        ${whereClause}
        ORDER BY po.created_at DESC
      `, params);

      const filename = `reporte_ordenes_${Date.now()}.pdf`;
      const filepath = path.join(this.pdfsDir, filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      doc.pipe(fs.createWriteStream(filepath));

      const pageWidth = doc.page.width;

      // Logo y Header
      const logoPath = path.join(__dirname, '../../frontend/img/cielitohome.png');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 50, 40, { width: 80 });
        } catch (err) {
          console.warn('No se pudo cargar el logo:', err.message);
        }
      }

      doc.fontSize(20)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('CIELITO HOME', 140, 50, { align: 'left' });

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text('Sistema de Compras', 140, 75);

      // Título del reporte
      doc.fontSize(18)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('REPORTE DE ÓRDENES DE COMPRA', 50, 130, { align: 'center', width: pageWidth - 100 });

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text(`Generado el: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
               50, 155, { align: 'center', width: pageWidth - 100 });

      // Línea divisoria
      doc.moveTo(50, 175)
         .lineTo(pageWidth - 50, 175)
         .strokeColor('#216238')
         .lineWidth(2)
         .stroke();

      // Resumen estadístico
      const totalAmount = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
      const summary = {
        total: orders.length,
        emitidas: orders.filter(o => o.status === 'emitida').length,
        en_transito: orders.filter(o => o.status === 'en_transito').length,
        recibidas: orders.filter(o => o.status === 'recibida').length,
        canceladas: orders.filter(o => o.status === 'cancelada').length
      };

      let currentY = 200;

      // Box de resumen
      doc.rect(50, currentY, pageWidth - 100, 110)
         .fillColor('#f8f9fa')
         .fill();

      doc.fontSize(12)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('RESUMEN GENERAL', 60, currentY + 10);

      currentY += 35;

      doc.fontSize(10)
         .font('Helvetica');

      const col1X = 70;
      const col2X = 250;
      const col3X = 430;

      doc.text(`Total: ${summary.total}`, col1X, currentY);
      doc.text(`Emitidas: ${summary.emitidas}`, col2X, currentY);
      doc.text(`En Tránsito: ${summary.en_transito}`, col3X, currentY);

      currentY += 20;

      doc.text(`Recibidas: ${summary.recibidas}`, col1X, currentY);
      doc.text(`Canceladas: ${summary.canceladas}`, col2X, currentY);

      currentY += 25;

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#216238')
         .text(`MONTO TOTAL: ${formatCurrency(totalAmount)}`, 70, currentY);

      currentY += 50;

      // Detalle de órdenes
      doc.fontSize(12)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('DETALLE DE ÓRDENES', 50, currentY);

      currentY += 25;

      orders.forEach((order, index) => {
        if (currentY > 680) {
          doc.addPage();
          currentY = 50;
        }

        // Box por orden
        const boxHeight = 85;

        doc.rect(50, currentY, pageWidth - 100, boxHeight)
           .fillColor(index % 2 === 0 ? '#ffffff' : '#f8f9fa')
           .fill();

        doc.rect(50, currentY, pageWidth - 100, boxHeight)
           .strokeColor('#dee2e6')
           .lineWidth(1)
           .stroke();

        const contentY = currentY + 10;

        // Folio y Proveedor
        doc.fontSize(11)
           .fillColor('#000')
           .font('Helvetica-Bold')
           .text(`${order.folio}`, 60, contentY)
           .font('Helvetica')
           .text(` - ${order.supplier_name}`, 130, contentY);

        // Estado badge
        const statusColors = {
          'emitida': '#ffc107',
          'en_transito': '#17a2b8',
          'recibida': '#28a745',
          'cancelada': '#dc3545'
        };

        const statusColor = statusColors[order.status] || '#6c757d';
        doc.rect(pageWidth - 140, contentY - 2, 80, 16)
           .fillColor(statusColor)
           .fill();

        doc.fontSize(9)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(order.status.toUpperCase().replace('_', ' '), pageWidth - 135, contentY, { width: 70, align: 'center' });

        // Información adicional
        doc.fontSize(9)
           .fillColor('#666')
           .font('Helvetica')
           .text(`Área: ${order.area}`, 60, contentY + 20);

        doc.text(`Solicitud: ${order.request_folio}`, 60, contentY + 35);

        doc.text(`Fecha Orden: ${this.formatDateLocal(order.order_date)}`, 60, contentY + 50);

        doc.fontSize(10)
           .fillColor('#216238')
           .font('Helvetica-Bold')
           .text(`${formatCurrency(order.total_amount)}`, 250, contentY + 25);

        doc.fontSize(9)
           .fillColor('#666')
           .font('Helvetica')
           .text(`Entrega Esperada: ${this.formatDateLocal(order.expected_delivery)}`, 350, contentY + 20);

        if (order.actual_delivery) {
          doc.text(`Entrega Real: ${this.formatDateLocal(order.actual_delivery)}`, 350, contentY + 35);
        }

        if (order.supplier_phone) {
          doc.text(`Tel: ${order.supplier_phone}`, 350, contentY + 50);
        }

        currentY += boxHeight + 5;
      });

      // Footer en cada página
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor('#999')
           .font('Helvetica')
           .text(`Página ${i + 1} de ${range.count}`,
                 50, doc.page.height - 50,
                 { width: pageWidth - 100, align: 'center' });
        doc.text(`Reporte generado por Sistema de Compras Cielito Home - ${new Date().toLocaleDateString('es-MX')}`,
                 50, doc.page.height - 35,
                 { width: pageWidth - 100, align: 'center' });
      }

      doc.end();

      return `pdfs/${filename}`;

    } catch (error) {
      console.error('Error generando reporte de órdenes:', error);
      throw error;
    }
  }

  // Generar reporte de proveedores en PDF
  async generateSuppliersReport() {
    try {
      const suppliers = await db.allAsync(`
        SELECT
          s.*,
          COUNT(q.id) as total_quotations,
          COUNT(po.id) as total_orders,
          COALESCE(SUM(po.total_amount), 0) as total_purchased
        FROM suppliers s
        LEFT JOIN quotations q ON s.id = q.supplier_id
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id
        GROUP BY s.id
        ORDER BY s.name ASC
      `);

      const filename = `reporte_proveedores_${Date.now()}.pdf`;
      const filepath = path.join(this.pdfsDir, filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      doc.pipe(fs.createWriteStream(filepath));

      const pageWidth = doc.page.width;

      // Logo y Header
      const logoPath = path.join(__dirname, '../../frontend/img/cielitohome.png');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 50, 40, { width: 80 });
        } catch (err) {
          console.warn('No se pudo cargar el logo:', err.message);
        }
      }

      doc.fontSize(20)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('CIELITO HOME', 140, 50, { align: 'left' });

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text('Sistema de Compras', 140, 75);

      // Título del reporte
      doc.fontSize(18)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('CATÁLOGO DE PROVEEDORES', 50, 130, { align: 'center', width: pageWidth - 100 });

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text(`Generado el: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
               50, 155, { align: 'center', width: pageWidth - 100 });

      // Línea divisoria
      doc.moveTo(50, 175)
         .lineTo(pageWidth - 50, 175)
         .strokeColor('#216238')
         .lineWidth(2)
         .stroke();

      // Resumen estadístico
      const totalPurchased = suppliers.reduce((sum, s) => sum + (parseFloat(s.total_purchased) || 0), 0);
      const avgRating = suppliers.reduce((sum, s) => sum + (parseFloat(s.rating) || 0), 0) / suppliers.length;

      let currentY = 200;

      // Box de resumen
      doc.rect(50, currentY, pageWidth - 100, 90)
         .fillColor('#f8f9fa')
         .fill();

      doc.fontSize(12)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('RESUMEN GENERAL', 60, currentY + 10);

      currentY += 35;

      doc.fontSize(10)
         .font('Helvetica');

      const col1X = 70;
      const col2X = 250;
      const col3X = 430;

      doc.text(`Total: ${suppliers.length}`, col1X, currentY);
      doc.text(`Activos: ${suppliers.filter(s => s.is_active).length}`, col2X, currentY);
      doc.text(`Inactivos: ${suppliers.filter(s => !s.is_active).length}`, col3X, currentY);

      currentY += 20;

      doc.text(`Rating Promedio: ${avgRating.toFixed(1)}/5`, col1X, currentY);
      doc.text(`Total Comprado: ${formatCurrency(totalPurchased)}`, col2X, currentY);

      currentY += 50;

      // Detalle de proveedores
      doc.fontSize(12)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('CATÁLOGO DETALLADO', 50, currentY);

      currentY += 25;

      suppliers.forEach((supplier, index) => {
        if (currentY > 660) {
          doc.addPage();
          currentY = 50;
        }

        // Box por proveedor
        const boxHeight = 95;

        doc.rect(50, currentY, pageWidth - 100, boxHeight)
           .fillColor(index % 2 === 0 ? '#ffffff' : '#f8f9fa')
           .fill();

        doc.rect(50, currentY, pageWidth - 100, boxHeight)
           .strokeColor('#dee2e6')
           .lineWidth(1)
           .stroke();

        const contentY = currentY + 10;

        // Nombre del proveedor
        doc.fontSize(11)
           .fillColor('#000')
           .font('Helvetica-Bold')
           .text(supplier.name, 60, contentY, { width: 350 });

        // Badge de estado
        const statusColor = supplier.is_active ? '#28a745' : '#dc3545';
        const statusText = supplier.is_active ? 'ACTIVO' : 'INACTIVO';

        doc.rect(pageWidth - 120, contentY - 2, 60, 16)
           .fillColor(statusColor)
           .fill();

        doc.fontSize(8)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(statusText, pageWidth - 115, contentY, { width: 50, align: 'center' });

        // RFC y Categoría
        doc.fontSize(9)
           .fillColor('#666')
           .font('Helvetica')
           .text(`RFC: ${supplier.rfc || 'N/A'}`, 60, contentY + 22);

        doc.text(`Categoría: ${supplier.category || 'N/A'}`, 200, contentY + 22);

        // Contacto
        doc.text(`Contacto: ${supplier.contact_name || 'N/A'}`, 60, contentY + 37);

        doc.text(`Tel: ${supplier.phone || 'N/A'}`, 250, contentY + 37);

        if (supplier.email) {
          doc.text(`Email: ${supplier.email}`, 60, contentY + 52, { width: 400 });
        }

        // Estadísticas
        doc.fontSize(9)
           .fillColor('#216238')
           .font('Helvetica-Bold')
           .text(`Rating: ${supplier.rating}/5`, 60, contentY + 67);

        doc.fillColor('#666')
           .font('Helvetica')
           .text(`Cotizaciones: ${supplier.total_quotations}`, 150, contentY + 67);

        doc.text(`Órdenes: ${supplier.total_orders}`, 280, contentY + 67);

        doc.fillColor('#216238')
           .font('Helvetica-Bold')
           .text(`${formatCurrency(supplier.total_purchased)}`, 400, contentY + 67);

        currentY += boxHeight + 5;
      });

      // Footer en cada página
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor('#999')
           .font('Helvetica')
           .text(`Página ${i + 1} de ${range.count}`,
                 50, doc.page.height - 50,
                 { width: pageWidth - 100, align: 'center' });
        doc.text(`Reporte generado por Sistema de Compras Cielito Home - ${new Date().toLocaleDateString('es-MX')}`,
                 50, doc.page.height - 35,
                 { width: pageWidth - 100, align: 'center' });
      }

      doc.end();

      return `pdfs/${filename}`;

    } catch (error) {
      console.error('Error generando reporte de proveedores:', error);
      throw error;
    }
  }

  // Generar resumen ejecutivo en PDF
  async generateAnalyticsSummaryReport(responseStream = null) {
    try {
      const generalStats = await db.getAsync(`
        SELECT
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'entregada' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN status = 'pendiente' THEN 1 END) as pending_requests
        FROM requests
      `);

      const orderStats = await db.getAsync(`
        SELECT
          COUNT(*) as total_orders,
          COALESCE(SUM(total_amount), 0) as total_spent
        FROM purchase_orders
      `);

      const supplierStats = await db.getAsync(`
        SELECT
          COUNT(*) as total_suppliers,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_suppliers
        FROM suppliers
      `);

      const spendingByArea = await db.allAsync(`
        SELECT
          r.area,
          COUNT(po.id) as orders_count,
          COALESCE(SUM(po.total_amount), 0) as total_spent
        FROM requests r
        LEFT JOIN purchase_orders po ON r.id = po.request_id
        GROUP BY r.area
        ORDER BY total_spent DESC
        LIMIT 10
      `);

      const topSuppliers = await db.allAsync(`
        SELECT
          s.name,
          COUNT(po.id) as orders_count,
          SUM(po.total_amount) as total_amount
        FROM suppliers s
        JOIN purchase_orders po ON s.id = po.supplier_id
        GROUP BY s.id, s.name
        ORDER BY total_amount DESC
        LIMIT 5
      `);

      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

      // Si se proporciona un stream (response), escribir directamente ahí
      // Si no, guardar en archivo (para compatibilidad con otros usos)
      let writeStream;
      let filename;
      let filepath;

      if (responseStream) {
        doc.pipe(responseStream);
      } else {
        filename = `resumen_ejecutivo_${Date.now()}.pdf`;
        filepath = path.join(this.pdfsDir, filename);
        writeStream = fs.createWriteStream(filepath);
        doc.pipe(writeStream);
      }

      const pageWidth = doc.page.width;

      // Logo y Header
      const logoPath = path.join(__dirname, '../../frontend/img/cielitohome.png');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 50, 40, { width: 80 });
        } catch (err) {
          console.warn('No se pudo cargar el logo:', err.message);
        }
      }

      doc.fontSize(20)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('CIELITO HOME', 140, 50, { align: 'left' });

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text('Sistema de Compras', 140, 75);

      // Título del reporte
      doc.fontSize(20)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('RESUMEN EJECUTIVO', 50, 130, { align: 'center', width: pageWidth - 100 });

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text(`Generado el: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
               50, 160, { align: 'center', width: pageWidth - 100 });

      // Línea divisoria
      doc.moveTo(50, 180)
         .lineTo(pageWidth - 50, 180)
         .strokeColor('#216238')
         .lineWidth(2)
         .stroke();

      let currentY = 210;

      // ESTADÍSTICAS GENERALES
      doc.rect(50, currentY, pageWidth - 100, 150)
         .fillColor('#f8f9fa')
         .fill();

      doc.fontSize(14)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('ESTADÍSTICAS GENERALES', 60, currentY + 15);

      currentY += 45;

      // Grid de métricas
      const metricsData = [
        { label: 'Total Solicitudes', value: generalStats.total_requests, color: '#007bff' },
        { label: 'Completadas', value: generalStats.completed_requests, color: '#28a745' },
        { label: 'Pendientes', value: generalStats.pending_requests, color: '#ffc107' },
        { label: 'Órdenes de Compra', value: orderStats.total_orders, color: '#6f42c1' },
        { label: 'Total Proveedores', value: supplierStats.total_suppliers, color: '#17a2b8' },
        { label: 'Proveedores Activos', value: supplierStats.active_suppliers, color: '#28a745' }
      ];

      let metricX = 70;
      const metricWidth = 160;
      let metricY = currentY;
      let metricCount = 0;

      metricsData.forEach((metric) => {
        // Box de métrica
        doc.rect(metricX, metricY, metricWidth, 35)
           .strokeColor(metric.color)
           .lineWidth(2)
           .stroke();

        // Valor
        doc.fontSize(18)
           .fillColor(metric.color)
           .font('Helvetica-Bold')
           .text(metric.value.toString(), metricX + 10, metricY + 5, { width: metricWidth - 20, align: 'center' });

        // Label
        doc.fontSize(9)
           .fillColor('#666')
           .font('Helvetica')
           .text(metric.label, metricX + 10, metricY + 26, { width: metricWidth - 20, align: 'center' });

        metricCount++;
        if (metricCount % 3 === 0) {
          metricX = 70;
          metricY += 43;
        } else {
          metricX += metricWidth + 15;
        }
      });

      // Total gastado (destacado)
      currentY += 120;
      doc.rect(50, currentY, pageWidth - 100, 50)
         .fillColor('#216238')
         .fill();

      doc.fontSize(12)
         .fillColor('#ffffff')
         .font('Helvetica')
         .text('TOTAL GASTADO', 60, currentY + 10);

      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text(formatCurrency(orderStats.total_spent), 60, currentY + 25, { width: pageWidth - 120, align: 'right' });

      currentY += 75;

      // GASTOS POR ÁREA
      if (currentY > 600) {
        doc.addPage();
        currentY = 50;
      }

      doc.fontSize(14)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('GASTOS POR ÁREA', 50, currentY);

      currentY += 30;

      spendingByArea.forEach((area, index) => {
        if (currentY > 720) {
          doc.addPage();
          currentY = 50;
        }

        const barWidth = (parseFloat(area.total_spent) / (spendingByArea[0]?.total_spent || 1)) * (pageWidth - 300);

        // Área nombre
        doc.fontSize(10)
           .fillColor('#000')
           .font('Helvetica')
           .text(area.area, 60, currentY + 5, { width: 150 });

        // Barra
        doc.rect(220, currentY, Math.max(barWidth, 5), 20)
           .fillColor('#216238')
           .fill();

        // Monto
        doc.fontSize(10)
           .fillColor('#216238')
           .font('Helvetica-Bold')
           .text(formatCurrency(area.total_spent), 220 + barWidth + 10, currentY + 5);

        currentY += 30;
      });

      // TOP 5 PROVEEDORES
      currentY += 20;

      if (currentY > 600) {
        doc.addPage();
        currentY = 50;
      }

      doc.fontSize(14)
         .fillColor('#216238')
         .font('Helvetica-Bold')
         .text('TOP 5 PROVEEDORES', 50, currentY);

      currentY += 30;

      topSuppliers.forEach((supplier, index) => {
        if (currentY > 720) {
          doc.addPage();
          currentY = 50;
        }

        const barWidth = (parseFloat(supplier.total_amount) / (topSuppliers[0]?.total_amount || 1)) * (pageWidth - 350);

        // Posición
        doc.fontSize(12)
           .fillColor('#216238')
           .font('Helvetica-Bold')
           .text(`${index + 1}`, 60, currentY + 5);

        // Nombre
        doc.fontSize(10)
           .fillColor('#000')
           .font('Helvetica')
           .text(supplier.name, 90, currentY + 5, { width: 180 });

        // Barra
        doc.rect(280, currentY, Math.max(barWidth, 5), 20)
           .fillColor('#28a745')
           .fill();

        // Monto
        doc.fontSize(10)
           .fillColor('#28a745')
           .font('Helvetica-Bold')
           .text(formatCurrency(supplier.total_amount), 280 + barWidth + 10, currentY + 5);

        currentY += 30;
      });

      // Footer en cada página
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor('#999')
           .font('Helvetica')
           .text(`Página ${i + 1} de ${range.count}`,
                 50, doc.page.height - 50,
                 { width: pageWidth - 100, align: 'center' });
        doc.text(`Reporte generado por Sistema de Compras Cielito Home - ${new Date().toLocaleDateString('es-MX')}`,
                 50, doc.page.height - 35,
                 { width: pageWidth - 100, align: 'center' });
      }

      doc.end();

      // Si estamos usando un response stream, retornar promesa que resuelve cuando termina
      if (responseStream) {
        return new Promise((resolve, reject) => {
          doc.on('end', resolve);
          doc.on('error', reject);
        });
      }

      // Si guardamos en archivo, retornar la ruta
      return `pdfs/${filename}`;

    } catch (error) {
      console.error('Error generando resumen ejecutivo:', error);
      throw error;
    }
  }

  // Generar PDF de formato de no requerimiento
  async generateNoRequirementPDF(noRequirementId) {
    try {
      // Obtener datos del no requerimiento
      const noReq = await db.getAsync(`
        SELECT
          nr.*,
          u.name as created_by_name,
          u.email as created_by_email,
          approver.name as approved_by_name
        FROM no_requirements nr
        JOIN users u ON nr.user_id = u.id
        LEFT JOIN users approver ON nr.approved_by = approver.id
        WHERE nr.id = ?
      `, [noRequirementId]);

      if (!noReq) {
        throw new Error('Formato de no requerimiento no encontrado');
      }

      if (noReq.status !== 'aprobado') {
        throw new Error('Solo se puede generar PDF de formatos aprobados');
      }

      // Crear PDF con nombre sanitizado (sin caracteres especiales)
      const sanitizedArea = noReq.area
        .normalize('NFD') // Normalizar caracteres Unicode
        .replace(/[\u0300-\u036f]/g, '') // Remover diacríticos (acentos, etc)
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remover caracteres especiales
        .replace(/\s+/g, '_'); // Reemplazar espacios con guiones bajos

      const doc = new PDFDocument({
        margin: 70,
        size: 'A4',
        bufferPages: true
      });

      const buffers = [];

      // Intentar agregar logo
      const logoPath = path.join(__dirname, '../../frontend/img/cielitohome.png');
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 50, 40, { width: 80 });
        } catch (err) {
          console.warn('No se pudo cargar el logo:', err.message);
        }
      }

      // Header con color verde
      doc.fontSize(20)
         .fillColor('#216238') // Verde acorde al branding
         .text('CIELITO HOME', 140, 50, { align: 'left' });

      doc.fontSize(10)
         .fillColor('#666')
         .text('Experiencias La Carta', 140, 75);

      // Título centrado y en negrita
      doc.fontSize(16)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('FORMATO DE NO REQUERIMIENTO SEMANAL DE', 70, 140, {
           align: 'center',
           width: doc.page.width - 140
         });

      doc.text('COTIZACIÓN', 70, 160, {
        align: 'center',
        width: doc.page.width - 140
      });

      // Cuerpo del documento
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#000');

      const startY = 220;
      const pageWidth = doc.page.width - 140;

      // Formatear fechas (las fechas vienen como timestamps completos de PostgreSQL)
      const weekStart = new Date(noReq.start_date).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long'
      });
      const weekEnd = new Date(noReq.end_date).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long'
      });
      const createdDate = new Date(noReq.created_at);
      const dayName = createdDate.toLocaleDateString('es-MX', { day: 'numeric' });
      const monthName = createdDate.toLocaleDateString('es-MX', { month: 'long' });
      const year = createdDate.getFullYear();

      // Texto del formato
      const text = `Yo, ${noReq.created_by_name}, responsable del área de ${noReq.area}, manifiesto por medio del presente que el día ${dayName} de ${monthName} de ${year}, y correspondiente a la semana del ${weekStart} al ${weekEnd}, no se requiere realizar ninguna solicitud de cotización de materiales, insumos o servicios ante el Área de Compras. Esta decisión se toma con base en la planeación interna del área, y bajo mi total responsabilidad como jefe o encargado, consciente de que cualquier necesidad urgente no prevista durante esta semana será atribuible a la falta de previsión del área que represento, y no será responsabilidad del Área de Compras. Sin más que agregar, firmo el presente como constancia y para los efectos correspondientes.`;

      // Dibujar el texto con alineación justificada
      doc.text(text, 70, startY, {
        width: pageWidth,
        align: 'justify',
        lineGap: 5
      });

      // Firmas
      const signaturesY = doc.y + 80;

      // FIRMA DEL RESPONSABLE (IZQUIERDA)
      // Título
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#000')
         .text('Firma del responsable', 70, signaturesY, {
           width: 220,
           align: 'center'
         });

      // Nombre del responsable (ARRIBA de la línea)
      doc.fontSize(11)
         .font('Helvetica')
         .text(noReq.created_by_name, 70, signaturesY + 50, {
           width: 220,
           align: 'center'
         });

      // Línea de firma (debajo del nombre)
      doc.moveTo(80, signaturesY + 70)
         .lineTo(280, signaturesY + 70)
         .stroke();

      // Área (debajo de la línea)
      doc.fontSize(10)
         .fillColor('#666')
         .text(noReq.area, 70, signaturesY + 75, {
           width: 220,
           align: 'center'
         });

      // FIRMA DE DIRECCIÓN GENERAL (DERECHA)
      // Título
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#000')
         .text('Firma de Dirección General', 310, signaturesY, {
           width: 220,
           align: 'center'
         });

      // Nombre del aprobador (ARRIBA de la línea)
      if (noReq.approved_by_name) {
        doc.fontSize(11)
           .font('Helvetica')
           .text(noReq.approved_by_name, 310, signaturesY + 50, {
             width: 220,
             align: 'center'
           });
      }

      // Línea de firma (debajo del nombre)
      doc.moveTo(320, signaturesY + 70)
         .lineTo(520, signaturesY + 70)
         .stroke();

      // Fecha de aprobación (debajo de la línea)
      if (noReq.approved_at) {
        const approvedDate = new Date(noReq.approved_at).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        doc.fontSize(10)
           .fillColor('#666')
           .text(`Fecha: ${approvedDate}`, 310, signaturesY + 75, {
             width: 220,
             align: 'center'
           });
      }

      // Footer
      const footerY = doc.page.height - 50;
      doc.fontSize(8)
         .fillColor('#999')
         .text(`Documento generado el ${new Date().toLocaleDateString('es-MX')} - ID: ${noReq.id}`,
           70, footerY, {
             width: pageWidth,
             align: 'center'
           });

      // Capturar PDF en buffers
      return new Promise((resolve, reject) => {
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          console.log(`✅ PDF de no-requerimiento generado en memoria: ID ${noReq.id}`);
          resolve(pdfBuffer);
        });
        doc.on('error', (err) => {
          console.error(`❌ Error generando PDF: ${err.message}`);
          reject(err);
        });

        doc.end();
      });

    } catch (error) {
      console.error('Error generando PDF de no requerimiento:', error);
      throw error;
    }
  }
}

module.exports = new PDFService();
// Actualizado con nuevo diseño Cielito Home v2
