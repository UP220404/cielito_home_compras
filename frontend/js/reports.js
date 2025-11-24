document.addEventListener('DOMContentLoaded', async function() {
    // Cargar componentes (usa la función global de init.js)
    await loadComponents();

    // Inicializar página
    initReportsPage();
});

function initReportsPage() {
    // Verificar autenticación
    if (!Utils.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Configurar fechas por defecto
    setupDefaultDates();

    // Cargar áreas para el filtro
    loadAreas();

    // Verificar permisos
    checkPermissions();
}

function setupDefaultDates() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    document.getElementById('startDate').value = firstDayOfMonth.toISOString().split('T')[0];
    document.getElementById('endDate').value = lastDayOfMonth.toISOString().split('T')[0];
}

async function loadAreas() {
    try {
        const areaSelect = document.getElementById('areaFilter');
        CONFIG.AREAS.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            areaSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando áreas:', error);
    }
}

function checkPermissions() {
    const user = Utils.getCurrentUser();

    // Solo directores, compradores y admin pueden acceder a reportes
    if (!['director', 'purchaser', 'admin'].includes(user.role)) {
        Utils.showToast('No tienes permisos para acceder a los reportes', 'error');
        window.location.href = 'dashboard.html';
        return;
    }
}

async function generateReport(reportType, format) {
    // Obtener filtros
    const filters = getFilters();

    // Mostrar estado de generación
    showGenerationStatus(reportType, format);

    try {
        // Construir URL
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, filters[key]);
            }
        });

        const url = `${CONFIG.API_URL}/reports/${reportType}/${format}?${params.toString()}`;

        // Simular progreso
        await simulateProgress();

        // Crear enlace de descarga
        const a = document.createElement('a');
        a.href = url;
        a.style.display = 'none';

        // Agregar headers de autorización
        const headers = {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        };

        // Para archivos, hacemos una petición fetch primero para manejar errores
        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        // Si la respuesta es exitosa, descargamos el archivo
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);

        a.href = downloadUrl;
        a.download = generateFileName(reportType, format);

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Limpiar URL temporal
        window.URL.revokeObjectURL(downloadUrl);

        Utils.showToast('Reporte generado exitosamente', 'success');

    } catch (error) {
        console.error('Error generando reporte:', error);
        Utils.showToast('Error al generar el reporte', 'error');
    } finally {
        hideGenerationStatus();
    }
}

function getFilters() {
    return {
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        area: document.getElementById('areaFilter').value,
        status: document.getElementById('statusFilter').value
    };
}

function generateFileName(reportType, format) {
    const date = new Date().toISOString().split('T')[0];
    const reportNames = {
        'requests': 'solicitudes',
        'requests-by-area': 'solicitudes_por_area',
        'requests-by-status': 'solicitudes_por_estado',
        'requests-pending': 'solicitudes_pendientes',
        'suppliers': 'proveedores',
        'suppliers-active': 'proveedores_activos',
        'suppliers-by-category': 'proveedores_por_categoria',
        'suppliers-rating': 'proveedores_por_calificacion',
        'orders': 'ordenes_compra',
        'orders-pending': 'ordenes_pendientes',
        'orders-by-supplier': 'ordenes_por_proveedor',
        'analytics-summary': 'resumen_ejecutivo',
        'analytics-monthly': 'tendencias_mensuales',
        'analytics-costs': 'analisis_costos',
        'analytics-efficiency': 'eficiencia_procesos'
    };

    const reportName = reportNames[reportType] || reportType;
    const extension = format === 'excel' ? 'xlsx' : 'pdf';

    return `${reportName}_${date}.${extension}`;
}

function showGenerationStatus(reportType, format) {
    const statusDiv = document.getElementById('generationStatus');
    const statusText = document.getElementById('statusText');

    const reportNames = {
        'requests': 'Solicitudes',
        'suppliers': 'Proveedores',
        'orders': 'Órdenes de Compra',
        'analytics-summary': 'Resumen Ejecutivo'
    };

    const baseName = reportType.split('-')[0];
    const reportName = reportNames[baseName] || 'Reporte';
    const formatName = format === 'excel' ? 'Excel' : 'PDF';

    statusText.textContent = `Generando reporte de ${reportName} en formato ${formatName}...`;
    statusDiv.style.display = 'block';

    // Scroll hacia el estado
    statusDiv.scrollIntoView({ behavior: 'smooth' });
}

async function simulateProgress() {
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');

    const steps = [
        { progress: 20, text: 'Consultando base de datos...' },
        { progress: 40, text: 'Procesando datos...' },
        { progress: 60, text: 'Aplicando filtros...' },
        { progress: 80, text: 'Generando archivo...' },
        { progress: 100, text: 'Finalizando descarga...' }
    ];

    for (const step of steps) {
        await new Promise(resolve => setTimeout(resolve, 300));
        progressBar.style.width = `${step.progress}%`;
        statusText.textContent = step.text;
    }
}

function hideGenerationStatus() {
    setTimeout(() => {
        const statusDiv = document.getElementById('generationStatus');
        statusDiv.style.display = 'none';

        // Resetear progreso
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = '0%';
    }, 1000);
}

// Función auxiliar para formatear fechas para display
function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX');
}

// Función para validar rango de fechas
function validateDateRange() {
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);

    if (startDate > endDate) {
        Utils.showToast('La fecha de inicio debe ser anterior a la fecha de fin', 'warning');
        return false;
    }

    // Validar que el rango no sea mayor a 1 año
    const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
        Utils.showToast('El rango de fechas no puede ser mayor a 1 año', 'warning');
        return false;
    }

    return true;
}

// Event listeners para validación de fechas
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('startDate').addEventListener('change', validateDateRange);
    document.getElementById('endDate').addEventListener('change', validateDateRange);
});