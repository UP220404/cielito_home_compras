const { transporter, emailTemplates } = require('../config/email');
const db = require('../config/database');

class EmailService {
  // Método base para enviar emails
  async sendEmail(to, subject, html, requestId = null) {
    if (!transporter) {
      console.warn('⚠️  Transporter de email no configurado');
      return false;
    }

    try {
      const mailOptions = {
        from: `"Sistema Cielito Home" <${process.env.EMAIL_USER}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html
      };

      const result = await transporter.sendMail(mailOptions);
      
      // Log del email enviado
      await this.logEmail(
        Array.isArray(to) ? to.join(', ') : to,
        subject,
        requestId,
        'sent'
      );

      console.log('✅ Email enviado exitosamente:', result.messageId);
      return true;

    } catch (error) {
      console.error('❌ Error enviando email:', error.message);
      
      // Log del error
      await this.logEmail(
        Array.isArray(to) ? to.join(', ') : to,
        subject,
        requestId,
        'failed',
        error.message
      );

      return false;
    }
  }

  // Log de emails en base de datos
  async logEmail(recipient, subject, requestId = null, status = 'sent', errorMessage = null) {
    try {
      await db.runAsync(
        'INSERT INTO email_log (recipient, subject, request_id, status, error_message) VALUES (?, ?, ?, ?, ?)',
        [recipient, subject, requestId, status, errorMessage]
      );
    } catch (error) {
      console.error('Error logging email:', error);
    }
  }

  // Notificación de nueva solicitud
  async sendNewRequestNotification(requestData, recipients) {
    const template = emailTemplates.newRequest(requestData);
    const emails = recipients.map(r => r.email);
    
    return await this.sendEmail(
      emails,
      template.subject,
      template.html,
      requestData.id
    );
  }

  // Notificación de cambio de estatus
  async sendStatusChangeNotification(requestData, newStatus, reason = null) {
    const template = emailTemplates.statusChange(requestData, newStatus, reason);
    
    return await this.sendEmail(
      requestData.requester_email,
      template.subject,
      template.html,
      requestData.id
    );
  }

  // Notificación de orden de compra
  async sendPurchaseOrderNotification(orderData) {
    const template = emailTemplates.purchaseOrder(orderData);
    
    return await this.sendEmail(
      orderData.requester_email,
      template.subject,
      template.html,
      orderData.request_id
    );
  }

  // Email de bienvenida para nuevos usuarios
  async sendWelcomeEmail(userData, tempPassword) {
    const subject = 'Bienvenido al Sistema de Compras Cielito Home';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
          <h1>¡Bienvenido a Cielito Home!</h1>
        </div>
        
        <div style="padding: 20px;">
          <p>Hola <strong>${userData.name}</strong>,</p>
          
          <p>Tu cuenta ha sido creada exitosamente en el Sistema de Compras de Cielito Home.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Datos de acceso:</h3>
            <p><strong>Email:</strong> ${userData.email}</p>
            <p><strong>Contraseña temporal:</strong> ${tempPassword}</p>
            <p><strong>Área:</strong> ${userData.area}</p>
            <p><strong>Rol:</strong> ${userData.role}</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
            <p><strong>⚠️ Importante:</strong> Por seguridad, cambia tu contraseña en el primer inicio de sesión.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/pages/login.html" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Iniciar Sesión
            </a>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d;">
          <p>Sistema de Compras Cielito Home</p>
        </div>
      </div>
    `;

    return await this.sendEmail(userData.email, subject, html);
  }

  // Recordatorio de solicitudes pendientes (para cron job)
  async sendPendingRequestsReminder() {
    try {
      // Obtener solicitudes pendientes de más de 2 días
      const pendingRequests = await db.allAsync(`
        SELECT r.*, u.name as requester_name, u.email as requester_email
        FROM requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.status = 'pendiente' 
        AND datetime(r.created_at) < datetime('now', '-2 days')
      `);

      if (pendingRequests.length === 0) {
        console.log('📧 No hay solicitudes pendientes para recordar');
        return;
      }

      // Obtener directores para notificar
      const directors = await db.allAsync(`
        SELECT email FROM users 
        WHERE role IN ('director', 'admin') AND is_active = TRUE
      `);

      const directorEmails = directors.map(d => d.email);

      const subject = `Recordatorio: ${pendingRequests.length} solicitud(es) pendiente(s) de autorización`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ffc107; color: #212529; padding: 20px; text-align: center;">
            <h1>⚠️ Solicitudes Pendientes</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Hay <strong>${pendingRequests.length}</strong> solicitudes pendientes de autorización:</p>
            
            <div style="margin: 20px 0;">
              ${pendingRequests.map(req => `
                <div style="background-color: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 5px;">
                  <strong>${req.folio}</strong> - ${req.requester_name} (${req.area})<br>
                  <small>Creada: ${new Date(req.created_at).toLocaleDateString('es-MX')}</small>
                </div>
              `).join('')}
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/pages/compras-panel.html" 
                 style="background-color: #ffc107; color: #212529; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Revisar Solicitudes
              </a>
            </div>
          </div>
        </div>
      `;

      return await this.sendEmail(directorEmails, subject, html);

    } catch (error) {
      console.error('Error enviando recordatorio de solicitudes pendientes:', error);
    }
  }

  // Reporte semanal de actividad
  async sendWeeklyReport() {
    try {
      const stats = await db.getAsync(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'autorizada' THEN 1 ELSE 0 END) as authorized,
          SUM(CASE WHEN status = 'comprada' THEN 1 ELSE 0 END) as purchased,
          SUM(CASE WHEN status = 'entregada' THEN 1 ELSE 0 END) as delivered
        FROM requests 
        WHERE created_at >= datetime('now', '-7 days')
      `);

      const admins = await db.allAsync(`
        SELECT email FROM users 
        WHERE role IN ('director', 'admin') AND is_active = TRUE
      `);

      const adminEmails = admins.map(a => a.email);

      const subject = 'Reporte Semanal - Sistema de Compras';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
            <h1>📊 Reporte Semanal</h1>
            <p>Sistema de Compras Cielito Home</p>
          </div>
          
          <div style="padding: 20px;">
            <h3>Actividad de los últimos 7 días:</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                <h4 style="margin: 0; color: #007bff;">${stats.total_requests}</h4>
                <p style="margin: 5px 0;">Total Solicitudes</p>
              </div>
              
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; text-align: center;">
                <h4 style="margin: 0; color: #856404;">${stats.pending}</h4>
                <p style="margin: 5px 0;">Pendientes</p>
              </div>
              
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; text-align: center;">
                <h4 style="margin: 0; color: #155724;">${stats.authorized}</h4>
                <p style="margin: 5px 0;">Autorizadas</p>
              </div>
              
              <div style="background-color: #cce5ff; padding: 15px; border-radius: 5px; text-align: center;">
                <h4 style="margin: 0; color: #004085;">${stats.delivered}</h4>
                <p style="margin: 5px 0;">Entregadas</p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/pages/analytics.html" 
                 style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Ver Dashboard Completo
              </a>
            </div>
          </div>
        </div>
      `;

      return await this.sendEmail(adminEmails, subject, html);

    } catch (error) {
      console.error('Error enviando reporte semanal:', error);
    }
  }
}

module.exports = new EmailService();
