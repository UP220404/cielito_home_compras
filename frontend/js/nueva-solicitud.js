document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    // Verificar si estamos editando un borrador
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draft_id');

    // Inicializar formulario
    initForm();

    // Cargar borrador si existe
    if (draftId) {
        await loadDraft(draftId);
    }
});

function initForm() {
    const form = document.getElementById('requestForm');
    const user = Utils.getCurrentUser();

    // Llenar opciones de área y pre-seleccionar
    fillAreaOptions(user);

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

function fillAreaOptions(user) {
    const areaSelect = document.getElementById('area');

    // Limpiar opciones existentes
    areaSelect.innerHTML = '';

    // Si el usuario NO es admin, solo puede crear solicitudes de su área
    if (user.role !== 'admin' && user.role !== 'purchaser') {
        // Solo agregar su área
        const option = document.createElement('option');
        option.value = user.area;
        option.textContent = user.area;
        option.selected = true;
        areaSelect.appendChild(option);

        // Estilo de deshabilitado pero sin disabled (para que se envíe en FormData)
        areaSelect.classList.add('bg-light');
        areaSelect.style.pointerEvents = 'none'; // Prevenir clicks
        areaSelect.setAttribute('data-locked', 'true');

        console.log(`✅ Área pre-seleccionada y bloqueada: ${user.area}`);
    } else {
        // Admin/Purchaser pueden seleccionar cualquier área
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Seleccione un área';
        areaSelect.appendChild(placeholderOption);

        CONFIG.AREAS.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            // Pre-seleccionar el área del usuario por defecto
            if (area === user.area) {
                option.selected = true;
            }
            areaSelect.appendChild(option);
        });

        console.log(`✅ Admin/Purchaser: Todas las áreas disponibles, pre-seleccionada: ${user.area}`);
    }
}

function setupEventListeners() {
    const form = document.getElementById('requestForm');
    const addItemBtn = document.getElementById('addItemBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveAsDraftBtn = document.getElementById('saveAsDraftBtn');
    const scheduleBtn = document.getElementById('scheduleBtn');
    const confirmSubmit = document.getElementById('confirmSubmit');
    const confirmScheduleBtn = document.getElementById('confirmScheduleBtn');

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

    // Guardar borrador
    saveAsDraftBtn.addEventListener('click', saveAsDraft);

    // Programar envío
    scheduleBtn.addEventListener('click', openScheduleModal);

    // Confirmar programación
    confirmScheduleBtn.addEventListener('click', scheduleRequest);

    // Enviar formulario
    form.addEventListener('submit', handleFormSubmit);

    // Confirmar envío
    confirmSubmit.addEventListener('click', submitRequest);

    // Continuar sin costos (del modal de advertencia)
    const proceedWithoutCostBtn = document.getElementById('proceedWithoutCost');
    if (proceedWithoutCostBtn) {
        proceedWithoutCostBtn.addEventListener('click', () => {
            // Cerrar modal de advertencia
            const warningModal = bootstrap.Modal.getInstance(document.getElementById('warningModal'));
            if (warningModal) {
                warningModal.hide();
            }

            // Activar flag para saltar advertencias
            skipWarnings = true;

            // Trigger el submit del form de nuevo
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        });
    }

    // Actualizar resumen al cambiar items
    document.addEventListener('input', updateSummary);
    document.addEventListener('change', updateSummary);

    // Configurar mensajes de validación personalizados
    setupCustomValidationMessages();
}

function setupCustomValidationMessages() {
    // Event listener para todos los inputs con data-error-message
    document.addEventListener('invalid', (e) => {
        const input = e.target;
        const customMessage = input.getAttribute('data-error-message');

        if (customMessage) {
            input.setCustomValidity(customMessage);
        }
    }, true);

    // Limpiar el mensaje personalizado cuando el input sea válido
    document.addEventListener('input', (e) => {
        const input = e.target;
        if (input.validity.valid) {
            input.setCustomValidity('');
        }
    }, true);
}

function setupCharacterCounter() {
    const justificationField = document.getElementById('justification');
    const charCount = document.getElementById('charCount');

    if (!justificationField || !charCount) {
        console.warn('Character counter elements not found');
        return;
    }

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
let skipWarnings = false; // Flag para saltar advertencias de costo

function addNewItem(itemData = null) {
    itemCounter++;
    const container = document.getElementById('itemsContainer');
    const noItemsAlert = document.getElementById('noItemsAlert');

    // Extraer datos del item si se proporcionan
    const material = itemData?.material || '';
    const quantity = itemData?.quantity || 1;
    const unit = itemData?.unit || 'pza';
    const specifications = itemData?.specifications || '';
    const approximate_cost = itemData?.approximate_cost || '';
    const in_stock = itemData?.in_stock ? 'checked' : '';
    const location = itemData?.location || '';

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
                           placeholder="Ej: Papel bond, Computadora, etc." required
                           data-label="Material" value="${material}">
                    <div class="invalid-feedback">El material es requerido</div>
                </div>

                <div class="col-md-3 mb-3">
                    <label class="form-label">
                        Cantidad <span class="text-danger">*</span>
                    </label>
                    <input type="number" class="form-control item-quantity" name="items[${itemCounter}][quantity]"
                           min="1" value="${quantity}" required
                           data-label="Cantidad">
                    <div class="invalid-feedback">La cantidad debe ser al menos 1</div>
                </div>

                <div class="col-md-3 mb-3">
                    <label class="form-label">Unidad</label>
                    <select class="form-select" name="items[${itemCounter}][unit]">
                        <option value="pza" ${unit === 'pza' ? 'selected' : ''}>Pieza</option>
                        <option value="kg" ${unit === 'kg' ? 'selected' : ''}>Kilogramo</option>
                        <option value="lt" ${unit === 'lt' ? 'selected' : ''}>Litro</option>
                        <option value="m" ${unit === 'm' ? 'selected' : ''}>Metro</option>
                        <option value="caja" ${unit === 'caja' ? 'selected' : ''}>Caja</option>
                        <option value="paquete" ${unit === 'paquete' ? 'selected' : ''}>Paquete</option>
                        <option value="rollo" ${unit === 'rollo' ? 'selected' : ''}>Rollo</option>
                        <option value="resma" ${unit === 'resma' ? 'selected' : ''}>Resma</option>
                        <option value="galón" ${unit === 'galón' ? 'selected' : ''}>Galón</option>
                        <option value="otros" ${unit === 'otros' ? 'selected' : ''}>Otros</option>
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
                              placeholder="Describa detalladamente las características, marca, modelo, etc."
                              data-label="Especificaciones">${specifications}</textarea>
                    <div class="invalid-feedback">Las especificaciones son requeridas (mínimo 5 caracteres)</div>
                </div>

                <div class="col-md-4 mb-3">
                    <label class="form-label">Costo Aproximado</label>
                    <div class="input-group">
                        <span class="input-group-text">$</span>
                        <input type="number" class="form-control item-cost" name="items[${itemCounter}][approximate_cost]"
                               min="0" step="0.01" placeholder="0.00"
                               data-label="Costo aproximado" value="${approximate_cost}">
                    </div>
                    <div class="form-text">Opcional, si lo conoce</div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" name="items[${itemCounter}][in_stock]" value="1" ${in_stock}>
                        <label class="form-check-label">
                            ¿Disponible en almacén?
                        </label>
                    </div>
                </div>

                <div class="col-md-6 mb-3">
                    <label class="form-label">Ubicación (si está en almacén)</label>
                    <input type="text" class="form-control" name="items[${itemCounter}][location]"
                           placeholder="Ej: Almacén A, Estante 3"
                           data-label="Ubicación" value="${location}">
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
        // Actualizar data-item-id también
        item.setAttribute('data-item-id', number);
    });

    // Resetear el contador al número de items actual
    itemCounter = items.length;
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

    const errors = [];

    // 1. Validar campos básicos
    const area = document.getElementById('area').value;
    if (!area) {
        errors.push('• Debe seleccionar un área solicitante');
    }

    const deliveryDate = document.getElementById('delivery_date').value;
    if (!deliveryDate) {
        errors.push('• Debe especificar una fecha de entrega');
    }

    const priority = document.getElementById('priority').value;
    if (!priority) {
        errors.push('• Debe seleccionar la prioridad');
    }

    const justification = document.getElementById('justification').value.trim();
    if (!justification || justification.length < 10) {
        errors.push('• La justificación debe tener al menos 10 caracteres');
    }
    if (justification.length > 500) {
        errors.push('• La justificación no puede exceder 500 caracteres');
    }

    // 2. Validar fecha de entrega es futura
    if (deliveryDate) {
        const deliveryDateObj = new Date(deliveryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (deliveryDateObj <= today) {
            errors.push('• La fecha de entrega debe ser futura (mínimo mañana)');
        }
    }

    // 3. Validar que hay al menos un item
    if (items.length === 0) {
        errors.push('• Debe agregar al menos un item a la solicitud');
        document.getElementById('noItemsAlert').classList.remove('d-none');
    }

    // 4. Validar cada item
    const warnings = [];
    items.forEach((item, index) => {
        const itemNum = index + 1;

        const material = item.querySelector('[name*="[material]"]').value.trim();
        if (!material) {
            errors.push(`• Item ${itemNum}: Debe especificar el material`);
        }

        const specifications = item.querySelector('[name*="[specifications]"]').value.trim();
        if (!specifications || specifications.length < 5) {
            errors.push(`• Item ${itemNum}: Las especificaciones deben tener al menos 5 caracteres`);
        }

        const quantity = item.querySelector('[name*="[quantity]"]').value;
        if (!quantity || parseInt(quantity) < 1) {
            errors.push(`• Item ${itemNum}: La cantidad debe ser al menos 1`);
        }

        const approximateCost = item.querySelector('[name*="[approximate_cost]"]').value;
        if (!approximateCost || parseFloat(approximateCost) === 0) {
            warnings.push(`• Item ${itemNum} (${material || 'Sin nombre'}): No tiene costo aproximado especificado`);
        }
    });

    // Mostrar errores si existen
    if (errors.length > 0) {
        form.classList.add('was-validated');
        const errorMsg = '<strong>Errores encontrados:</strong><br>' + errors.join('<br>');

        // Crear alerta de error personalizada
        Utils.showAlert('Por favor, corrija los siguientes errores:', 'danger', errorMsg);

        // Scroll al primer campo con error
        const firstInvalid = form.querySelector(':invalid');
        if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalid.focus();
        }

        return false;
    }

    // Mostrar advertencias (no bloquean el envío)
    if (warnings.length > 0 && !skipWarnings) {
        // Mostrar modal de advertencia en vez de confirm feo
        const warningList = document.getElementById('warningList');
        warningList.innerHTML = warnings.map(w => `<li>${w}</li>`).join('');

        const warningModal = new bootstrap.Modal(document.getElementById('warningModal'));
        warningModal.show();

        // Retornar false para detener el flujo
        // El botón "Continuar sin costos" manejará el siguiente paso
        return false;
    }

    // Si llegamos aquí con skipWarnings activo, resetear el flag
    if (skipWarnings) {
        skipWarnings = false;
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

        console.log('📤 Enviando solicitud...');

        // Si estamos editando un borrador, convertirlo en solicitud real
        let response;
        if (window.currentDraftId) {
            console.log(`📝 Convirtiendo borrador ${window.currentDraftId} en solicitud...`);
            response = await api.submitDraft(window.currentDraftId);
        } else {
            // Enviar nueva solicitud
            response = await api.createRequest(formData);
        }

        // ========== MANEJO DE VALIDACIÓN DE HORARIOS ==========
        // Si el backend responde con error de horario
        if (!response.success && response.data && response.data.reason === 'outside_schedule') {
            console.log('⏰ Fuera de horario:', response.data);

            // Cerrar modal de confirmación
            const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
            if (confirmModal) {
                confirmModal.hide();
            }

            // Restaurar botón
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;

            // Mostrar modal de fuera de horario
            document.getElementById('outsideScheduleMessage').textContent = response.message;
            document.getElementById('currentScheduleInfo').textContent = `${response.data.current_day} ${response.data.current_time}`;
            document.getElementById('allowedScheduleInfo').textContent = response.data.allowed_schedule || 'No configurado';
            document.getElementById('nextScheduleInfo').textContent = response.data.next_available || 'No disponible';

            const outsideModal = new bootstrap.Modal(document.getElementById('outsideScheduleModal'));
            outsideModal.show();

            // Agregar evento al botón de programar
            document.getElementById('scheduleFromOutsideBtn').onclick = () => {
                outsideModal.hide();
                openScheduleModal();
            };

            return;
        }

        console.log('✅ Respuesta recibida:', response);

        if (response.success) {
            console.log('🎉 Solicitud creada exitosamente!');

            // Cerrar modal de confirmación
            const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
            if (confirmModal) {
                confirmModal.hide();
            }

            // Mostrar mensaje de éxito (IGUAL que los errores)
            const folio = response.data.folio || `SOL-${response.data.id}`;
            const successMsg = `
                <strong>✓ Solicitud enviada exitosamente</strong><br><br>
                • <strong>Folio:</strong> ${folio}<br>
                • Tu solicitud está <strong>pendiente de autorización</strong><br>
                • El director recibirá una notificación para aprobarla<br><br>
                <div class="alert alert-info mt-3">
                    <i class="fas fa-info-circle me-2"></i>
                    Redirigiendo al detalle de la solicitud en unos momentos...
                </div>
            `;

            Utils.showAlert('¡Solicitud creada exitosamente!', 'success', successMsg);

            // Redirigir después de 4 segundos
            setTimeout(() => {
                window.location.href = `detalle-solicitud.html?id=${response.data.id}`;
            }, 4000);
        } else {
            console.error('❌ Respuesta no exitosa:', response);
        }

    } catch (error) {
        console.error('❌ Error completo:', error);
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

// ================== FUNCIONALIDAD DE BORRADORES ==================

async function saveAsDraft() {
    console.log('💾 Guardando borrador...');

    // Validar que haya al menos un item
    const items = document.querySelectorAll('.item-row');
    if (items.length === 0) {
        Utils.showToast('Debe agregar al menos un artículo', 'warning');
        return;
    }

    try {
        const data = collectFormData();

        // Mostrar loading
        const btn = document.getElementById('saveAsDraftBtn');
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';

        // Si estamos editando un borrador existente, actualizarlo
        let response;
        if (window.currentDraftId) {
            response = await api.updateDraft(window.currentDraftId, data);
        } else {
            response = await api.saveDraft(data);
        }

        if (response.success) {
            Utils.showToast('Borrador guardado exitosamente', 'success');
            setTimeout(() => {
                window.location.href = 'mis-solicitudes.html';
            }, 1500);
        } else {
            throw new Error(response.message || 'Error al guardar borrador');
        }

    } catch (error) {
        console.error('Error guardando borrador:', error);
        Utils.showToast(error.message || 'Error al guardar borrador', 'danger');
        const btn = document.getElementById('saveAsDraftBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Borrador';
    }
}

// ================== FUNCIONALIDAD DE PROGRAMACIÓN ==================

async function openScheduleModal() {
    console.log('📅 Abriendo modal de programación...');

    // Validar que haya al menos un item
    const items = document.querySelectorAll('.item-row');
    if (items.length === 0) {
        Utils.showToast('Debe agregar al menos un artículo antes de programar', 'warning');
        return;
    }

    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
    modal.show();

    // Cargar horarios del área
    await loadAreaSchedules();

    // Obtener próximo horario disponible
    await loadNextAvailable();

    // Configurar datetime mínimo (ahora + 1 hora)
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const minDateTime = now.toISOString().slice(0, 16);
    document.getElementById('scheduledDateTime').min = minDateTime;
}

async function loadAreaSchedules() {
    const scheduleInfo = document.getElementById('scheduleInfo');
    scheduleInfo.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div>Cargando horarios...';

    try {
        const user = Utils.getCurrentUser();
        const response = await api.getSchedules(user.area);

        if (response.success && response.data.length > 0) {
            const schedules = response.data;

            // Agrupar por día
            const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const schedulesByDay = schedules.reduce((acc, schedule) => {
                if (!acc[schedule.day_of_week]) {
                    acc[schedule.day_of_week] = [];
                }
                acc[schedule.day_of_week].push(schedule);
                return acc;
            }, {});

            let html = '<ul class="list-unstyled mb-0">';
            Object.keys(schedulesByDay).sort((a, b) => a - b).forEach(dayNum => {
                const daySchedules = schedulesByDay[dayNum];
                daySchedules.forEach(schedule => {
                    html += `<li><strong>${days[schedule.day_of_week]}:</strong> ${schedule.start_time} - ${schedule.end_time}</li>`;
                });
            });
            html += '</ul>';

            scheduleInfo.innerHTML = html;
        } else {
            scheduleInfo.innerHTML = '<em>No hay horarios configurados para tu área</em>';
        }

    } catch (error) {
        console.error('Error cargando horarios:', error);
        scheduleInfo.innerHTML = '<em class="text-danger">Error cargando horarios</em>';
    }
}

async function loadNextAvailable() {
    try {
        const response = await api.getNextAvailableSchedule();

        if (response.success && response.data.next_available) {
            const nextDate = new Date(response.data.next_available);
            const formatted = `${nextDate.toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })} a las ${nextDate.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit'
            })}`;

            document.getElementById('nextAvailableText').textContent =
                `Próximo horario disponible: ${formatted}`;
            document.getElementById('nextAvailableInfo').style.display = 'block';

            // Sugerir fecha
            document.getElementById('scheduledDateTime').value = nextDate.toISOString().slice(0, 16);
        }

    } catch (error) {
        console.error('Error obteniendo próximo horario:', error);
    }
}

async function scheduleRequest() {
    console.log('⏰ Programando solicitud...');

    const scheduledDateTime = document.getElementById('scheduledDateTime').value;

    if (!scheduledDateTime) {
        Utils.showToast('Seleccione fecha y hora de envío', 'warning');
        return;
    }

    try {
        const data = collectFormData();
        data.scheduled_for = new Date(scheduledDateTime).toISOString();

        // Mostrar loading
        const btn = document.getElementById('confirmScheduleBtn');
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Programando...';

        const response = await api.saveDraft(data);

        if (response.success) {
            Utils.showToast('Solicitud programada exitosamente', 'success');

            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
            modal.hide();

            setTimeout(() => {
                window.location.href = 'mis-solicitudes.html';
            }, 1500);
        } else {
            throw new Error(response.message || 'Error al programar solicitud');
        }

    } catch (error) {
        console.error('Error programando solicitud:', error);
        Utils.showToast(error.message || 'Error al programar solicitud', 'danger');
        const btn = document.getElementById('confirmScheduleBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-clock me-2"></i>Programar';
    }
}

// ==================== CARGAR BORRADOR ====================
async function loadDraft(draftId) {
    try {
        console.log(`📝 Cargando borrador ID: ${draftId}`);
        
        const response = await api.get(`/drafts/${draftId}`);
        
        if (response.success && response.data) {
            const draft = response.data;
            
            console.log('✅ Borrador cargado:', draft);

            // Llenar campos del formulario
            document.getElementById('justification').value = draft.justification || '';
            document.getElementById('priority').value = draft.priority || 'normal';
            document.getElementById('delivery_date').value = draft.delivery_date || '';
            
            // Limpiar items existentes
            document.getElementById('itemsContainer').innerHTML = '';
            
            // Cargar items del borrador
            if (draft.items && draft.items.length > 0) {
                draft.items.forEach(item => {
                    addNewItem(item);
                });
            } else {
                // Si no hay items, agregar uno vacío
                addNewItem();
            }
            
            // Actualizar resumen
            updateSummary();
            
            // Cambiar el título para indicar que es un borrador
            const pageTitle = document.querySelector('.page-title');
            if (pageTitle) {
                pageTitle.innerHTML = '<i class="fas fa-edit me-2"></i>Editar Borrador';
            }
            
            // Guardar el ID del borrador para poder actualizarlo
            window.currentDraftId = draftId;
            
            Utils.showToast('Borrador cargado correctamente', 'success');
        } else {
            throw new Error(response.message || 'No se pudo cargar el borrador');
        }
        
    } catch (error) {
        console.error('❌ Error cargando borrador:', error);
        Utils.showToast(error.message || 'Error al cargar el borrador', 'danger');
        setTimeout(() => {
            window.location.href = 'mis-solicitudes.html';
        }, 2000);
    }
}
