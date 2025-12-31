// ============================================================
//   SIDEBAR COLAPSABLE - JavaScript
//   Maneja el toggle, pin y mobile menu
// ============================================================

class CollapsibleSidebar {
    constructor() {
        this.sidebar = null;
        this.overlay = null;
        this.toggleBtn = null;
        this.isPinned = false;
        this.isMobile = window.innerWidth < 768;

        this.init();
    }

    init() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.waitForSidebar());
        } else {
            this.waitForSidebar();
        }
    }

    waitForSidebar() {
        // Esperar a que el sidebar se cargue (puede venir de loadComponents)
        const checkSidebar = () => {
            this.sidebar = document.querySelector('.sidebar');
            if (this.sidebar) {
                this.setup();
            } else {
                // Reintentar cada 100ms hasta 3 segundos
                setTimeout(checkSidebar, 100);
            }
        };

        checkSidebar();
    }

    setup() {
        if (!this.sidebar) {
            console.warn('Sidebar not found after waiting');
            return;
        }

        // Crear botón pin para desktop
        this.createPinButton();

        // Crear overlay para mobile
        this.createOverlay();

        // Crear botón toggle mobile
        this.createMobileToggle();

        // Cargar estado guardado
        this.loadPinnedState();

        // Setup event listeners
        this.setupEventListeners();

        // Agregar tooltips a los links
        this.setupTooltips();

        // Marcar link activo
        this.markActiveLink();

        console.log('✅ Sidebar colapsable inicializado');
    }

    createPinButton() {
        const pinBtn = document.createElement('button');
        pinBtn.className = 'sidebar-toggle-pin';
        pinBtn.innerHTML = '<i class="fas fa-thumbtack"></i>';
        pinBtn.title = 'Fijar sidebar';
        pinBtn.setAttribute('aria-label', 'Fijar sidebar');

        this.sidebar.appendChild(pinBtn);
        this.pinBtn = pinBtn;

        pinBtn.addEventListener('click', () => this.togglePin());
    }

    createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        this.overlay = overlay;

        overlay.addEventListener('click', () => this.closeMobileSidebar());
    }

    createMobileToggle() {
        // Buscar navbar
        const navbar = document.querySelector('.navbar .container-fluid');
        if (!navbar) return;

        // Crear botón hamburger
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'sidebar-toggle-mobile';
        toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
        toggleBtn.setAttribute('aria-label', 'Toggle sidebar');

        // Insertar al inicio del navbar (antes del brand)
        const brand = navbar.querySelector('.navbar-brand');
        if (brand) {
            navbar.insertBefore(toggleBtn, brand);
        } else {
            navbar.insertBefore(toggleBtn, navbar.firstChild);
        }

        this.toggleBtn = toggleBtn;

        toggleBtn.addEventListener('click', () => this.toggleMobileSidebar());
    }

    setupEventListeners() {
        // Responsive: detectar cambios de tamaño
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const wasMobile = this.isMobile;
                this.isMobile = window.innerWidth < 768;

                // Si cambió de desktop a mobile o viceversa
                if (wasMobile !== this.isMobile) {
                    if (this.isMobile) {
                        // Cerrar sidebar en mobile
                        this.closeMobileSidebar();
                    } else {
                        // Restaurar estado pinned en desktop
                        this.closeMobileSidebar(); // Cerrar si estaba abierto en mobile
                    }
                }
            }, 250);
        });

        // Cerrar mobile sidebar al navegar
        document.addEventListener('click', (e) => {
            if (this.isMobile && this.sidebar.classList.contains('show')) {
                const clickedLink = e.target.closest('.sidebar .nav-link');
                if (clickedLink) {
                    // Pequeño delay para que se vea la animación
                    setTimeout(() => this.closeMobileSidebar(), 150);
                }
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + B = Toggle pin (solo desktop)
            if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !this.isMobile) {
                e.preventDefault();
                this.togglePin();
            }

            // ESC = Cerrar mobile sidebar
            if (e.key === 'Escape' && this.isMobile && this.sidebar.classList.contains('show')) {
                this.closeMobileSidebar();
            }
        });
    }

    setupTooltips() {
        const links = this.sidebar.querySelectorAll('.nav-link');
        links.forEach(link => {
            // Extraer el texto del link (sin el icono)
            const textNode = Array.from(link.childNodes).find(
                node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
            );

            if (textNode) {
                const text = textNode.textContent.trim();
                link.setAttribute('data-tooltip', text);
            }
        });
    }

    markActiveLink() {
        const currentPath = window.location.pathname;
        const links = this.sidebar.querySelectorAll('.nav-link');

        links.forEach(link => {
            const linkPath = new URL(link.href, window.location.origin).pathname;

            if (currentPath === linkPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    togglePin() {
        this.isPinned = !this.isPinned;

        if (this.isPinned) {
            this.sidebar.classList.add('pinned');
            this.pinBtn.title = 'Desfijar sidebar';
            localStorage.setItem('sidebarPinned', 'true');
        } else {
            this.sidebar.classList.remove('pinned');
            this.pinBtn.title = 'Fijar sidebar';
            localStorage.removeItem('sidebarPinned');
        }
    }

    loadPinnedState() {
        const pinned = localStorage.getItem('sidebarPinned') === 'true';

        if (pinned && !this.isMobile) {
            this.isPinned = true;
            this.sidebar.classList.add('pinned');
            this.pinBtn.title = 'Desfijar sidebar';
        }
    }

    toggleMobileSidebar() {
        if (!this.isMobile) return;

        const isOpen = this.sidebar.classList.contains('show');

        if (isOpen) {
            this.closeMobileSidebar();
        } else {
            this.openMobileSidebar();
        }
    }

    openMobileSidebar() {
        if (!this.isMobile) return;

        this.sidebar.classList.add('show');
        this.overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeMobileSidebar() {
        this.sidebar.classList.remove('show');
        this.overlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    // Método público para actualizar badge de notificaciones
    updateNotificationBadge(count) {
        const badge = this.sidebar.querySelector('.notification-count');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Método para mostrar loading state
    setLoading(loading) {
        if (loading) {
            this.sidebar.classList.add('loading');
        } else {
            this.sidebar.classList.remove('loading');
        }
    }
}

// Inicializar sidebar colapsable
let collapsibleSidebar;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        collapsibleSidebar = new CollapsibleSidebar();
    });
} else {
    collapsibleSidebar = new CollapsibleSidebar();
}

// Hacer disponible globalmente
window.CollapsibleSidebar = CollapsibleSidebar;
window.collapsibleSidebar = collapsibleSidebar;

// Hook para actualizar notificaciones desde otros scripts
window.updateSidebarNotifications = (count) => {
    if (window.collapsibleSidebar) {
        window.collapsibleSidebar.updateNotificationBadge(count);
    }
};
