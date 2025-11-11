# Cambios Realizados - Migración Completa a PostgreSQL

## Resumen
Se eliminaron todas las referencias a SQLite y se corrigieron las discrepancias en los nombres de columnas entre el esquema PostgreSQL y el código de la aplicación.

---

## 1. Archivos Modificados

### Backend Core

#### `backend/server.js`
- ✅ Eliminada referencia a SQLite en comentarios
- ✅ Función `initializeDatabase()` ahora solo trabaja con PostgreSQL
- ✅ Eliminado el check condicional de SQLite

#### `backend/utils/helpers.js`
- ✅ Eliminado comentario que mencionaba formato SQLite

#### `backend/package.json`
- ❌ **ELIMINADA** dependencia `sqlite3`
- ❌ **ELIMINADOS** scripts relacionados con SQLite:
  - `init-db`
  - `migrate-to-postgres`
  - `check-db`
  - `reset-db`
  - `clean-start`

### Rutas (Routes)

#### `backend/routes/suppliers.js`
- ✅ Cambiado `active` → `is_active` (en todos los lugares)
- ✅ Cambiado comparaciones de `= 1` → `= true` y `= 0` → `= false`

#### `backend/routes/quotations.js`
- ✅ Cambiado `active = 1` → `is_active = true`

#### `backend/routes/budgets.js`
- ✅ Cambiado `budget_approved = 1` → `budget_approved = true`
- ✅ Cambiado `budget_approved = 0` → `budget_approved = false`

### Esquema de Base de Datos

#### `backend/init-postgres.js` - Correcciones Críticas

**Tabla `suppliers`:**
```sql
-- ANTES
contact_person VARCHAR(255)
bank_account VARCHAR(100)
payment_terms VARCHAR(100)

-- DESPUÉS
contact_name VARCHAR(255)  -- ✅ Renombrado
category VARCHAR(100)       -- ✅ Agregado
-- bank_account ELIMINADO
-- payment_terms ELIMINADO
```

**Tabla `budgets`:**
```sql
-- ANTES
area VARCHAR(100) NOT NULL UNIQUE
annual_budget DECIMAL(12,2)
fiscal_year INTEGER

-- DESPUÉS
area VARCHAR(100) NOT NULL
year INTEGER NOT NULL         -- ✅ Renombrado de fiscal_year
total_amount DECIMAL(12,2)    -- ✅ Renombrado de annual_budget
created_by INTEGER            -- ✅ Agregado
UNIQUE(area, year)            -- ✅ Constraint modificado
```

**Tabla `invoices`:**
```sql
-- ANTES
purchase_order_id INTEGER
due_date DATE
status VARCHAR(50)
payment_date DATE
pdf_path VARCHAR(255)
xml_path VARCHAR(255)

-- DESPUÉS
order_id INTEGER              -- ✅ Renombrado de purchase_order_id
subtotal DECIMAL(10,2)        -- ✅ Agregado
file_path VARCHAR(255)        -- ✅ Agregado
created_by INTEGER            -- ✅ Agregado
-- due_date, status, payment_date, pdf_path, xml_path ELIMINADOS
```

**Tabla `purchase_orders`:**
```sql
-- AGREGADO
requires_invoice BOOLEAN DEFAULT false  -- ✅ Campo faltante
```

**Tabla `requests`:**
```sql
-- AGREGADO
budget_approved BOOLEAN DEFAULT false   -- ✅ Campo faltante
```

---

## 2. Script de Corrección Creado

Se creó el archivo **`backend/fix-schema-postgresql.js`** que:

- ✅ Renombra columnas automáticamente
- ✅ Agrega columnas faltantes
- ✅ Elimina columnas no usadas
- ✅ Corrige constraints (UNIQUE, etc.)
- ✅ Es idempotente (se puede ejecutar múltiples veces sin errores)

---

## 3. Instrucciones de Deploy

### Opción A: Base de Datos Nueva (Recomendado si es posible)

```bash
# En Render, conectarte a la base de datos y eliminar todas las tablas
# Luego ejecutar:
npm run init-postgres
```

### Opción B: Base de Datos Existente (Producción)

```bash
# Ejecutar el script de corrección:
node backend/fix-schema-postgresql.js

# O configurar en Render.com como Build Command:
npm install && node backend/fix-schema-postgresql.js
```

### Configuración en Render.com

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Variables de Entorno Requeridas:**
```
DATABASE_URL=<tu-postgresql-url>
JWT_SECRET=<tu-secret-key>
NODE_ENV=production
```

---

## 4. Verificación Post-Deploy

Después del deploy, verifica:

### 4.1 Verificar Conexión a PostgreSQL
```bash
curl https://tu-app.onrender.com/health
```

Debe retornar:
```json
{
  "status": "ok",
  "timestamp": "...",
  "environment": "production",
  "version": "1.0.0"
}
```

### 4.2 Verificar Esquema de Tablas

Conectarte a PostgreSQL y ejecutar:

```sql
-- Verificar columnas de suppliers
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'suppliers';

-- Debe incluir: contact_name, category, is_active

-- Verificar columnas de budgets
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'budgets';

-- Debe incluir: area, year, total_amount, spent_amount, created_by

-- Verificar columnas de invoices
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'invoices';

-- Debe incluir: order_id, subtotal, tax_amount, total_amount, file_path, created_by
```

---

## 5. Migraciones Antiguas (IGNORAR)

Los siguientes archivos son para SQLite y **NO DEBEN EJECUTARSE**:

- ❌ `backend/migrations/010_add_programada_status.js`
- ❌ `backend/migrations/009_add_borrador_status.js`
- ❌ `backend/migrations/008_add_area_schedules.js`
- ❌ `backend/migrations/add-budgets-invoices.js`
- ❌ `backend/migrations/create_no_requirements_table.js`
- ❌ Cualquier otro archivo en `backend/migrations/` con SQLite

Estas migraciones ya están incorporadas en `init-postgres.js`.

---

## 6. Problemas Comunes y Soluciones

### Error: "column does not exist"

**Causa:** El esquema no se ha actualizado.

**Solución:**
```bash
node backend/fix-schema-postgresql.js
```

### Error: "relation does not exist"

**Causa:** Las tablas no existen.

**Solución:**
```bash
npm run init-postgres
```

### Error: "duplicate column name"

**Causa:** Intentar agregar una columna que ya existe.

**Solución:** El script `fix-schema-postgresql.js` maneja esto automáticamente.

### Error: "sqlite3 module not found" (en producción)

**Causa:** Dependencia de sqlite3 en package-lock.json.

**Solución:**
```bash
# Eliminar node_modules y package-lock.json
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Remove sqlite3 dependency"
git push
```

---

## 7. Checklist de Validación

- [ ] No hay referencias a SQLite en el código
- [ ] `package.json` no tiene dependencia de `sqlite3`
- [ ] Todas las columnas de las tablas coinciden con el código
- [ ] Los boolean usan `true/false` en lugar de `0/1`
- [ ] El esquema PostgreSQL está actualizado
- [ ] La aplicación se conecta correctamente a PostgreSQL
- [ ] Las rutas API funcionan correctamente
- [ ] No hay errores de "column does not exist"

---

## 8. Contacto y Soporte

Si encuentras algún error después de estos cambios:

1. Verifica los logs de Render
2. Ejecuta el script `fix-schema-postgresql.js`
3. Verifica que DATABASE_URL esté configurada correctamente
4. Comprueba que las tablas existen con el esquema correcto

---

**Fecha de Cambios:** $(date +%Y-%m-%d)
**Versión:** 2.0.0 - PostgreSQL Only
