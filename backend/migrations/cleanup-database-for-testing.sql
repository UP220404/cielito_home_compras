-- Script para limpiar la base de datos y prepararla para pruebas
-- Mantiene: usuarios, proveedores, presupuestos
-- Elimina: solicitudes, cotizaciones, órdenes de compra, facturas, no-requerimientos

-- Eliminar datos de tablas relacionadas con solicitudes y órdenes
-- El orden es importante debido a las foreign keys

-- 1. Eliminar items de cotizaciones (depende de quotations)
DELETE FROM quotation_items;

-- 2. Eliminar cotizaciones (depende de requests y suppliers)
DELETE FROM quotations;

-- 3. Eliminar facturas (depende de purchase_orders)
DELETE FROM invoices;

-- 4. Eliminar órdenes de compra (depende de requests y suppliers)
DELETE FROM purchase_orders;

-- 5. Eliminar items de solicitudes (depende de requests)
DELETE FROM request_items;

-- 6. Eliminar horarios de áreas (si están relacionados con requests)
DELETE FROM area_schedules;

-- 7. Eliminar solicitudes (tabla principal)
DELETE FROM requests;

-- 8. Eliminar no-requerimientos
DELETE FROM no_requirements;

-- 9. Eliminar notificaciones relacionadas
DELETE FROM notifications WHERE message LIKE '%solicitud%' OR message LIKE '%orden%' OR message LIKE '%cotización%' OR message LIKE '%factura%';

-- 10. Eliminar logs de auditoría relacionados (opcional, pero limpia el historial)
DELETE FROM audit_log WHERE table_name IN ('requests', 'quotations', 'purchase_orders', 'invoices', 'no_requirements', 'request_items', 'quotation_items', 'area_schedules');

-- Verificar lo que queda
SELECT 'users' as tabla, COUNT(*) as registros FROM users
UNION ALL
SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'budgets', COUNT(*) FROM budgets
UNION ALL
SELECT 'requests', COUNT(*) FROM requests
UNION ALL
SELECT 'quotations', COUNT(*) FROM quotations
UNION ALL
SELECT 'purchase_orders', COUNT(*) FROM purchase_orders
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'no_requirements', COUNT(*) FROM no_requirements
ORDER BY tabla;
