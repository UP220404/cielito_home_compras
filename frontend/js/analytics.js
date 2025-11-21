document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    // Inicializar página
    initAnalyticsPage();
});

let charts = {};

function initAnalyticsPage() {
    // Verificar autenticación
    if (!Utils.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Verificar permisos
    checkPermissions();

    // Event listeners
    setupEventListeners();

    // Cargar datos iniciales
    loadAnalyticsData();
}

function checkPermissions() {
    const user = Utils.getCurrentUser();

    // Solo directores y admin pueden acceder a analytics
    if (!['director', 'admin'].includes(user.role)) {
        Utils.showToast('No tienes permisos para acceder al analytics', 'error');
        window.location.href = 'dashboard.html';
        return;
    }
}

function setupEventListeners() {
    // Filtro de período
    document.getElementById('periodFilter').addEventListener('change', function() {
        loadAnalyticsData();
    });
}

async function loadAnalyticsData() {
    try {
        const period = document.getElementById('periodFilter').value;

        // Mostrar loading
        showLoading();

        // Cargar datos en paralelo
        const [summary, trends, statusDistribution, areaData, processingTime, suppliers, users, costs] = await Promise.all([
            api.get(`/analytics/summary?period=${period}`),
            api.get(`/analytics/trends?period=${period}`),
            api.get(`/analytics/status-distribution?period=${period}`),
            api.get(`/analytics/by-area?period=${period}`),
            api.get(`/analytics/processing-time?period=${period}`),
            api.get(`/analytics/top-suppliers?period=${period}`),
            api.get(`/analytics/user-activity?period=${period}`),
            api.get(`/analytics/cost-analysis?period=${period}`)
        ]);

        // Actualizar KPIs
        updateKPIs(summary.data);

        // Actualizar gráficas
        updateTrendsChart(trends.data);
        updateStatusPieChart(statusDistribution.data);
        updateAreaChart(areaData.data);
        updateProcessingTimeChart(processingTime.data);
        updateCostAnalysisChart(costs.data);

        // Actualizar listas
        updateTopSuppliers(suppliers.data);
        updateUserActivity(users.data);

        // Generar insights
        generateInsights(summary.data, trends.data);

        hideLoading();

    } catch (error) {
        console.error('Error cargando analytics:', error);
        Utils.showToast('Error cargando datos de analytics', 'error');
        hideLoading();
    }
}

function updateKPIs(data) {
    const formatNumber = (num) => new Intl.NumberFormat('es-MX').format(num);
    const formatCurrency = (num) => new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(num);

    document.getElementById('totalRequests').textContent = formatNumber(data.total_requests || 0);
    document.getElementById('completedRequests').textContent = formatNumber(data.completed_requests || 0);
    document.getElementById('avgProcessingTime').textContent = `${data.avg_processing_time || 0}`;
    document.getElementById('totalValue').textContent = formatCurrency(data.total_value || 0);

    // Calcular y mostrar porcentajes
    const completionRate = data.total_requests > 0
        ? ((data.completed_requests / data.total_requests) * 100).toFixed(1)
        : 0;
    document.getElementById('completionRate').textContent = `${completionRate}%`;

    // Simular crecimiento (en una implementación real esto vendría del backend)
    document.getElementById('requestsGrowth').textContent = `+${(Math.random() * 20).toFixed(1)}%`;
    document.getElementById('timeImprovement').textContent = `${(Math.random() * 10 - 5).toFixed(1)}%`;
    document.getElementById('valueGrowth').textContent = `+${(Math.random() * 15).toFixed(1)}%`;
}

function updateTrendsChart(data) {
    const ctx = document.getElementById('trendsChart').getContext('2d');

    if (charts.trends) {
        charts.trends.destroy();
    }

    charts.trends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Solicitudes Creadas',
                data: data.created || [],
                borderColor: CONFIG.CHART_COLORS.primary,
                backgroundColor: CONFIG.CHART_COLORS.primary + '20',
                tension: 0.4,
                fill: true
            }, {
                label: 'Solicitudes Completadas',
                data: data.completed || [],
                borderColor: CONFIG.CHART_COLORS.success,
                backgroundColor: CONFIG.CHART_COLORS.success + '20',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            ...CONFIG.CHART_CONFIG,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateStatusPieChart(data) {
    const ctx = document.getElementById('statusPieChart').getContext('2d');

    if (charts.statusPie) {
        charts.statusPie.destroy();
    }

    const colors = [
        CONFIG.CHART_COLORS.warning,
        CONFIG.CHART_COLORS.info,
        CONFIG.CHART_COLORS.success,
        CONFIG.CHART_COLORS.danger,
        CONFIG.CHART_COLORS.primary,
        CONFIG.CHART_COLORS.secondary
    ];

    charts.statusPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels || [],
            datasets: [{
                data: data.values || [],
                backgroundColor: colors.slice(0, (data.labels || []).length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            ...CONFIG.CHART_CONFIG,
            cutout: '60%'
        }
    });
}

function updateAreaChart(data) {
    const ctx = document.getElementById('areaChart').getContext('2d');

    if (charts.area) {
        charts.area.destroy();
    }

    charts.area = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Solicitudes',
                data: data.values || [],
                backgroundColor: CONFIG.CHART_COLORS.cielitoGreen,
                borderColor: CONFIG.CHART_COLORS.cielitoDark,
                borderWidth: 1
            }]
        },
        options: {
            ...CONFIG.CHART_CONFIG,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateProcessingTimeChart(data) {
    const ctx = document.getElementById('processingTimeChart').getContext('2d');

    if (charts.processingTime) {
        charts.processingTime.destroy();
    }

    charts.processingTime = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Días Promedio',
                data: data.values || [],
                borderColor: CONFIG.CHART_COLORS.warning,
                backgroundColor: CONFIG.CHART_COLORS.warning + '20',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            ...CONFIG.CHART_CONFIG,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Días'
                    }
                }
            }
        }
    });
}

function updateCostAnalysisChart(data) {
    const ctx = document.getElementById('costAnalysisChart').getContext('2d');

    if (charts.costAnalysis) {
        charts.costAnalysis.destroy();
    }

    charts.costAnalysis = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Valor Total (MXN)',
                data: data.values || [],
                backgroundColor: [
                    CONFIG.CHART_COLORS.primary,
                    CONFIG.CHART_COLORS.success,
                    CONFIG.CHART_COLORS.warning,
                    CONFIG.CHART_COLORS.danger,
                    CONFIG.CHART_COLORS.info,
                    CONFIG.CHART_COLORS.secondary
                ]
            }]
        },
        options: {
            ...CONFIG.CHART_CONFIG,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return new Intl.NumberFormat('es-MX', {
                                style: 'currency',
                                currency: 'MXN',
                                notation: 'compact'
                            }).format(value);
                        }
                    }
                }
            }
        }
    });
}

function updateTopSuppliers(data) {
    const container = document.getElementById('topSuppliers');

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay datos disponibles</p>';
        return;
    }

    const html = data.map((supplier, index) => `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="d-flex align-items-center">
                <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3"
                     style="width: 40px; height: 40px; font-weight: bold;">
                    ${index + 1}
                </div>
                <div>
                    <h6 class="mb-0">${supplier.name}</h6>
                    <small class="text-muted">${supplier.orders_count} órdenes</small>
                </div>
            </div>
            <div class="text-end">
                <strong>${Utils.formatCurrency(supplier.total_value)}</strong>
                <br>
                <small class="text-success">⭐ ${supplier.rating}/5</small>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function updateUserActivity(data) {
    const container = document.getElementById('userActivity');

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay datos disponibles</p>';
        return;
    }

    const html = data.map(user => `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="d-flex align-items-center">
                <div class="avatar-circle bg-success text-white me-3">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h6 class="mb-0">${user.name}</h6>
                    <small class="text-muted">${user.area}</small>
                </div>
            </div>
            <div class="text-end">
                <strong>${user.requests_count}</strong>
                <br>
                <small class="text-muted">solicitudes</small>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function generateInsights(summary, trends) {
    const container = document.getElementById('insights');
    const insights = [];

    // Generar insights basados en los datos
    if (summary.completion_rate > 90) {
        insights.push({
            type: 'success',
            title: 'Excelente Eficiencia',
            message: `El sistema tiene una tasa de completitud del ${summary.completion_rate}%. ¡Mantén el buen trabajo!`
        });
    } else if (summary.completion_rate < 70) {
        insights.push({
            type: 'warning',
            title: 'Oportunidad de Mejora',
            message: 'La tasa de completitud es baja. Considera revisar los procesos de autorización.'
        });
    }

    if (summary.avg_processing_time > 7) {
        insights.push({
            type: 'info',
            title: 'Tiempo de Procesamiento',
            message: 'El tiempo promedio de procesamiento es alto. Revisa los cuellos de botella en el flujo.'
        });
    }

    if (trends.growth_rate > 20) {
        insights.push({
            type: 'success',
            title: 'Crecimiento Positivo',
            message: 'Las solicitudes han aumentado significativamente. Asegúrate de tener suficiente capacidad.'
        });
    }

    // Si no hay insights específicos, mostrar mensaje general
    if (insights.length === 0) {
        insights.push({
            type: 'info',
            title: 'Sistema Estable',
            message: 'El sistema está funcionando dentro de parámetros normales. Continúa monitoreando las métricas.'
        });
    }

    const html = insights.map(insight => `
        <div class="alert alert-${insight.type} d-flex align-items-center" role="alert">
            <i class="fas fa-${insight.type === 'success' ? 'check-circle' : insight.type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-3"></i>
            <div>
                <strong>${insight.title}</strong><br>
                ${insight.message}
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function showLoading() {
    // Mostrar spinners en las gráficas
    const chartContainers = ['trendsChart', 'statusPieChart', 'areaChart', 'processingTimeChart', 'costAnalysisChart'];

    chartContainers.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            canvas.style.opacity = '0.5';
        }
    });
}

function hideLoading() {
    // Ocultar spinners
    const chartContainers = ['trendsChart', 'statusPieChart', 'areaChart', 'processingTimeChart', 'costAnalysisChart'];

    chartContainers.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            canvas.style.opacity = '1';
        }
    });
}

// Limpiar charts al salir de la página
window.addEventListener('beforeunload', function() {
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
});