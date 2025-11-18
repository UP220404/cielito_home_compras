/* ============================================================
   SISTEMA CIELITO HOME - APP.JS PROFESIONAL
   ============================================================ */

class CielitoApp {
    constructor() {
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupSidebar();
        this.setupLogout();
        this.loadUserInfo();
        this.addAnimations();
    }

    // Verificar autenticación
    checkAuth() {
        const token = localStorage.getItem('token');
        const currentPath = window.location.pathname;

        if (!token && !currentPath.includes('login.html')) {
            window.location.href = 'login.html';
            return false;
        }

        if (token && currentPath.includes('login.html')) {
            window.location.href = 'dashboard.html';
            return false;
        }

        return true;
    }

    // Setup sidebar responsivo
    setupSidebar() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.querySelector('.app-sidebar');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Cerrar sidebar al hacer click fuera en móvil
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 1024) {
                    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                        sidebar.classList.remove('open');
                    }
                }
            });
        }

        // Marcar link activo
        this.setActiveLink();
    }

    // Marcar link activo en el sidebar
    setActiveLink() {
        const currentPath = window.location.pathname;
        const links = document.querySelectorAll('.sidebar-menu-link');

        links.forEach(link => {
            const href = link.getAttribute('href');
            if (currentPath.includes(href)) {
                link.classList.add('active');
            }
        });
    }

    // Setup logout
    setupLogout() {
        const logoutBtns = document.querySelectorAll('.btn-logout, .logout-link');

        logoutBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });
    }

    // Cerrar sesión
    async logout() {
        if (confirm('¿Cerrar sesión?')) {
            try {
                // Mostrar loading
                this.showLoading();

                // Limpiar localStorage
                localStorage.removeItem('token');
                localStorage.removeItem('user');

                // Mostrar mensaje
                this.showToast('Sesión cerrada exitosamente', 'success');

                // Esperar un poco y redirigir
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);

            } catch (error) {
                console.error('Error al cerrar sesión:', error);
                window.location.href = 'login.html';
            }
        }
    }

    // Cargar información del usuario
    loadUserInfo() {
        const userStr = localStorage.getItem('user');
        if (!userStr) return;

        try {
            const user = JSON.parse(userStr);

            // Actualizar nombre de usuario
            const userNameElements = document.querySelectorAll('.user-name');
            userNameElements.forEach(el => {
                el.textContent = user.name || 'Usuario';
            });

            // Actualizar avatar (iniciales)
            const userAvatarElements = document.querySelectorAll('.user-avatar');
            userAvatarElements.forEach(el => {
                const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';
                el.textContent = initials.substring(0, 2);
            });

            // Actualizar rol
            const userRoleElements = document.querySelectorAll('.user-role');
            userRoleElements.forEach(el => {
                el.textContent = this.getRoleName(user.role);
            });

            // Mostrar/ocultar elementos según rol
            this.handleRolePermissions(user.role);

        } catch (error) {
            console.error('Error cargando usuario:', error);
        }
    }

    // Obtener nombre del rol
    getRoleName(role) {
        const roles = {
            'admin': 'Administrador',
            'director': 'Director',
            'purchaser': 'Compras',
            'requester': 'Solicitante'
        };
        return roles[role] || role;
    }

    // Manejar permisos por rol
    handleRolePermissions(userRole) {
        // Ocultar elementos de admin
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = userRole === 'admin' ? 'block' : 'none';
        });

        // Ocultar elementos de compras
        const purchaserElements = document.querySelectorAll('.purchaser-only');
        purchaserElements.forEach(el => {
            el.style.display = ['purchaser', 'admin'].includes(userRole) ? 'block' : 'none';
        });

        // Ocultar elementos de director
        const directorElements = document.querySelectorAll('.director-only');
        directorElements.forEach(el => {
            el.style.display = ['director', 'admin'].includes(userRole) ? 'block' : 'none';
        });
    }

    // Agregar animaciones a los elementos
    addAnimations() {
        // Animar cards al hacer scroll
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, index * 100);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        const animatedElements = document.querySelectorAll('.stat-card-modern, .card-modern');
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'all 0.5s ease';
            observer.observe(el);
        });
    }

    // Mostrar loading overlay
    showLoading(message = 'Cargando...') {
        const existingOverlay = document.getElementById('loadingOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'spinner-overlay';
        overlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-modern"></div>
                <div class="mt-3" style="color: var(--primary); font-weight: 600;">
                    ${message}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // Ocultar loading
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // Mostrar toast notification
    showToast(message, type = 'info', duration = 3000) {
        // Crear contenedor si no existe
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.style.cssText = `
                position: fixed;
                top: 90px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        // Colores por tipo
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        // Crear toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 1rem;
            min-width: 300px;
            animation: slideInRight 0.3s ease;
            border-left: 4px solid ${colors[type]};
        `;

        toast.innerHTML = `
            <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 1.5rem;"></i>
            <div style="flex: 1; font-weight: 500;">${message}</div>
            <i class="fas fa-times" style="cursor: pointer; opacity: 0.5;" onclick="this.parentElement.remove()"></i>
        `;

        container.appendChild(toast);

        // Auto-remover
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Formatear fecha
    formatDate(date, format = 'DD/MM/YYYY') {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        if (format === 'DD/MM/YYYY') {
            return `${day}/${month}/${year}`;
        }
        return d.toLocaleDateString();
    }

    // Formatear moneda
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    }

    // Obtener badge de estatus
    getStatusBadge(status) {
        const badges = {
            'pendiente': '<span class="badge-modern badge-warning">Pendiente</span>',
            'autorizada': '<span class="badge-modern badge-success">Autorizada</span>',
            'rechazada': '<span class="badge-modern badge-danger">Rechazada</span>',
            'cotizando': '<span class="badge-modern badge-info">Cotizando</span>',
            'comprada': '<span class="badge-modern badge-primary">Comprada</span>',
            'entregada': '<span class="badge-modern badge-success">Entregada</span>',
            'cancelada': '<span class="badge-modern" style="background: #e2e3e5; color: #383d41;">Cancelada</span>'
        };
        return badges[status] || `<span class="badge-modern">${status}</span>`;
    }
}

// Inicializar app cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CielitoApp();
});

// Animación slideInRight para toasts
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
