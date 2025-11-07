let requestsTable;
let currentRequestId = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    // Inicializar página
    initPage();
});

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

    // Panel simplificado: Solo total y leyenda de estados con conteo
    const statsHTML = `
        <div class="col-12 mb-3">
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-white">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-list text-success me-2"></i>
                            <h5 class="mb-0">Mis Solicitudes</h5>
                        </div>
                        <div class="stat-card stat-primary d-inline-block px-3 py-2">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-file-alt me-2"></i>
                                <div>
                                    <div class="stat-number d-inline">${stats.total || 0}</div>
                                    <small class="text-muted ms-1">Total</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <!-- Leyenda de estados con conteo -->
                    <div class="row row-cols-2 row-cols-md-4 row-cols-lg-5 g-2">
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-secondary">Borrador</span>
                                <span class="fw-bold">${stats.borradores || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-primary">Programada</span>
                                <span class="fw-bold">${stats.programadas || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-warning text-dark">Pendiente</span>
                                <span class="fw-bold">${stats.pendientes || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-info">Cotizando</span>
                                <span class="fw-bold">${stats.cotizando || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-success">Autorizada</span>
                                <span class="fw-bold">${stats.autorizadas || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge" style="background-color: #6f42c1; color: white;">Emitida</span>
                                <span class="fw-bold">${stats.emitidas || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-secondary">En Tránsito</span>
                                <span class="fw-bold">${stats.en_transito || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-dark">Recibida</span>
                                <span class="fw-bold">${stats.recibidas || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-danger">Rechazada</span>
                                <span class="fw-bold">${stats.rechazadas || 0}</span>
                            </div>
                        </div>
                        <div class="col">
                            <div class="d-flex align-items-center justify-content-between p-2 border rounded">
                                <span class="badge bg-danger">Cancelada</span>
                                <span class="fw-bold">${stats.canceladas || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    statsRow.innerHTML = statsHTML;
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
                render: function(data, type, row) {
                    // Flujo lineal único: pendiente → cotizando → autorizada → emitida → en_transito → recibida
                    let statusHtml = Utils.getStatusBadge(data);

                    // Si está programada, mostrar countdown o fecha programada
                    if (data === 'programada' && row.scheduled_for) {
                        if (typeof Utils.getCountdown === 'function') {
                            const countdown = Utils.getCountdown(row.scheduled_for);
                            statusHtml += `<br><small class="text-muted countdown-text" data-scheduled="${row.scheduled_for}">${countdown}</small>`;
                        } else {
                            // Fallback: mostrar la fecha y hora programada (parseando correctamente)
                            const scheduledDate = new Date(row.scheduled_for); // Las fechas con hora sí pueden usar new Date() directamente
                            const dateStr = scheduledDate.toLocaleDateString('es-MX', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            });
                            const timeStr = scheduledDate.toLocaleTimeString('es-MX', {
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            statusHtml += `<br><small class="text-muted"><i class="fas fa-calendar-alt me-1"></i>${dateStr}<br><i class="fas fa-clock me-1"></i>${timeStr}</small>`;
                        }
                    }

                    return statusHtml;
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
                    if (!data) return '-';

                    // Parsear fecha SIN conversión UTC
                    const deliveryDate = Utils.parseLocalDate(data);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Comparar solo fechas, sin hora

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
                    let actions = `
                        <div class="btn-group" role="group">`;

                    // Si es borrador o programada, botón de editar que va a nueva-solicitud
                    if (row.status === 'borrador' || row.status === 'programada') {
                        const buttonLabel = row.status === 'programada' ? 'Editar programación' : 'Editar borrador';
                        actions += `
                            <a href="nueva-solicitud.html?draft_id=${row.id}"
                               class="btn btn-sm btn-outline-warning" title="${buttonLabel}">
                                <i class="fas fa-edit"></i>
                            </a>
                            <button class="btn btn-sm btn-outline-danger delete-draft"
                                    data-id="${row.id}" data-folio="${row.folio}" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>`;
                    } else {
                        // Para solicitudes normales, botón de ver detalles
                        actions += `
                            <a href="detalle-solicitud.html?id=${row.id}"
                               class="btn btn-sm btn-outline-primary" title="Ver detalles">
                                <i class="fas fa-eye"></i>
                            </a>`;

                        // Botón PDF si la orden está recibida
                        if (row.status === 'recibida' && row.purchase_order_id) {
                            actions += `
                                <button class="btn btn-sm btn-outline-danger download-pdf"
                                        data-order-id="${row.purchase_order_id}"
                                        data-order-folio="${row.purchase_order_folio || 'orden'}"
                                        title="Descargar PDF de Orden de Compra">
                                    <i class="fas fa-file-pdf"></i>
                                </button>`;
                        }

                        // Botón cancelar si está pendiente
                        if (row.status === 'pendiente') {
                            actions += `
                                <button class="btn btn-sm btn-outline-danger cancel-request"
                                        data-id="${row.id}" data-folio="${row.folio}" title="Cancelar">
                                    <i class="fas fa-times"></i>
                                </button>`;
                        }
                    }

                    actions += `</div>`;
                    return actions;
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

    // Cancelar solicitud
    $(document).on('click', '.cancel-request', handleCancelRequest);
    document.getElementById('confirmCancel').addEventListener('click', confirmCancelRequest);

    // Eliminar borrador
    $(document).on('click', '.delete-draft', handleDeleteDraft);

    // Descargar PDF de orden de compra
    $(document).on('click', '.download-pdf', handleDownloadPDF);

    // Iniciar actualización de countdowns cada minuto
    startCountdownUpdater();
}

// Actualizar countdowns cada minuto
function startCountdownUpdater() {
    // Verificar que la función existe antes de iniciar el timer
    if (typeof Utils.getCountdown !== 'function') {
        console.warn('⚠️ Utils.getCountdown no está disponible. Por favor, limpia el caché del navegador (Ctrl+Shift+Delete)');
        return;
    }

    setInterval(() => {
        const countdownElements = document.querySelectorAll('.countdown-text');
        countdownElements.forEach(element => {
            const scheduledFor = element.getAttribute('data-scheduled');
            if (scheduledFor && typeof Utils.getCountdown === 'function') {
                element.innerHTML = Utils.getCountdown(scheduledFor);
            }
        });
    }, 60000); // Actualizar cada minuto
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

// Función para descargar PDF de orden de compra
async function handleDownloadPDF(e) {
    const button = e.currentTarget;
    const orderId = button.getAttribute('data-order-id');
    const orderFolio = button.getAttribute('data-order-folio');

    try {
        // Deshabilitar botón temporalmente
        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        Utils.showToast('Generando PDF...', 'info');

        const response = await fetch(`${CONFIG.API_URL}/orders/${orderId}/pdf`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al generar el PDF');
        }

        // Convertir respuesta a blob
        const blob = await response.blob();

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

        // Restaurar botón
        button.disabled = false;
        button.innerHTML = originalHTML;

    } catch (error) {
        console.error('Error descargando PDF:', error);
        Utils.showToast('Error al descargar el PDF', 'error');

        // Restaurar botón
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-file-pdf"></i>';
    }
}

// Función para eliminar borrador
async function handleDeleteDraft(e) {
    e.preventDefault();
    const button = e.currentTarget;
    const draftId = button.getAttribute('data-id');
    const folio = button.getAttribute('data-folio');

    // Confirmar eliminación
    if (!confirm(`¿Está seguro de que desea eliminar el borrador ${folio}?`)) {
        return;
    }

    try {
        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const response = await api.deleteDraft(draftId);

        if (response.success) {
            Utils.showToast('Borrador eliminado exitosamente', 'success');
            refreshTable();
        }

    } catch (error) {
        console.error('Error eliminando borrador:', error);
        Utils.handleApiError(error, 'Error al eliminar el borrador');

        // Restaurar botón
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-trash"></i>';
    }
}
