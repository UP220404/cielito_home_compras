-- Agregar columnas opcionales a quotation_items para diferentes áreas
-- Estas columnas se mostrarán según la configuración del área

-- Columnas opcionales para quotation_items
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS ubicacion TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS cliente TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS garantia TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS instalacion TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS entrega TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS metodo_pago TEXT;

-- Tabla para configurar qué columnas se muestran por área
CREATE TABLE IF NOT EXISTS area_column_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area TEXT NOT NULL UNIQUE,
    enabled_columns TEXT NOT NULL, -- JSON con array de columnas habilitadas
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configuración por defecto para algunas áreas comunes
INSERT OR IGNORE INTO area_column_config (area, enabled_columns) VALUES
('Farmacia', '["ubicacion", "cliente", "garantia"]'),
('Mantenimiento', '["ubicacion", "garantia", "instalacion", "entrega"]'),
('Tecnología', '["ubicacion", "garantia", "instalacion"]'),
('General', '[]'); -- Sin columnas opcionales por defecto

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_area_column_config_area ON area_column_config(area);
