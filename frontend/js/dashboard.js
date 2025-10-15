document.addEventListener('DOMContentLoaded', async function() {
    console.log('Dashboard cargando...');
    
    // Verificar autenticación
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }

    // Cargar componentes
    await loadComponents();
    
    // Inicializar dashboard
    await initDashboard();
});

async function loadComponents() {
    try {
        // Cargar navbar
        const navbarResponse = await fetch('../components/navbar.html');
        const navbarHtml = await navbarResponse.text();
        document.getElementById('navbar-container').innerHTML = navbarHtml;
        
        // Cargar sidebar
        const sidebarResponse = await fetch('../components/sidebar.html');
        const sidebarHtml = await sidebarResponse.text();
        document.getElementById('sidebar-container').innerHTML = sidebarHtml;
        
        // Activar link del dashboard
        const dashboardLink = document.querySelector('.sidebar .nav-link[href="dashboard.html"]');
        if (dashboardLink) {
            dashboardLink.classList.add('active');
        }
        
        // Configurar logout después de cargar navbar
        setTimeout(setupLogout, 500);
        
    } catch (error) {
        console.error('Error cargando componentes:', error);
    }
}

async function initDashboard() {
    try {
        // Mostrar información del usuario
        displayUserInfo();
        
        // Cargar KPIs
        await loadDashboardData();
        
        // Configurar elementos por rol
        handleRoleBasedVisibility();
        
    } catch (error) {
        console.error('Error inicializando dashboard:', error);
    }
}

function displayUserInfo() {
    const user = Utils.getCurrentUser();
    if (user) {
        // Mostrar nombre en el header si existe
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(el => {
            el.textContent = user.name || 'Usuario';
        });
    }
}

async function loadDashboardData() {
    try {
        // Simular carga de datos (reemplazar con llamadas API reales)
        document.getElementById('totalRequests').textContent = '12';
        document.getElementById('pendingRequests').textContent = '3';
        document.getElementById('completedRequests').textContent = '8';
        document.getElementById('totalSpent').textContent = '$45,320';
        
        // Cargar solicitudes recientes
        loadRecentRequests();
        
        // Cargar notificaciones
        loadRecentNotifications();
        
    } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
    }
}

function loadRecentRequests() {
    const container = document.getElementById('recentRequests');
    
    // Simulación de datos (reemplazar con API real)
    const mockRequests = [
        { id: 1, folio: 'REQ-001', descripcion: 'Material de oficina', estado: 'pendiente', fecha: '2025-01-15' },
        { id: 2, folio: 'REQ-002', descripcion: 'Equipo de computo', estado: 'autorizada', fecha: '2025-01-14' },
        { id: 3, folio: 'REQ-003', descripcion: 'Suministros médicos', estado: 'pendiente', fecha: '2025-01-13' }
    ];
    
    const html = mockRequests.map(req => `
        <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <div>
                <h6 class="mb-1">${req.folio}</h6>
                <p class="mb-0 text-muted small">${req.descripcion}</p>
            </div>
            <div class="text-end">
                <span class="badge bg-${CONFIG.ESTATUS_COLORS[req.estado]}">${CONFIG.ESTATUS[req.estado]}</span>
                <div class="small text-muted">${Utils.formatDate(req.fecha)}</div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html || '<p class="text-muted">No hay solicitudes recientes</p>';
}

function loadRecentNotifications() {
    const container = document.getElementById('recentNotifications');
    
    // Simulación de notificaciones
    const mockNotifications = [
        { id: 1, mensaje: 'Nueva solicitud pendiente de revisión', fecha: '2025-01-15', tipo: 'info' },
        { id: 2, mensaje: 'Solicitud REQ-001 ha sido autorizada', fecha: '2025-01-14', tipo: 'success' }
    ];
    
    const html = mockNotifications.map(notif => `
        <div class="d-flex align-items-start mb-3">
            <div class="flex-shrink-0">
                <i class="fas fa-circle text-${notif.tipo === 'success' ? 'success' : 'primary'} small"></i>
            </div>
            <div class="flex-grow-1 ms-2">
                <p class="mb-1 small">${notif.mensaje}</p>
                <div class="text-muted small">${Utils.formatDate(notif.fecha)}</div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html || '<p class="text-muted">No hay notificaciones</p>';
}

function handleRoleBasedVisibility() {
    const user = Utils.getCurrentUser();
    if (!user) return;
    
    // Mostrar elementos según rol
    const purchaserElements = document.querySelectorAll('.purchaser-only');
    const directorElements = document.querySelectorAll('.director-only');
    const adminElements = document.querySelectorAll('.admin-only');
    
    if (['purchaser', 'admin'].includes(user.role)) {
        purchaserElements.forEach(el => el.style.display = 'block');
    }
    
    if (['director', 'admin'].includes(user.role)) {
        directorElements.forEach(el => el.style.display = 'block');
    }
    
    if (user.role === 'admin') {
        adminElements.forEach(el => el.style.display = 'block');
    }
}

function setupLogout() {
    const logoutButtons = document.querySelectorAll('.logout-btn, .nav-link[href="#"]');
    
    logoutButtons.forEach(btn => {
        // Remover listeners anteriores
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Agregar nuevo listener
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (confirm('¿Cerrar sesión?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        });
    });
}