/**
 * Script de inicialización global
 * Se ejecuta automáticamente al cargar cualquier página
 */

// Función global para cargar componentes (navbar + sidebar)
async function loadComponents() {
    try {
        // Cargar ambos componentes en paralelo
        const [navbarResponse, sidebarResponse] = await Promise.all([
            fetch('../components/navbar.html'),
            fetch('../components/sidebar.html')
        ]);

        const [navbarHtml, sidebarHtml] = await Promise.all([
            navbarResponse.text(),
            sidebarResponse.text()
        ]);

        // Usar requestAnimationFrame para renderizado suave
        requestAnimationFrame(() => {
            const navbarContainer = document.getElementById('navbar-container');
            if (navbarContainer && !navbarContainer.hasChildNodes()) {
                navbarContainer.innerHTML = navbarHtml;
            }

            const sidebarContainer = document.getElementById('sidebar-container');
            if (sidebarContainer && !sidebarContainer.hasChildNodes()) {
                sidebarContainer.innerHTML = sidebarHtml;
            }

            // Actualizar información del usuario después de cargar componentes
            updateUserInfo();

            // Activar el link correcto en el sidebar
            activateSidebarLink();

            // Configurar botones de logout
            setupLogoutButtons();

            // Manejar permisos del sidebar
            handleSidebarPermissions();
        });

        // Cargar script de notificaciones si no está disponible
        await loadNotificationsScript();

    } catch (error) {
        console.error('Error cargando componentes:', error);
    }
}

// Cargar script de notificaciones dinámicamente
async function loadNotificationsScript() {
    // Si ya existe NotificationManager, no hacer nada
    if (typeof NotificationManager !== 'undefined') {
        console.log('✅ NotificationManager ya disponible');
        initializeNotifications();
        return;
    }

    console.log('📦 Cargando script de notificaciones...');

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '../js/notifications.js';
        script.onload = () => {
            console.log('✅ Script de notificaciones cargado');
            initializeNotifications();
            resolve();
        };
        script.onerror = () => {
            console.error('❌ Error cargando script de notificaciones');
            reject();
        };
        document.head.appendChild(script);
    });
}

// Inicializar sistema de notificaciones
function initializeNotifications() {
    if (typeof NotificationManager === 'undefined') {
        console.warn('⚠️ NotificationManager no está disponible aún');
        return;
    }

    // Si ya existe una instancia, no crear otra
    if (window.notificationManager) {
        console.log('✅ Sistema de notificaciones ya está inicializado');
        return;
    }

    // Crear nueva instancia
    window.notificationManager = new NotificationManager();
    console.log('✅ Sistema de notificaciones inicializado');
}

// Actualizar información del usuario en el navbar
function updateUserInfo() {
    const user = Utils.getCurrentUser();

    if (!user) {
        console.warn('⚠️ No hay usuario en localStorage');
        return;
    }

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
}

// Activar el link correcto en el sidebar según la página actual
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

    logoutButtons.forEach(btn => {
        // Remover listeners previos
        btn.replaceWith(btn.cloneNode(true));
    });

    // Volver a obtener los botones después de clonarlos
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (confirm('¿Está seguro de que desea cerrar sesión?')) {
                try {
                    // Limpiar localStorage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');

                    // Redirigir al login
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Error al cerrar sesión:', error);
                }
            }
        });
    });
}

// Manejar permisos en el sidebar
function handleSidebarPermissions() {
    const user = Utils.getCurrentUser();
    if (!user) {
        console.warn('⚠️ handleSidebarPermissions: No hay usuario');
        return;
    }

    const userRole = user.role;
    console.log('🔒 Configurando permisos del sidebar para rol:', userRole);

    // Elementos que requieren roles específicos
    const adminElements = document.querySelectorAll('.admin-only');
    const purchaserElements = document.querySelectorAll('.purchaser-only');
    const directorElements = document.querySelectorAll('.director-only');
    const reportsElements = document.querySelectorAll('.reports-access');

    console.log(`📋 Elementos encontrados: admin=${adminElements.length}, purchaser=${purchaserElements.length}, director=${directorElements.length}, reports=${reportsElements.length}`);

    // ADMIN: Ve TODO
    if (userRole === 'admin') {
        adminElements.forEach(el => {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
        });
        purchaserElements.forEach(el => {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
        });
        directorElements.forEach(el => {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
        });
        reportsElements.forEach(el => {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
        });
        console.log('✅ Admin: acceso total concedido');
        return;
    }

    // PURCHASER: Ve compras y reportes, NO usuarios ni aprobaciones
    if (userRole === 'purchaser') {
        adminElements.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
            el.setAttribute('hidden', 'true');
            el.remove(); // Remover completamente del DOM
        });
        purchaserElements.forEach(el => {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
            el.removeAttribute('hidden');
        });
        directorElements.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
            el.setAttribute('hidden', 'true');
            el.remove(); // Remover completamente del DOM
        });
        reportsElements.forEach(el => {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
            el.removeAttribute('hidden');
        });
        console.log('✅ Purchaser: acceso a compras y reportes');
        console.log(`   ❌ Eliminados ${adminElements.length + directorElements.length} elementos de admin/director`);
        return;
    }

    // DIRECTOR: Ve aprobaciones, análisis y reportes, NO compras ni usuarios
    if (userRole === 'director') {
        adminElements.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
            el.setAttribute('hidden', 'true');
            el.remove();
        });
        purchaserElements.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
            el.setAttribute('hidden', 'true');
            el.remove();
        });
        directorElements.forEach(el => {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
            el.removeAttribute('hidden');
        });
        reportsElements.forEach(el => {
            el.style.removeProperty('display');
            el.classList.remove('d-none');
            el.removeAttribute('hidden');
        });
        console.log('✅ Director: acceso a aprobaciones, análisis y reportes');
        console.log(`   ❌ Eliminados ${adminElements.length + purchaserElements.length} elementos`);
        return;
    }

    // REQUESTER: Solo dashboard, solicitudes y notificaciones
    if (userRole === 'requester') {
        adminElements.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
            el.setAttribute('hidden', 'true');
            el.remove();
        });
        purchaserElements.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
            el.setAttribute('hidden', 'true');
            el.remove();
        });
        directorElements.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
            el.setAttribute('hidden', 'true');
            el.remove();
        });
        reportsElements.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('d-none');
            el.setAttribute('hidden', 'true');
            el.remove();
        });
        console.log('✅ Requester: acceso básico (solo solicitudes)');
        console.log(`   ❌ Eliminados ${adminElements.length + purchaserElements.length + directorElements.length + reportsElements.length} elementos`);
        return;
    }
}

// Hacer la función global disponible
window.loadComponents = loadComponents;
window.updateUserInfo = updateUserInfo;
