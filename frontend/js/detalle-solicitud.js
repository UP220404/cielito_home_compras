let currentRequest = null;
let currentAction = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes (usa la función global de init.js)
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

    // Mostrar estado de la solicitud y de la orden (si existe)
    let statusHTML = Utils.getStatusBadge(request.status);

    // Si existe orden de compra, mostrar su estado también
    if (request.purchase_order) {
        const order = request.purchase_order;
        const orderStatusIcons = {
            'emitida': 'file-invoice',
            'en_transito': 'truck',
            'recibida': 'check-circle',
            'cancelada': 'times-circle'
        };
        const icon = orderStatusIcons[order.status] || 'question';
        const orderBadge = Utils.getOrderStatusBadge(order.status);

        // Mostrar badge de orden sin botones adicionales
        statusHTML += ` <span class="d-inline-flex align-items-center gap-2">
            ${orderBadge.replace('<span', `<span style="display:inline-flex;align-items:center;gap:4px;"`).replace('>', `><i class="fas fa-${icon}"></i>Orden: `).replace('</span>', ' </span>')}
        </span>`;
    }

    document.getElementById('detailStatus').innerHTML = statusHTML;
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
    
    // Botón PDF si hay orden de compra recibida
    if (request.purchase_order && request.purchase_order.status === 'recibida') {
        actions.push({
            text: 'Descargar PDF',
            icon: 'fa-file-pdf',
            class: 'btn-outline-danger',
            action: 'download-pdf',
            orderId: request.purchase_order.id,
            orderFolio: request.purchase_order.folio
        });
    }
    
    container.innerHTML = actions.map(action => {
        if (action.href) {
            return `
                <a href="${action.href}" class="btn ${action.class}">
                    <i class="fas ${action.icon} me-2"></i>
                    ${action.text}
                </a>
            `;
        } else if (action.action === 'download-pdf') {
            return `
                <button class="btn ${action.class}" onclick="window.downloadOrderPDF(${action.orderId}, '${action.orderFolio}')">
                    <i class="fas ${action.icon} me-2"></i>
                    ${action.text}
                </button>
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

async function renderTimeline(request) {
    const container = document.getElementById('timelineContainer');

    try {
        // Obtener historial real desde el API
        const response = await fetch(`${CONFIG.API_URL}/requests/${request.id}/history`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const data = await response.json();
        const timeline = [];

        // Mapear estados a información visual
        const statusInfo = {
            'pendiente': { title: 'Pendiente', icon: 'fa-clock', color: 'secondary' },
            'cotizando': { title: 'En Cotización', icon: 'fa-file-invoice-dollar', color: 'info' },
            'autorizada': { title: 'Aprobada por Dirección', icon: 'fa-check-circle', color: 'success' },
            'emitida': { title: 'Orden Emitida', icon: 'fa-file-invoice', color: 'warning' },
            'en_transito': { title: 'En Tránsito', icon: 'fa-truck', color: 'info' },
            'recibida': { title: 'Entregada', icon: 'fa-check-double', color: 'success' },
            'rechazada': { title: 'Rechazada', icon: 'fa-times-circle', color: 'danger' },
            'cancelada': { title: 'Cancelada', icon: 'fa-ban', color: 'danger' }
        };

        if (data.success && data.data.length > 0) {
            // Procesar cada entrada del audit_log
            data.data.forEach(log => {
                let event = null;

                if (log.action === 'create') {
                    event = {
                        title: 'Solicitud Creada',
                        description: `Creada por ${log.user_name || 'Usuario'}`,
                        date: log.created_at,
                        icon: 'fa-plus-circle',
                        color: 'primary'
                    };
                } else if (log.action === 'update' && log.new_values) {
                    try {
                        const newValues = typeof log.new_values === 'string'
                            ? JSON.parse(log.new_values)
                            : log.new_values;

                        // Detectar cambio de estado
                        if (newValues.status) {
                            const info = statusInfo[newValues.status] || { title: newValues.status, icon: 'fa-edit', color: 'secondary' };
                            let description = `Por ${log.user_name || 'Sistema'}`;

                            // Agregar notas si existen
                            if (newValues.notes) {
                                description += `<br><small class="text-muted">${newValues.notes}</small>`;
                            }

                            event = {
                                title: info.title,
                                description: description,
                                date: log.created_at,
                                icon: info.icon,
                                color: info.color
                            };
                        }
                    } catch (e) {
                        console.error('Error parseando new_values:', e);
                    }
                }

                if (event) {
                    timeline.push(event);
                }
            });
        }

        // Si no hay historial, mostrar al menos el evento de creación
        if (timeline.length === 0) {
            timeline.push({
                title: 'Solicitud Creada',
                description: `Creada por ${request.requester_name}`,
                date: request.created_at,
                icon: 'fa-plus-circle',
                color: 'primary'
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
                    <small class="text-muted">
                        <i class="far fa-calendar me-1"></i>${Utils.formatDate(event.date)}
                    <i class="far fa-clock ms-2 me-1"></i>${Utils.formatTime(event.date)}
                </small>
            </div>
        </div>
    `).join('');

    } catch (error) {
        console.error('Error cargando historial:', error);
        // Mostrar mensaje de error
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error al cargar el historial
            </div>
        `;
    }
}

async function loadQuotations(requestId) {
    try {
        // Cargar comparación de cotizaciones (por item)
        const comparisonResponse = await fetch(`${CONFIG.API_URL}/quotations/request/${requestId}/comparison`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const comparisonData = await comparisonResponse.json();

        if (comparisonData.success && comparisonData.data.materials.length > 0) {
            renderQuotationsByItem(comparisonData.data.materials);
            document.getElementById('quotationsSection').style.display = 'block';

            // Mostrar botón de comparar cotizaciones
            const compareBtn = document.getElementById('compareQuotationsBtn');
            if (compareBtn) {
                compareBtn.style.display = 'inline-block';
            }
        }

    } catch (error) {
        console.error('Error cargando cotizaciones:', error);
    }
}

function renderQuotationsByItem(materials) {
    const container = document.getElementById('quotationsContainer');

    if (!materials || materials.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay cotizaciones disponibles</p>';
        return;
    }

    let html = '';

    materials.forEach((material, index) => {
        if (material.quotations.length === 0) return;

        const selectedQuotation = material.quotations.find(q => q.is_selected === true || q.is_selected === 1);
        const hasSelection = !!selectedQuotation;

        html += `
            <div class="card mb-3">
                <div class="card-header bg-light">
                    <h6 class="mb-0">
                        <i class="fas fa-box me-2"></i>
                        ${material.material} (${material.quantity} ${material.unit})
                        ${hasSelection ? '<span class="badge bg-success ms-2">Cotización Seleccionada</span>' : '<span class="badge bg-warning ms-2">Sin Selección</span>'}
                    </h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-sm table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Proveedor</th>
                                    <th>Precio Unit.</th>
                                    <th>Subtotal</th>
                                    <th>Factura</th>
                                    <th>Entrega</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        material.quotations.forEach(q => {
            const isSelected = q.is_selected === true || q.is_selected === 1;
            const subtotal = q.unit_price * material.quantity;
            const rowClass = isSelected ? 'table-success' : '';

            html += `
                <tr class="${rowClass}">
                    <td>
                        <strong>${q.supplier_name}</strong>
                    </td>
                    <td>${Utils.formatCurrency(q.unit_price)}</td>
                    <td class="fw-bold">${Utils.formatCurrency(subtotal)}</td>
                    <td><span class="badge ${q.has_invoice ? 'bg-success' : 'bg-secondary'}">${q.has_invoice ? 'Sí' : 'No'}</span></td>
                    <td>${q.delivery_date ? Utils.formatDate(q.delivery_date) : 'Inmediata'}</td>
                    <td>
                        ${isSelected
                            ? '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Seleccionada</span>'
                            : '<span class="badge bg-secondary">No Seleccionada</span>'}
                    </td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
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

    // Botón comparar cotizaciones
    const compareBtn = document.getElementById('compareQuotationsBtn');
    if (compareBtn) {
        compareBtn.addEventListener('click', function() {
            const urlParams = Utils.getUrlParams();
            window.location.href = `comparacion-cotizaciones.html?request=${urlParams.id}`;
        });
    }
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

// Función para descargar PDF de orden de compra (global para que onclick pueda acceder)
window.downloadOrderPDF = async function(orderId, orderFolio) {
    try {
        console.log('Descargando PDF para orden:', orderId, orderFolio);
        Utils.showToast('Generando PDF...', 'info');

        const response = await fetch(`${CONFIG.API_URL}/orders/${orderId}/pdf`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Error response:', errorData);
            throw new Error('Error al generar el PDF');
        }

        // Convertir respuesta a blob
        const blob = await response.blob();
        console.log('Blob creado:', blob.size, 'bytes');

        // Crear enlace de descarga
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Orden_Compra_${orderFolio}.pdf`;
        document.body.appendChild(a);
        a.click();

        // Limpiar
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        Utils.showToast('PDF descargado exitosamente', 'success');

    } catch (error) {
        console.error('Error completo descargando PDF:', error);
        Utils.showToast('Error al descargar el PDF: ' + error.message, 'error');
    }
}
