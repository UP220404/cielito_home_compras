// Estado de la aplicación
let currentInvoices = [];
let currentMonthlyReport = null;
let availableOrders = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticación
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }

    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    // Inicializar años en el filtro
    initYearFilter();

    // Cargar datos iniciales
    await loadMonthlyReport();
    await loadInvoices();
    await loadAvailableOrders();

    // Event listeners
    setupEventListeners();

    // Ya NO permitimos editar el subtotal manualmente
    // Se calcula automáticamente desde la orden seleccionada
});

// Inicializar filtro de años
function initYearFilter() {
    const yearSelect = document.getElementById('filterYear');
    const currentYear = new Date().getFullYear();

    for (let year = currentYear; year >= currentYear - 5; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }

    // Set mes actual
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    document.getElementById('filterMonth').value = currentMonth;
}

// Event listeners
function setupEventListeners() {
    // Botones principales
    document.getElementById('addInvoiceBtn').addEventListener('click', openNewInvoiceModal);
    document.getElementById('applyFilters').addEventListener('click', applyFilters);

    // Modal
    const modal = document.getElementById('invoiceModal');
    const closeBtn = modal.querySelector('.close');
    const cancelBtn = document.getElementById('cancelBtn');

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    document.getElementById('saveInvoiceBtn').addEventListener('click', saveInvoice);

    // Evento para selección de orden - llenar datos automáticamente
    document.getElementById('orderId').addEventListener('change', onOrderSelected);

    // Evento para selección de proveedor
    document.getElementById('supplierId').addEventListener('change', onSupplierSelected);

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Cargar reporte mensual
async function loadMonthlyReport() {
    try {
        const year = document.getElementById('filterYear').value || new Date().getFullYear();
        const response = await api.get(`/invoices/report/monthly?year=${year}`);

        if (response.success) {
            currentMonthlyReport = response.data;
            displayMonthlyReport(response.data);
        }
    } catch (error) {
        console.error('Error cargando reporte mensual:', error);
        showNotification('Error al cargar el reporte mensual', 'error');
    }
}

// Mostrar reporte mensual
function displayMonthlyReport(report) {
    const currentMonth = report.current_month;

    // Actualizar estadísticas
    document.getElementById('totalExpenses').textContent = formatCurrency(currentMonth.total_expenses);
    document.getElementById('totalInvoiced').textContent = formatCurrency(currentMonth.total_invoiced);
    document.getElementById('totalTax').textContent = formatCurrency(currentMonth.total_tax_collected);
    document.getElementById('taxBalance').textContent = formatCurrency(Math.abs(currentMonth.tax_balance));

    // Actualizar estado de salud financiera
    const healthCard = document.getElementById('healthCard');
    const healthMessage = document.getElementById('healthMessage');
    const healthAlert = document.getElementById('healthAlert');

    if (currentMonth.is_healthy) {
        healthCard.classList.remove('stat-danger');
        healthCard.classList.add('stat-success');
        healthMessage.textContent = '¡Estado Saludable!';
        healthAlert.className = 'alert alert-success';
        healthAlert.textContent = currentMonth.message;
        healthAlert.style.display = 'block';
    } else {
        healthCard.classList.remove('stat-success');
        healthCard.classList.add('stat-danger');
        healthMessage.textContent = 'Requiere Atención';
        healthAlert.className = 'alert alert-warning';
        healthAlert.textContent = currentMonth.message;
        healthAlert.style.display = 'block';
    }

    // Mostrar cálculo de facturación requerida
    const requiredText = `
        <strong>Análisis del Mes:</strong><br>
        💰 Has gastado <strong>${formatCurrency(currentMonth.total_expenses)}</strong> este mes (con IVA incluido).<br>
        📊 El IVA que pagaste en compras: <strong>${formatCurrency(currentMonth.expenses_iva_paid)}</strong><br>
        📝 Has facturado <strong>${formatCurrency(currentMonth.total_invoiced)}</strong>, que es el <strong>${currentMonth.percentage_of_required}%</strong> de lo que gastaste.<br>
        💵 IVA cobrado en facturas: <strong>${formatCurrency(currentMonth.total_tax_collected)}</strong><br>
        ${currentMonth.still_need_to_invoice > 0
            ? `<span class="text-warning">⚠️ Aún necesitas facturar <strong>${formatCurrency(currentMonth.still_need_to_invoice)}</strong> para igualar tus gastos.</span><br>`
            : ``
        }
        ${currentMonth.is_healthy
            ? `<span class="text-success">✅ ¡Excelente! ${currentMonth.message}</span>`
            : `<span class="text-danger">❌ ${currentMonth.message}</span>`
        }
    `;

    document.getElementById('requiredInvoicing').innerHTML = requiredText;
}

// Cargar facturas
async function loadInvoices() {
    try {
        const month = document.getElementById('filterMonth').value;
        const year = document.getElementById('filterYear').value;

        let url = '/invoices';
        const params = [];

        if (month) params.push(`month=${month}`);
        if (year) params.push(`year=${year}`);

        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        const response = await api.get(url);

        if (response.success) {
            currentInvoices = response.data;
            displayInvoices(response.data);
        }
    } catch (error) {
        console.error('Error cargando facturas:', error);
        showNotification('Error al cargar las facturas', 'error');
    }
}

// Mostrar facturas en la tabla
function displayInvoices(invoices) {
    const tbody = document.getElementById('invoicesTableBody');

    if (invoices.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">
                    <i class="fas fa-inbox"></i> No hay facturas registradas
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = invoices.map(invoice => `
        <tr>
            <td>${invoice.invoice_number || 'Sin folio'}</td>
            <td>${formatDate(invoice.invoice_date)}</td>
            <td>
                <a href="detalle-orden.html?id=${invoice.order_id}">
                    ${invoice.order_number || `#${invoice.order_id}`}
                </a>
            </td>
            <td>
                ${invoice.all_suppliers || invoice.supplier_name || 'N/A'}
                ${invoice.suppliers_count > 1 ? `<span class="badge bg-info ms-1">${invoice.suppliers_count}</span>` : ''}
            </td>
            <td>${formatCurrency(invoice.subtotal)}</td>
            <td>${formatCurrency(invoice.tax_amount)}</td>
            <td><strong>${formatCurrency(invoice.total_amount)}</strong></td>
            <td>
                ${invoice.file_path
                    ? `<a href="#" onclick="downloadInvoice(${invoice.id}); return false;">
                        <i class="fas fa-file-pdf text-danger"></i> Ver
                       </a>`
                    : '<span class="text-muted">Sin archivo</span>'
                }
            </td>
            <td>
                <button class="btn btn-sm btn-icon" onclick="viewInvoice(${invoice.id})" title="Ver detalles">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-icon" onclick="deleteInvoice(${invoice.id})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Cargar órdenes disponibles
async function loadAvailableOrders() {
    try {
        // Buscar tanto en inglés como en español
        const response = await api.get('/orders?limit=1000&status=approved,aprobada,received,recibida');

        if (response.success) {
            availableOrders = response.data.orders || [];
            console.log('✅ Órdenes disponibles cargadas:', availableOrders.length);
            populateOrdersSelect();
        }
    } catch (error) {
        console.error('Error cargando órdenes:', error);
    }
}

// Poblar select de órdenes
function populateOrdersSelect() {
    const select = document.getElementById('orderId');
    select.innerHTML = '<option value="">Seleccione una orden...</option>';

    availableOrders.forEach(order => {
        // Filtrar órdenes sin monto facturable (todos los items sin factura)
        const invoiceableAmount = order.invoiceable_amount || order.total_amount;
        if (invoiceableAmount <= 0) {
            return; // No mostrar órdenes sin items facturables
        }

        const option = document.createElement('option');
        option.value = order.id;
        // Mostrar todos los proveedores si hay múltiples
        const suppliersDisplay = order.all_suppliers || order.supplier_name;
        option.textContent = `${order.order_number || order.folio} - ${suppliersDisplay} - ${formatCurrency(invoiceableAmount)}`;
        // Guardar el monto facturable como data attribute
        option.setAttribute('data-amount', invoiceableAmount);
        option.setAttribute('data-suppliers', suppliersDisplay);
        select.appendChild(option);
    });
}

// Variable para almacenar los proveedores de la orden actual
let currentOrderSuppliers = [];

// Cuando se selecciona una orden, cargar sus proveedores
async function onOrderSelected(e) {
    const select = e.target;
    const orderId = select.value;
    const supplierGroup = document.getElementById('supplierSelectGroup');
    const supplierSelect = document.getElementById('supplierId');

    // Resetear proveedor
    supplierSelect.innerHTML = '<option value="">Seleccione un proveedor...</option>';
    currentOrderSuppliers = [];

    if (!orderId) {
        supplierGroup.style.display = 'none';
        document.getElementById('subtotal').value = '';
        document.getElementById('taxAmount').value = '';
        document.getElementById('totalAmount').value = '';
        return;
    }

    try {
        // Cargar proveedores de la orden
        const response = await api.get(`/invoices/order/${orderId}/suppliers`);

        if (response.success && response.data.length > 0) {
            currentOrderSuppliers = response.data;

            // Si hay más de un proveedor, mostrar selector
            if (response.data.length > 1) {
                supplierGroup.style.display = 'block';
                supplierSelect.required = true;

                response.data.forEach(supplier => {
                    const option = document.createElement('option');
                    option.value = supplier.id;
                    option.textContent = `${supplier.name} - ${formatCurrency(supplier.total_amount)}`;
                    option.setAttribute('data-amount', supplier.total_amount);

                    if (supplier.has_invoice) {
                        option.textContent += ' ✓ (Ya facturado)';
                        option.disabled = true;
                    }

                    supplierSelect.appendChild(option);
                });

                // No llenar montos hasta que seleccione proveedor
                document.getElementById('subtotal').value = '';
                document.getElementById('taxAmount').value = '';
                document.getElementById('totalAmount').value = '';
            } else {
                // Solo un proveedor, ocultar selector y usar ese
                supplierGroup.style.display = 'none';
                supplierSelect.required = false;

                const supplier = response.data[0];
                if (supplier.has_invoice) {
                    showNotification('Este proveedor ya tiene factura registrada', 'warning');
                }

                // Llenar con el monto del único proveedor
                const subtotal = supplier.total_amount;
                const tax = subtotal * 0.16;
                const total = subtotal + tax;

                document.getElementById('subtotal').value = subtotal.toFixed(2);
                document.getElementById('taxAmount').value = tax.toFixed(2);
                document.getElementById('totalAmount').value = total.toFixed(2);

                // Guardar el supplier_id para enviar
                supplierSelect.innerHTML = `<option value="${supplier.id}" selected>${supplier.name}</option>`;
            }
        } else {
            // Sin proveedores (fallback al comportamiento anterior)
            supplierGroup.style.display = 'none';
            fillAmountsFromOrder(orderId);
        }
    } catch (error) {
        console.error('Error cargando proveedores:', error);
        supplierGroup.style.display = 'none';
        fillAmountsFromOrder(orderId);
    }
}

// Cuando se selecciona un proveedor, llenar montos
function onSupplierSelected(e) {
    const select = e.target;
    const supplierId = select.value;

    if (!supplierId) {
        document.getElementById('subtotal').value = '';
        document.getElementById('taxAmount').value = '';
        document.getElementById('totalAmount').value = '';
        return;
    }

    const supplier = currentOrderSuppliers.find(s => s.id == supplierId);
    if (supplier) {
        const subtotal = supplier.total_amount;
        const tax = subtotal * 0.16;
        const total = subtotal + tax;

        document.getElementById('subtotal').value = subtotal.toFixed(2);
        document.getElementById('taxAmount').value = tax.toFixed(2);
        document.getElementById('totalAmount').value = total.toFixed(2);
    }
}

// Llenar montos desde la orden (fallback)
function fillAmountsFromOrder(orderId) {
    const select = document.getElementById('orderId');
    const selectedOption = select.options[select.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        // Si no hay orden seleccionada, limpiar campos
        document.getElementById('subtotal').value = '';
        document.getElementById('taxAmount').value = '';
        document.getElementById('totalAmount').value = '';
        return;
    }

    // Obtener el total de la orden (que YA incluye IVA)
    const orderTotalWithTax = parseFloat(selectedOption.getAttribute('data-amount')) || 0;

    // IMPORTANTE: El total de la orden incluye IVA (16%)
    // Entonces: total = subtotal + (subtotal * 0.16) = subtotal * 1.16
    // Por lo tanto: subtotal = total / 1.16
    const subtotal = orderTotalWithTax / 1.16;
    const taxAmount = subtotal * 0.16;

    // Llenar los campos
    document.getElementById('subtotal').value = subtotal.toFixed(2);
    document.getElementById('taxAmount').value = taxAmount.toFixed(2);
    document.getElementById('totalAmount').value = orderTotalWithTax.toFixed(2);

    console.log(`📦 Orden seleccionada: Total con IVA: $${orderTotalWithTax}`);
    console.log(`   💰 Subtotal (sin IVA): $${subtotal.toFixed(2)}`);
    console.log(`   🧾 IVA (16%): $${taxAmount.toFixed(2)}`);
    console.log(`   📋 Total: $${orderTotalWithTax.toFixed(2)}`);
}

// Calcular IVA automáticamente
function calculateTax() {
    const subtotal = parseFloat(document.getElementById('subtotal').value) || 0;
    const taxAmount = subtotal * 0.16;
    const total = subtotal + taxAmount;

    document.getElementById('taxAmount').value = taxAmount.toFixed(2);
    document.getElementById('totalAmount').value = total.toFixed(2);
}

// Abrir modal para nueva factura
async function openNewInvoiceModal() {
    document.getElementById('modalTitle').textContent = 'Nueva Factura';
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceId').value = '';

    // Fecha actual por defecto
    document.getElementById('invoiceDate').valueAsDate = new Date();

    // Generar número de factura automático
    await generateInvoiceNumber();

    document.getElementById('invoiceModal').style.display = 'block';
}

// Generar número de factura automático
async function generateInvoiceNumber() {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');

        // Obtener el número de facturas del mes actual para generar el consecutivo
        const response = await api.get(`/invoices?month=${month}&year=${year}`);

        let consecutivo = 1;
        if (response.success && response.data && response.data.length > 0) {
            consecutivo = response.data.length + 1;
        }

        // Formato: FAC-YYYYMM-NNNN
        const invoiceNumber = `FAC-${year}${month}-${consecutivo.toString().padStart(4, '0')}`;
        document.getElementById('invoiceNumber').value = invoiceNumber;

    } catch (error) {
        console.error('Error generando número de factura:', error);
        // Si hay error, usar timestamp como fallback
        const timestamp = Date.now();
        document.getElementById('invoiceNumber').value = `FAC-${timestamp}`;
    }
}

// Cerrar modal
function closeModal() {
    document.getElementById('invoiceModal').style.display = 'none';
}

// Guardar factura
async function saveInvoice() {
    try {
        const form = document.getElementById('invoiceForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const invoiceId = document.getElementById('invoiceId').value;
        const formData = new FormData();

        formData.append('order_id', document.getElementById('orderId').value);

        // Agregar supplier_id si está seleccionado
        const supplierId = document.getElementById('supplierId').value;
        if (supplierId) {
            formData.append('supplier_id', supplierId);
        }

        formData.append('invoice_number', document.getElementById('invoiceNumber').value);
        formData.append('invoice_date', document.getElementById('invoiceDate').value);
        formData.append('subtotal', document.getElementById('subtotal').value);
        formData.append('tax_amount', document.getElementById('taxAmount').value);
        formData.append('total_amount', document.getElementById('totalAmount').value);
        formData.append('notes', document.getElementById('notes').value);

        const fileInput = document.getElementById('invoiceFile');
        if (fileInput.files.length > 0) {
            formData.append('file', fileInput.files[0]);
        }

        showNotification('Guardando factura...', 'info');

        let response;
        if (invoiceId) {
            // Actualizar
            response = await api.putFormData(`/invoices/${invoiceId}`, formData);
        } else {
            // Crear
            response = await api.postFormData('/invoices', formData);
        }

        if (response.success) {
            showNotification('Factura guardada exitosamente', 'success');
            closeModal();
            await loadInvoices();
            await loadMonthlyReport();
        } else {
            showNotification(response.message || 'Error al guardar la factura', 'error');
        }
    } catch (error) {
        console.error('Error guardando factura:', error);
        showNotification(error.message || 'Error al guardar la factura', 'error');
    }
}

// Variable para almacenar el ID de la factura actual
let currentViewInvoiceId = null;

// Ver detalles de factura
async function viewInvoice(id) {
    try {
        const response = await api.get(`/invoices/${id}`);

        if (response.success) {
            const invoice = response.data;
            currentViewInvoiceId = id;

            // Llenar el modal con los datos
            document.getElementById('viewInvoiceNumber').textContent = invoice.invoice_number || 'Sin folio';
            document.getElementById('viewInvoiceDate').textContent = formatDate(invoice.invoice_date);
            document.getElementById('viewOrderNumber').textContent = invoice.order_number || `#${invoice.order_id}`;
            document.getElementById('viewArea').textContent = invoice.area || 'N/A';
            document.getElementById('viewSuppliers').textContent = invoice.all_suppliers || invoice.supplier_name || 'N/A';
            document.getElementById('viewSubtotal').textContent = formatCurrency(invoice.subtotal);
            document.getElementById('viewTax').textContent = formatCurrency(invoice.tax_amount);
            document.getElementById('viewTotal').textContent = formatCurrency(invoice.total_amount);
            document.getElementById('viewNotes').textContent = invoice.notes || 'Sin notas';
            document.getElementById('viewCreatedBy').textContent = invoice.created_by_name || 'N/A';

            // Mostrar/ocultar sección de archivo
            const fileSection = document.getElementById('viewFileSection');
            if (invoice.file_path) {
                fileSection.style.display = 'block';
            } else {
                fileSection.style.display = 'none';
            }

            // Mostrar modal
            document.getElementById('viewInvoiceModal').style.display = 'block';
        }
    } catch (error) {
        console.error('Error cargando factura:', error);
        showNotification('Error al cargar los detalles de la factura', 'error');
    }
}

// Cerrar modal de ver detalles
function closeViewModal() {
    document.getElementById('viewInvoiceModal').style.display = 'none';
    currentViewInvoiceId = null;
}

// Abrir archivo de factura
function openInvoiceFile() {
    if (currentViewInvoiceId) {
        downloadInvoice(currentViewInvoiceId);
    }
}

// Descargar archivo de factura
async function downloadInvoice(id) {
    try {
        const token = localStorage.getItem('token');
        const url = `${API_URL}/invoices/${id}/download`;

        // Crear un fetch con el token en el header
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al descargar el archivo');
        }

        // Obtener el blob del archivo
        const blob = await response.blob();

        // Crear una URL temporal para el blob
        const blobUrl = window.URL.createObjectURL(blob);

        // Obtener el nombre del archivo del header Content-Disposition o usar uno por defecto
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `factura_${id}.pdf`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }

        // Abrir en nueva pestaña para visualizar
        window.open(blobUrl, '_blank');

        // Opcional: también descargar automáticamente
        // const link = document.createElement('a');
        // link.href = blobUrl;
        // link.download = filename;
        // document.body.appendChild(link);
        // link.click();
        // document.body.removeChild(link);

        // Limpiar la URL del blob después de un tiempo
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);

    } catch (error) {
        console.error('Error descargando factura:', error);
        showNotification('Error al descargar el archivo', 'error');
    }
}

// Eliminar factura
async function deleteInvoice(id) {
    Utils.showConfirm('Eliminar Factura', '¿Estás seguro de eliminar esta factura?', async () => {
        try {
            const response = await api.delete(`/invoices/${id}`);

            if (response.success) {
                showNotification('Factura eliminada exitosamente', 'success');
                await loadInvoices();
                await loadMonthlyReport();
            } else {
                showNotification(response.message || 'Error al eliminar la factura', 'error');
            }
        } catch (error) {
            console.error('Error eliminando factura:', error);
            showNotification('Error al eliminar la factura', 'error');
        }
    });
}

// Aplicar filtros
async function applyFilters() {
    await loadInvoices();
    await loadMonthlyReport();
}

// Formatear moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

// Formatear fecha
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
