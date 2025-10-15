document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes
    await loadComponents();
    
    // Inicializar formulario
    initForm();
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
        
        // Activar link de nueva solicitud
        document.querySelector('.sidebar .nav-link[href="nueva-solicitud.html"]').classList.add('active');
        
    } catch (error) {
        console.error('Error cargando componentes:', error);
    }
}

function initForm() {
    const form = document.getElementById('requestForm');
    const user = Utils.getCurrentUser();
    
    // Llenar área por defecto
    fillAreaOptions();
    document.getElementById('area').value = user.area;
    
    // Configurar fecha mínima (mañana)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('delivery_date').min = Utils.formatDateForInput(tomorrow);
    
    // Agregar primer item
    addNewItem();
    
    // Event listeners
    setupEventListeners();
    
    // Contador de caracteres
    setupCharacterCounter();
}

function fillAreaOptions() {
    const areaSelect = document.getElementById('area');
    CONFIG.AREAS.forEach(area => {
        const option = document.createElement('option');
        option.value = area;
        option.textContent = area;
        areaSelect.appendChild(option);
    });
}

function setupEventListeners() {
    const form = document.getElementById('requestForm');
    const addItemBtn = document.getElementById('addItemBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveAsDraftBtn = document.getElementById('saveAsDraftBtn');
    const confirmSubmit = document.getElementById('confirmSubmit');
    
    // Agregar item
    addItemBtn.addEventListener('click', addNewItem);
    
    // Cancelar
    cancelBtn.addEventListener('click', () => {
        Utils.showConfirm(
            'Cancelar Solicitud',
            '¿Está seguro de que desea cancelar? Se perderán todos los cambios.',
            () => window.location.href = 'mis-solicitudes.html'
        );
    });
    
    // Guardar borrador (funcionalidad futura)
    saveAsDraftBtn.addEventListener('click', () => {
        Utils.showToast('Funcionalidad de borrador próximamente', 'info');
    });
    
    // Enviar formulario
    form.addEventListener('submit', handleFormSubmit);
    
    // Confirmar envío
    confirmSubmit.addEventListener('click', submitRequest);
    
    // Actualizar resumen al cambiar items
    document.addEventListener('input', updateSummary);
    document.addEventListener('change', updateSummary);
}

function setupCharacterCounter() {
    const justificationField = document.getElementById('justification');
    const charCount = document.getElementById('charCount');
    
    justificationField.addEventListener('input', function() {
        const length = this.value.length;
        charCount.textContent = length;
        
        if (length > 450) {
            charCount.style.color = 'var(--danger-color)';
        } else if (length > 400) {
            charCount.style.color = 'var(--warning-color)';
        } else {
            charCount.style.color = 'var(--success-color)';
        }
    });
}

let itemCounter = 0;

function addNewItem() {
    itemCounter++;
    const container = document.getElementById('itemsContainer');
    const noItemsAlert = document.getElementById('noItemsAlert');
    
    const itemHtml = `
        <div class="item-row border rounded p-3 mb-3" data-item-id="${itemCounter}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0">
                    <i class="fas fa-box me-2"></i>
                    Item #${itemCounter}
                </h6>
                <button type="button" class="btn btn-sm btn-outline-danger remove-item-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">
                        Material <span class="text-danger">*</span>
                    </label>
                    <input type="text" class="form-control" name="items[${itemCounter}][material]" 
                           placeholder="Ej: Papel bond, Computadora, etc." required>
                </div>
                
                <div class="col-md-3 mb-3">
                    <label class="form-label">
                        Cantidad <span class="text-danger">*</span>
                    </label>
                    <input type="number" class="form-control item-quantity" name="items[${itemCounter}][quantity]" 
                           min="1" value="1" required>
                </div>
                
                <div class="col-md-3 mb-3">
                    <label class="form-label">Unidad</label>
                    <select class="form-select" name="items[${itemCounter}][unit]">
                        <option value="pza">Pieza</option>
                        <option value="kg">Kilogramo</option>
                        <option value="lt">Litro</option>
                        <option value="m">Metro</option>
                        <option value="caja">Caja</option>
                        <option value="paquete">Paquete</option>
                        <option value="rollo">Rollo</option>
                        <option value="resma">Resma</option>
                        <option value="galón">Galón</option>
                        <option value="otros">Otros</option>
                    </select>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-8 mb-3">
                    <label class="form-label">
                        Especificaciones <span class="text-danger">*</span>
                    </label>
                    <textarea class="form-control" name="items[${itemCounter}][specifications]" 
                              rows="2" required minlength="5" maxlength="500"
                              placeholder="Describa detalladamente las características, marca, modelo, etc."></textarea>
                </div>
                
                <div class="col-md-4 mb-3">
                    <label class="form-label">Costo Aproximado</label>
                    <div class="input-group">
                        <span class="input-group-text">$</span>
                        <input type="number" class="form-control item-cost" name="items[${itemCounter}][approximate_cost]" 
                               min="0" step="0.01" placeholder="0.00">
                    </div>
                    <div class="form-text">Opcional, si lo conoce</div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" name="items[${itemCounter}][in_stock]" value="1">
                        <label class="form-check-label">
                            ¿Disponible en almacén?
                        </label>
                    </div>
                </div>
                
                <div class="col-md-6 mb-3">
                    <label class="form-label">Ubicación (si está en almacén)</label>
                    <input type="text" class="form-control" name="items[${itemCounter}][location]" 
                           placeholder="Ej: Almacén A, Estante 3">
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', itemHtml);
    
    // Agregar event listener al botón de eliminar
    const newItem = container.lastElementChild;
    const removeBtn = newItem.querySelector('.remove-item-btn');
    removeBtn.addEventListener('click', () => removeItem(newItem));
    
    // Ocultar alerta de no items
    noItemsAlert.classList.add('d-none');
    
    // Actualizar resumen
    updateSummary();
}

function removeItem(itemElement) {
    const container = document.getElementById('itemsContainer');
    const noItemsAlert = document.getElementById('noItemsAlert');
    
    Utils.showConfirm(
        'Eliminar Item',
        '¿Está seguro de que desea eliminar este item?',
        () => {
            itemElement.remove();
            
            // Mostrar alerta si no hay items
            if (container.children.length === 0) {
                noItemsAlert.classList.remove('d-none');
            }
            
            // Renumerar items
            renumberItems();
            updateSummary();
        }
    );
}

function renumberItems() {
    const items = document.querySelectorAll('.item-row');
    items.forEach((item, index) => {
        const number = index + 1;
        const header = item.querySelector('h6');
        header.innerHTML = `<i class="fas fa-box me-2"></i>Item #${number}`;
    });
}

function updateSummary() {
    const items = document.querySelectorAll('.item-row');
    const totalItemsSpan = document.getElementById('totalItems');
    const totalCostSpan = document.getElementById('totalCost');
    
    let totalItems = items.length;
    let totalCost = 0;
    
    items.forEach(item => {
        const quantityInput = item.querySelector('.item-quantity');
        const costInput = item.querySelector('.item-cost');
        
        const quantity = parseInt(quantityInput.value) || 0;
        const unitCost = parseFloat(costInput.value) || 0;
        
        totalCost += quantity * unitCost;
    });
    
    totalItemsSpan.textContent = totalItems;
    totalCostSpan.textContent = Utils.formatCurrency(totalCost);
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validar formulario
    if (!validateForm()) {
        return;
    }
    
    // Mostrar modal de confirmación
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
}

function validateForm() {
    const form = document.getElementById('requestForm');
    const items = document.querySelectorAll('.item-row');
    
    // Validación nativa de Bootstrap
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        Utils.showToast('Por favor, complete todos los campos requeridos', 'warning');
        return false;
    }
    
    // Validar que hay al menos un item
    if (items.length === 0) {
        Utils.showToast('Debe agregar al menos un item a la solicitud', 'warning');
        document.getElementById('noItemsAlert').classList.remove('d-none');
        return false;
    }
    
    // Validar fecha de entrega
    const deliveryDate = new Date(document.getElementById('delivery_date').value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (deliveryDate <= today) {
        Utils.showToast('La fecha de entrega debe ser futura', 'warning');
        return false;
    }
    
    return true;
}

async function submitRequest() {
    try {
        const submitBtn = document.getElementById('confirmSubmit');
        const originalText = submitBtn.innerHTML;
        
        // Mostrar loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';
        
        // Recopilar datos del formulario
        const formData = collectFormData();
        
        // Enviar solicitud
        const response = await api.createRequest(formData);
        
        if (response.success) {
            Utils.showToast('Solicitud creada exitosamente', 'success');
            
            // Cerrar modal
            bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
            
            // Redirigir después de un momento
            setTimeout(() => {
                window.location.href = `detalle-solicitud.html?id=${response.data.id}`;
            }, 1500);
        }
        
    } catch (error) {
        Utils.handleApiError(error, 'Error al crear la solicitud');
        
        // Restaurar botón
        const submitBtn = document.getElementById('confirmSubmit');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Confirmar Envío';
    }
}

function collectFormData() {
    const form = document.getElementById('requestForm');
    const formData = new FormData(form);
    
    // Datos básicos
    const data = {
        area: formData.get('area'),
        delivery_date: formData.get('delivery_date'),
        urgency: formData.get('urgency'),
        priority: formData.get('priority'),
        justification: formData.get('justification'),
        items: []
    };
    
    // Recopilar items
    const items = document.querySelectorAll('.item-row');
    items.forEach(item => {
        const itemData = {
            material: item.querySelector('[name*="[material]"]').value,
            specifications: item.querySelector('[name*="[specifications]"]').value,
            quantity: parseInt(item.querySelector('[name*="[quantity]"]').value),
            unit: item.querySelector('[name*="[unit]"]').value,
            approximate_cost: parseFloat(item.querySelector('[name*="[approximate_cost]"]').value) || null,
            in_stock: item.querySelector('[name*="[in_stock]"]').checked ? 1 : 0,
            location: item.querySelector('[name*="[location]"]').value || null
        };
        
        data.items.push(itemData);
    });
    
    return data;
}
