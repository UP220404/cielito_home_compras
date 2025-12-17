// Sistema de notificaciones del frontend

class NotificationManager {
  constructor() {
    this.notifications = [];
    this.pollingInterval = null;
    this.isInitialized = false;
    this.visibilityChangeHandler = null;
    this.socket = null;
    this.init();
  }

  // Inicializar sistema de notificaciones
  init() {
    if (this.isInitialized) {
      console.warn('⚠️ NotificationManager ya está inicializado');
      return;
    }

    this.loadNotifications();
    this.setupEventListeners();
    this.connectSocket();
    this.startPolling(); // Mantener polling como fallback
    this.isInitialized = true;
    console.log('✅ NotificationManager inicializado correctamente');
  }

  // Conectar Socket.IO para notificaciones en tiempo real
  connectSocket() {
    try {
      // Verificar que Socket.IO esté disponible
      if (typeof io === 'undefined') {
        console.warn('⚠️ Socket.IO no está disponible, usando solo polling');
        return;
      }

      // Verificar que Utils esté disponible
      if (typeof Utils === 'undefined' || typeof Utils.getCurrentUser !== 'function') {
        console.warn('⚠️ Utils no está disponible aún, reintentando en 500ms...');
        setTimeout(() => this.connectSocket(), 500);
        return;
      }

      const user = Utils.getCurrentUser();
      if (!user || !user.id) {
        console.warn('⚠️ No hay usuario autenticado para Socket.IO');
        return;
      }

      // Conectar al servidor Socket.IO
      const socketUrl = CONFIG.API_URL.replace('/api', '');
      console.log('🔌 Conectando Socket.IO a:', socketUrl);

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      // Evento: Conexión exitosa
      this.socket.on('connect', () => {
        console.log('✅ Socket.IO conectado:', this.socket.id);
        // Autenticar el usuario
        this.socket.emit('authenticate', user.id);
      });

      // Evento: Nueva notificación
      this.socket.on('new_notification', (notification) => {
        console.log('📬 Nueva notificación recibida vía Socket.IO:', notification);

        // Agregar notificación al inicio del array
        this.notifications.unshift(notification);

        // Re-renderizar
        this.renderNotifications();

        // Mostrar toast
        if (!document.hidden) {
          Utils.showToast(`${notification.title}: ${notification.message}`, notification.type || 'info');
        }

        // Actualizar contador
        this.updateUnreadCount();
      });

      // Evento: Actualización de contador
      this.socket.on('unread_count', (data) => {
        console.log('🔔 Contador actualizado vía Socket.IO:', data.count);
        this.updateNotificationBadge(data.count);
      });

      // Evento: Desconexión
      this.socket.on('disconnect', (reason) => {
        console.warn('🔌 Socket.IO desconectado:', reason);
      });

      // Evento: Error de conexión
      this.socket.on('connect_error', (error) => {
        console.error('❌ Error conectando Socket.IO:', error);
      });

      // Evento: Reconexión
      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`🔌 Socket.IO reconectado después de ${attemptNumber} intento(s)`);
        // Re-autenticar
        this.socket.emit('authenticate', user.id);
      });

    } catch (error) {
      console.error('❌ Error inicializando Socket.IO:', error);
    }
  }

  // Desconectar Socket.IO
  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 Socket.IO desconectado');
    }
  }

  // Cargar notificaciones iniciales
  async loadNotifications(page = 1, unreadOnly = false) {
    try {
      const response = await api.getNotifications(page, 20, unreadOnly);
      if (response.success) {
        this.notifications = response.data.notifications;
        this.updateNotificationBadge(response.data.unread_count);
        this.renderNotifications();
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  }

  // Configurar event listeners
  setupEventListeners() {
    // NO configurar event listener en notificationToggle
    // Bootstrap ya maneja el toggle del dropdown con data-bs-toggle="dropdown"

    // Marcar todas como leídas (si existe el botón)
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('mark-all-read')) {
        e.preventDefault();
        this.markAllAsRead();
      }
    });
  }

  // Renderizar notificaciones en el dropdown
  renderNotifications() {
    const container = document.getElementById('notificationList');
    if (!container) {
      console.warn('⚠️ No se encontró el contenedor #notificationList');
      return;
    }

    console.log(`📬 Renderizando ${this.notifications.length} notificación(es)`);

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="text-center py-3 text-muted">
          <i class="fas fa-inbox fa-2x mb-2"></i>
          <div>No hay notificaciones</div>
        </div>
      `;
      return;
    }

    // Generar HTML de notificaciones dentro del <li>
    container.innerHTML = this.notifications.slice(0, 5).map(notification => `
      <div class="notification-item-content ${notification.is_read ? '' : 'unread'}"
           data-id="${notification.id}" style="cursor: pointer; padding: 0.75rem 1rem; border-bottom: 1px solid #eee;">
        <div class="d-flex align-items-start">
          <div class="notification-icon me-2">
            <i class="fas ${this.getNotificationIcon(notification.type)} text-primary"></i>
          </div>
          <div class="flex-grow-1">
            <div class="notification-title fw-bold small">${notification.title}</div>
            <div class="notification-message text-muted" style="font-size: 0.85rem;">${notification.message}</div>
            <div class="notification-time text-muted" style="font-size: 0.75rem;">
              <i class="fas fa-clock me-1"></i>
              ${this.getRelativeTime(notification.created_at)}
            </div>
          </div>
          ${!notification.is_read ? '<div class="badge bg-primary rounded-pill ms-2">Nueva</div>' : ''}
        </div>
      </div>
    `).join('');

    console.log('✅ Notificaciones renderizadas correctamente');

    // Agregar event listeners para acciones
    this.setupNotificationActions();
  }

  // Configurar acciones de notificaciones
  setupNotificationActions() {
    const container = document.getElementById('notificationList');
    if (!container) return;

    // Click en notificación (marcar como leída y navegar si tiene link)
    container.addEventListener('click', async (e) => {
      const notificationItem = e.target.closest('.notification-item-content');
      if (!notificationItem) return;

      const notificationId = notificationItem.getAttribute('data-id');
      if (!notificationId) return;

      const notification = this.notifications.find(n => n.id === parseInt(notificationId));

      if (notification) {
        // Marcar como leída si no lo está
        if (!notification.is_read) {
          await this.markAsRead(notificationId);
        }

        // Si hay link, navegar
        if (notification.link) {
          // Los links vienen como "pages/detalle-solicitud.html?id=11" desde el backend
          // Detectar si estamos en la carpeta pages o en la raíz
          const currentPath = window.location.pathname;
          const isInPagesFolder = currentPath.includes('/pages/');

          let targetUrl;
          if (isInPagesFolder) {
            // Si ya estamos en /pages/, remover "pages/" del link
            targetUrl = notification.link.replace('pages/', '');
          } else {
            // Si estamos en la raíz, usar el link tal cual
            targetUrl = notification.link;
          }

          console.log('🔗 Navegando a notificación:', targetUrl);
          window.location.href = targetUrl;
        }
      }
    });
  }

  // Obtener ícono según tipo de notificación
  getNotificationIcon(type) {
    const icons = {
      info: 'fa-info-circle',
      success: 'fa-check-circle',
      warning: 'fa-exclamation-triangle',
      danger: 'fa-exclamation-circle',
      error: 'fa-times-circle'
    };
    return icons[type] || 'fa-bell';
  }

  // Obtener tiempo relativo
  getRelativeTime(date) {
    const now = new Date();
    // Asegurar que la fecha incluya 'Z' si es UTC, o convertirla correctamente
    let notificationDate;

    if (typeof date === 'string') {
      // Si la fecha no tiene 'Z' al final y no tiene offset, asumirla como UTC
      if (!date.endsWith('Z') && !date.includes('+') && !date.includes('T')) {
        notificationDate = new Date(date + ' UTC');
      } else if (!date.includes('T') && date.includes(' ')) {
        // Formato SQL: "YYYY-MM-DD HH:MM:SS" -> asumir UTC
        notificationDate = new Date(date.replace(' ', 'T') + 'Z');
      } else {
        notificationDate = new Date(date);
      }
    } else {
      notificationDate = new Date(date);
    }

    const diffInSeconds = Math.floor((now - notificationDate) / 1000);

    if (diffInSeconds < 60) {
      return 'Hace un momento';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      if (days === 1) return 'Ayer';
      if (days < 7) return `Hace ${days} días`;
      return Utils.formatDate(date);
    }
  }

  // Marcar notificación como leída
  async markAsRead(notificationId) {
    try {
      const response = await api.markNotificationAsRead(notificationId);
      if (response.success) {
        // Actualizar estado local
        const notification = this.notifications.find(n => n.id === parseInt(notificationId));
        if (notification) {
          notification.is_read = 1;
        }
        
        // Actualizar badge y re-renderizar
        await this.updateUnreadCount();
        this.renderNotifications();
      }
    } catch (error) {
      Utils.handleApiError(error, 'Error marcando notificación como leída');
    }
  }

  // Marcar todas como leídas
  async markAllAsRead() {
    try {
      const response = await api.markAllNotificationsAsRead();
      if (response.success) {
        // Actualizar estado local
        this.notifications.forEach(n => n.is_read = 1);
        
        // Actualizar UI
        this.updateNotificationBadge(0);
        this.renderNotifications();
        
        Utils.showToast('Todas las notificaciones marcadas como leídas', 'success');
      }
    } catch (error) {
      Utils.handleApiError(error, 'Error marcando todas las notificaciones como leídas');
    }
  }

  // Eliminar notificación
  async deleteNotification(notificationId) {
    try {
      const response = await api.deleteNotification(notificationId);
      if (response.success) {
        // Remover de array local
        this.notifications = this.notifications.filter(n => n.id !== parseInt(notificationId));
        
        // Re-renderizar
        this.renderNotifications();
        await this.updateUnreadCount();
        
        Utils.showToast('Notificación eliminada', 'success');
      }
    } catch (error) {
      Utils.handleApiError(error, 'Error eliminando notificación');
    }
  }

  // Actualizar badge de notificaciones
  updateNotificationBadge(count) {
    Utils.updateNotificationBadge(count);
  }

  // Actualizar contador de no leídas
  async updateUnreadCount() {
    try {
      const response = await api.getUnreadCount();
      if (response.success) {
        this.updateNotificationBadge(response.data.count);
      }
    } catch (error) {
      console.error('Error actualizando contador:', error);
    }
  }

  // Toggle dropdown de notificaciones
  toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
      const bsDropdown = new bootstrap.Dropdown(dropdown);
      bsDropdown.toggle();
    }
  }

  // Iniciar polling para nuevas notificaciones
  startPolling() {
    // Si ya hay un intervalo activo, no crear otro
    if (this.pollingInterval) {
      console.log('⚠️ Polling ya está activo');
      return;
    }

    // Verificar cada 30 segundos para notificaciones en tiempo real
    console.log('🔔 Iniciando polling de notificaciones (cada 30 segundos)');

    this.pollingInterval = setInterval(() => {
      if (!document.hidden) {
        this.checkForNewNotifications();
      }
    }, 30000); // Cambiado de 120,000 a 30,000 ms (30 segundos)

    // Actualizar timestamps cada minuto
    this.timestampInterval = setInterval(() => {
      this.updateTimestamps();
    }, 60000); // Cada 60 segundos

    // Remover event listener anterior si existe
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    // Crear nuevo handler y guardarlo
    this.visibilityChangeHandler = () => {
      if (document.hidden && this.pollingInterval) {
        console.log('⏸️ Pausando polling (pestaña inactiva)');
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      } else if (!document.hidden && !this.pollingInterval) {
        console.log('▶️ Reanudando polling (pestaña activa)');
        this.startPolling();
      }
    };

    // Agregar event listener
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  // Detener polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.timestampInterval) {
      clearInterval(this.timestampInterval);
      this.timestampInterval = null;
    }

    // Remover event listener de visibilitychange
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    // Desconectar Socket.IO
    this.disconnectSocket();

    console.log('⏹️ Polling detenido');
  }

  // Actualizar timestamps en tiempo real
  updateTimestamps() {
    const container = document.getElementById('notificationList');
    if (!container) return;

    const timeElements = container.querySelectorAll('.notification-time');
    timeElements.forEach((element, index) => {
      if (this.notifications[index]) {
        const relativeTime = this.getRelativeTime(this.notifications[index].created_at);
        element.innerHTML = `<i class="fas fa-clock me-1"></i>${relativeTime}`;
      }
    });
  }

  // Verificar nuevas notificaciones
  async checkForNewNotifications() {
    try {
      const response = await api.getUnreadCount();
      if (response.success) {
        const currentCount = this.getCurrentUnreadCount();
        const newCount = response.data.count;

        console.log(`🔍 Verificando notificaciones: actual=${currentCount}, nuevo=${newCount}`);

        if (newCount > currentCount) {
          // Hay nuevas notificaciones
          console.log('✉️ ¡Nuevas notificaciones detectadas!');
          this.loadNotifications();

          // Mostrar toast solo si la página está visible
          if (!document.hidden) {
            Utils.showToast(`Tienes ${newCount} notificación(es) nueva(s)`, 'info');
          }
        }

        // SIEMPRE actualizar el badge con el contador del servidor
        this.updateNotificationBadge(newCount);
      }
    } catch (error) {
      console.error('❌ Error verificando nuevas notificaciones:', error);
    }
  }

  // Obtener contador actual de no leídas
  getCurrentUnreadCount() {
    return this.notifications.filter(n => !n.is_read).length;
  }

  // Crear notificación local (para testing)
  createLocalNotification(title, message, type = 'info', link = null) {
    const notification = {
      id: Date.now(),
      title,
      message,
      type,
      link,
      is_read: 0,
      created_at: new Date().toISOString()
    };
    
    this.notifications.unshift(notification);
    this.renderNotifications();
    this.updateUnreadCount();
  }
}

// NO auto-inicializar aquí, se inicializará desde auth.js
// para asegurar el orden correcto de carga

// Hacer la clase disponible globalmente
window.NotificationManager = NotificationManager;
window.notificationManager = null; // Se inicializará desde auth.js
