# Análisis de Funcionalidad - Sistema de Compras

## ✅ Lo que FUNCIONA

### 1. Dashboard
- ✅ Página principal carga correctamente
- ✅ Estadísticas se muestran
- ✅ Widgets funcionan

### 2. Crear Nueva Solicitud
- ✅ Formulario de creación funciona
- ✅ Agregar items funciona
- ✅ Guardar solicitud funciona

**Conclusión:** Estas funcionalidades usan las tablas básicas: `users`, `requests`, `request_items`

---

## ❌ Lo que NO FUNCIONA (Errores de "column does not exist")

Las funcionalidades que probablemente fallen son las que usan las tablas con discrepancias:

### 1. Proveedores (Suppliers)
**Posibles errores:**
- Ver lista de proveedores
- Crear/editar proveedor
- Ver detalles de proveedor

**Causa:** La tabla `suppliers` en producción tiene:
- `contact_person` (debería ser `contact_name`)
- Falta columna `category`
- Tiene columnas extras: `bank_account`, `payment_terms`

### 2. Presupuestos (Budgets)
**Posibles errores:**
- Ver presupuestos por área
- Crear/editar presupuesto
- Aprobar excesos de presupuesto

**Causa:** La tabla `budgets` en producción tiene:
- `annual_budget` (debería ser `total_amount`)
- `fiscal_year` (debería ser `year`)
- `area` UNIQUE (debería ser UNIQUE(area, year))
- Falta columna `created_by`

### 3. Facturas (Invoices)
**Posibles errores:**
- Ver facturas
- Crear factura
- Vincular factura a orden

**Causa:** La tabla `invoices` en producción tiene:
- `purchase_order_id` (debería ser `order_id`)
- Falta columna `subtotal`
- Falta columna `file_path`
- Tiene columnas extras: `due_date`, `status`, `payment_date`, `pdf_path`, `xml_path`

### 4. Órdenes de Compra (Purchase Orders)
**Posibles errores:**
- Marcar orden como "requiere factura"

**Causa:** La tabla `purchase_orders` en producción:
- Falta columna `requires_invoice`

### 5. Aprobación de Presupuesto en Solicitudes
**Posibles errores:**
- Aprobar solicitudes que exceden presupuesto

**Causa:** La tabla `requests` en producción:
- Falta columna `budget_approved`

---

## 🔍 Cómo Verificar Qué Tabla Está Causando el Error

Si recibes un error como:
```
column "contact_name" does not exist
```

Entonces sabes que:
- El problema está en la tabla `suppliers`
- El código está buscando `contact_name`
- Pero la base de datos tiene `contact_person`

---

## 🚀 Solución

Una vez que hagas el deploy y ejecutes el endpoint:

```bash
POST https://tu-app.onrender.com/api/schema/fix-schema
```

**TODAS** las funcionalidades deberían empezar a funcionar porque:

1. ✅ Renombrará las columnas mal nombradas
2. ✅ Agregará las columnas faltantes
3. ✅ Eliminará las columnas que no se usan
4. ✅ Corregirá los constraints (UNIQUE, etc.)

---

## 📊 Tabla de Correcciones Automáticas

| Tabla | Cambio | Tipo |
|-------|--------|------|
| **suppliers** | `contact_person` → `contact_name` | Renombrar |
| **suppliers** | Agregar `category` | Nueva columna |
| **suppliers** | Eliminar `bank_account` | Limpiar |
| **suppliers** | Eliminar `payment_terms` | Limpiar |
| **budgets** | `annual_budget` → `total_amount` | Renombrar |
| **budgets** | `fiscal_year` → `year` | Renombrar |
| **budgets** | Agregar `created_by` | Nueva columna |
| **budgets** | UNIQUE(area) → UNIQUE(area, year) | Constraint |
| **invoices** | `purchase_order_id` → `order_id` | Renombrar |
| **invoices** | Agregar `subtotal` | Nueva columna |
| **invoices** | Agregar `file_path` | Nueva columna |
| **invoices** | Agregar `created_by` | Nueva columna |
| **invoices** | Eliminar `due_date`, `status`, etc. | Limpiar |
| **purchase_orders** | Agregar `requires_invoice` | Nueva columna |
| **requests** | Agregar `budget_approved` | Nueva columna |

---

## 🧪 Plan de Pruebas Post-Corrección

Después de ejecutar el endpoint, prueba en este orden:

1. ✅ Dashboard (ya funciona)
2. ✅ Crear solicitud (ya funciona)
3. 🧪 **Proveedores:**
   - Ver lista
   - Crear nuevo proveedor
   - Editar proveedor existente
   - Ver detalles
4. 🧪 **Presupuestos:**
   - Ver presupuestos por área
   - Crear presupuesto para un área
   - Ver gastos vs presupuesto
5. 🧪 **Cotizaciones:**
   - Crear cotización
   - Comparar cotizaciones
6. 🧪 **Órdenes de Compra:**
   - Generar orden desde cotización
   - Marcar como "requiere factura"
7. 🧪 **Facturas:**
   - Crear factura para una orden
   - Ver facturas registradas

---

## 📝 Notas Importantes

1. **El script es seguro:** Verifica antes de hacer cambios, no va a romper nada
2. **Es idempotente:** Puedes ejecutarlo múltiples veces sin problemas
3. **No borra datos:** Solo modifica la estructura, tus datos están seguros
4. **Toma backup:** Render automáticamente hace backups, pero si quieres estar seguro, puedes hacer uno manual antes

---

## 🆘 Si Algo Falla

Compárteme:
1. El error exacto que ves (copia y pega completo)
2. En qué página/funcionalidad ocurrió
3. La respuesta del endpoint `/api/schema/fix-schema`

Con esa información puedo identificar exactamente qué falta corregir.
