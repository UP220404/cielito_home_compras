// Sistema de notificaciones del frontend

class NotificationManager {
  constructor() {
    this.notifications = [];
    this.pollingInterval = null;
    this.init();
  }

  // Inicializar sistema de notificaciones
  init() {
    this.loadNotifications();
    this.setupEventListeners();
    this.startPolling();
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
    // Click en campana de notificaciones
    const notificationToggle = document.getElementById('notificationToggle');
    if (notificationToggle) {
      notificationToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleNotificationDropdown();
      });
    }

    // Marcar todas como leídas
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
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="dropdown-item text-center text-muted py-3">
          <i class="fas fa-inbox fa-2x mb-2"></i>
          <div>No hay notificaciones</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.notifications.map(notification => `
      <div class="dropdown-item notification-item ${notification.is_read ? '' : 'unread'}" 
           data-id="${notification.id}">
        <div class="d-flex">
          <div class="notification-icon me-3">
            <i class="fas ${this.getNotificationIcon(notification.type)} text-${notification.type}"></i>
          </div>
          <div class="flex-grow-1">
            <div class="notification-title fw-bold">${notification.title}</div>
            <div class="notification-message text-muted small">${notification.message}</div>
            <div class="notification-time text-muted small">
              <i class="fas fa-clock me-1"></i>
              ${this.getRelativeTime(notification.created_at)}
            </div>
          </div>
          <div class="notification-actions">
            ${!notification.is_read ? `
              <button class="btn btn-sm btn-outline-primary mark-read" 
                      data-id="${notification.id}" title="Marcar como leída">
                <i class="fas fa-check"></i>
              </button>
            ` : ''}
            <button class="btn btn-sm btn-outline-danger delete-notification" 
                    data-id="${notification.id}" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        ${notification.link ? `
          <div class="mt-2">
            <a href="${notification.link}" class="btn btn-sm btn-primary">Ver detalles</a>
          </div>
        ` : ''}
      </div>
    `).join('');

    // Agregar event listeners para acciones
    this.setupNotificationActions();
  }

  // Configurar acciones de notificaciones
  setupNotificationActions() {
    const container = document.getElementById('notificationList');
    if (!container) return;

    // Marcar como leída
    container.addEventListener('click', async (e) => {
      if (e.target.classList.contains('mark-read') || 
          e.target.closest('.mark-read')) {
        e.preventDefault();
        e.stopPropagation();
        
        const btn = e.target.closest('.mark-read');
        const notificationId = btn.getAttribute('data-id');
        await this.markAsRead(notificationId);
      }
    });

    // Eliminar notificación
    container.addEventListener('click', async (e) => {
      if (e.target.classList.contains('delete-notification') || 
          e.target.closest('.delete-notification')) {
        e.preventDefault();
        e.stopPropagation();
        
        const btn = e.target.closest('.delete-notification');
        const notificationId = btn.getAttribute('data-id');
        
        Utils.showConfirm(
          'Eliminar notificación',
          '¿Estás seguro de que deseas eliminar esta notificación?',
          () => this.deleteNotification(notificationId)
        );
      }
    });

    // Click en notificación (marcar como leída si no lo está)
    container.addEventListener('click', async (e) => {
      const notificationItem = e.target.closest('.notification-item');
      if (notificationItem && !e.target.closest('.notification-actions')) {
        const notificationId = notificationItem.getAttribute('data-id');
        const notification = this.notifications.find(n => n.id === parseInt(notificationId));
        
        if (notification && !notification.is_read) {
          await this.markAsRead(notificationId);
        }

        // Si hay link, navegar
        if (notification && notification.link) {
          window.location.href = notification.link;
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
    const notificationDate = new Date(date);
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
    // Verificar cada 30 segundos
    this.pollingInterval = setInterval(() => {
      this.checkForNewNotifications();
    }, 30000);
  }

  // Detener polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Verificar nuevas notificaciones
  async checkForNewNotifications() {
    try {
      const response = await api.getUnreadCount();
      if (response.success) {
        const currentCount = this.getCurrentUnreadCount();
        const newCount = response.data.count;
        
        if (newCount > currentCount) {
          // Hay nuevas notificaciones
          this.loadNotifications();
          
          // Mostrar toast solo si la página está visible
          if (!document.hidden) {
            Utils.showToast('Tienes nuevas notificaciones', 'info');
          }
        }
        
        this.updateNotificationBadge(newCount);
      }
    } catch (error) {
      console.error('Error verificando nuevas notificaciones:', error);
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

// Inicializar gestor de notificaciones si estamos autenticados
let notificationManager = null;

if (Utils.isAuthenticated()) {
  notificationManager = new NotificationManager();
}

// Hacer disponible globalmente
window.NotificationManager = NotificationManager;
window.notificationManager = notificationManager;
