let pendingTable, quotingTable, authorizedTable;
let currentRequestForQuote = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Verificar permisos
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !Utils.hasPermission(user.role, ['purchaser', 'admin'])) {
        alert('No tienes permisos para acceder a esta página');
        window.location.href = 'dashboard.html';
        return;
    }

    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    // Inicializar página
    await initPage();
});

async function initPage() {
    try {
        // Cargar datos iniciales
        await Promise.all([
            loadKPIs(),
            loadAreaOptions(),
            loadSuppliers()
        ]);

        // Inicializar tablas (ya cargan datos automáticamente con AJAX)
        initTables();

        // Configurar event listeners
        setupEventListeners();

        // NO llamar refreshAllTables aquí porque las tablas ya están cargando
        // Los datos se cargan automáticamente al inicializar las DataTables

    } catch (error) {
        console.error('Error inicializando página:', error);
        Utils.showToast('Error cargando el panel de compras', 'error');
    }
}

async function loadKPIs() {
    try {
        const response = await api.getAnalyticsSummary();
        if (response.success) {
            renderKPIs(response.data);
        }
    } catch (error) {
        console.error('Error cargando KPIs:', error);
    }
}

function renderKPIs(data) {
    const kpiGrid = document.getElementById('kpiGrid');
    
    const kpis = [
        {
            title: 'Pendientes',
            value: data.pending_requests || 0,
            icon: 'fa-clock',
            color: 'warning'
        },
        {
            title: 'En Cotización',
            value: data.cotizando || 0,
            icon: 'fa-file-invoice-dollar',
            color: 'info'
        },
        {
            title: 'Autorizadas',
            value: data.authorized_requests || 0,
            icon: 'fa-check-circle',
            color: 'success'
        },
        {
            title: 'Órdenes Mes',
            value: data.total_orders || 0,
            icon: 'fa-shopping-cart',
            color: 'primary'
        }
    ];
    
    kpiGrid.innerHTML = kpis.map(kpi => `
        <div class="kpi-card stat-${kpi.color}">
            <div class="kpi-header">
                <div>
                    <div class="kpi-value">${Utils.formatNumber(kpi.value)}</div>
                    <div class="kpi-label">${kpi.title}</div>
                </div>
                <div class="kpi-icon">
                    <i class="fas ${kpi.icon}"></i>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadAreaOptions() {
    const areaFilter = document.getElementById('areaFilter');
    CONFIG.AREAS.forEach(area => {
        const option = document.createElement('option');
        option.value = area;
        option.textContent = area;
        areaFilter.appendChild(option);
    });
}

async function loadSuppliers() {
    try {
        // Cargar TODOS los proveedores activos
        const response = await api.getSuppliers(1, 1000, { active_only: 'true' });
        if (response.success) {
            const supplierSelect = $('#supplierId');
            supplierSelect.html('<option value="">Seleccionar proveedor</option>');

            response.data.suppliers.forEach(supplier => {
                supplierSelect.append(`<option value="${supplier.id}">${supplier.name}${supplier.category ? ` (${supplier.category})` : ''}</option>`);
            });

            // Inicializar Select2 con búsqueda
            supplierSelect.select2({
                theme: 'bootstrap-5',
                placeholder: 'Buscar proveedor...',
                allowClear: true,
                dropdownParent: $('#quickQuoteModal'),
                width: '100%',
                language: {
                    noResults: function() {
                        return "No se encontraron proveedores";
                    },
                    searching: function() {
                        return "Buscando...";
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error cargando proveedores:', error);
    }
}

function initTables() {
    // Destruir tablas existentes si existen
    if ($.fn.DataTable.isDataTable('#pendingTable')) {
        $('#pendingTable').DataTable().destroy();
    }
    if ($.fn.DataTable.isDataTable('#quotingTable')) {
        $('#quotingTable').DataTable().destroy();
    }
    if ($.fn.DataTable.isDataTable('#authorizedTable')) {
        $('#authorizedTable').DataTable().destroy();
    }

    // Tabla de pendientes
    pendingTable = $('#pendingTable').DataTable({
        ...CONFIG.DATATABLE_CONFIG,
        ajax: {
            url: CONFIG.API_URL + '/requests',
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            data: function(d) {
                return { ...d, status: 'pendiente', ...getFilters() };
            },
            dataSrc: function(json) {
                if (json && json.success) {
                    updateTabBadge('pendingCount', json.data.requests.length);
                    return json.data.requests;
                }
                return [];
            },
            error: function(xhr, error, thrown) {
                console.error('Error en DataTable pendingTable:', error);
                Utils.showToast('Error cargando solicitudes pendientes', 'error');
                return [];
            }
        },
        columns: [
            {
                data: 'folio',
                render: function(data, type, row) {
                    return `<a href="detalle-solicitud.html?id=${row.id}" class="text-decoration-none fw-bold">${data}</a>`;
                }
            },
            { data: 'requester_name' },
            { data: 'area' },
            {
                data: 'priority',
                render: function(data) {
                    return Utils.getPriorityBadge(data);
                }
            },
            {
                data: 'request_date',
                render: function(data) {
                    return Utils.formatDate(data);
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
                            <button class="btn btn-sm btn-outline-success quick-quote" 
                                    data-id="${row.id}" data-folio="${row.folio}" title="Cotización rápida">
                                <i class="fas fa-bolt"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ]
    });

    // Tabla en cotización
    quotingTable = $('#quotingTable').DataTable({
        ...CONFIG.DATATABLE_CONFIG,
        ajax: {
            url: CONFIG.API_URL + '/requests',
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            data: function(d) {
                return { ...d, status: 'cotizando', ...getFilters() };
            },
            dataSrc: function(json) {
                if (json && json.success) {
                    updateTabBadge('quotingCount', json.data.requests.length);
                    return json.data.requests;
                }
                return [];
            },
            error: function(xhr, error, thrown) {
                console.error('Error en DataTable quotingTable:', error);
                Utils.showToast('Error cargando solicitudes en cotización', 'error');
                return [];
            }
        },
        columns: [
            {
                data: 'folio',
                render: function(data, type, row) {
                    return `<a href="detalle-solicitud.html?id=${row.id}" class="text-decoration-none fw-bold">${data}</a>`;
                }
            },
            { data: 'requester_name' },
            { data: 'area' },
            {
                data: null,
                className: 'text-center',
                render: function(data, type, row) {
                    return `<span class="badge bg-info">En proceso</span>`;
                }
            },
            {
                data: 'request_date',
                render: function(data) {
                    return Utils.formatDate(data);
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
                            <a href="cotizaciones.html?request=${row.id}"
                               class="btn btn-sm btn-outline-success" title="Gestionar cotizaciones">
                                <i class="fas fa-file-invoice-dollar"></i>
                            </a>
                        </div>
                    `;
                }
            }
        ]
    });

    // Tabla autorizadas
    authorizedTable = $('#authorizedTable').DataTable({
        ...CONFIG.DATATABLE_CONFIG,
        ajax: {
            url: CONFIG.API_URL + '/requests',
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            data: function(d) {
                return { ...d, status: 'autorizada', ...getFilters() };
            },
            dataSrc: function(json) {
                if (json && json.success) {
                    updateTabBadge('authorizedCount', json.data.requests.length);
                    return json.data.requests;
                }
                return [];
            },
            error: function(xhr, error, thrown) {
                console.error('Error en DataTable authorizedTable:', error);
                Utils.showToast('Error cargando solicitudes autorizadas', 'error');
                return [];
            }
        },
        columns: [
            {
                data: 'folio',
                render: function(data, type, row) {
                    return `<a href="detalle-solicitud.html?id=${row.id}" class="text-decoration-none fw-bold">${data}</a>`;
                }
            },
            { data: 'requester_name' },
            { data: 'area' },
            {
                data: null,
                className: 'text-center',
                render: function(data, type, row) {
                    return `<span class="badge bg-warning">Pendiente</span>`;
                }
            },
            {
                data: 'estimated_total',
                render: function(data) {
                    return data > 0 ? Utils.formatCurrency(data) : '-';
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
                            <a href="cotizaciones.html?request=${row.id}"
                               class="btn btn-sm btn-outline-success" title="Cotizar">
                                <i class="fas fa-file-invoice-dollar"></i>
                            </a>
                            <button class="btn btn-sm btn-outline-info generate-order" 
                                    data-id="${row.id}" title="Generar orden"
                                    style="display: none;">
                                <i class="fas fa-receipt"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ]
    });
}

function setupEventListeners() {
    // Filtros
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    
    // Tabs
    const tabButtons = document.querySelectorAll('#purchaseTabs button[data-bs-toggle="tab"]');
    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', function() {
            refreshCurrentTable();
        });
    });
    
    // Cotización rápida
    $(document).on('click', '.quick-quote', handleQuickQuote);
    document.getElementById('quickQuoteForm').addEventListener('submit', submitQuickQuote);
    
    // Generar orden
    $(document).on('click', '.generate-order', handleGenerateOrder);
}

function getFilters() {
    return {
        area: document.getElementById('areaFilter').value,
        urgency: document.getElementById('urgencyFilter').value
    };
}

function applyFilters() {
    refreshAllTables();
    Utils.showToast('Filtros aplicados', 'success');
}

function refreshAllTables() {
    pendingTable.ajax.reload();
    quotingTable.ajax.reload();
    authorizedTable.ajax.reload();
}

function refreshCurrentTable() {
    const activeTab = document.querySelector('#purchaseTabs .nav-link.active');
    const target = activeTab.getAttribute('data-bs-target');
    
    switch (target) {
        case '#pendingTab':
            pendingTable.ajax.reload();
            break;
        case '#quotingTab':
            quotingTable.ajax.reload();
            break;
        case '#authorizedTab':
            authorizedTable.ajax.reload();
            break;
    }
}

function updateTabBadge(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.textContent = count;
        badge.className = count > 0 ? 'badge bg-warning ms-2' : 'badge bg-secondary ms-2';
    }
}

function handleQuickQuote(e) {
    const button = e.currentTarget;
    const requestId = button.getAttribute('data-id');
    const folio = button.getAttribute('data-folio');
    
    currentRequestForQuote = { id: requestId, folio: folio };
    
    // Actualizar modal
    document.getElementById('quickQuoteRequest').textContent = folio;
    
    // Limpiar formulario
    document.getElementById('quickQuoteForm').reset();
    document.getElementById('validityDays').value = '30';
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('quickQuoteModal'));
    modal.show();
}

async function submitQuickQuote(e) {
    e.preventDefault();

    if (!currentRequestForQuote) return;

    // Prevenir doble-submit: verificar si ya está deshabilitado
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) {
        console.warn('⚠️ Ya hay una cotización en proceso, ignorando doble-clic');
        return;
    }

    try {
        const formData = new FormData(e.target);
        const originalText = submitBtn.innerHTML;

        // Mostrar loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
        
        // Preparar datos de la cotización
        const quotationData = {
            request_id: parseInt(currentRequestForQuote.id),
            supplier_id: parseInt(formData.get('supplier_id')),
            total_amount: parseFloat(formData.get('total_amount')),
            delivery_days: parseInt(formData.get('delivery_days')) || null,
            payment_terms: formData.get('payment_terms') || null,
            validity_days: parseInt(formData.get('validity_days')) || 30,
            notes: formData.get('notes') || null,
            items: [] // Se llenará automáticamente en el backend
        };
        
        // Crear cotización
        const response = await api.createQuotation(quotationData);

        if (response.success) {
            Utils.showToast('Cotización creada exitosamente', 'success');

            // Cerrar modal
            bootstrap.Modal.getInstance(document.getElementById('quickQuoteModal')).hide();

            // Actualizar tablas
            refreshAllTables();

            // Opcional: redirigir a ver la cotización
            Utils.showToast('¿Desea ver los detalles de la cotización?', 'info', 3000);
        } else {
            // Manejar errores específicos (como duplicados - 409)
            if (response.status === 409) {
                Utils.showToast(response.error || 'Esta cotización ya existe', 'warning');
            } else {
                throw new Error(response.error || 'Error al crear cotización');
            }
        }

    } catch (error) {
        Utils.handleApiError(error, 'Error creando la cotización');
    } finally {
        // Restaurar botón solo si no hubo éxito (si hubo éxito el modal se cierra)
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Cotización';

        currentRequestForQuote = null;
    }
}

async function handleGenerateOrder(e) {
    const button = e.currentTarget;
    const requestId = button.getAttribute('data-id');
    
    // Aquí iría la lógica para generar orden de compra
    // Por ahora, redirigir a la página de órdenes
    window.location.href = `ordenes-compra.html?generate=${requestId}`;
}
