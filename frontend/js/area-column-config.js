// Configuración de columnas dinámicas por área

// Columnas disponibles para configurar
const AVAILABLE_COLUMNS = [
  { id: 'ubicacion', label: 'Ubicación', header: 'UBICACIÓN' },
  { id: 'cliente', label: 'Cliente', header: 'CLIENTE' },
  { id: 'garantia', label: 'Garantía', header: 'GARANTÍA' },
  { id: 'instalacion', label: 'Instalación', header: 'INSTALACIÓN' },
  { id: 'entrega', label: 'Entrega', header: 'ENTREGA' },
  { id: 'metodo_pago', label: 'Método de Pago', header: 'MÉTODO DE PAGO' }
];

class AreaColumnConfig {
  constructor() {
    this.currentArea = null;
    this.enabledColumns = [];
    this.onColumnsChanged = null;
  }

  // Cargar configuración de columnas para un área
  async loadConfig(area) {
    try {
      const response = await api.get(`/area-columns/${area}`);
      if (response.success) {
        this.currentArea = area;
        this.enabledColumns = response.data.config.enabled_columns || [];
        return this.enabledColumns;
      }
      return [];
    } catch (error) {
      console.error('Error cargando configuración de columnas:', error);
      return [];
    }
  }

  // Guardar configuración de columnas
  async saveConfig(area, enabledColumns) {
    try {
      const response = await api.post('/area-columns', {
        area,
        enabled_columns: enabledColumns
      });

      if (response.success) {
        this.currentArea = area;
        this.enabledColumns = enabledColumns;
        Utils.showToast('Configuración guardada exitosamente', 'success');
        if (this.onColumnsChanged) {
          this.onColumnsChanged(enabledColumns);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error guardando configuración:', error);
      Utils.showToast('Error al guardar configuración', 'error');
      return false;
    }
  }

  // Mostrar modal de configuración
  showConfigModal(area, currentColumns = []) {
    const modalHTML = `
      <div class="modal fade" id="columnConfigModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-columns me-2"></i>
                Configurar Columnas Opcionales
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                Selecciona las columnas adicionales que necesitas para el área <strong>${area}</strong>
              </div>
              <div class="form-check-list">
                ${AVAILABLE_COLUMNS.map(col => `
                  <div class="form-check mb-3">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      value="${col.id}"
                      id="col_${col.id}"
                      ${currentColumns.includes(col.id) ? 'checked' : ''}
                    >
                    <label class="form-check-label" for="col_${col.id}">
                      <strong>${col.label}</strong>
                      <br>
                      <small class="text-muted">Columna: ${col.header}</small>
                    </label>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                <i class="fas fa-times me-2"></i>Cancelar
              </button>
              <button type="button" class="btn btn-primary" id="saveColumnConfig">
                <i class="fas fa-save me-2"></i>Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Eliminar modal anterior si existe
    const existingModal = document.getElementById('columnConfigModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Agregar nuevo modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Obtener instancia del modal
    const modalElement = document.getElementById('columnConfigModal');
    const modal = new bootstrap.Modal(modalElement);

    // Event listener para guardar
    document.getElementById('saveColumnConfig').addEventListener('click', async () => {
      const checkedBoxes = modalElement.querySelectorAll('.form-check-input:checked');
      const selectedColumns = Array.from(checkedBoxes).map(cb => cb.value);

      const saved = await this.saveConfig(area, selectedColumns);
      if (saved) {
        modal.hide();
      }
    });

    // Limpiar modal al cerrar
    modalElement.addEventListener('hidden.bs.modal', () => {
      modalElement.remove();
    });

    modal.show();
  }

  // Obtener columnas habilitadas
  getEnabledColumns() {
    return this.enabledColumns;
  }

  // Verificar si una columna está habilitada
  isColumnEnabled(columnId) {
    return this.enabledColumns.includes(columnId);
  }

  // Obtener información de columnas disponibles
  getAvailableColumns() {
    return AVAILABLE_COLUMNS;
  }

  // Obtener columnas habilitadas con su información completa
  getEnabledColumnsInfo() {
    return AVAILABLE_COLUMNS.filter(col => this.enabledColumns.includes(col.id));
  }
}

// Instancia global
const areaColumnConfig = new AreaColumnConfig();
