let requestsTable;
let currentRequestId = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes
    await loadComponents();
    
    // Inicializar página
    initPage();
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
        
        // Activar link de mis solicitudes
        document.querySelector('.sidebar .nav-link[href="mis-solicitudes.html"]').classList.add('active');
        
    } catch (error) {
        console.error('Error cargando componentes:', error);
    }
}

async function initPage() {
    try {
        // Cargar estadísticas
        await loadStats();
        
        // Inicializar tabla
        initTable();
        
        // Configurar event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error inicializando página:', error);
        Utils.showToast('Error cargando la página', 'error');
    }
}

async function loadStats() {
    try {
        const response = await api.getRequestStats();
        if (response.success) {
            renderStats(response.data);
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

function renderStats(stats) {
    const statsRow = document.getElementById('statsRow');
    
    const statsCards = [
        {
            title: 'Total',
            value: stats.total || 0,
            icon: 'fa-file-alt',
            color: 'primary'
        },
        {
            title: 'Pendientes',
            value: stats.pendientes || 0,
            icon: 'fa-clock',
            color: 'warning'
        },
        {
            title: 'Autorizadas',
            value: stats.autorizadas || 0,
            icon: 'fa-check-circle',
            color: 'success'
        },
        {
            title: 'Completadas',
            value: stats.entregadas || 0,
            icon: 'fa-check-double',
            color: 'info'
        }
    ];
    
    statsRow.innerHTML = statsCards.map(stat => `
        <div class="col-lg-3 col-md-6 mb-3">
            <div class="stat-card stat-${stat.color}">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="stat-number">${stat.value}</div>
                        <div class="stat-label">${stat.title}</div>
                    </div>
                    <div class="stat-icon">
                        <i class="fas ${stat.icon}"></i>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function initTable() {
    requestsTable = $('#requestsTable').DataTable({
        ...CONFIG.DATATABLE_CONFIG,
        ajax: {
            url: CONFIG.API_URL + '/requests/my',
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            data: function(d) {
                // Agregar filtros
                const filters = getFilters();
                return { ...d, ...filters };
            },
            dataSrc: function(json) {
                if (json.success) {
                    return json.data.requests;
                } else {
                    Utils.showToast('Error cargando solicitudes', 'error');
                    return [];
                }
            },
            error: function(xhr, error, thrown) {
                console.error('Error cargando datos:', error);
                Utils.showToast('Error de conexión', 'error');
            }
        },
        columns: [
            {
                data: 'folio',
                render: function(data, type, row) {
                    return `<strong class="text-primary">${data}</strong>`;
                }
            },
            {
                data: 'request_date',
                render: function(data) {
                    return Utils.formatDate(data);
                }
            },
            {
                data: 'status',
                render: function(data) {
                    return Utils.getStatusBadge(data);
                }
            },
            {
                data: 'urgency',
                render: function(data) {
                    return Utils.getUrgencyBadge(data);
                }
            },
            {
                data: 'items_count',
                className: 'text-center',
                render: function(data) {
                    return `<span class="badge bg-secondary">${data}</span>`;
                }
            },
            {
                data: 'estimated_total',
                render: function(data) {
                    return data > 0 ? Utils.formatCurrency(data) : '-';
                }
            },
            {
                data: 'delivery_date',
                render: function(data) {
                    const deliveryDate = new Date(data);
                    const today = new Date();
                    const isOverdue = deliveryDate < today;
                    
                    return `
                        <span class="${isOverdue ? 'text-danger fw-bold' : ''}">
                            ${Utils.formatDate(data)}
                            ${isOverdue ? '<i class="fas fa-exclamation-triangle ms-1"></i>' : ''}
                        </span>
                    `;
                }
            },
            {
                data: null,
                orderable: false,
                className: 'text-center',
                render: function(data, type, row) {
                    return `
                        <div class="btn-group" role="group">
                            <a href="detalle-solicitud.html?id=${row.id}" 
                               class="btn btn-sm btn-outline-primary" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </a>
                            ${row.status === 'pendiente' ? `
                                <button class="btn btn-sm btn-outline-danger cancel-request" 
                                        data-id="${row.id}" data-folio="${row.folio}" title="Cancelar">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : ''}
                        </div>
                    `;
                }
            }
        ],
        order: [[1, 'desc']], // Ordenar por fecha descendente
        columnDefs: [
            { targets: [4, 7], orderable: false }
        ]
    });
}

function setupEventListeners() {
    // Filtros
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    
    // Botones de acción
    document.getElementById('refreshTable').addEventListener('click', refreshTable);
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);
    
    // Cancelar solicitud
    $(document).on('click', '.cancel-request', handleCancelRequest);
    document.getElementById('confirmCancel').addEventListener('click', confirmCancelRequest);
}

function getFilters() {
    return {
        status: document.getElementById('statusFilter').value,
        urgency: document.getElementById('urgencyFilter').value,
        date_from: document.getElementById('dateFromFilter').value,
        date_to: document.getElementById('dateToFilter').value
    };
}

function applyFilters() {
    requestsTable.ajax.reload();
    Utils.showToast('Filtros aplicados', 'success');
}

function clearFilters() {
    document.getElementById('statusFilter').value = '';
    document.getElementById('urgencyFilter').value = '';
    document.getElementById('dateFromFilter').value = '';
    document.getElementById('dateToFilter').value = '';
    
    requestsTable.ajax.reload();
    Utils.showToast('Filtros limpiados', 'info');
}

function refreshTable() {
    requestsTable.ajax.reload();
    loadStats(); // Actualizar también las estadísticas
    Utils.showToast('Datos actualizados', 'success');
}

async function exportToExcel() {
    try {
        Utils.showSpinner(document.body, 'Generando archivo Excel...');
        
        const filters = getFilters();
        filters.user_id = Utils.getCurrentUser().id; // Solo mis solicitudes
        
        const blob = await api.downloadRequestsExcel(filters);
        const filename = `mis_solicitudes_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        Utils.downloadBlob(blob, filename);
        Utils.showToast('Archivo Excel descargado', 'success');
        
    } catch (error) {
        Utils.handleApiError(error, 'Error al exportar a Excel');
    } finally {
        Utils.hideSpinner();
    }
}

function handleCancelRequest(e) {
    const button = e.currentTarget;
    currentRequestId = button.getAttribute('data-id');
    const folio = button.getAttribute('data-folio');
    
    // Actualizar modal
    document.querySelector('#cancelModal .modal-title').innerHTML = `
        <i class="fas fa-times-circle text-danger me-2"></i>
        Cancelar Solicitud ${folio}
    `;
    
    // Limpiar razón anterior
    document.getElementById('cancelReason').value = '';
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('cancelModal'));
    modal.show();
}

async function confirmCancelRequest() {
    if (!currentRequestId) return;
    
    try {
        const cancelBtn = document.getElementById('confirmCancel');
        const originalText = cancelBtn.innerHTML;
        
        // Mostrar loading
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cancelando...';
        
        const reason = document.getElementById('cancelReason').value.trim();
        
        // Cambiar estado a cancelada
        const response = await api.updateRequestStatus(currentRequestId, 'cancelada', reason || null);
        
        if (response.success) {
            Utils.showToast('Solicitud cancelada exitosamente', 'success');
            
            // Cerrar modal
            bootstrap.Modal.getInstance(document.getElementById('cancelModal')).hide();
            
            // Actualizar tabla y stats
            refreshTable();
        }
        
    } catch (error) {
        Utils.handleApiError(error, 'Error al cancelar la solicitud');
    } finally {
        // Restaurar botón
        const cancelBtn = document.getElementById('confirmCancel');
        cancelBtn.disabled = false;
        cancelBtn.innerHTML = '<i class="fas fa-times-circle me-2"></i>Sí, cancelar';
        
        currentRequestId = null;
    }
}
