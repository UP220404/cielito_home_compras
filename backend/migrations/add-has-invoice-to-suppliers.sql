-- Agregar columna has_invoice a suppliers
-- Esta columna indica si el proveedor emite factura por defecto

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT true;

-- Actualizar proveedores existentes
-- Puedes ajustar esto según tus necesidades
UPDATE suppliers
SET has_invoice = true
WHERE has_invoice IS NULL;

-- Comentario:
-- has_invoice = true: El proveedor emite factura
-- has_invoice = false: El proveedor NO emite factura
