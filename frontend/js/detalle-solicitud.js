let currentRequest = null;
let currentAction = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes
    await loadComponents();
    
    // Obtener ID de la solicitud
    const urlParams = Utils.getUrlParams();
    const requestId = urlParams.id;
    
    if (!requestId) {
        Utils.showToast('ID de solicitud no especificado', 'error');
        window.location.href = 'mis-solicitudes.html';
        return;
    }
    
    // Cargar solicitud
    await loadRequest(requestId);
    
    // Configurar event listeners
    setupEventListeners();
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
        
    } catch (error) {
        console.error('Error cargando componentes:', error);
    }
}

async function loadRequest(requestId) {
    try {
        const response = await api.getRequestById(requestId);
        
        if (response.success) {
            currentRequest = response.data;
            renderRequest(currentRequest);
            
            // Cargar cotizaciones si existen
            if (currentRequest.status !== 'pendiente') {
                await loadQuotations(requestId);
            }
        } else {
            throw new Error('Solicitud no encontrada');
        }
        
    } catch (error) {
        console.error('Error cargando solicitud:', error);
        Utils.showToast('Error cargando la solicitud', 'error');
        
        // Mostrar error en el contenedor
        document.getElementById('loadingContainer').innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h5>Error al cargar la solicitud</h5>
                <p class="text-muted">${error.message}</p>
                <button class="btn btn-primary" onclick="history.back()">Volver</button>
            </div>
        `;
        return;
    }
    
    // Ocultar loading y mostrar content
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('contentContainer').style.display = 'block';
}

function renderRequest(request) {
    // Header
    document.getElementById('requestFolio').textContent = request.folio;
    document.getElementById('requestSubtitle').textContent = 
        `Solicitud de ${request.requester_name} - ${request.area}`;
    
    // Información general
    document.getElementById('detailFolio').textContent = request.folio;
    document.getElementById('detailRequester').textContent = request.requester_name;
    document.getElementById('detailArea').textContent = request.area;
    document.getElementById('detailStatus').innerHTML = Utils.getStatusBadge(request.status);
    document.getElementById('detailUrgency').innerHTML = Utils.getUrgencyBadge(request.urgency);
    document.getElementById('detailPriority').innerHTML = Utils.getPriorityBadge(request.priority);
    document.getElementById('detailRequestDate').textContent = Utils.formatDate(request.request_date);
    document.getElementById('detailDeliveryDate').textContent = Utils.formatDate(request.delivery_date);
    document.getElementById('detailJustification').textContent = request.justification;
    
    // Información de autorización
    if (request.authorized_by_name) {
        document.getElementById('detailAuthorizedBy').textContent = request.authorized_by_name;
        document.getElementById('detailAuthorizedAt').textContent = Utils.formatDate(request.authorized_at);
        document.getElementById('authorizationInfo').style.display = 'block';
    }
    
    // Razón de rechazo
    if (request.status === 'rechazada' && request.rejection_reason) {
        document.getElementById('detailRejectionReason').textContent = request.rejection_reason;
        document.getElementById('rejectionInfo').style.display = 'block';
    }
    
    // Items
    renderItems(request.items);
    
    // Acciones
    renderActions(request);
    
    // Timeline
    renderTimeline(request);
}

function renderItems(items) {
    const tbody = document.getElementById('itemsTableBody');
    let totalEstimated = 0;
    
    tbody.innerHTML = items.map((item, index) => {
        const itemTotal = (item.approximate_cost || 0) * item.quantity;
        totalEstimated += itemTotal;
        
        return `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>
                    <strong>${item.material}</strong>
                    ${item.in_stock ? '<span class="badge bg-info ms-2">En Almacén</span>' : ''}
                </td>
                <td>
                    <div class="text-wrap" style="max-width: 300px;">
                        ${item.specifications}
                    </div>
                    ${item.location ? `<small class="text-muted d-block">Ubicación: ${item.location}</small>` : ''}
                </td>
                <td>
                    <strong>${item.quantity}</strong> ${item.unit}
                </td>
                <td>
                    ${itemTotal > 0 ? Utils.formatCurrency(itemTotal) : '-'}
                </td>
            </tr>
        `;
    }).join('');
    
    // Agregar fila de total si hay costos
    if (totalEstimated > 0) {
        tbody.innerHTML += `
            <tr class="table-info">
                <td colspan="4" class="text-end"><strong>Total Estimado:</strong></td>
                <td><strong>${Utils.formatCurrency(totalEstimated)}</strong></td>
            </tr>
        `;
    }
}

function renderActions(request) {
    const container = document.getElementById('actionsContainer');
    const user = Utils.getCurrentUser();
    const actions = [];
    
    // Acciones según rol y estado
    if (user.role === 'director' && request.status === 'pendiente') {
        actions.push({
            text: 'Autorizar',
            icon: 'fa-check',
            class: 'btn-success',
            action: 'authorize'
        });
        actions.push({
            text: 'Rechazar',
            icon: 'fa-times',
            class: 'btn-danger',
            action: 'reject'
        });
    }
    
    if ((user.role === 'purchaser' || user.role === 'admin') && request.status === 'autorizada') {
        actions.push({
            text: 'Cotizar',
            icon: 'fa-file-invoice-dollar',
            class: 'btn-primary',
            action: 'quote',
            href: `cotizaciones.html?request=${request.id}`
        });
    }
    
    if (user.role === 'requester' && request.user_id === user.id && request.status === 'pendiente') {
        actions.push({
            text: 'Cancelar',
            icon: 'fa-times-circle',
            class: 'btn-outline-danger',
            action: 'cancel'
        });
    }
    
    // Acciones comunes
    actions.push({
        text: 'Imprimir',
        icon: 'fa-print',
        class: 'btn-outline-secondary',
        action: 'print'
    });
    
    container.innerHTML = actions.map(action => {
        if (action.href) {
            return `
                <a href="${action.href}" class="btn ${action.class}">
                    <i class="fas ${action.icon} me-2"></i>
                    ${action.text}
                </a>
            `;
        } else {
            return `
                <button class="btn ${action.class}" data-action="${action.action}">
                    <i class="fas ${action.icon} me-2"></i>
                    ${action.text}
                </button>
            `;
        }
    }).join('');
}

function renderTimeline(request) {
    const container = document.getElementById('timelineContainer');
    const timeline = [];
    
    // Evento de creación
    timeline.push({
        title: 'Solicitud Creada',
        description: `Solicitud creada por ${request.requester_name}`,
        date: request.created_at,
        icon: 'fa-plus-circle',
        color: 'primary'
    });
    
    // Evento de autorización/rechazo
    if (request.authorized_at) {
        if (request.status === 'autorizada') {
            timeline.push({
                title: 'Autorizada',
                description: `Autorizada por ${request.authorized_by_name}`,
                date: request.authorized_at,
                icon: 'fa-check-circle',
                color: 'success'
            });
        } else if (request.status === 'rechazada') {
            timeline.push({
                title: 'Rechazada',
                description: `Rechazada por ${request.authorized_by_name}`,
                date: request.authorized_at,
                icon: 'fa-times-circle',
                color: 'danger'
            });
        }
    }
    
    // Otros eventos según estado
    if (request.status === 'cotizando') {
        timeline.push({
            title: 'En Cotización',
            description: 'Solicitud en proceso de cotización',
            date: request.updated_at,
            icon: 'fa-file-invoice-dollar',
            color: 'info'
        });
    }
    
    if (request.status === 'comprada') {
        timeline.push({
            title: 'Comprada',
            description: 'Orden de compra generada',
            date: request.updated_at,
            icon: 'fa-shopping-cart',
            color: 'primary'
        });
    }
    
    if (request.status === 'entregada') {
        timeline.push({
            title: 'Entregada',
            description: 'Solicitud completada',
            date: request.updated_at,
            icon: 'fa-check-double',
            color: 'success'
        });
    }
    
    container.innerHTML = timeline.map(event => `
        <div class="d-flex mb-3">
            <div class="flex-shrink-0 me-3">
                <div class="bg-${event.color} text-white rounded-circle d-flex align-items-center justify-content-center" 
                     style="width: 40px; height: 40px;">
                    <i class="fas ${event.icon}"></i>
                </div>
            </div>
            <div class="flex-grow-1">
                <h6 class="mb-1">${event.title}</h6>
                <p class="mb-1 text-muted small">${event.description}</p>
                <small class="text-muted">${Utils.formatDate(event.date)}</small>
            </div>
        </div>
    `).join('');
}

async function loadQuotations(requestId) {
    try {
        const response = await api.getQuotationsByRequest(requestId);
        
        if (response.success && response.data.length > 0) {
            renderQuotations(response.data);
            document.getElementById('quotationsSection').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error cargando cotizaciones:', error);
    }
}

function renderQuotations(quotations) {
    const container = document.getElementById('quotationsContainer');
    
    container.innerHTML = quotations.map(quotation => `
        <div class="card mb-3 ${quotation.is_selected ? 'border-success' : ''}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">
                    <i class="fas fa-truck me-2"></i>
                    ${quotation.supplier_name}
                    ${quotation.is_selected ? '<span class="badge bg-success ms-2">Seleccionada</span>' : ''}
                </h6>
                <span class="text-primary fw-bold">${Utils.formatCurrency(quotation.total_amount)}</span>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <small class="text-muted">Días de entrega:</small>
                        <p class="mb-2">${quotation.delivery_days || 'No especificado'} días</p>
                    </div>
                    <div class="col-md-6">
                        <small class="text-muted">Términos de pago:</small>
                        <p class="mb-2">${quotation.payment_terms || 'No especificado'}</p>
                    </div>
                </div>
                ${quotation.notes ? `
                    <div class="mt-2">
                        <small class="text-muted">Notas:</small>
                        <p class="mb-0">${quotation.notes}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function setupEventListeners() {
    // Acciones de botones
    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-action]')) {
            const action = e.target.closest('[data-action]').getAttribute('data-action');
            handleAction(action);
        }
    });
    
    // Modal de confirmación
    document.getElementById('confirmActionBtn').addEventListener('click', confirmAction);
}

function handleAction(action) {
    currentAction = action;
    
    const modal = document.getElementById('actionModal');
    const title = document.getElementById('actionModalTitle');
    const message = document.getElementById('actionModalMessage');
    const reasonContainer = document.getElementById('reasonContainer');
    const confirmBtn = document.getElementById('confirmActionBtn');
    
    switch (action) {
        case 'authorize':
            title.innerHTML = '<i class="fas fa-check text-success me-2"></i>Autorizar Solicitud';
            message.textContent = '¿Está seguro de que desea autorizar esta solicitud?';
            reasonContainer.style.display = 'none';
            confirmBtn.className = 'btn btn-success';
            confirmBtn.innerHTML = '<i class="fas fa-check me-2"></i>Autorizar';
            break;
            
        case 'reject':
            title.innerHTML = '<i class="fas fa-times text-danger me-2"></i>Rechazar Solicitud';
            message.textContent = '¿Está seguro de que desea rechazar esta solicitud?';
            reasonContainer.style.display = 'block';
            document.getElementById('actionReason').required = true;
            confirmBtn.className = 'btn btn-danger';
            confirmBtn.innerHTML = '<i class="fas fa-times me-2"></i>Rechazar';
            break;
            
        case 'cancel':
            title.innerHTML = '<i class="fas fa-times-circle text-warning me-2"></i>Cancelar Solicitud';
            message.textContent = '¿Está seguro de que desea cancelar esta solicitud?';
            reasonContainer.style.display = 'block';
            document.getElementById('actionReason').required = false;
            confirmBtn.className = 'btn btn-warning';
            confirmBtn.innerHTML = '<i class="fas fa-times-circle me-2"></i>Cancelar';
            break;
            
        case 'print':
            window.print();
            return;
    }
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

async function confirmAction() {
    if (!currentAction || !currentRequest) return;
    
    try {
        const confirmBtn = document.getElementById('confirmActionBtn');
        const originalText = confirmBtn.innerHTML;
        
        // Mostrar loading
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';
        
        const reason = document.getElementById('actionReason').value.trim();
        let newStatus;
        
        switch (currentAction) {
            case 'authorize':
                newStatus = 'autorizada';
                break;
            case 'reject':
                if (!reason) {
                    Utils.showToast('Debe especificar una razón para el rechazo', 'warning');
                    return;
                }
                newStatus = 'rechazada';
                break;
            case 'cancel':
                newStatus = 'cancelada';
                break;
        }
        
        // Actualizar estado
        const response = await api.updateRequestStatus(currentRequest.id, newStatus, reason || null);
        
        if (response.success) {
            Utils.showToast(`Solicitud ${newStatus} exitosamente`, 'success');
            
            // Cerrar modal
            bootstrap.Modal.getInstance(document.getElementById('actionModal')).hide();
            
            // Recargar solicitud
            await loadRequest(currentRequest.id);
        }
        
    } catch (error) {
        Utils.handleApiError(error, 'Error procesando la acción');
    } finally {
        // Restaurar botón
        const confirmBtn = document.getElementById('confirmActionBtn');
        confirmBtn.disabled = false;
        // El texto original se restaurará al cerrar el modal
        
        currentAction = null;
    }
}
