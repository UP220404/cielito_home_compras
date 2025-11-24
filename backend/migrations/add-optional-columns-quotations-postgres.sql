-- Agregar columnas opcionales a quotation_items para diferentes áreas (PostgreSQL)
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
    id SERIAL PRIMARY KEY,
    area TEXT NOT NULL UNIQUE,
    enabled_columns JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de columnas habilitadas
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuración por defecto para algunas áreas comunes
INSERT INTO area_column_config (area, enabled_columns) VALUES
('Farmacia', '["ubicacion", "cliente", "garantia"]'::jsonb),
('Mantenimiento', '["ubicacion", "garantia", "instalacion", "entrega"]'::jsonb),
('Tecnología', '["ubicacion", "garantia", "instalacion"]'::jsonb),
('General', '[]'::jsonb)
ON CONFLICT (area) DO NOTHING;

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_area_column_config_area ON area_column_config(area);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_area_column_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_area_column_config_updated_at ON area_column_config;
CREATE TRIGGER trigger_update_area_column_config_updated_at
    BEFORE UPDATE ON area_column_config
    FOR EACH ROW
    EXECUTE FUNCTION update_area_column_config_updated_at();
