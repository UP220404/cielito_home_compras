document.addEventListener('DOMContentLoaded', async function() {
    console.log('🏠 ========== DASHBOARD CARGANDO ==========');

    // Verificar autenticación
    if (!localStorage.getItem('token')) {
        console.log('❌ No hay token, redirigiendo a login');
        window.location.href = 'login.html';
        return;
    }

    console.log('✅ Token encontrado, cargando componentes...');

    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    console.log('✅ Componentes cargados, inicializando dashboard...');

    // Inicializar dashboard
    await initDashboard();

    console.log('✅ Dashboard inicializado completamente');
});

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
        // Cargar estadísticas PERSONALES del usuario actual desde /analytics/summary
        const statsResponse = await api.get('/analytics/summary');

        if (statsResponse.success) {
            const stats = statsResponse.data;
            console.log('📊 Estadísticas del dashboard (desde analytics):', stats);

            // Actualizar KPIs con datos reales del usuario
            document.getElementById('totalRequests').textContent = stats.total_requests || '0';
            document.getElementById('pendingRequests').textContent = stats.pending_requests || '0';
            document.getElementById('completedRequests').textContent = (stats.recibidas || stats.completed_requests) || '0';

            // Usar el total_amount que viene del backend (ya filtrado por usuario)
            const totalSpent = stats.total_amount || 0;
            console.log('💰 Total gastado (del backend):', totalSpent);
            document.getElementById('totalSpent').textContent = Utils.formatCurrency(totalSpent);
        }

        // Cargar solicitudes recientes DEL USUARIO
        await loadRecentRequests();

        // Cargar notificaciones
        loadRecentNotifications();

    } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
        Utils.showToast('Error cargando datos del dashboard', 'danger');
    }
}

async function calculateTotalSpent() {
    try {
        const user = Utils.getCurrentUser();
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        console.log(`📅 Buscando gastos del mes: ${currentMonth}/${currentYear}`);

        // Obtener TODAS las órdenes de compra recibidas
        const response = await api.get('/orders?limit=1000&status=recibida,received');
        console.log('📦 Respuesta de órdenes recibidas:', response);

        if (response.success && response.data && response.data.orders) {
            const allOrders = response.data.orders;
            console.log(`📋 Total órdenes recibidas: ${allOrders.length}`);

            // Filtrar solo órdenes del mes actual
            const validOrders = allOrders.filter(order => {
                if (!order.order_date) {
                    console.log(`  ⚠️ Orden ${order.folio} sin fecha`);
                    return false;
                }

                const orderDate = new Date(order.order_date);
                const orderMonth = orderDate.getMonth() + 1;
                const orderYear = orderDate.getFullYear();

                const isCurrentMonth = (orderMonth === currentMonth && orderYear === currentYear);

                console.log(`  📅 Orden ${order.folio}: ${orderDate.toISOString().split('T')[0]} (${orderMonth}/${orderYear}) - ${isCurrentMonth ? '✅ SÍ' : '❌ NO'} es del mes actual`);

                return isCurrentMonth;
            });

            console.log(`🔍 Órdenes del mes ${currentMonth}/${currentYear}: ${validOrders.length}`);

            const total = validOrders.reduce((sum, order) => {
                const amount = parseFloat(order.total_amount) || 0;
                console.log(`  💰 ${order.folio}: $${amount}`);
                return sum + amount;
            }, 0);

            console.log(`💵 TOTAL GASTADO EN ${currentMonth}/${currentYear}: $${total}`);
            return total;
        }

        console.warn('⚠️ No se obtuvieron órdenes de compra');
        return 0;
    } catch (error) {
        console.error('❌ Error calculando gasto total:', error);
        return 0;
    }
}

async function loadRecentRequests() {
    const container = document.getElementById('recentRequests');

    try {
        // Obtener las solicitudes PERSONALES del usuario actual
        const user = Utils.getCurrentUser();
        const response = await api.getRequests({ user_id: user.id, limit: 5 });

        if (response.success && response.data && response.data.length > 0) {
            const html = response.data.map(req => `
                <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <div>
                        <h6 class="mb-1">
                            <a href="detalle-solicitud.html?id=${req.id}" class="text-decoration-none">
                                ${req.folio}
                            </a>
                        </h6>
                        <p class="mb-0 text-muted small">${Utils.truncate(req.justification, 50)}</p>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-${CONFIG.ESTATUS_COLORS[req.status]}">${CONFIG.ESTATUS[req.status]}</span>
                        <div class="small text-muted">${Utils.formatDate(req.created_at)}</div>
                    </div>
                </div>
            `).join('');

            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="text-muted text-center py-4">No tienes solicitudes recientes</p>';
        }

    } catch (error) {
        console.error('Error cargando solicitudes recientes:', error);
        container.innerHTML = '<p class="text-danger text-center py-4">Error cargando solicitudes</p>';
    }
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

            Utils.showConfirm('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            });
        });
    });
}