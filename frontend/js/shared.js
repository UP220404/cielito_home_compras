// Funciones compartidas para todas las páginas

// Variables globales
window.componentsLoaded = false;

// Función universal para cargar componentes
window.loadComponents = async function() {
    if (window.componentsLoaded) return;
    
    try {
        console.log('🔄 Cargando componentes...');
        
        // Cargar navbar
        const navbarResponse = await fetch('../components/navbar.html');
        if (navbarResponse.ok) {
            const navbarHtml = await navbarResponse.text();
            const navbarContainer = document.getElementById('navbar-container');
            if (navbarContainer) {
                navbarContainer.innerHTML = navbarHtml;
                console.log('✅ Navbar cargado');
            }
        }
        
        // Cargar sidebar
        const sidebarResponse = await fetch('../components/sidebar.html');
        if (sidebarResponse.ok) {
            const sidebarHtml = await sidebarResponse.text();
            const sidebarContainer = document.getElementById('sidebar-container');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = sidebarHtml;
                console.log('✅ Sidebar cargado');
            }
        }
        
        // Configurar después de cargar
        setTimeout(() => {
            setupComponents();
        }, 100);
        
        window.componentsLoaded = true;
        console.log('✅ Componentes cargados completamente');
        
    } catch (error) {
        console.error('❌ Error cargando componentes:', error);
    }
};

// Configurar componentes después de cargar
window.setupComponents = function() {
    console.log('🔧 Configurando componentes...');
    
    // 1. Configurar información del usuario
    setupUserInfo();
    
    // 2. Configurar visibilidad por roles
    setupRoleVisibility();
    
    // 3. Configurar navegación activa
    setupActiveNavigation();
    
    // 4. Configurar logout
    setupLogout();
    
    // 5. Cargar notificaciones
    setupNotifications();
    
    console.log('✅ Componentes configurados');
};

// Configurar información del usuario
function setupUserInfo() {
    const user = Utils.getCurrentUser();
    if (!user) return;

    // Actualizar todos los elementos del usuario
    document.querySelectorAll('.user-name').forEach(el => {
        el.textContent = user.name || 'Usuario';
    });
    
    document.querySelectorAll('.user-role').forEach(el => {
        el.textContent = CONFIG.ROLES[user.role] || user.role;
    });
    
    document.querySelectorAll('.user-area').forEach(el => {
        el.textContent = user.area || 'Sin área';
    });
    
    console.log('👤 Información de usuario configurada:', user.name);
}

// Configurar visibilidad por roles (SIN ocultar elementos)
function setupRoleVisibility() {
    const user = Utils.getCurrentUser();
    if (!user) return;

    const userRole = user.role;
    console.log('🔐 Configurando permisos para rol:', userRole);
    
    // Mapeo de roles permitidos por elemento
    const rolePermissions = {
        'purchaser-only': ['purchaser', 'admin'],
        'director-only': ['director', 'admin'],
        'admin-only': ['admin']
    };
    
    // Aplicar visibilidad (MOSTRAR si tiene permiso, ocultar si no)
    Object.keys(rolePermissions).forEach(className => {
        const elements = document.querySelectorAll(`.${className}`);
        const hasPermission = rolePermissions[className].includes(userRole);
        
        elements.forEach(el => {
            if (hasPermission) {
                el.style.display = ''; // Mostrar (usar estilo por defecto)
                el.style.visibility = 'visible';
            } else {
                el.style.display = 'none'; // Ocultar
            }
        });
        
        if (elements.length > 0) {
            console.log(`🔍 Elementos ${className}: ${elements.length} encontrados, ${hasPermission ? 'mostrados' : 'ocultados'}`);
        }
    });
}

// Configurar navegación activa
function setupActiveNavigation() {
    const currentPage = window.location.pathname.split('/').pop();
    
    // Remover todas las clases active
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Agregar active al link actual
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
            console.log('🎯 Página activa marcada:', currentPage);
        }
    });
}

// Configurar logout
function setupLogout() {
    // Remover event listeners anteriores clonando elementos
    document.querySelectorAll('.logout-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (confirm('¿Cerrar sesión?')) {
                console.log('🚪 Cerrando sesión...');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        });
    });
    
    console.log('🚪 Logout configurado');
}

// Configurar notificaciones
async function setupNotifications() {
    try {
        if (typeof api !== 'undefined') {
            const response = await api.getUnreadCount();
            if (response.success && response.data.count > 0) {
                document.querySelectorAll('.notification-count, .notification-badge').forEach(el => {
                    el.textContent = response.data.count;
                    el.style.display = 'inline';
                });
                console.log('🔔 Notificaciones cargadas:', response.data.count);
            }
        }
    } catch (error) {
        // Silenciar errores de notificaciones
        console.log('🔕 Notificaciones no disponibles');
    }
}

// Función para inicializar cualquier página
window.initializePage = async function() {
    console.log('🚀 Inicializando página...');
    
    // Verificar autenticación
    if (!Utils.isAuthenticated()) {
        console.log('❌ No autenticado, redirigiendo...');
        window.location.href = 'login.html';
        return false;
    }
    
    // Cargar componentes
    await loadComponents();
    
    console.log('✅ Página inicializada');
    return true;
};

// Auto-ejecutar para páginas que no sean login
document.addEventListener('DOMContentLoaded', async function() {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login.html');
    const isIndexPage = currentPath.includes('index.html') || currentPath.endsWith('/');
    
    if (!isLoginPage && !isIndexPage) {
        console.log('📄 Auto-inicializando página:', currentPath);
        await initializePage();
    }
});