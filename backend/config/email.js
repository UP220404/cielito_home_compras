const nodemailer = require('nodemailer');

const createTransporter = () => {
  // Configuración para Gmail
    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

    let transporter;

    if (process.env.NODE_ENV !== 'test' && EMAIL_HOST && EMAIL_PORT && EMAIL_USER && EMAIL_PASS) {
    return nodemailer.createTransport({  // ← Cambiar aquí: createTransport (sin "er")
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // App password de Google
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  
  // Configuración para SendGrid (alternativa)
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({  // ← Cambiar aquí también
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }
  
  // Configuración de desarrollo (Ethereal Email)
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️  Usando configuración de email de desarrollo');
    return nodemailer.createTransport({  // ← Y aquí también
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.password'
      }
    });
  }
  
  console.warn('⚠️  No se encontró configuración de email válida');
  return null;
};

let transporter = createTransporter();

// Verificar configuración al inicializar
if (process.env.NODE_ENV !== 'test' && transporter) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Error en configuración de email:', error.message);
    } else {
      console.log('✅ Servidor de email configurado correctamente');
    }
  });
} else if (process.env.NODE_ENV === 'test') {
  // In test mode, use a mock transporter or skip setup
  transporter = null;
}

// Templates de email
const emailTemplates = {
  newRequest: (requestData) => ({
    subject: `Nueva Solicitud de Compra - ${requestData.folio}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
          <h1>Cielito Home</h1>
          <h2>Nueva Solicitud de Compra</h2>
        </div>
        
        <div style="padding: 20px;">
          <p><strong>Folio:</strong> ${requestData.folio}</p>
          <p><strong>Solicitante:</strong> ${requestData.requester_name}</p>
          <p><strong>Área:</strong> ${requestData.area}</p>
          <p><strong>Fecha de Solicitud:</strong> ${new Date(requestData.request_date).toLocaleDateString('es-MX')}</p>
          <p><strong>Fecha de Entrega Requerida:</strong> ${new Date(requestData.delivery_date).toLocaleDateString('es-MX')}</p>
          <p><strong>Urgencia:</strong> <span style="text-transform: capitalize;">${requestData.urgency}</span></p>
          <p><strong>Prioridad:</strong> <span style="text-transform: capitalize;">${requestData.priority}</span></p>
          
          <h3>Justificación:</h3>
          <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">${requestData.justification}</p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/pages/detalle-solicitud.html?id=${requestData.id}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver Solicitud Completa
            </a>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d;">
          <p>Este es un mensaje automático del Sistema de Compras Cielito Home</p>
        </div>
      </div>
    `
  }),

  statusChange: (requestData, newStatus, reason = null) => ({
    subject: `Solicitud ${requestData.folio} - Estado: ${newStatus.toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${getStatusColor(newStatus)}; color: white; padding: 20px; text-align: center;">
          <h1>Cielito Home</h1>
          <h2>Cambio de Estado en Solicitud</h2>
        </div>
        
        <div style="padding: 20px;">
          <p><strong>Folio:</strong> ${requestData.folio}</p>
          <p><strong>Nuevo Estado:</strong> <span style="text-transform: capitalize;">${newStatus}</span></p>
          <p><strong>Fecha del Cambio:</strong> ${new Date().toLocaleString('es-MX')}</p>
          
          ${reason ? `
            <h3>Observaciones:</h3>
            <p style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">${reason}</p>
          ` : ''}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/pages/detalle-solicitud.html?id=${requestData.id}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver Detalles
            </a>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d;">
          <p>Este es un mensaje automático del Sistema de Compras Cielito Home</p>
        </div>
      </div>
    `
  }),

  purchaseOrder: (orderData) => ({
    subject: `Orden de Compra Generada - ${orderData.folio}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
          <h1>Cielito Home</h1>
          <h2>Orden de Compra Generada</h2>
        </div>
        
        <div style="padding: 20px;">
          <p><strong>Folio de Orden:</strong> ${orderData.folio}</p>
          <p><strong>Proveedor:</strong> ${orderData.supplier_name}</p>
          <p><strong>Monto Total:</strong> $${parseFloat(orderData.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          <p><strong>Fecha de Orden:</strong> ${new Date(orderData.order_date).toLocaleDateString('es-MX')}</p>
          <p><strong>Entrega Esperada:</strong> ${new Date(orderData.expected_delivery).toLocaleDateString('es-MX')}</p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/pages/ordenes-compra.html" 
               style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver Órdenes de Compra
            </a>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d;">
          <p>Este es un mensaje automático del Sistema de Compras Cielito Home</p>
        </div>
      </div>
    `
  })
};

function getStatusColor(status) {
  const colors = {
    pendiente: '#ffc107',
    cotizando: '#17a2b8',
    autorizada: '#28a745',
    rechazada: '#dc3545',
    comprada: '#007bff',
    entregada: '#28a745',
    cancelada: '#6c757d'
  };
  return colors[status] || '#6c757d';
}

module.exports = {
  transporter,
  emailTemplates
};