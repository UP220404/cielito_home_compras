-- Agregar columna supplier_id a la tabla invoices
-- Esto permite que cada factura esté asociada a un proveedor específico
-- Necesario para manejar órdenes de compra con múltiples proveedores

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supplier_id INTEGER;

-- Agregar la foreign key constraint
ALTER TABLE invoices
ADD CONSTRAINT fk_invoices_supplier
FOREIGN KEY (supplier_id)
REFERENCES suppliers(id)
ON DELETE SET NULL;

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);

-- Actualizar facturas existentes con el supplier_id basado en la orden de compra
-- Esto solo funciona para órdenes con un único proveedor
UPDATE invoices
SET supplier_id = (
    SELECT po.supplier_id
    FROM purchase_orders po
    WHERE po.id = invoices.order_id
)
WHERE supplier_id IS NULL;
