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

  // Generar PDF de orden de compra
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
          r.urgency,
          r.priority,
          r.created_at,
          u.name as requester_name,
          u.email as requester_email,
          auth.name as authorized_by_name,
          s.name as supplier_name,
          s.rfc as supplier_rfc,
          s.contact_person,
          s.phone as supplier_phone,
          s.email as supplier_email,
          s.address as supplier_address,
          q.quotation_number,
          q.payment_terms,
          q.validity_days,
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

      // Obtener items
      const items = await db.allAsync(`
        SELECT
          qi.*,
          ri.material,
          ri.specifications,
          ri.unit,
          ri.quantity,
          ri.in_stock,
          ri.location
        FROM quotation_items qi
        JOIN request_items ri ON qi.request_item_id = ri.id
        WHERE qi.quotation_id = ?
        ORDER BY qi.id ASC
      `, [order.quotation_id]);

      // Crear PDF
      const filename = `orden_${order.folio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const filepath = path.join(this.pdfsDir, filename);

      // Crear el documento PDF con promesa para esperar a que termine
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const writeStream = fs.createWriteStream(filepath);

        doc.pipe(writeStream);

        // Header con logo
        this.addHeader(doc, order);

        // Información de la orden
        const infoY = this.addOrderInfo(doc, order);

        // Tabla de items
        const tableY = this.addItemsTable(doc, items, infoY);

        // Firmas
        this.addSignatures(doc, order, tableY);

        doc.end();

        // Esperar a que el stream termine de escribir
        writeStream.on('finish', () => {
          console.log('✅ PDF escrito correctamente:', filepath);
          resolve(`pdfs/${filename}`);
        });

        writeStream.on('error', (err) => {
          console.error('❌ Error escribiendo PDF:', err);
          reject(err);
        });
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
    doc.font('Helvetica-Bold').text(new Date(order.request_date || order.created_at).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }));
    currentY += 18;

    // Expectativa de fecha de entrega con valor
    doc.font('Helvetica').text('Expectativa de fecha de entrega: ', 50, currentY, { continued: true });
    doc.font('Helvetica-Bold').text(new Date(order.delivery_date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }));
    currentY += 18;

    // Urgencia con espacios para marcar
    doc.font('Helvetica');
    const urgency = order.urgency || 'media';
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

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      doc.pipe(fs.createWriteStream(filepath));

      // Header
      doc.fontSize(18)
         .fillColor('#007bff')
         .text('REPORTE DE SOLICITUDES DE COMPRA', { align: 'center' });

      doc.fontSize(12)
         .fillColor('#000')
         .text(`Generado el: ${new Date().toLocaleDateString('es-MX')}`, { align: 'center' });

      // Resumen
      const summary = {
        total: requests.length,
        pendientes: requests.filter(r => r.status === 'pendiente').length,
        autorizadas: requests.filter(r => r.status === 'autorizada').length,
        completadas: requests.filter(r => r.status === 'entregada').length
      };

      doc.moveDown(2);
      doc.text(`Total de solicitudes: ${summary.total}`);
      doc.text(`Pendientes: ${summary.pendientes}`);
      doc.text(`Autorizadas: ${summary.autorizadas}`);
      doc.text(`Completadas: ${summary.completadas}`);

      // Tabla de solicitudes
      doc.moveDown(2);
      requests.forEach(request => {
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.fontSize(11)
           .text(`${request.folio} - ${request.requester_name}`)
           .fontSize(9)
           .text(`Área: ${request.area} | Estado: ${request.status} | Items: ${request.items_count}`)
           .text(`Fecha: ${new Date(request.request_date).toLocaleDateString('es-MX')}`)
           .moveDown(0.5);
      });

      doc.end();

      return `pdfs/${filename}`;

    } catch (error) {
      console.error('Error generando reporte PDF:', error);
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

      const filename = `no_req_${sanitizedArea}_${noReq.id}.pdf`;
      const filepath = path.join(this.pdfsDir, filename);

      // Si ya existe un PDF, eliminarlo para regenerarlo
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      const doc = new PDFDocument({
        margin: 70,
        size: 'A4',
        bufferPages: true
      });

      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

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

      // Formatear fechas (agregar T12:00:00 para evitar problemas de timezone)
      const weekStart = new Date(noReq.week_start + 'T12:00:00').toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long'
      });
      const weekEnd = new Date(noReq.week_end + 'T12:00:00').toLocaleDateString('es-MX', {
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

      doc.end();

      // Wait for the stream to finish writing
      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          console.log(`✅ PDF generado exitosamente: ${filepath}`);
          resolve(`pdfs/${filename}`);
        });
        writeStream.on('error', (err) => {
          console.error(`❌ Error escribiendo PDF: ${err.message}`);
          reject(err);
        });
      });

    } catch (error) {
      console.error('Error generando PDF de no requerimiento:', error);
      throw error;
    }
  }
}

module.exports = new PDFService();
// Actualizado con nuevo diseño Cielito Home v2
