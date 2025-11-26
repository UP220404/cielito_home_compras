document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    // Inicializar página
    initSuppliersPage();
});

let suppliersTable;
let currentSupplier = null;
let categories = [];

function initSuppliersPage() {
    // Verificar autenticación
    if (!Utils.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Cargar estadísticas del dashboard
    loadStatistics();

    // Cargar categorías
    loadCategories();

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
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            data: function(d) {
                // No filtrar por defecto - mostrar todos los proveedores
                d.active_only = 'false';
                // Si existen filtros en el HTML, usarlos
                if ($('#statusFilter').length) d.active_only = $('#statusFilter').val();
                if ($('#categoryFilter').length) d.category = $('#categoryFilter').val();
                if ($('#ratingFilter').length) d.min_rating = $('#ratingFilter').val();
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
                    const user = Utils.getCurrentUser();
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
                        `;

                        if (row.is_active) {
                            actions += `
                                <button class="btn btn-sm btn-outline-secondary"
                                        onclick="toggleSupplierStatus(${row.id}, ${row.is_active})"
                                        title="Desactivar">
                                    <i class="fas fa-ban"></i>
                                </button>
                            `;
                        } else {
                            actions += `
                                <button class="btn btn-sm btn-outline-success me-1"
                                        onclick="toggleSupplierStatus(${row.id}, ${row.is_active})"
                                        title="Reactivar">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger"
                                        onclick="deleteSupplierPermanently(${row.id}, '${row.name.replace(/'/g, "\\'")}')"
                                        title="Eliminar permanentemente">
                                    <i class="fas fa-trash"></i>
                                </button>
                            `;
                        }
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

    // Manejar cambio en selector de categoría
    $('#categorySelect').on('change', function() {
        const value = $(this).val();
        const newCategoryInput = $('#newCategoryInput');

        if (value === '__nueva__') {
            // Mostrar input para nueva categoría
            newCategoryInput.removeClass('d-none').focus();
            newCategoryInput.attr('name', 'category');
            $(this).attr('name', 'category_select_temp'); // Remover name para que no se envíe
        } else {
            // Ocultar input de nueva categoría
            newCategoryInput.addClass('d-none').val('');
            newCategoryInput.attr('name', '');
            $(this).attr('name', 'category_select');
        }
    });

    // Modal events
    $('#supplierModal').on('hidden.bs.modal', function() {
        resetForm();
    });

    // Recargar categorías cuando se abra el modal
    $('#supplierModal').on('show.bs.modal', function() {
        loadCategories();
    });
}

function checkPermissions() {
    const user = Utils.getCurrentUser();
    const canManage = user.role === 'admin' || user.role === 'purchaser';

    // Mostrar/ocultar botones según permisos
    if (!canManage) {
        $('.purchaser-only, .admin-only').hide();
    }
}

async function viewSupplier(id) {
    // Redirigir a la página de detalle del proveedor
    window.location.href = `detalle-proveedor.html?id=${id}`;
}

async function editSupplier(id) {
    try {
        const response = await api.getSupplierById(id);

        console.log('Respuesta editSupplier:', response);

        // El backend devuelve los datos directamente en response.data (no en response.data.supplier)
        if (response.success && response.data) {
            currentSupplier = response.data;

            // Llenar el formulario usando atributo name
            $('[name="name"]').val(currentSupplier.name || '');
            $('[name="rfc"]').val(currentSupplier.rfc || '');
            $('[name="contact_name"]').val(currentSupplier.contact_name || '');
            $('[name="phone"]').val(currentSupplier.phone || '');
            $('[name="email"]').val(currentSupplier.email || '');
            $('[name="address"]').val(currentSupplier.address || '');
            $('[name="notes"]').val(currentSupplier.notes || '');

            // Campos opcionales
            $('[name="vendor_size"]').val(currentSupplier.vendor_size || '');
            $('[name="specialty"]').val(currentSupplier.specialty || '');
            $('[name="has_invoice"]').val(currentSupplier.has_invoice === true ? 'true' : currentSupplier.has_invoice === false ? 'false' : '');
            $('[name="business_name"]').val(currentSupplier.business_name || '');
            $('[name="rating"]').val(currentSupplier.rating || '5');

            // Manejar categoría
            const category = currentSupplier.category || '';
            if (category) {
                // Verificar si la categoría existe en el select
                const optionExists = $('#categorySelect option[value="' + category + '"]').length > 0;
                if (optionExists) {
                    // Seleccionar la categoría existente
                    $('#categorySelect').val(category);
                    $('#newCategoryInput').addClass('d-none').val('');
                } else {
                    // La categoría no existe, usar "nueva" y mostrar input
                    $('#categorySelect').val('__nueva__');
                    $('#newCategoryInput').removeClass('d-none').val(category);
                }
            }

            // Cambiar título del modal
            $('#modalTitle').text('Editar Proveedor');

            // Mostrar modal
            $('#supplierModal').modal('show');

        } else {
            console.error('Respuesta del servidor:', response);
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
        const response = await api.toggleSupplier(id);

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

async function deleteSupplierPermanently(id, name) {
    if (!confirm(`⚠️ ADVERTENCIA: ¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE al proveedor "${name}"?\n\nEsta acción NO se puede deshacer.`)) {
        return;
    }

    // Segundo confirm para estar seguro
    if (!confirm('¿Realmente deseas continuar con la eliminación permanente?')) {
        return;
    }

    try {
        const response = await api.request(`/suppliers/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            Utils.showToast('Proveedor eliminado permanentemente', 'success');
            suppliersTable.ajax.reload();
        } else {
            Utils.showToast(response.error || 'Error al eliminar proveedor', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Utils.showToast('Error al eliminar proveedor', 'error');
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    // Obtener categoría: o del select o del input de nueva categoría
    let category = null;
    const categorySelectValue = $('#categorySelect').val();
    if (categorySelectValue === '__nueva__') {
        // Nueva categoría personalizada
        category = $('#newCategoryInput').val()?.trim() || null;

        // Validar que la nueva categoría no exista ya (case-insensitive)
        if (category) {
            const categoryLower = category.toLowerCase();
            const existingCategory = categories.find(cat =>
                cat.category.toLowerCase() === categoryLower
            );

            if (existingCategory) {
                Utils.showToast(
                    `La categoría "${existingCategory.category}" ya existe. Por favor selecciónala de la lista.`,
                    'warning'
                );
                // Seleccionar automáticamente la categoría existente
                $('#categorySelect').val(existingCategory.category);
                $('#newCategoryInput').addClass('d-none').val('');
                return;
            }
        }
    } else if (categorySelectValue) {
        // Categoría existente seleccionada
        category = categorySelectValue;
    }

    // Manejar has_invoice
    const hasInvoiceVal = $('[name="has_invoice"]').val();
    const hasInvoice = hasInvoiceVal === 'true' ? true : hasInvoiceVal === 'false' ? false : null;

    const formData = {
        name: $('[name="name"]').val()?.trim() || '',
        rfc: $('[name="rfc"]').val()?.trim() || null,
        contact_name: $('[name="contact_name"]').val()?.trim() || null,
        phone: $('[name="phone"]').val()?.trim() || null,
        email: $('[name="email"]').val()?.trim() || null,
        category: category,
        address: $('[name="address"]').val()?.trim() || null,
        notes: $('[name="notes"]').val()?.trim() || null,
        // Campos opcionales
        vendor_size: $('[name="vendor_size"]').val() || null,
        specialty: $('[name="specialty"]').val()?.trim() || null,
        has_invoice: hasInvoice,
        business_name: $('[name="business_name"]').val()?.trim() || null,
        rating: parseFloat($('[name="rating"]').val()) || 5
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
            response = await api.updateSupplier(currentSupplier.id, formData);
        } else {
            // Crear nuevo proveedor
            console.log('📤 Enviando datos del proveedor:', JSON.stringify(formData, null, 2));
            response = await api.createSupplier(formData);
            console.log('📥 Respuesta recibida:', JSON.stringify(response, null, 2));
            console.log('📥 response.success:', response.success);
            console.log('📥 response.error:', response.error);
            console.log('📥 response.message:', response.message);
        }

        if (response.success) {
            Utils.showToast(
                currentSupplier ? 'Proveedor actualizado exitosamente' : 'Proveedor creado exitosamente',
                'success'
            );
            $('#supplierModal').modal('hide');
            suppliersTable.ajax.reload();
            // Recargar categorías para actualizar la lista
            loadCategories();
        } else {
            Utils.showToast(response.error || response.message || 'Error al guardar proveedor', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        // Mostrar el mensaje del error si está disponible
        const errorMessage = error.message || 'Error al guardar proveedor';
        Utils.showToast(errorMessage, 'error');
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

    // Resetear selector de categoría
    $('#categorySelect').val('').attr('name', 'category_select');
    $('#newCategoryInput').addClass('d-none').val('').attr('name', '');
}

async function loadCategories() {
    try {
        console.log('🔄 Cargando categorías...');
        const response = await api.getSupplierCategories();

        console.log('📦 Respuesta de categorías:', response);

        if (response.success && response.data) {
            categories = response.data;

            // Actualizar el select con las categorías
            const select = $('#categorySelect');
            console.log('📝 Select encontrado:', select.length > 0);

            if (select.length === 0) {
                console.error('❌ No se encontró el elemento #categorySelect en el DOM');
                return;
            }

            // Guardar la opción de "Agregar nueva"
            const addNewOption = select.find('option[value="__nueva__"]');

            // Limpiar opciones existentes (excepto la primera y la última)
            select.find('option').not(':first').not('[value="__nueva__"]').remove();

            // Agregar categorías existentes
            categories.forEach(cat => {
                const option = `<option value="${cat.category}">${cat.category} (${cat.count || 0})</option>`;
                addNewOption.before(option);
                console.log('➕ Agregada categoría:', cat.category);
            });

            console.log('✅ Categorías cargadas:', categories.length);
            console.log('📋 Categorías disponibles:', categories.map(c => c.category).join(', '));
        } else {
            console.error('❌ No hay datos de categorías en la respuesta');
        }
    } catch (error) {
        console.error('❌ Error cargando categorías:', error);
        // No mostramos error al usuario, solo log en consola
    }
}

async function loadStatistics() {
    try {
        // Obtener estadísticas directamente del endpoint
        const response = await api.request('/suppliers/stats');

        if (response.success && response.data) {
            const stats = response.data;

            // Total de proveedores
            $('#totalSuppliers').text(stats.total || 0);

            // Proveedores activos
            $('#activeSuppliers').text(stats.active || 0);

            // Categorías únicas
            $('#categories').text(stats.categories || 0);

            // Rating promedio
            $('#avgRating').text(stats.avgRating || '5.0');

            console.log('✅ Estadísticas cargadas:', stats);
        } else {
            // Fallback: obtener todos los proveedores sin límite de paginación
            const response = await api.getSuppliers(1, 10000, { active_only: 'false' });

            if (response.success && response.data) {
                const suppliers = response.data.suppliers || [];
                const pagination = response.data.pagination || {};

                // Total de proveedores (usar el total de paginación)
                const total = pagination.total || suppliers.length;
                $('#totalSuppliers').text(total);

                // Proveedores activos (compatible con boolean y número)
                const active = suppliers.filter(s => s.is_active === true || s.is_active === 1).length;
                $('#activeSuppliers').text(active);

                // Categorías únicas
                const uniqueCategories = new Set(
                    suppliers
                        .filter(s => s.category)
                        .map(s => s.category)
                );
                $('#categories').text(uniqueCategories.size);

                // Rating promedio
                const ratings = suppliers.filter(s => s.rating).map(s => parseFloat(s.rating));
                const avgRating = ratings.length > 0
                    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
                    : '5.0';
                $('#avgRating').text(avgRating);

                console.log('✅ Estadísticas cargadas (fallback):', { total, active, categories: uniqueCategories.size, avgRating });
            }
        }
    } catch (error) {
        console.error('❌ Error cargando estadísticas:', error);
    }
}