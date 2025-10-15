document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes
    await loadComponents();

    // Inicializar página
    initSuppliersPage();
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

        // Activar link de proveedores
        const supplierLink = document.querySelector('.sidebar .nav-link[href="suppliers.html"]');
        if (supplierLink) {
            supplierLink.classList.add('active');
        }

    } catch (error) {
        console.error('Error cargando componentes:', error);
    }
}

let suppliersTable;
let currentSupplier = null;

function initSuppliersPage() {
    // Verificar autenticación
    if (!Auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Inicializar DataTable
    initDataTable();

    // Event listeners
    setupEventListeners();

    // Verificar permisos
    checkPermissions();
}

function initDataTable() {
    suppliersTable = $('#suppliersTable').DataTable({
        ...CONFIG.DATATABLE_CONFIG,
        ajax: {
            url: `${CONFIG.API_URL}/suppliers`,
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            },
            data: function(d) {
                // Agregar filtros
                d.active_only = $('#statusFilter').val();
                d.category = $('#categoryFilter').val();
                d.min_rating = $('#ratingFilter').val();
            },
            dataSrc: function(json) {
                if (json.success) {
                    return json.data.suppliers || [];
                } else {
                    Utils.showToast(json.error || 'Error cargando proveedores', 'error');
                    return [];
                }
            },
            error: function(xhr, error, thrown) {
                console.error('Error en DataTable:', error);
                Utils.showToast('Error cargando datos de proveedores', 'error');
            }
        },
        columns: [
            {
                data: 'name',
                render: function(data, type, row) {
                    return `
                        <div class="d-flex align-items-center">
                            <div class="avatar-circle bg-primary text-white me-2">
                                ${data.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <strong>${data}</strong>
                                ${row.email ? `<br><small class="text-muted">${row.email}</small>` : ''}
                            </div>
                        </div>
                    `;
                }
            },
            {
                data: 'rfc',
                render: function(data) {
                    return data || '<span class="text-muted">N/A</span>';
                }
            },
            {
                data: 'contact_name',
                render: function(data, type, row) {
                    let html = data || '<span class="text-muted">N/A</span>';
                    if (row.phone) {
                        html += `<br><small class="text-muted"><i class="fas fa-phone"></i> ${row.phone}</small>`;
                    }
                    return html;
                }
            },
            {
                data: 'category',
                render: function(data) {
                    if (!data) return '<span class="text-muted">Sin categoría</span>';

                    const colors = {
                        'Ferretería': 'warning',
                        'Oficina': 'info',
                        'Tecnología': 'primary',
                        'Limpieza': 'success',
                        'Médico': 'danger',
                        'Mantenimiento': 'secondary'
                    };

                    const color = colors[data] || 'secondary';
                    return `<span class="badge bg-${color}">${data}</span>`;
                }
            },
            {
                data: 'rating',
                render: function(data) {
                    const rating = parseFloat(data) || 0;
                    let stars = '';
                    for (let i = 1; i <= 5; i++) {
                        stars += i <= rating ? '⭐' : '☆';
                    }
                    return `${stars} (${rating})`;
                }
            },
            {
                data: 'is_active',
                render: function(data) {
                    return data == 1
                        ? '<span class="badge bg-success">Activo</span>'
                        : '<span class="badge bg-secondary">Inactivo</span>';
                }
            },
            {
                data: null,
                orderable: false,
                render: function(data, type, row) {
                    const user = Auth.getCurrentUser();
                    const canEdit = user.role === 'admin' || user.role === 'purchaser';

                    let actions = `
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="viewSupplier(${row.id})" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                    `;

                    if (canEdit) {
                        actions += `
                            <button class="btn btn-sm btn-outline-warning me-1" onclick="editSupplier(${row.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-${row.is_active ? 'secondary' : 'success'}"
                                    onclick="toggleSupplierStatus(${row.id}, ${row.is_active})"
                                    title="${row.is_active ? 'Desactivar' : 'Activar'}">
                                <i class="fas fa-${row.is_active ? 'ban' : 'check'}"></i>
                            </button>
                        `;
                    }

                    return actions;
                }
            }
        ],
        order: [[0, 'asc']]
    });
}

function setupEventListeners() {
    // Filtros
    $('#statusFilter, #categoryFilter, #ratingFilter').on('change', function() {
        suppliersTable.ajax.reload();
    });

    // Limpiar filtros
    $('#clearFilters').on('click', function() {
        $('#statusFilter').val('');
        $('#categoryFilter').val('');
        $('#ratingFilter').val('');
        suppliersTable.ajax.reload();
    });

    // Exportar a Excel
    $('#exportBtn').on('click', exportToExcel);

    // Form submit
    $('#supplierForm').on('submit', handleFormSubmit);

    // Modal events
    $('#supplierModal').on('hidden.bs.modal', function() {
        resetForm();
    });
}

function checkPermissions() {
    const user = Auth.getCurrentUser();
    const canManage = user.role === 'admin' || user.role === 'purchaser';

    // Mostrar/ocultar botones según permisos
    if (!canManage) {
        $('.purchaser-only, .admin-only').hide();
    }
}

async function viewSupplier(id) {
    try {
        const response = await API.get(`/suppliers/${id}`);

        if (response.success) {
            const supplier = response.data;

            // Crear modal de vista
            const modalHtml = `
                <div class="modal fade" id="viewSupplierModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="fas fa-truck me-2"></i>
                                    Detalles del Proveedor
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>Nombre:</strong> ${supplier.name}</p>
                                        <p><strong>RFC:</strong> ${supplier.rfc || 'N/A'}</p>
                                        <p><strong>Contacto:</strong> ${supplier.contact_name || 'N/A'}</p>
                                        <p><strong>Teléfono:</strong> ${supplier.phone || 'N/A'}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><strong>Email:</strong> ${supplier.email || 'N/A'}</p>
                                        <p><strong>Categoría:</strong> ${supplier.category || 'N/A'}</p>
                                        <p><strong>Calificación:</strong> ${supplier.rating}/5</p>
                                        <p><strong>Estado:</strong> ${supplier.is_active ? 'Activo' : 'Inactivo'}</p>
                                    </div>
                                    <div class="col-12">
                                        <p><strong>Dirección:</strong><br>${supplier.address || 'N/A'}</p>
                                        <p><strong>Notas:</strong><br>${supplier.notes || 'Sin notas'}</p>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remover modal anterior si existe
            $('#viewSupplierModal').remove();

            // Agregar y mostrar nuevo modal
            $('body').append(modalHtml);
            $('#viewSupplierModal').modal('show');

        } else {
            Utils.showToast('Error cargando detalles del proveedor', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Utils.showToast('Error cargando detalles del proveedor', 'error');
    }
}

async function editSupplier(id) {
    try {
        const response = await API.get(`/suppliers/${id}`);

        if (response.success) {
            currentSupplier = response.data;

            // Llenar el formulario
            $('#name').val(currentSupplier.name);
            $('#rfc').val(currentSupplier.rfc);
            $('#contact_name').val(currentSupplier.contact_name);
            $('#phone').val(currentSupplier.phone);
            $('#email').val(currentSupplier.email);
            $('#category').val(currentSupplier.category);
            $('#address').val(currentSupplier.address);
            $('#rating').val(currentSupplier.rating);
            $('#is_active').val(currentSupplier.is_active);
            $('#notes').val(currentSupplier.notes);

            // Cambiar título del modal
            $('#modalTitle').text('Editar Proveedor');

            // Mostrar modal
            $('#supplierModal').modal('show');

        } else {
            Utils.showToast('Error cargando datos del proveedor', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Utils.showToast('Error cargando datos del proveedor', 'error');
    }
}

async function toggleSupplierStatus(id, currentStatus) {
    const action = currentStatus ? 'desactivar' : 'activar';

    if (!confirm(`¿Estás seguro de que deseas ${action} este proveedor?`)) {
        return;
    }

    try {
        const response = await API.patch(`/suppliers/${id}`, {
            is_active: currentStatus ? 0 : 1
        });

        if (response.success) {
            Utils.showToast(`Proveedor ${action}do exitosamente`, 'success');
            suppliersTable.ajax.reload();
        } else {
            Utils.showToast(response.error || `Error al ${action} proveedor`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Utils.showToast(`Error al ${action} proveedor`, 'error');
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        name: $('#name').val().trim(),
        rfc: $('#rfc').val().trim(),
        contact_name: $('#contact_name').val().trim(),
        phone: $('#phone').val().trim(),
        email: $('#email').val().trim(),
        category: $('#category').val(),
        address: $('#address').val().trim(),
        rating: parseFloat($('#rating').val()),
        is_active: parseInt($('#is_active').val()),
        notes: $('#notes').val().trim()
    };

    // Validación básica
    if (!formData.name) {
        Utils.showToast('El nombre de la empresa es obligatorio', 'error');
        return;
    }

    try {
        let response;

        if (currentSupplier) {
            // Editar proveedor existente
            response = await API.put(`/suppliers/${currentSupplier.id}`, formData);
        } else {
            // Crear nuevo proveedor
            response = await API.post('/suppliers', formData);
        }

        if (response.success) {
            Utils.showToast(
                currentSupplier ? 'Proveedor actualizado exitosamente' : 'Proveedor creado exitosamente',
                'success'
            );
            $('#supplierModal').modal('hide');
            suppliersTable.ajax.reload();
        } else {
            Utils.showToast(response.error || 'Error al guardar proveedor', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Utils.showToast('Error al guardar proveedor', 'error');
    }
}

async function exportToExcel() {
    try {
        const filters = {
            active_only: $('#statusFilter').val(),
            category: $('#categoryFilter').val(),
            min_rating: $('#ratingFilter').val()
        };

        const queryParams = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                queryParams.append(key, filters[key]);
            }
        });

        const url = `${CONFIG.API_URL}/reports/suppliers/excel?${queryParams.toString()}`;

        // Crear link temporal para descarga
        const a = document.createElement('a');
        a.href = url;
        a.download = `proveedores_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        Utils.showToast('Exportación iniciada', 'success');

    } catch (error) {
        console.error('Error:', error);
        Utils.showToast('Error al exportar datos', 'error');
    }
}

function resetForm() {
    currentSupplier = null;
    $('#supplierForm')[0].reset();
    $('#modalTitle').text('Nuevo Proveedor');
    $('#rating').val('5');
    $('#is_active').val('1');
}