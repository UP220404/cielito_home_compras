// Utilidades generales para el frontend

class Utils {
  // Mostrar spinner de carga
  static showSpinner(container = document.body, message = 'Cargando...') {
    const spinner = document.createElement('div');
    spinner.id = 'loading-spinner';
    spinner.className = 'spinner-overlay';
    spinner.innerHTML = `
      <div class="text-center">
        <div class="spinner-border" role="status" style="width: 3rem; height: 3rem;">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-3 text-primary fw-bold">${message}</div>
      </div>
    `;
    container.appendChild(spinner);
  }

  // Ocultar spinner de carga
  static hideSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
      spinner.remove();
    }
  }

  // Mostrar toast notification
  static showToast(message, type = 'info', duration = 5000) {
    const toastContainer = this.getOrCreateToastContainer();
    const toastId = 'toast-' + Date.now();
    
    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle', 
      danger: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const colorMap = {
      success: 'text-success',
      error: 'text-danger',
      danger: 'text-danger', 
      warning: 'text-warning',
      info: 'text-info'
    };

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <div class="toast-header">
        <i class="fas ${iconMap[type]} ${colorMap[type]} me-2"></i>
        <strong class="me-auto">Sistema Cielito Home</strong>
        <small class="text-muted">ahora</small>
        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;

    toastContainer.appendChild(toast);

    // Verificar si bootstrap está disponible
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
      const bsToast = new bootstrap.Toast(toast, { delay: duration });
      bsToast.show();

      // Eliminar el toast después de que se oculte
      toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
      });
    } else {
      // Fallback sin bootstrap: mostrar el toast con CSS simple
      toast.style.display = 'block';
      toast.style.opacity = '1';
      toast.style.transition = 'opacity 0.3s';

      // Auto-hide después del duration
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  }

  // Obtener o crear contenedor de toasts
  static getOrCreateToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container position-fixed top-0 end-0 p-3';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }
    return container;
  }

  // Limpiar alertas existentes
  static clearAlerts(container = null) {
    const targetContainer = container || document.querySelector('main .container') || document.querySelector('main') || document.body;
    const existingAlerts = targetContainer.querySelectorAll('.alert[id^="alert-"]');
    existingAlerts.forEach(alert => alert.remove());
  }

  // Mostrar alerta en la página
  static showAlert(title, type = 'info', htmlContent = '', container = null, autoDismiss = true) {
    // Limpiar alertas anteriores
    this.clearAlerts(container);

    const alertId = 'alert-' + Date.now();
    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      danger: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const alert = document.createElement('div');
    alert.id = alertId;
    alert.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
      <div class="d-flex align-items-start">
        <i class="fas ${iconMap[type]} me-2 mt-1" style="font-size: 1.2rem;"></i>
        <div class="flex-grow-1">
          <h5 class="alert-heading mb-2">${title}</h5>
          ${htmlContent ? `<div class="alert-content">${htmlContent}</div>` : ''}
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;

    // Determinar dónde insertar la alerta
    const targetContainer = container || document.querySelector('main .container') || document.querySelector('main') || document.body;

    // Insertar al inicio del contenedor
    targetContainer.insertBefore(alert, targetContainer.firstChild);

    // Scroll suave hasta la alerta
    alert.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Auto-dismiss después de 10 segundos para alertas de error
    if (autoDismiss && (type === 'error' || type === 'danger')) {
      setTimeout(() => {
        const alertElement = document.getElementById(alertId);
        if (alertElement) {
          const bsAlert = bootstrap.Alert.getInstance(alertElement);
          if (bsAlert) {
            bsAlert.close();
          } else {
            alertElement.remove();
          }
        }
      }, 10000);
    }
  }

  // Mostrar modal de confirmación
  static showConfirm(title, message, onConfirm, onCancel = null) {
    const modalId = 'confirm-modal-' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-danger" id="confirm-btn">Confirmar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);

    // Manejar confirmación
    modal.querySelector('#confirm-btn').addEventListener('click', () => {
      if (onConfirm) onConfirm();
      bsModal.hide();
    });

    // Manejar cancelación
    modal.addEventListener('hidden.bs.modal', () => {
      if (onCancel) onCancel();
      modal.remove();
    });

    bsModal.show();
  }

  // Formatear fecha para input date
  static formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  // Validar formulario
  static validateForm(form) {
    const errors = [];
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        errors.push(`${field.getAttribute('data-label') || field.name} es requerido`);
        field.classList.add('is-invalid');
      } else {
        field.classList.remove('is-invalid');
      }
    });

    // Validaciones específicas
    const emailFields = form.querySelectorAll('input[type="email"]');
    emailFields.forEach(field => {
      if (field.value && !Utils.isValidEmail(field.value)) {
        errors.push('El formato del email no es válido');
        field.classList.add('is-invalid');
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Limpiar validaciones de formulario
  static clearFormValidation(form) {
    const invalidFields = form.querySelectorAll('.is-invalid');
    invalidFields.forEach(field => {
      field.classList.remove('is-invalid');
    });
  }

  // Serializar formulario a objeto
  static serializeForm(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }
    
    return data;
  }

  // Poblar formulario con datos
  static populateForm(form, data) {
    Object.keys(data).forEach(key => {
      const field = form.querySelector(`[name="${key}"]`);
      if (field) {
        if (field.type === 'checkbox') {
          field.checked = Boolean(data[key]);
        } else if (field.type === 'radio') {
          const radio = form.querySelector(`[name="${key}"][value="${data[key]}"]`);
          if (radio) radio.checked = true;
        } else {
          field.value = data[key] || '';
        }
      }
    });
  }

  // Manejar errores de API
  static handleApiError(error, defaultMessage = 'Ha ocurrido un error', showAsAlert = false) {
    console.error('API Error:', error);

    let message = defaultMessage;
    let title = 'Error';

    if (error.message) {
      message = error.message;
    }

    // Si el error incluye saltos de línea (errores de validación del backend), mostrarlo como alerta
    if (message.includes('\n') || message.includes('•') || showAsAlert) {
      // Convertir saltos de línea a HTML
      const htmlMessage = message.replace(/\n/g, '<br>');

      // Determinar si es error de validación
      const isValidationError = message.includes('•') || message.includes('validación');
      title = isValidationError ? 'Errores de Validación' : 'Error';

      this.showAlert(title, 'danger', htmlMessage);
    } else {
      // Para errores simples, mostrar como toast
      this.showToast(message, 'error');
    }
  }

  // Descargar archivo blob
  static downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // Cargar script externo
  static loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Actualizar badge de notificaciones
  static updateNotificationBadge(count) {
    // Badge en el navbar
    const navbarBadges = document.querySelectorAll('.notification-badge');
    navbarBadges.forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    });

    // Badge en el sidebar (si existe)
    const sidebarBadges = document.querySelectorAll('.sidebar .notification-count');
    sidebarBadges.forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    });

    console.log(`🔔 Badge actualizado: ${count} notificaciones no leídas`);
  }

  // Crear DataTable con configuración por defecto
  static createDataTable(selector, options = {}) {
    const defaultOptions = {
      ...CONFIG.DATATABLE_CONFIG,
      ...options
    };
    
    return $(selector).DataTable(defaultOptions);
  }

  // Formatear números grandes
  static formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Obtener diferencia de días
  static getDaysDifference(date1, date2 = new Date()) {
    const diffTime = Math.abs(new Date(date2) - new Date(date1));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Verificar si el usuario está autenticado
  static isAuthenticated() {
    return !!localStorage.getItem('token');
  }

  // Obtener token de autenticación
  static getToken() {
    return localStorage.getItem('token');
  }

  // Obtener usuario actual
  static getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Verificar permisos
  static hasPermission(requiredRoles) {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.includes(user.role);
    }
    
    return user.role === requiredRoles;
  }

  // Redirigir según rol
  static redirectByRole() {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const currentPath = window.location.pathname;

    // Si ya está en la página correcta, no redirigir
    if (currentPath.includes('dashboard.html')) return;

    // Redirigir al dashboard
    window.location.href = 'dashboard.html';
  }

  // Manejar navegación del sidebar
  static handleSidebarNavigation() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && currentPath.includes(href.split('/').pop())) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Inicializar tooltips
  static initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // Crear paginación
  static createPagination(container, currentPage, totalPages, onPageChange) {
    const pagination = document.createElement('nav');
    pagination.innerHTML = `
      <ul class="pagination justify-content-center">
        <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
          <a class="page-link" href="#" data-page="${currentPage - 1}">Anterior</a>
        </li>
        ${this.generatePageNumbers(currentPage, totalPages)}
        <li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
          <a class="page-link" href="#" data-page="${currentPage + 1}">Siguiente</a>
        </li>
      </ul>
    `;

    // Manejar clicks de paginación
    pagination.addEventListener('click', (e) => {
      e.preventDefault();
      if (e.target.classList.contains('page-link')) {
        const page = parseInt(e.target.getAttribute('data-page'));
        if (page && page !== currentPage && onPageChange) {
          onPageChange(page);
        }
      }
    });

    container.innerHTML = '';
    container.appendChild(pagination);
  }

  // Generar números de página
  static generatePageNumbers(currentPage, totalPages) {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(`
        <li class="page-item ${i === currentPage ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `);
    }

    return pages.join('');
  }

  // Formatear fecha
  static formatDate(date, format = CONFIG.FORMATS.DATE) {
    if (!date) return '';

    // Convertir a objeto Date manejando diferentes formatos
    let d;
    if (typeof date === 'string') {
      // Si la fecha no tiene 'Z' al final y es formato SQL, asumirla como UTC
      if (!date.endsWith('Z') && !date.includes('+') && date.includes(' ') && !date.includes('T')) {
        // Formato SQL: "YYYY-MM-DD HH:MM:SS" -> convertir a ISO con Z
        d = new Date(date.replace(' ', 'T') + 'Z');
      } else if (!date.endsWith('Z') && !date.includes('+') && !date.includes('T')) {
        // Solo fecha sin hora: "YYYY-MM-DD"
        d = new Date(date + 'T00:00:00Z');
      } else {
        d = new Date(date);
      }
    } else {
      d = new Date(date);
    }

    // Verificar si la fecha es válida
    if (isNaN(d.getTime())) {
      console.error('Fecha inválida:', date);
      return '';
    }

    if (format === 'DD/MM/YYYY') {
      return d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
    if (format === 'DD/MM/YYYY HH:mm') {
      return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
    return d.toISOString().split('T')[0];
  }

  // Formatear hora
  static formatTime(date) {
    if (!date) return '';

    // Convertir a objeto Date manejando diferentes formatos
    let d;
    if (typeof date === 'string') {
      // Si la fecha no tiene 'Z' al final y es formato SQL, asumirla como UTC
      if (!date.endsWith('Z') && !date.includes('+') && date.includes(' ') && !date.includes('T')) {
        // Formato SQL: "YYYY-MM-DD HH:MM:SS" -> convertir a ISO con Z
        d = new Date(date.replace(' ', 'T') + 'Z');
      } else {
        d = new Date(date);
      }
    } else {
      d = new Date(date);
    }

    // Verificar si la fecha es válida
    if (isNaN(d.getTime())) {
      return '';
    }

    return d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // Formatear moneda
  static formatCurrency(amount) {
    if (!amount && amount !== 0) return '$0.00';
    return new Intl.NumberFormat(CONFIG.FORMATS.CURRENCY, {
      style: 'currency',
      currency: CONFIG.FORMATS.CURRENCY_CODE
    }).format(amount);
  }

  // Capitalizar texto
  static capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  // Truncar texto
  static truncate(text, length = 50) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  // Parsear fecha SQL (YYYY-MM-DD) a objeto Date SIN conversión UTC
  static parseLocalDate(dateStr) {
    if (!dateStr) return null;
    // Si es string en formato YYYY-MM-DD, parsear como fecha local
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  }

  // Obtener badge de estatus
  static getStatusBadge(status) {
    const color = CONFIG.ESTATUS_COLORS[status] || 'secondary';
    const text = CONFIG.ESTATUS[status] || status;
    return `<span class="badge bg-${color}">${text}</span>`;
  }

  // Obtener badge de prioridad
  static getPriorityBadge(priority) {
    const colors = {
      critica: 'danger',
      urgente: 'warning',
      normal: 'success'
    };
    const color = colors[priority] || 'secondary';
    return `<span class="badge bg-${color}">${this.capitalize(priority)}</span>`;
  }

  // Obtener badge de estatus para órdenes de compra
  static getOrderStatusBadge(status) {
    const colors = {
      emitida: 'primary',      // Azul - recién creada
      en_transito: 'warning',  // Amarillo - en camino
      recibida: 'success',     // Verde - entregada
      cancelada: 'danger'      // Rojo - cancelada
    };
    const labels = {
      emitida: 'Emitida',
      en_transito: 'En Tránsito',
      recibida: 'Recibida',
      cancelada: 'Cancelada'
    };
    const color = colors[status] || 'secondary';
    const text = labels[status] || status;
    return `<span class="badge bg-${color}">${text}</span>`;
  }

  // Validar email
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Generar ID único
  static generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Obtener parámetros de URL
  static getUrlParams() {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }
    return params;
  }
}

// Función para cargar componentes de manera consistente
window.loadComponents = async function() {
    try {
        // Cargar ambos componentes en paralelo con versión para cache-busting
        const version = '20251118v4';
        const [navbarResponse, sidebarResponse] = await Promise.all([
            fetch(`../components/navbar.html?v=${version}`),
            fetch(`../components/sidebar.html?v=${version}`)
        ]);

        if (navbarResponse.ok && sidebarResponse.ok) {
            const [navbarHtml, sidebarHtml] = await Promise.all([
                navbarResponse.text(),
                sidebarResponse.text()
            ]);

            // Usar requestAnimationFrame para renderizado suave y prevenir flash
            requestAnimationFrame(() => {
                const navbarContainer = document.getElementById('navbar-container');
                if (navbarContainer && !navbarContainer.hasChildNodes()) {
                    navbarContainer.innerHTML = navbarHtml;
                }

                const sidebarContainer = document.getElementById('sidebar-container');
                if (sidebarContainer && !sidebarContainer.hasChildNodes()) {
                    sidebarContainer.innerHTML = sidebarHtml;
                }

                // Configurar elementos después de cargar
                setupComponentsAfterLoad();
            });
        }

    } catch (error) {
        console.error('Error cargando componentes:', error);
    }
};

window.setupComponentsAfterLoad = function() {
    // Configurar información del usuario
    const user = Utils.getCurrentUser();
    if (user) {
        // Actualizar elementos del usuario
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = user.name || 'Usuario';
        });
        document.querySelectorAll('.user-role').forEach(el => {
            el.textContent = CONFIG.ROLES[user.role] || user.role;
        });
        document.querySelectorAll('.user-area').forEach(el => {
            el.textContent = user.area || 'Sin área';
        });
        
        // Manejar visibilidad por roles
        handleRoleVisibility(user.role);
    }
    
    // Configurar logout
    setupLogoutButtons();

    // Inicializar formulario de cambio de contraseña
    initPasswordChangeForm();

    // Marcar página activa
    markActiveNavigation();

    // Cargar notificaciones
    loadNotificationCount();
};

window.handleRoleVisibility = function(userRole) {
    const roleElements = {
        'purchaser-only': ['purchaser', 'admin'],
        'director-only': ['director', 'admin'], 
        'admin-only': ['admin']
    };
    
    Object.keys(roleElements).forEach(className => {
        const elements = document.querySelectorAll(`.${className}`);
        elements.forEach(el => {
            if (roleElements[className].includes(userRole)) {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });
    });
};

window.setupLogoutButtons = function() {
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('¿Cerrar sesión?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        });
    });
};

window.markActiveNavigation = function() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        }
    });
};

window.loadNotificationCount = async function() {
    try {
        if (typeof api !== 'undefined') {
            const response = await api.getUnreadCount();
            if (response.success && response.data.count > 0) {
                document.querySelectorAll('.notification-count, .notification-badge').forEach(el => {
                    el.textContent = response.data.count;
                    el.style.display = 'inline';
                });
            }
        }
    } catch (error) {
        // Silenciar errores de notificaciones
    }
};

// Hacer Utils disponible globalmente
window.Utils = Utils;

// Función global para mostrar/ocultar contraseñas (usada en navbar)
window.togglePasswordVisibility = function(fieldId) {
    const field = document.getElementById(fieldId);
    const icon = document.getElementById(fieldId + '-icon');

    if (field && icon) {
        if (field.type === 'password') {
            field.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            field.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
};

// Función para inicializar el formulario de cambio de contraseña
function initPasswordChangeForm() {
    const changePasswordForm = document.getElementById('changePasswordForm');
    const submitBtn = document.getElementById('changePasswordSubmitBtn');

    if (changePasswordForm && submitBtn) {
        changePasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Validar que las contraseñas nuevas coincidan
            if (newPassword !== confirmPassword) {
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast('Las contraseñas no coinciden', 'error');
                } else {
                    alert('Las contraseñas no coinciden');
                }
                return;
            }

            // Validar longitud mínima
            if (newPassword.length < 6) {
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast('La contraseña debe tener al menos 6 caracteres', 'error');
                } else {
                    alert('La contraseña debe tener al menos 6 caracteres');
                }
                return;
            }

            // Deshabilitar botón mientras procesa
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cambiando...';

            try {
                console.log('Intentando cambiar contraseña...');

                // Verificar que api esté disponible
                if (typeof api === 'undefined') {
                    console.error('API no disponible');
                    throw new Error('Error de configuración. Recarga la página.');
                }

                // Usar la clase API global que ya maneja los headers correctamente
                const response = await api.changePassword(currentPassword, newPassword);
                console.log('Respuesta completa del servidor:', response);

                // CRÍTICO: Verificar explícitamente el éxito
                if (response && response.success === true) {
                    // Mostrar mensaje de éxito
                    if (typeof Utils !== 'undefined' && Utils.showToast) {
                        Utils.showToast('¡Contraseña cambiada exitosamente!', 'success');
                    } else {
                        alert('¡Contraseña cambiada exitosamente!');
                    }

                    // Limpiar formulario
                    changePasswordForm.reset();

                    // Cerrar modal
                    const modalElement = document.getElementById('changePasswordModal');
                    if (modalElement && typeof bootstrap !== 'undefined') {
                        const modal = bootstrap.Modal.getInstance(modalElement);
                        if (modal) {
                            modal.hide();
                        }
                    }
                } else {
                    // MOSTRAR ERROR - NO cerrar modal
                    const errorMsg = response?.error || response?.message || 'Error al cambiar la contraseña';
                    console.error('❌ Error del servidor:', errorMsg);

                    if (typeof Utils !== 'undefined' && Utils.showToast) {
                        Utils.showToast(errorMsg, 'danger');
                    } else {
                        alert('Error: ' + errorMsg);
                    }

                    // NO cerrar el modal para que el usuario pueda corregir
                }

            } catch (error) {
                console.error('❌ Excepción cambiando contraseña:', error);
                const errorMsg = error.message || 'Error al cambiar la contraseña. Verifica tu conexión.';

                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast(errorMsg, 'danger');
                } else {
                    alert('Error: ' + errorMsg);
                }

                // NO cerrar el modal
            } finally {
                // Re-habilitar botón SIEMPRE
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Cambiar Contraseña';
            }
        });
    }
}

// Funciones globales para cargar navbar y sidebar
async function loadNavbar() {
  try {
    const version = '20251118v4';
    const response = await fetch(`../components/navbar.html?v=${version}`);
    const html = await response.text();
    const container = document.getElementById('navbar-container');
    if (container) {
      container.innerHTML = html;

      // Inicializar manejador del formulario de cambio de contraseña
      initPasswordChangeForm();
    }
  } catch (error) {
    console.error('Error cargando navbar:', error);
  }
}

async function loadSidebar() {
  try {
    const version = '20251118v4';
    const response = await fetch(`../components/sidebar.html?v=${version}`);
    const html = await response.text();
    const container = document.getElementById('sidebar-container');
    if (container) {
      container.innerHTML = html;
    }

    // Actualizar información del usuario
    const user = Utils.getCurrentUser();
    if (user) {
      // Actualizar nombre de usuario
      const userNameElements = document.querySelectorAll('.user-name');
      userNameElements.forEach(el => {
        el.textContent = user.name || 'Usuario';
      });

      // Actualizar rol
      const userRoleElements = document.querySelectorAll('.user-role');
      userRoleElements.forEach(el => {
        const roleName = CONFIG.ROLES ? CONFIG.ROLES[user.role] : user.role;
        el.textContent = roleName || user.role;
      });

      // Actualizar área
      const userAreaElements = document.querySelectorAll('.user-area');
      userAreaElements.forEach(el => {
        el.textContent = user.area || '';
      });

      // Manejar permisos del sidebar
      handleSidebarPermissions(user.role);

      // Activar link correcto
      activateSidebarLink();

      // Configurar botones de logout
      setupLogoutButtons();

      // Inicializar notificaciones
      try {
        const response = await api.getUnreadCount();
        if (response.success) {
          Utils.updateNotificationBadge(response.data.count);
        }
      } catch (error) {
        console.error('Error cargando notificaciones:', error);
      }

      // Iniciar polling de notificaciones
      if (typeof Utils !== 'undefined' && Utils.initNotificationPolling) {
        Utils.initNotificationPolling();
      }

      // Cargar indicador de presupuesto para todos
      try {
        const budgetResponse = await api.get('/budgets/my');
        if (budgetResponse.success && budgetResponse.data) {
          const budget = budgetResponse.data;
          const budgetNav = document.querySelector('.budget-indicator-nav');
          if (budgetNav && budget.total_amount > 0) {
            budgetNav.style.display = 'block';
            const percentage = budget.percentage_used || 0;
            const percentageEl = document.querySelector('.budget-percentage');
            const widget = document.querySelector('.budget-widget');

            if (percentageEl) {
              percentageEl.textContent = `${percentage.toFixed(1)}%`;
            }

            if (widget) {
              widget.classList.remove('budget-success', 'budget-warning', 'budget-danger');
              if (percentage >= 90) {
                widget.classList.add('budget-danger');
              } else if (percentage >= 75) {
                widget.classList.add('budget-warning');
              } else {
                widget.classList.add('budget-success');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error cargando presupuesto:', error);
      }
    }
  } catch (error) {
    console.error('Error cargando sidebar:', error);
  }
}

// Activar link correcto en el sidebar
function activateSidebarLink() {
  const currentPage = window.location.pathname.split('/').pop();
  const sidebarLinks = document.querySelectorAll('.sidebar .nav-link');

  sidebarLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Configurar botones de logout
function setupLogoutButtons() {
  const logoutButtons = document.querySelectorAll('.logout-btn');
  console.log('Configurando', logoutButtons.length, 'botones de logout');

  logoutButtons.forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (confirm('¿Está seguro de que desea cerrar sesión?')) {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = 'login.html';
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
        }
      }
    });
  });
}

// Manejar permisos del sidebar
function handleSidebarPermissions(userRole) {
  console.log('🔒 Aplicando permisos del sidebar para rol:', userRole);

  const adminElements = document.querySelectorAll('.admin-only');
  const purchaserElements = document.querySelectorAll('.purchaser-only');
  const directorElements = document.querySelectorAll('.director-only');
  const reportsElements = document.querySelectorAll('.reports-access');

  console.log('📊 Elementos encontrados:', {
    admin: adminElements.length,
    purchaser: purchaserElements.length,
    director: directorElements.length,
    reports: reportsElements.length
  });

  // Ocultar TODO primero
  adminElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
  purchaserElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
  directorElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
  reportsElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });

  // Mostrar solo lo permitido
  if (userRole === 'admin') {
    adminElements.forEach(el => { el.style.display = 'block'; el.classList.remove('hidden'); });
    purchaserElements.forEach(el => { el.style.display = 'block'; el.classList.remove('hidden'); });
    directorElements.forEach(el => { el.style.display = 'block'; el.classList.remove('hidden'); });
    reportsElements.forEach(el => { el.style.display = 'block'; el.classList.remove('hidden'); });
    console.log('✅ Admin: acceso total');
  } else if (userRole === 'purchaser') {
    purchaserElements.forEach(el => { el.style.display = 'block'; el.classList.remove('hidden'); });
    reportsElements.forEach(el => { el.style.display = 'block'; el.classList.remove('hidden'); });
    console.log('✅ Purchaser: solo compras y reportes');
  } else if (userRole === 'director') {
    directorElements.forEach(el => { el.style.display = 'block'; el.classList.remove('hidden'); });
    reportsElements.forEach(el => { el.style.display = 'block'; el.classList.remove('hidden'); });
    console.log('✅ Director: solo aprobaciones y reportes');
  } else {
    console.log('✅ Requester: solo solicitudes (todo oculto)');
  }
}

// Función global de notificación simple
function showNotification(message, type = 'info') {
  if (typeof Utils !== 'undefined' && Utils.showToast) {
    Utils.showToast(message, type);
  } else {
    // Fallback si Utils no está disponible
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

// Hacer funciones globales disponibles
window.loadNavbar = loadNavbar;
window.loadSidebar = loadSidebar;
window.showNotification = showNotification;

// Función para verificar autenticación
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (!token || !user) {
    console.warn('Usuario no autenticado, redirigiendo al login...');
    window.location.href = 'login.html';
    return false;
  }

  return true;
}

// Hacer checkAuth disponible globalmente
window.checkAuth = checkAuth;

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
  // Si existe Utils.showToast, usarla
  if (typeof Utils !== 'undefined' && Utils.showToast) {
    Utils.showToast(message, type);
    return;
  }

  // Fallback simple
  const bgColor = {
    'success': '#198754',
    'error': '#dc3545',
    'warning': '#ffc107',
    'info': '#17a2b8'
  }[type] || '#17a2b8';

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Hacer showNotification disponible globalmente
window.showNotification = showNotification;
