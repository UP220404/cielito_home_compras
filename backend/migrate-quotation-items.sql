-- ============================================================================
-- Migración: Agregar columnas faltantes a quotation_items
-- ============================================================================
-- Esta migración agrega las columnas que el código espera pero que faltan
-- en la tabla quotation_items de PostgreSQL
-- ============================================================================

-- 1. Agregar columna notes (notas específicas del ítem cotizado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotation_items' AND column_name = 'notes'
    ) THEN
        ALTER TABLE quotation_items ADD COLUMN notes TEXT;
        RAISE NOTICE '✓ Columna notes agregada';
    ELSE
        RAISE NOTICE '✓ Columna notes ya existe';
    END IF;
END $$;

-- 2. Agregar columna has_invoice (si el proveedor tiene factura)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotation_items' AND column_name = 'has_invoice'
    ) THEN
        ALTER TABLE quotation_items ADD COLUMN has_invoice BOOLEAN DEFAULT false;
        RAISE NOTICE '✓ Columna has_invoice agregada';
    ELSE
        RAISE NOTICE '✓ Columna has_invoice ya existe';
    END IF;
END $$;

-- 3. Agregar columna delivery_date (fecha de entrega específica del ítem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotation_items' AND column_name = 'delivery_date'
    ) THEN
        ALTER TABLE quotation_items ADD COLUMN delivery_date DATE;
        RAISE NOTICE '✓ Columna delivery_date agregada';
    ELSE
        RAISE NOTICE '✓ Columna delivery_date ya existe';
    END IF;
END $$;

-- 4. Agregar columna is_selected (si el ítem está seleccionado para compra)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotation_items' AND column_name = 'is_selected'
    ) THEN
        ALTER TABLE quotation_items ADD COLUMN is_selected BOOLEAN DEFAULT false;
        RAISE NOTICE '✓ Columna is_selected agregada';

        -- Migrar datos existentes: si una cotización está seleccionada,
        -- marcar todos sus ítems como seleccionados
        UPDATE quotation_items
        SET is_selected = true
        WHERE quotation_id IN (
            SELECT id FROM quotations WHERE is_selected = true
        );
        RAISE NOTICE '✓ Datos migrados (ítems de cotizaciones seleccionadas marcados)';
    ELSE
        RAISE NOTICE '✓ Columna is_selected ya existe';
    END IF;
END $$;

-- Verificar que todas las columnas existen
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quotation_items'
ORDER BY ordinal_position;
