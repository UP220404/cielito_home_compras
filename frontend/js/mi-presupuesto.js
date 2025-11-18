// Estado
let currentBudget = null;
let currentExpenses = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticación
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }

    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    // Inicializar filtro de años
    initYearFilter();

    // Cargar datos
    await loadBudgetData();
    await loadExpenses();

    // Event listeners
    document.getElementById('yearFilter').addEventListener('change', async () => {
        await loadBudgetData();
        await loadExpenses();
    });
});

// Inicializar filtro de años
function initYearFilter() {
    const yearSelect = document.getElementById('yearFilter');
    const currentYear = new Date().getFullYear();

    for (let year = currentYear; year >= currentYear - 5; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
}

// Cargar datos del presupuesto
async function loadBudgetData() {
    try {
        const year = document.getElementById('yearFilter').value || new Date().getFullYear();
        const response = await api.get(`/budgets/my?year=${year}`);

        if (response.success) {
            currentBudget = response.data;
            displayBudget(response.data);
        }
    } catch (error) {
        console.error('Error cargando presupuesto:', error);
        showNotification('Error al cargar el presupuesto', 'error');
    }
}

// Mostrar información del presupuesto
function displayBudget(budget) {
    // Si no hay presupuesto asignado
    if (!budget.id || budget.total_amount === 0) {
        document.getElementById('totalBudget').textContent = '$0.00';
        document.getElementById('spentAmount').textContent = '$0.00';
        document.getElementById('availableAmount').textContent = '$0.00';
        document.getElementById('percentageUsed').textContent = '0%';
        document.getElementById('budgetProgressBar').style.width = '0%';
        document.getElementById('budgetProgressBar').querySelector('.progress-text').textContent = '0%';

        document.getElementById('budgetInfo').innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Sin presupuesto asignado</strong><br>
                ${budget.message || 'No hay presupuesto asignado para tu área este año.'}
                Por favor, contacta al departamento de compras o administración.
            </div>
        `;

        return;
    }

    const totalAmount = parseFloat(budget.total_amount) || 0;
    const spentAmount = parseFloat(budget.spent_amount) || 0;
    const availableAmount = parseFloat(budget.available_amount) || (totalAmount - spentAmount);
    const percentageUsed = parseFloat(budget.percentage_used) || 0;

    // Actualizar estadísticas
    document.getElementById('totalBudget').textContent = formatCurrency(totalAmount);
    document.getElementById('spentAmount').textContent = formatCurrency(spentAmount);
    document.getElementById('availableAmount').textContent = formatCurrency(availableAmount);
    document.getElementById('percentageUsed').textContent = `${percentageUsed.toFixed(1)}%`;

    // Actualizar labels
    document.getElementById('availableLabelAmount').textContent = formatCurrency(availableAmount);
    document.getElementById('usedLabelAmount').textContent = formatCurrency(spentAmount);

    // Actualizar barra de progreso
    const progressBar = document.getElementById('budgetProgressBar');
    progressBar.style.width = `${Math.min(percentageUsed, 100)}%`;
    progressBar.querySelector('.progress-text').textContent = `${percentageUsed.toFixed(1)}%`;

    // Cambiar color de la barra según el porcentaje
    progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
    if (percentageUsed >= 90) {
        progressBar.classList.add('bg-danger');
    } else if (percentageUsed >= 75) {
        progressBar.classList.add('bg-warning');
    } else {
        progressBar.classList.add('bg-success');
    }

    // Cambiar color de la tarjeta de porcentaje
    const percentageCard = document.getElementById('percentageCard');
    const icon = percentageCard.querySelector('.stat-icon');
    icon.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info');
    if (percentageUsed >= 90) {
        icon.classList.add('bg-danger');
    } else if (percentageUsed >= 75) {
        icon.classList.add('bg-warning');
    } else {
        icon.classList.add('bg-success');
    }

    // Mostrar alerta según el estado
    const alertEl = document.getElementById('budgetAlert');
    alertEl.style.display = 'block';

    if (percentageUsed >= 100) {
        alertEl.className = 'alert alert-danger';
        alertEl.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <strong>¡Presupuesto Agotado!</strong><br>
            Has utilizado el ${percentageUsed.toFixed(1)}% de tu presupuesto.
            No puedes realizar más solicitudes sin aprobación de Dirección.
        `;
    } else if (percentageUsed >= 90) {
        alertEl.className = 'alert alert-warning';
        alertEl.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Advertencia: Presupuesto Casi Agotado</strong><br>
            Has utilizado el ${percentageUsed.toFixed(1)}% de tu presupuesto.
            Solo te quedan ${formatCurrency(availableAmount)} disponibles.
        `;
    } else if (percentageUsed >= 75) {
        alertEl.className = 'alert alert-info';
        alertEl.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <strong>Aviso</strong><br>
            Has utilizado el ${percentageUsed.toFixed(1)}% de tu presupuesto.
            Tienes ${formatCurrency(availableAmount)} disponibles.
        `;
    } else {
        alertEl.className = 'alert alert-success';
        alertEl.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <strong>Presupuesto Saludable</strong><br>
            Has utilizado el ${percentageUsed.toFixed(1)}% de tu presupuesto.
            Tienes ${formatCurrency(availableAmount)} disponibles.
        `;
    }

    // Información adicional
    const currentMonth = new Date().getMonth() + 1;
    const monthsPassed = currentMonth;
    const monthsRemaining = 12 - currentMonth;
    const avgMonthlySpent = spentAmount / monthsPassed;
    const projectedYearEnd = avgMonthlySpent * 12;
    const projectedRemaining = totalAmount - projectedYearEnd;

    document.getElementById('budgetInfo').innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>Área:</strong> ${budget.area || 'N/A'}</p>
                <p><strong>Año:</strong> ${budget.year || new Date().getFullYear()}</p>
                <p><strong>Presupuesto asignado:</strong> ${formatCurrency(totalAmount)}</p>
                <p><strong>Gastado hasta ahora:</strong> ${formatCurrency(spentAmount)}</p>
                <p><strong>Disponible:</strong> ${formatCurrency(availableAmount)}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Meses transcurridos:</strong> ${monthsPassed} de 12</p>
                <p><strong>Gasto promedio mensual:</strong> ${formatCurrency(avgMonthlySpent)}</p>
                <p><strong>Proyección fin de año:</strong> ${formatCurrency(projectedYearEnd)}</p>
                <p><strong>${projectedRemaining >= 0 ? 'Sobrante proyectado' : 'Déficit proyectado'}:</strong>
                    <span class="${projectedRemaining >= 0 ? 'text-success' : 'text-danger'}">
                        ${formatCurrency(Math.abs(projectedRemaining))}
                    </span>
                </p>
            </div>
        </div>
    `;

    // Proyección
    displayProjection(totalAmount, spentAmount, monthsPassed, monthsRemaining);
}

// Mostrar proyección
function displayProjection(totalBudget, currentSpent, monthsPassed, monthsRemaining) {
    const avgMonthlySpent = currentSpent / monthsPassed;
    const projectedTotalSpent = avgMonthlySpent * 12;
    const suggestedMonthlySpending = (totalBudget - currentSpent) / monthsRemaining;

    let projectionHTML = `
        <h5>Análisis de Gasto</h5>
        <p>Basado en tu gasto actual de <strong>${formatCurrency(currentSpent)}</strong> en ${monthsPassed} meses:</p>
        <ul>
            <li>Tu gasto promedio mensual es: <strong>${formatCurrency(avgMonthlySpent)}</strong></li>
            <li>Si continúas a este ritmo, gastarás: <strong>${formatCurrency(projectedTotalSpent)}</strong> al final del año</li>
    `;

    if (projectedTotalSpent > totalBudget) {
        const excess = projectedTotalSpent - totalBudget;
        projectionHTML += `
            <li class="text-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Advertencia:</strong> Esto excedería tu presupuesto por <strong>${formatCurrency(excess)}</strong>
            </li>
            <li class="text-info">
                <i class="fas fa-lightbulb"></i>
                Para mantenerte dentro del presupuesto, deberías gastar máximo <strong>${formatCurrency(suggestedMonthlySpending)}</strong> por mes durante los próximos ${monthsRemaining} meses
            </li>
        `;
    } else {
        const savings = totalBudget - projectedTotalSpent;
        projectionHTML += `
            <li class="text-success">
                <i class="fas fa-check-circle"></i>
                ¡Excelente! Te sobraría aproximadamente <strong>${formatCurrency(savings)}</strong> al final del año
            </li>
            <li class="text-info">
                Puedes gastar hasta <strong>${formatCurrency(suggestedMonthlySpending)}</strong> por mes y seguir dentro del presupuesto
            </li>
        `;
    }

    projectionHTML += `</ul>`;

    document.getElementById('projection').innerHTML = projectionHTML;
}

// Cargar gastos
async function loadExpenses() {
    try {
        const user = Utils.getCurrentUser();
        const year = document.getElementById('yearFilter').value || new Date().getFullYear();

        // Obtener órdenes de compra del usuario
        const response = await api.get(`/orders?limit=1000`);

        if (response.success) {
            currentExpenses = response.data.orders || [];
            displayExpenses(currentExpenses);
        }
    } catch (error) {
        console.error('Error cargando gastos:', error);
        showNotification('Error al cargar el historial de gastos', 'error');
    }
}

// Mostrar gastos en la tabla
function displayExpenses(orders) {
    const tbody = document.getElementById('expensesTableBody');

    // Filtrar solo las órdenes aprobadas o recibidas (en español e inglés)
    const validOrders = orders.filter(o =>
        o.status === 'approved' || o.status === 'aprobada' ||
        o.status === 'received' || o.status === 'recibida' ||
        o.status === 'completed' || o.status === 'completada'
    );

    if (validOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <i class="fas fa-inbox"></i> No hay gastos registrados este año
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = validOrders.map(order => `
        <tr>
            <td>${formatDate(order.order_date || order.created_at)}</td>
            <td>
                <a href="detalle-orden.html?id=${order.id}">
                    ${order.folio}
                </a>
            </td>
            <td>${order.supplier_name || 'N/A'} - Solicitud: ${order.request_folio}</td>
            <td><strong>${formatCurrency(order.total_amount || 0)}</strong></td>
            <td>${getOrderStatusBadge(order.status)}</td>
            <td>
                <a href="detalle-orden.html?id=${order.id}" class="btn btn-sm btn-icon" title="Ver detalles">
                    <i class="fas fa-eye"></i>
                </a>
            </td>
        </tr>
    `).join('');
}

// Obtener badge de estado para órdenes
function getOrderStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge badge-warning">Pendiente</span>',
        'pendiente': '<span class="badge badge-warning">Pendiente</span>',
        'approved': '<span class="badge badge-success">Aprobada</span>',
        'aprobada': '<span class="badge badge-success">Aprobada</span>',
        'received': '<span class="badge badge-info">Recibida</span>',
        'recibida': '<span class="badge badge-info">Recibida</span>',
        'completed': '<span class="badge badge-primary">Completada</span>',
        'completada': '<span class="badge badge-primary">Completada</span>',
        'cancelled': '<span class="badge badge-dark">Cancelada</span>',
        'cancelada': '<span class="badge badge-dark">Cancelada</span>'
    };
    return badges[status] || `<span class="badge badge-secondary">${status}</span>`;
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
