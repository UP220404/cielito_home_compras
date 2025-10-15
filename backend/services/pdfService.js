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
          u.name as requester_name,
          u.email as requester_email,
          s.name as supplier_name,
          s.rfc as supplier_rfc,
          s.contact_name,
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
          ri.unit
        FROM quotation_items qi
        JOIN request_items ri ON qi.request_item_id = ri.id
        WHERE qi.quotation_id = ?
        ORDER BY qi.id ASC
      `, [order.quotation_id]);

      // Crear PDF
      const filename = `orden_${order.folio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const filepath = path.join(this.pdfsDir, filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      doc.pipe(fs.createWriteStream(filepath));

      // Header con logo (simulado)
      this.addHeader(doc, order);
      
      // Información de la orden
      this.addOrderInfo(doc, order);
      
      // Información del proveedor
      this.addSupplierInfo(doc, order);
      
      // Tabla de items
      this.addItemsTable(doc, items);
      
      // Totales
      this.addTotals(doc, order);
      
      // Footer
      this.addFooter(doc, order);

      doc.end();

      return `pdfs/${filename}`;

    } catch (error) {
      console.error('Error generando PDF:', error);
      throw error;
    }
  }

  addHeader(doc, order) {
    const pageWidth = doc.page.width - 100;
    
    // Logo área (simulado)
    doc.fontSize(20)
       .fillColor('#007bff')
       .text('CIELITO HOME', 50, 50, { align: 'left' });
    
    doc.fontSize(12)
       .fillColor('#666')
       .text('Sistema de Compras', 50, 75);

    // Título
    doc.fontSize(18)
       .fillColor('#000')
       .text('ORDEN DE COMPRA', 50, 120, { align: 'center' });

    // Línea separadora
    doc.moveTo(50, 150)
       .lineTo(pageWidth + 50, 150)
       .stroke('#007bff');

    return 170; // Posición Y después del header
  }

  addOrderInfo(doc, order) {
    const startY = 170;
    
    doc.fontSize(12).fillColor('#000');
    
    // Columna izquierda
    doc.text(`Folio: ${order.folio}`, 50, startY);
    doc.text(`Solicitud: ${order.request_folio}`, 50, startY + 15);
    doc.text(`Fecha de Orden: ${new Date(order.order_date).toLocaleDateString('es-MX')}`, 50, startY + 30);
    doc.text(`Entrega Esperada: ${new Date(order.expected_delivery).toLocaleDateString('es-MX')}`, 50, startY + 45);
    
    // Columna derecha
    doc.text(`Área Solicitante: ${order.area}`, 300, startY);
    doc.text(`Solicitante: ${order.requester_name}`, 300, startY + 15);
    doc.text(`Creado por: ${order.created_by_name}`, 300, startY + 30);
    doc.text(`Estado: ${order.status.toUpperCase()}`, 300, startY + 45);

    return startY + 80;
  }

  addSupplierInfo(doc, order) {
    const startY = 260;
    
    // Título
    doc.fontSize(14)
       .fillColor('#007bff')
       .text('INFORMACIÓN DEL PROVEEDOR', 50, startY);

    doc.fontSize(12).fillColor('#000');
    
    // Información del proveedor
    const supplierY = startY + 25;
    doc.text(`Nombre: ${order.supplier_name}`, 50, supplierY);
    if (order.supplier_rfc) {
      doc.text(`RFC: ${order.supplier_rfc}`, 50, supplierY + 15);
    }
    if (order.contact_name) {
      doc.text(`Contacto: ${order.contact_name}`, 300, supplierY);
    }
    if (order.supplier_phone) {
      doc.text(`Teléfono: ${order.supplier_phone}`, 300, supplierY + 15);
    }
    if (order.supplier_email) {
      doc.text(`Email: ${order.supplier_email}`, 50, supplierY + 30);
    }
    if (order.supplier_address) {
      doc.text(`Dirección: ${order.supplier_address}`, 50, supplierY + 45, { width: 500 });
    }

    return supplierY + 80;
  }

  addItemsTable(doc, items) {
    const startY = 400;
    const pageWidth = doc.page.width - 100;
    
    // Título
    doc.fontSize(14)
       .fillColor('#007bff')
       .text('DETALLE DE PRODUCTOS/SERVICIOS', 50, startY);

    // Headers de tabla
    const tableTop = startY + 30;
    const itemCodeX = 50;
    const descriptionX = 120;
    const quantityX = 350;
    const unitPriceX = 420;
    const totalX = 490;

    doc.fontSize(10)
       .fillColor('#000')
       .text('Item', itemCodeX, tableTop)
       .text('Descripción', descriptionX, tableTop)
       .text('Cant.', quantityX, tableTop)
       .text('Precio Unit.', unitPriceX, tableTop)
       .text('Total', totalX, tableTop);

    // Línea bajo headers
    doc.moveTo(50, tableTop + 15)
       .lineTo(pageWidth + 50, tableTop + 15)
       .stroke();

    // Items
    let currentY = tableTop + 25;
    items.forEach((item, index) => {
      if (currentY > 700) { // Nueva página si es necesario
        doc.addPage();
        currentY = 50;
      }

      doc.fontSize(9)
         .text(index + 1, itemCodeX, currentY)
         .text(item.material, descriptionX, currentY, { width: 220 })
         .text(item.quantity.toString(), quantityX, currentY)
         .text(formatCurrency(item.unit_price), unitPriceX, currentY)
         .text(formatCurrency(item.subtotal), totalX, currentY);

      // Especificaciones en línea siguiente si hay espacio
      if (item.specifications && currentY < 680) {
        currentY += 12;
        doc.fontSize(8)
           .fillColor('#666')
           .text(item.specifications, descriptionX, currentY, { width: 220 });
        doc.fillColor('#000');
      }

      currentY += 20;
    });

    return currentY + 20;
  }

  addTotals(doc, order) {
    const startY = 600;
    const rightX = 400;
    
    // Línea separadora
    doc.moveTo(rightX, startY)
       .lineTo(550, startY)
       .stroke();

    doc.fontSize(12).fillColor('#000');
    
    // Total
    doc.text('TOTAL:', rightX, startY + 15)
       .fontSize(14)
       .fillColor('#007bff')
       .text(formatCurrency(order.total_amount), 480, startY + 15);

    // Información adicional
    if (order.payment_terms) {
      doc.fontSize(10)
         .fillColor('#000')
         .text(`Términos de pago: ${order.payment_terms}`, 50, startY + 50);
    }

    if (order.notes) {
      doc.text(`Observaciones: ${order.notes}`, 50, startY + 70, { width: 500 });
    }

    return startY + 100;
  }

  addFooter(doc, order) {
    const footerY = doc.page.height - 100;
    
    // Línea separadora
    doc.moveTo(50, footerY)
       .lineTo(doc.page.width - 50, footerY)
       .stroke('#ccc');

    doc.fontSize(8)
       .fillColor('#666')
       .text('Este documento fue generado automáticamente por el Sistema de Compras Cielito Home', 
             50, footerY + 10, { align: 'center' });

    doc.text(`Generado el: ${new Date().toLocaleString('es-MX')}`, 
             50, footerY + 25, { align: 'center' });

    // Área de firmas
    const signaturesY = footerY - 60;
    doc.fontSize(10)
       .fillColor('#000')
       .text('_____________________', 100, signaturesY)
       .text('_____________________', 350, signaturesY)
       .text('Solicitante', 100, signaturesY + 15)
       .text('Autorizado por', 350, signaturesY + 15);
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
}

module.exports = new PDFService();
