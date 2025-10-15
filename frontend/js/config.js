const CONFIG = {
  API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : 'https://tu-backend.onrender.com/api',
  
  AREAS: [
    'Dirección General',
    'Sistemas',
    'Marketing',
    'Jurídico',
    'Atención a clientes',
    'Logística',
    'Operaciones',
    'Mantenimiento',
    'Servicio Médico',
    'Compras'
  ],
  
  URGENCIAS: ['baja', 'media', 'alta'],
  PRIORIDADES: ['normal', 'urgente', 'critica'],
  
  ESTATUS: {
    pendiente: 'Pendiente',
    cotizando: 'En Cotización',
    autorizada: 'Autorizada',
    rechazada: 'Rechazada',
    comprada: 'Comprada',
    entregada: 'Entregada', 
    cancelada: 'Cancelada'
  },
  
  ESTATUS_COLORS: {
    pendiente: 'warning',
    cotizando: 'info',
    autorizada: 'success',
    rechazada: 'danger',
    comprada: 'primary',
    entregada: 'success',
    cancelada: 'secondary'
  },

  ESTATUS_ORDERS: {
    emitida: 'Emitida',
    en_transito: 'En Tránsito',
    recibida: 'Recibida',
    cancelada: 'Cancelada'
  },

  ROLES: {
    requester: 'Solicitante',
    purchaser: 'Compras',
    director: 'Director',
    admin: 'Administrador'
  },

  CHART_COLORS: {
    primary: '#28a745',
    success: '#198754',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    secondary: '#6c757d',
    light: '#f8f9fa',
    dark: '#343a40',
    cielitoGreen: '#28a745',
    cielitoForest: '#155724',
    cielitoDark: '#1e7e34'
  },

  PAGINATION: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  },

  VALIDATION: {
    MIN_PASSWORD_LENGTH: 6,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['application/pdf', 'image/jpeg', 'image/png']
  },

  NOTIFICATIONS: {
    AUTO_HIDE_DELAY: 5000,
    MAX_NOTIFICATIONS: 50
  },

  // Configuraciones de formato
  FORMATS: {
    DATE: 'DD/MM/YYYY',
    DATETIME: 'DD/MM/YYYY HH:mm',
    CURRENCY: 'es-MX',
    CURRENCY_CODE: 'MXN'
  },

  // Mensajes del sistema
  MESSAGES: {
    LOADING: 'Cargando...',
    SAVING: 'Guardando...',
    DELETING: 'Eliminando...',
    SUCCESS: 'Operación exitosa',
    ERROR: 'Ha ocurrido un error',
    CONFIRM_DELETE: '¿Estás seguro de que deseas eliminar este elemento?',
    NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.',
    UNAUTHORIZED: 'No tienes permisos para realizar esta acción',
    SESSION_EXPIRED: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente'
  },

  // Configuraciones de la tabla
  DATATABLE_CONFIG: {
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json'
    },
    pageLength: 10,
    lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
    order: [[0, 'desc']],
    responsive: true,
    autoWidth: false,
    processing: true,
    dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
         '<"row"<"col-sm-12"tr>>' +
         '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>'
  },

  // Configuración de Chart.js
  CHART_CONFIG: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0,0,0,0.1)'
        }
      },
      x: {
        grid: {
          color: 'rgba(0,0,0,0.1)'
        }
      }
    }
  }
};

// Funciones de utilidad global
window.Utils = {
  // Formatear fecha
  formatDate(date, format = CONFIG.FORMATS.DATE) {
    if (!date) return '';
    const d = new Date(date);
    if (format === 'DD/MM/YYYY') {
      return d.toLocaleDateString('es-MX');
    }
    if (format === 'DD/MM/YYYY HH:mm') {
      return d.toLocaleString('es-MX');
    }
    return d.toISOString().split('T')[0];
  },

  // Formatear moneda
  formatCurrency(amount) {
    if (!amount && amount !== 0) return '$0.00';
    return new Intl.NumberFormat(CONFIG.FORMATS.CURRENCY, {
      style: 'currency',
      currency: CONFIG.FORMATS.CURRENCY_CODE
    }).format(amount);
  },

  // Capitalizar texto
  capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  },

  // Truncar texto
  truncate(text, length = 50) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  },

  // Obtener badge de estatus
  getStatusBadge(status) {
    const color = CONFIG.ESTATUS_COLORS[status] || 'secondary';
    const text = CONFIG.ESTATUS[status] || status;
    return `<span class="badge bg-${color}">${text}</span>`;
  },

  // Obtener badge de urgencia
  getUrgencyBadge(urgency) {
    const colors = {
      alta: 'danger',
      media: 'warning',
      baja: 'success'
    };
    const color = colors[urgency] || 'secondary';
    return `<span class="badge bg-${color}">${this.capitalize(urgency)}</span>`;
  },

  // Obtener badge de prioridad
  getPriorityBadge(priority) {
    const colors = {
      critica: 'danger',
      urgente: 'warning',
      normal: 'success'
    };
    const color = colors[priority] || 'secondary';
    return `<span class="badge bg-${color}">${this.capitalize(priority)}</span>`;
  },

  // Validar email
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Generar ID único
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  },

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Obtener parámetros de URL
  getUrlParams() {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }
    return params;
  },

  // Validar permisos
  hasPermission(userRole, requiredRoles) {
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.includes(userRole);
    }
    return userRole === requiredRoles;
  }
};

// Exportar configuración para módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}