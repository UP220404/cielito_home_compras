// Manejo de autenticación y sesiones

class AuthManager {
  constructor() {
    // NO ejecutar checkAuthOnLoad automáticamente
    // Esto causaba redirecciones no deseadas
  }

  // Verificar autenticación al cargar la página (llamar manualmente si es necesario)
  checkAuthOnLoad() {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login.html');
    const isIndexPage = currentPath.includes('index.html') || currentPath.endsWith('/');
    const isAuthenticated = Utils.isAuthenticated();

    // Si es index o login, no hacer nada
    if (isLoginPage || isIndexPage) {
      return;
    }

    // Si no está autenticado y no es login/index, redirigir al login
    if (!isAuthenticated) {
      this.redirectToLogin();
    } else {
      this.initAuthenticatedPage();
    }
  }

  // Inicializar página autenticada
  initAuthenticatedPage() {
    this.loadUserInfo();
    this.setupLogoutHandlers();
    this.loadNotificationCount();
    Utils.handleSidebarNavigation();
  }

  // Cargar información del usuario en la interfaz
  loadUserInfo() {
    const user = Utils.getCurrentUser();
    if (!user) return;

    // Actualizar elementos de usuario en la página
    const userNameElements = document.querySelectorAll('.user-name');
    const userRoleElements = document.querySelectorAll('.user-role');
    const userAreaElements = document.querySelectorAll('.user-area');

    userNameElements.forEach(el => el.textContent = user.name);
    userRoleElements.forEach(el => el.textContent = CONFIG.ROLES[user.role] || user.role);
    userAreaElements.forEach(el => el.textContent = user.area);

    // Ocultar elementos según permisos
    this.handleRoleBasedVisibility(user.role);
  }

  // Manejar visibilidad basada en roles
  handleRoleBasedVisibility(userRole) {
    // Elementos que requieren roles específicos
    const adminElements = document.querySelectorAll('.admin-only');
    const purchaserElements = document.querySelectorAll('.purchaser-only');
    const directorElements = document.querySelectorAll('.director-only');

    // Mostrar/ocultar elementos de admin
    adminElements.forEach(el => {
      el.style.display = userRole === 'admin' ? 'block' : 'none';
    });

    // Mostrar/ocultar elementos de compras
    purchaserElements.forEach(el => {
      el.style.display = ['purchaser', 'admin'].includes(userRole) ? 'block' : 'none';
    });

    // Mostrar/ocultar elementos de director
    directorElements.forEach(el => {
      el.style.display = ['director', 'admin'].includes(userRole) ? 'block' : 'none';
    });
  }

  // Configurar manejadores de logout
  setupLogoutHandlers() {
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    });
  }

  // Cargar contador de notificaciones
  async loadNotificationCount() {
    try {
      const response = await api.getUnreadCount();
      if (response.success) {
        Utils.updateNotificationBadge(response.data.count);
      }
    } catch (error) {
      console.error('Error cargando contador de notificaciones:', error);
    }
  }

  // Realizar login
  async login(email, password) {
    try {
      Utils.showSpinner(document.body, 'Iniciando sesión...');
      
      const response = await api.login(email, password);
      
      if (response.success) {
        Utils.showToast('¡Bienvenido! Sesión iniciada correctamente', 'success');
        
        // Pequeño delay para mostrar el mensaje
        setTimeout(() => {
          this.redirectToDashboard();
        }, 1000);
      }
      
      return response;
    } catch (error) {
      Utils.handleApiError(error, 'Error al iniciar sesión');
      throw error;
    } finally {
      Utils.hideSpinner();
    }
  }

  // Cerrar sesión
  async logout() {
    try {
      Utils.showSpinner(document.body, 'Cerrando sesión...');
      
      // Intentar notificar al servidor
      try {
        await api.logout();
      } catch (error) {
        console.warn('Error notificando logout al servidor:', error);
      }

      // Limpiar datos locales
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      Utils.showToast('Sesión cerrada correctamente', 'info');
      
      setTimeout(() => {
        this.redirectToLogin();
      }, 1000);
      
    } catch (error) {
      console.error('Error durante logout:', error);
      // Aún así redirigir al login
      this.redirectToLogin();
    } finally {
      Utils.hideSpinner();
    }
  }

  // Cambiar contraseña
  async changePassword(currentPassword, newPassword, confirmPassword) {
    try {
      // Validaciones
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error('Todos los campos son requeridos');
      }

      if (newPassword !== confirmPassword) {
        throw new Error('Las contraseñas nuevas no coinciden');
      }

      if (newPassword.length < CONFIG.VALIDATION.MIN_PASSWORD_LENGTH) {
        throw new Error(`La contraseña debe tener al menos ${CONFIG.VALIDATION.MIN_PASSWORD_LENGTH} caracteres`);
      }

      Utils.showSpinner(document.body, 'Cambiando contraseña...');

      const response = await api.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        Utils.showToast('Contraseña cambiada exitosamente', 'success');
        return true;
      }
      
    } catch (error) {
      Utils.handleApiError(error, 'Error al cambiar la contraseña');
      return false;
    } finally {
      Utils.hideSpinner();
    }
  }

  // Redirigir al login
  redirectToLogin() {
    // Determinar si estamos en /pages o en raíz
    const currentPath = window.location.pathname;
    if (currentPath.includes('/pages/')) {
      window.location.href = 'login.html';
    } else {
      window.location.href = 'pages/login.html';
    }
  }

  // Redirigir al dashboard
  redirectToDashboard() {
    // Determinar si estamos en /pages o en raíz
    const currentPath = window.location.pathname;
    if (currentPath.includes('/pages/')) {
      window.location.href = 'dashboard.html';
    } else {
      window.location.href = 'pages/dashboard.html';
    }
  }

  // Verificar si el token está próximo a expirar
  isTokenExpiringSoon() {
    const token = localStorage.getItem('token');
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;
      
      // Considerar que expira pronto si quedan menos de 5 minutos
      return timeUntilExpiration < 5 * 60 * 1000;
    } catch (error) {
      console.error('Error decodificando token:', error);
      return true;
    }
  }

  // Renovar sesión (placeholder para implementación futura)
  async renewSession() {
    // Esta funcionalidad se puede implementar si el backend soporta refresh tokens
    console.log('Renovando sesión...');
  }

  // Configurar verificación periódica de sesión
  setupSessionCheck() {
    setInterval(() => {
      if (!Utils.isAuthenticated()) {
        this.redirectToLogin();
        return;
      }

      if (this.isTokenExpiringSoon()) {
        Utils.showToast('Tu sesión expirará pronto. Guarda tu trabajo.', 'warning');
      }
    }, 60000); // Verificar cada minuto
  }
}

// Inicializar gestor de autenticación (SIN checkAuthOnLoad automático)
const authManager = new AuthManager();

// Solo ejecutar checkAuthOnLoad en páginas que NO sean login o index
window.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  const isLoginPage = currentPath.includes('login.html');
  const isIndexPage = currentPath.includes('index.html') || currentPath.endsWith('/');

  if (!isLoginPage && !isIndexPage) {
    authManager.checkAuthOnLoad();
  }

  // Configurar verificación de sesión si está autenticado
  if (Utils.isAuthenticated()) {
    authManager.setupSessionCheck();
  }
});

// Hacer disponible globalmente
window.AuthManager = AuthManager;
window.authManager = authManager;

// FIX ADICIONAL: Configurar logout después de cargar componentes
setTimeout(() => {
  const logoutButtons = document.querySelectorAll('.logout-btn');
  console.log(`Configurando ${logoutButtons.length} botones de logout`);

  logoutButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (confirm('¿Cerrar sesión?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
      }
    });
  });
}, 2000); // Esperar 2 segundos para que los componentes se carguen
