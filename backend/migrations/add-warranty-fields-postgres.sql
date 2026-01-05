-- Agregar campos detallados de garantía a quotation_items (PostgreSQL)
-- has_warranty: Indica si el producto tiene garantía (Sí/No)
-- warranty_duration: Duración de la garantía en meses
-- El campo 'garantia' existente se usará como warranty_description (descripción de qué cubre)

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS has_warranty BOOLEAN DEFAULT FALSE;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS warranty_duration INTEGER; -- En meses
-- El campo 'garantia' ya existe y se usará como warranty_description
