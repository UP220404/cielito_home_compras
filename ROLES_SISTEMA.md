# Roles del Sistema de Compras Cielito Home

## Jerarquía y Permisos

### 1. **ADMIN** (Administrador)
- **Rol en DB:** `admin`
- **Nivel:** MÁXIMO
- **Descripción:** Acceso total al sistema
- **Permisos:**
  - ✅ Gestionar usuarios (crear, editar, desactivar)
  - ✅ Acceder a configuración del sistema
  - ✅ Todas las funciones de Compras
  - ✅ Todas las funciones de Dirección General
  - ✅ Ver reportes y análisis completos
  - ✅ Gestionar proveedores
  - ✅ Crear, editar y eliminar todo tipo de registros

---

### 2. **PURCHASER** (Compras)
- **Rol en DB:** `purchaser`
- **Nivel:** ALTO
- **Descripción:** Personal del área de Compras - Gestiona todo el proceso de compras
- **Permisos:**
  - ✅ Ver todas las solicitudes del sistema
  - ✅ Gestionar proveedores (crear, editar, activar/desactivar)
  - ✅ Crear y gestionar cotizaciones
  - ✅ Comparar cotizaciones de diferentes proveedores
  - ✅ **Seleccionar cotización ganadora**
  - ✅ Crear órdenes de compra
  - ✅ Gestionar el estado de las órdenes
  - ✅ Ver reportes de compras
  - ✅ Gestionar catálogo de materiales
  - ❌ NO puede aprobar/rechazar solicitudes
  - ❌ NO puede gestionar usuarios
  - ❌ NO puede acceder a configuración del sistema

**Flujo de trabajo:**
1. Recibe solicitudes autorizadas por Dirección
2. Solicita cotizaciones a proveedores
3. Compara y registra cotizaciones
4. **Selecciona la mejor cotización** (puede hacerlo Compras o Dirección)
5. Compras genera la orden de compra
6. Da seguimiento a entregas

---

### 3. **DIRECTOR** (Dirección General)
- **Rol en DB:** `director`
- **Nivel:** MEDIO-ALTO
- **Descripción:** Personal de Dirección General - Autoriza solicitudes
- **Permisos:**
  - ✅ Ver todas las solicitudes pendientes de autorización
  - ✅ Aprobar o rechazar solicitudes
  - ✅ Ver historial de solicitudes
  - ✅ **Seleccionar cotización ganadora** (opcional, puede hacerlo Compras)
  - ✅ Ver reportes de solicitudes y gastos
  - ❌ NO puede crear/editar proveedores
  - ❌ NO puede crear cotizaciones
  - ❌ NO puede crear órdenes de compra
  - ❌ NO puede gestionar usuarios

**Flujo de trabajo:**
1. Revisa solicitudes creadas por solicitantes
2. Aprueba o rechaza según presupuesto/necesidad
3. (Opcional) Una vez que Compras reúne cotizaciones, puede seleccionar la mejor
4. Compras procede con la orden de compra

**Pantallas visibles:**
- Dashboard con solicitudes pendientes de autorización
- Detalle de solicitud (con botones Aprobar/Rechazar)
- Comparación de cotizaciones (con botón Seleccionar)
- Reportes de gastos y solicitudes

---

### 4. **REQUESTER** (Solicitante)
- **Rol en DB:** `requester`
- **Nivel:** BÁSICO
- **Descripción:** Usuarios que crean solicitudes de compra
- **Permisos:**
  - ✅ Crear nuevas solicitudes de compra
  - ✅ Ver sus propias solicitudes
  - ✅ Editar solicitudes propias en estado "pendiente"
  - ✅ Ver el estado/seguimiento de sus solicitudes
  - ✅ Recibir notificaciones sobre sus solicitudes
  - ❌ NO puede ver solicitudes de otros usuarios
  - ❌ NO puede aprobar/rechazar
  - ❌ NO puede gestionar proveedores
  - ❌ NO puede crear cotizaciones
  - ❌ NO puede crear órdenes de compra

**Flujo de trabajo:**
1. Crea solicitud con materiales/servicios necesarios
2. Espera aprobación de Dirección
3. Recibe notificación de aprobación/rechazo
4. Da seguimiento al estado de su solicitud
5. Recibe notificación cuando orden está lista

**Pantallas visibles:**
- Dashboard personal
- Nueva Solicitud
- Mis Solicitudes
- Detalle de Solicitud (solo vista)
- Notificaciones

---

## Resumen de Accesos por Módulo

| Módulo | Admin | Purchaser | Director | Requester |
|--------|-------|-----------|----------|-----------|
| **Dashboard** | ✅ Completo | ✅ Panel Compras | ✅ Autorizaciones | ✅ Personal |
| **Solicitudes** | ✅ Todas | ✅ Todas | ✅ Todas | ✅ Solo propias |
| **Cotizaciones** | ✅ | ✅ Gestión + Selección | ✅ Selección | ❌ |
| **Proveedores** | ✅ | ✅ Gestión | ❌ | ❌ |
| **Órdenes Compra** | ✅ | ✅ Gestión | ✅ Vista | ❌ |
| **Reportes** | ✅ Todos | ✅ Compras | ✅ Aprobaciones | ❌ |
| **Usuarios** | ✅ Gestión | ❌ | ❌ | ❌ |
| **Configuración** | ✅ | ❌ | ❌ | ❌ |
| **Notificaciones** | ✅ | ✅ | ✅ | ✅ |

---

## Flujo Completo del Sistema

```
1. SOLICITANTE (requester)
   └─> Crea solicitud
       │
       ↓
2. DIRECCIÓN (director)
   └─> Aprueba o Rechaza
       │
       ├─> Si RECHAZA: fin del proceso
       │
       └─> Si APRUEBA ↓
           │
3. COMPRAS (purchaser)
   └─> Solicita cotizaciones a proveedores
   └─> Registra cotizaciones en el sistema
   └─> Compara precios y condiciones
       │
       ↓
4. COMPRAS (purchaser) o DIRECCIÓN (director)
   └─> Selecciona cotización ganadora
       │
       ↓
5. COMPRAS (purchaser)
   └─> Genera orden de compra
   └─> Envía orden al proveedor
   └─> Da seguimiento a entrega
       │
       ↓
6. SOLICITANTE (requester)
   └─> Recibe notificación de entrega
   └─> Recibe material/servicio
```

---

## Notas de Implementación

### Variables de roles en código:
```javascript
const ROLES = {
  admin: 'admin',
  purchaser: 'purchaser',
  director: 'director',
  requester: 'requester'
};
```

### Nombres mostrados al usuario:
```javascript
const ROLE_NAMES = {
  admin: 'Administrador',
  purchaser: 'Compras',
  director: 'Dirección General',
  requester: 'Solicitante'
};
```

### Verificación de permisos:
- **Sidebar:** Elementos con clases `.admin-only`, `.purchaser-only`, `.director-only`
- **Backend:** Middleware `requireRole('purchaser', 'director', 'admin')`
- **Frontend:** Función `Utils.hasPermission(user.role, ['purchaser', 'admin'])`

---

**Última actualización:** 27 de Octubre de 2025
