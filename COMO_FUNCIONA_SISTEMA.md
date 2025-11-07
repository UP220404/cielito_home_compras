# 📖 CÓMO FUNCIONA EL SISTEMA DE COMPRAS
## Cielito Home - Guía Completa

**Versión:** 2.5.5
**Fecha:** 28 de Octubre de 2025
**Estado:** Producción

---

## 📌 ÍNDICE

1. [Visión General](#visión-general)
2. [Roles y Permisos](#roles-y-permisos)
3. [Flujo Completo de Compras](#flujo-completo-de-compras)
4. [Módulos del Sistema](#módulos-del-sistema)
5. [Estados de Solicitud](#estados-de-solicitud)
6. [Arquitectura Técnica](#arquitectura-técnica)
7. [Credenciales de Prueba](#credenciales-de-prueba)

---

## 🎯 VISIÓN GENERAL

El Sistema de Compras de Cielito Home es una aplicación web que gestiona el ciclo completo de adquisiciones:
- **Solicitudes** de materiales/servicios
- **Cotizaciones** de múltiples proveedores
- **Aprobaciones** por dirección
- **Órdenes de compra**
- **Seguimiento** y entrega

### Objetivo
Centralizar y transparentar el proceso de compras, permitiendo:
- Trazabilidad completa
- Comparación de proveedores
- Aprobaciones documentadas
- Reportes y analytics

---

## 👥 ROLES Y PERMISOS

### 1. 👤 REQUESTER (Solicitante)
**Quién:** Cualquier empleado que necesite materiales/servicios

**Puede hacer:**
- ✅ Crear solicitudes de compra
- ✅ Ver sus propias solicitudes
- ✅ Editar solicitudes pendientes
- ✅ Cancelar solicitudes pendientes
- ✅ Ver notificaciones sobre sus solicitudes

**NO puede hacer:**
- ❌ Ver solicitudes de otros
- ❌ Agregar cotizaciones
- ❌ Aprobar solicitudes
- ❌ Crear órdenes de compra

**Sidebar visible:**
- Dashboard
- Nueva Solicitud
- Mis Solicitudes
- Notificaciones

---

### 2. 🛒 PURCHASER (Compras)
**Quién:** Departamento de compras

**Puede hacer:**
- ✅ Ver TODAS las solicitudes
- ✅ Agregar cotizaciones de proveedores
- ✅ Editar cotizaciones propias
- ✅ Crear órdenes de compra (después de aprobación)
- ✅ Gestionar proveedores
- ✅ Marcar entregas recibidas
- ✅ Seleccionar cotización ganadora (si autorizada)

**NO puede hacer:**
- ❌ Aprobar/rechazar solicitudes (solo Director)
- ❌ Gestionar usuarios

**Sidebar visible:**
- Dashboard
- Solicitudes
- **Panel de Compras**
- **Cotizaciones**
- **Órdenes de Compra**
- **Proveedores**
- Notificaciones

---

### 3. 👔 DIRECTOR
**Quién:** Dirección general

**Puede hacer:**
- ✅ Ver TODAS las solicitudes
- ✅ **Aprobar o rechazar** solicitudes
- ✅ Seleccionar cotización ganadora
- ✅ Ver analytics y reportes
- ✅ Comparar cotizaciones

**NO puede hacer:**
- ❌ Agregar cotizaciones (solo Compras)
- ❌ Gestionar usuarios (solo Admin)

**Sidebar visible:**
- Dashboard
- Solicitudes
- **Aprobación de Cotizaciones**
- **Analytics**
- **Reportes**
- Notificaciones

---

### 4. 👨‍💼 ADMIN (Administrador)
**Quién:** Administrador del sistema

**Puede hacer:**
- ✅ **TODO** lo que pueden hacer los demás roles
- ✅ Gestionar usuarios (crear, editar, desactivar)
- ✅ Configurar sistema
- ✅ Ver logs de auditoría
- ✅ Acceder a TODOS los módulos

**Sidebar visible:**
- Dashboard
- Solicitudes
- **Compras** (Panel, Cotizaciones, Órdenes, Proveedores)
- **Aprobaciones**
- Analytics
- Reportes
- **Administración** (Usuarios, Configuración)
- Notificaciones

---

## 🔄 FLUJO COMPLETO DE COMPRAS

### FASE 1: Creación de Solicitud 📝

**Actor:** Solicitante (Requester)
**Ubicación:** Nueva Solicitud

**Pasos:**
1. Hacer clic en "Nueva Solicitud"
2. Llenar información:
   - **Área:** Departamento solicitante
   - **Fecha de entrega:** Cuándo se necesita
   - **Urgencia:** Baja, Media, Alta
   - **Prioridad:** Baja, Media, Alta
   - **Justificación:** Motivo de la compra
3. Agregar items (materiales/servicios):
   - Material/servicio
   - Especificaciones técnicas
   - Cantidad
   - Unidad (piezas, kg, litros, etc.)
   - Costo aproximado (opcional)
   - Si está en stock
   - Ubicación actual
4. Hacer clic en "Enviar Solicitud"

**Resultado:**
- ✅ Solicitud creada con folio único (ej: REQ-2025-001)
- ✅ Estado: **"pendiente"**
- ✅ Notificación enviada a Compras
- ✅ Visible en "Mis Solicitudes" para el solicitante

---

### FASE 2: Cotización 💰

**Actor:** Compras (Purchaser)
**Ubicación:** Panel de Compras

**Pasos:**
1. Ir a "Panel de Compras"
2. Ver solicitudes pendientes
3. Hacer clic en "Ver Detalles" de una solicitud
4. Hacer clic en "Agregar Cotización"
5. Seleccionar proveedor (o agregar nuevo)
6. Llenar información:
   - **Número de cotización:** Del proveedor
   - **Monto total:** Suma de todos los items
   - **Días de entrega:** Tiempo estimado
   - **Términos de pago:** Contado, crédito, etc.
   - **Días de validez:** Cuánto tiempo es válida la cotización
   - **Notas:** Observaciones
7. Agregar items cotizados:
   - Precio unitario por item
   - Subtotal (cantidad × precio)
   - Incluye factura (sí/no)
   - Fecha de entrega estimada
   - Notas del item
8. Hacer clic en "Guardar Cotización"
9. **Repetir pasos 4-8 con 2-3 proveedores diferentes**

**Resultado:**
- ✅ Cotizaciones guardadas
- ✅ Estado: **"cotizando"**
- ✅ Se puede comparar cotizaciones
- ✅ Visible para Director en "Aprobación de Cotizaciones"

**Recomendación:** Agregar mínimo 3 cotizaciones para buena comparación.

---

### FASE 3: Aprobación 👔

**Actor:** Director o Admin
**Ubicación:** Aprobación de Cotizaciones

**Pasos:**
1. Ir a "Aprobación de Cotizaciones"
2. Ver solicitudes con estado "cotizando"
3. Hacer clic en "Revisar" en la solicitud
4. Ver información:
   - Folio y datos de la solicitud
   - Tabla comparativa de cotizaciones
   - Items solicitados
   - Mejor precio resaltado en verde
5. Hacer clic en el **radio button** de la cotización elegida
6. Revisar que sea la correcta (aparece resaltada)
7. Hacer clic en **"Aprobar"**

**O Rechazar:**
1. Hacer clic en **"Rechazar"**
2. Escribir motivo del rechazo
3. Confirmar

**Resultado si Aprueba:**
- ✅ Estado: **"autorizada"**
- ✅ Cotización seleccionada: `is_selected = 1`
- ✅ Desaparece de "Aprobación de Cotizaciones"
- ✅ **Aparece en "Órdenes de Compra"** para crear orden
- ✅ Notificación enviada a Compras

**Resultado si Rechaza:**
- ✅ Estado: **"rechazada"**
- ✅ Notificación enviada a Compras con motivo
- ✅ Solicitante puede ver motivo

---

### FASE 4: Orden de Compra 📋

**Actor:** Compras o Admin
**Ubicación:** Órdenes de Compra

**Pasos:**
1. Ir a "Órdenes de Compra"
2. Hacer clic en "Nueva Orden"
3. **Verificar:** Dropdown muestra solicitudes autorizadas
4. Seleccionar solicitud del dropdown
5. **Verificar:** Aparece info de la cotización aprobada
   - Proveedor
   - Monto total
   - Días de entrega
6. Llenar:
   - Fecha de orden (auto: hoy)
   - Fecha esperada de entrega (auto: calculada)
   - Notas adicionales
7. Hacer clic en "Crear Orden de Compra"

**Resultado:**
- ✅ Orden creada con folio único (ej: PO-2025-001)
- ✅ Estado: **"comprada"**
- ✅ PDF generado automáticamente
- ✅ Notificación enviada al proveedor
- ✅ Visible en tabla de órdenes

---

### FASE 5: Recepción y Entrega ✅

**Actor:** Compras
**Ubicación:** Órdenes de Compra

**Pasos:**
1. Cuando llegue el material:
2. Ir a "Órdenes de Compra"
3. Buscar la orden
4. Hacer clic en "Ver Detalles"
5. Hacer clic en "Marcar como Recibida"
6. Confirmar recepción

**Resultado:**
- ✅ Estado: **"entregada"**
- ✅ Ciclo completo cerrado
- ✅ Notificación enviada al solicitante
- ✅ Datos para reportes y analytics

---

## 📂 MÓDULOS DEL SISTEMA

### 1. Dashboard 📊

**Acceso:** Todos los roles

**Muestra:**
- Tarjetas con métricas clave:
  - Total de solicitudes
  - Pendientes de aprobar
  - En proceso
  - Completadas este mes
- Gráfico de tendencias (últimos 6 meses)
- Solicitudes recientes
- Notificaciones no leídas

**Para Requester:**
- Solo ve sus propias estadísticas

**Para otros roles:**
- Ven estadísticas globales del sistema

---

### 2. Solicitudes 📝

#### A. Nueva Solicitud
- Formulario para crear solicitud
- Agregar múltiples items
- Validación de campos requeridos
- Guardar como borrador (futuro)

#### B. Mis Solicitudes (Requester)
- Lista de solicitudes propias
- Filtros: estado, fecha, urgencia
- Acciones:
  - Ver detalles
  - Editar (solo pendientes)
  - Cancelar (solo pendientes)
  - Ver historial

#### C. Panel de Compras (Purchaser/Admin)
- Lista de TODAS las solicitudes
- Filtros avanzados
- Acciones:
  - Ver detalles
  - Agregar cotizaciones
  - Ver cotizaciones existentes
  - Actualizar estado

---

### 3. Cotizaciones 💰

#### A. Gestión de Cotizaciones
- Ver todas las cotizaciones
- Filtrar por proveedor, fecha, estado
- Comparar cotizaciones de una solicitud
- Editar cotizaciones no seleccionadas
- Eliminar cotizaciones no seleccionadas

#### B. Comparación de Cotizaciones
- Vista de tarjetas (cards)
- Vista de tabla comparativa
- Resalta mejor precio
- Muestra todos los detalles

---

### 4. Aprobaciones 👔

**Solo:** Director y Admin

**Funciones:**
- Ver solicitudes con cotizaciones
- Comparar precios y condiciones
- Aprobar cotización seleccionada
- Rechazar con motivo
- Ver historial de aprobaciones

---

### 5. Órdenes de Compra 📋

**Acceso:** Purchaser y Admin

**Funciones:**
- Crear órdenes desde solicitudes autorizadas
- Ver todas las órdenes
- Filtrar por estado, proveedor, fecha
- Generar PDF
- Enviar por email al proveedor
- Marcar como recibida
- Cancelar (con autorización)

---

### 6. Proveedores 🏢

**Acceso:** Purchaser y Admin

**Funciones:**
- Agregar nuevos proveedores
- Editar información:
  - Datos generales (nombre, RFC, dirección)
  - Contacto (teléfono, email, persona)
  - Categoría (autocomplete)
  - Condiciones de pago
  - Calificación
- Ver historial de compras con proveedor
- Desactivar proveedores
- Eliminar proveedores inactivos sin relaciones
- Estadísticas:
  - Total de proveedores
  - Activos
  - Categorías únicas
  - Calificación promedio

---

### 7. Analytics y Reportes 📈

**Acceso:** Director y Admin

#### A. Analytics
- Gasto total por período
- Gasto por área/departamento
- Gasto por categoría
- Proveedores más usados
- Tiempos promedio de proceso
- Solicitudes por urgencia
- Tasas de aprobación/rechazo

#### B. Reportes
- Reporte de compras por período
- Reporte de proveedores
- Reporte de solicitudes
- Reporte de órdenes de compra
- Exportar a PDF/Excel

---

### 8. Administración ⚙️

**Solo:** Admin

#### A. Usuarios
- Crear usuarios
- Editar información
- Cambiar roles
- Activar/desactivar
- Resetear contraseñas
- Ver logs de actividad

#### B. Configuración
- Configurar email
- Ajustar notificaciones
- Configurar límites de aprobación
- Backup de base de datos
- Ver logs del sistema

---

## 🔵 ESTADOS DE SOLICITUD

### 1. 🟡 PENDIENTE
**Descripción:** Solicitud creada, esperando cotizaciones
**Quién lo asigna:** Sistema (al crear)
**Acciones disponibles:**
- Solicitante: Editar, cancelar
- Compras: Ver, agregar cotizaciones

---

### 2. 🔵 COTIZANDO
**Descripción:** Al menos una cotización agregada
**Quién lo asigna:** Sistema (al agregar primera cotización)
**Acciones disponibles:**
- Compras: Agregar más cotizaciones
- Director: Ver, aprobar, rechazar

---

### 3. 🟢 AUTORIZADA
**Descripción:** Director aprobó una cotización
**Quién lo asigna:** Director/Admin (al aprobar)
**Acciones disponibles:**
- Compras: Crear orden de compra
- Admin: Ver detalles

**Importante:** Una vez autorizada, la cotización seleccionada tiene `is_selected = 1`

---

### 4. 🟣 COMPRADA
**Descripción:** Orden de compra generada
**Quién lo asigna:** Compras (al crear orden)
**Acciones disponibles:**
- Compras: Marcar como recibida
- Ver PDF de orden
- Contactar proveedor

---

### 5. ✅ ENTREGADA
**Descripción:** Material/servicio recibido
**Quién lo asigna:** Compras (al confirmar recepción)
**Acciones disponibles:**
- Ver historial completo
- Incluir en reportes

---

### 6. ❌ RECHAZADA
**Descripción:** Director rechazó las cotizaciones
**Quién lo asigna:** Director/Admin (al rechazar)
**Acciones disponibles:**
- Ver motivo de rechazo
- Compras puede agregar nuevas cotizaciones
- Volver a enviar para aprobación

---

### 7. 🚫 CANCELADA
**Descripción:** Solicitante canceló (solo si pendiente)
**Quién lo asigna:** Solicitante (si pendiente)
**Acciones disponibles:**
- Solo lectura
- Ver en historial

---

## 🏗️ ARQUITECTURA TÉCNICA

### Frontend

**Tecnologías:**
- HTML5 + CSS3
- JavaScript Vanilla
- jQuery 3.7.1
- Bootstrap 5.3.2
- DataTables 1.13.7
- Font Awesome 6.5.0
- Chart.js (para gráficos)

**Estructura:**
```
frontend/
├── pages/          # Páginas HTML
│   ├── login.html
│   ├── dashboard.html
│   ├── nueva-solicitud.html
│   ├── mis-solicitudes.html
│   ├── compras-panel.html
│   ├── cotizaciones.html
│   ├── aprobacion-cotizaciones.html
│   ├── ordenes-compra.html
│   ├── proveedores.html
│   ├── usuarios.html
│   └── ...
├── components/     # Componentes reutilizables
│   ├── navbar.html
│   └── sidebar.html
├── js/            # Scripts JavaScript
│   ├── config.js      # Configuración (API URL, constantes)
│   ├── api.js         # Wrapper de API
│   ├── auth.js        # Autenticación
│   ├── utils.js       # Utilidades
│   ├── init.js        # Inicialización global
│   └── [módulos].js
├── css/
│   └── styles.css # Estilos personalizados
└── img/           # Imágenes y logos
```

**Patrón:**
- Componentes cargados dinámicamente (navbar, sidebar)
- API REST consumida vía fetch()
- LocalStorage para token y usuario
- Validación en cliente antes de enviar

---

### Backend

**Tecnologías:**
- Node.js 18+
- Express.js 4.19.2
- SQLite3 5.1.7
- JWT para autenticación
- Bcrypt para contraseñas
- Nodemailer para emails
- Swagger para documentación API

**Estructura:**
```
backend/
├── routes/        # Rutas de API
│   ├── auth.js
│   ├── users.js
│   ├── requests.js
│   ├── quotations.js
│   ├── orders.js
│   ├── suppliers.js
│   └── ...
├── middleware/    # Middlewares
│   └── auth.js    # Autenticación y permisos
├── config/        # Configuración
│   ├── database.js   # Conexión SQLite
│   └── email.js      # Configuración email
├── services/      # Lógica de negocio
│   └── notificationService.js
├── utils/         # Utilidades
│   ├── helpers.js
│   └── validators.js
├── server.js      # Servidor principal
└── database.db    # Base de datos SQLite
```

**Endpoints Principales:**
```
POST   /api/auth/login
POST   /api/auth/change-password
GET    /api/requests
GET    /api/requests/:id
POST   /api/requests
PATCH  /api/requests/:id/status
GET    /api/quotations/request/:id
POST   /api/quotations
PATCH  /api/quotations/:id/select
GET    /api/orders
POST   /api/orders
GET    /api/suppliers
POST   /api/suppliers
GET    /api/users
POST   /api/users
```

**Autenticación:**
- JWT en header `Authorization: Bearer <token>`
- Middleware `authMiddleware` valida token
- Middleware `requireRole()` valida permisos
- Token expira en 24 horas

---

### Base de Datos

**Motor:** SQLite3

**Tablas Principales:**

```sql
users
├── id, email, password_hash, name
├── role, area, is_active
└── created_at, updated_at

requests
├── id, folio, user_id
├── area, request_date, delivery_date
├── urgency, priority, justification
├── status, authorized_by, authorized_at
└── created_at, updated_at

request_items
├── id, request_id
├── material, specifications
├── approximate_cost, quantity, unit
├── in_stock, location
└── created_at

quotations
├── id, request_id, supplier_id
├── quotation_number, total_amount
├── delivery_days, payment_terms, validity_days
├── is_selected, quoted_by, quoted_at
└── notes

quotation_items
├── id, quotation_id, request_item_id
├── unit_price, subtotal
├── notes, has_invoice, delivery_date
└── created_at

suppliers
├── id, name, rfc, address
├── contact_name, phone, email
├── category, payment_terms, rating
├── is_active
└── created_at, updated_at

purchase_orders
├── id, folio, request_id
├── quotation_id, supplier_id
├── order_date, expected_delivery, actual_delivery
├── total_amount, status, notes
└── created_at, updated_at

audit_logs
├── id, table_name, record_id
├── action, old_value, new_value
├── user_id, ip_address
└── created_at
```

**Índices:**
- requests.user_id
- requests.status
- quotations.request_id
- quotations.is_selected
- purchase_orders.request_id

---

## 🔑 CREDENCIALES DE PRUEBA

### Acceso al Sistema

**URL Local:** http://localhost:3000

### Usuarios de Prueba

#### 1. Admin
```
Email: admin@cielitohome.com
Password: admin123
Rol: admin
```

#### 2. Director
```
Email: director@cielitohome.com
Password: director123
Rol: director
```

#### 3. Compras
```
Email: compras@cielitohome.com
Password: compras123
Rol: purchaser
```

#### 4. Solicitante
```
Email: requester@cielitohome.com
Password: requester123
Rol: requester
```

---

## 🚀 INICIAR EL SISTEMA

### 1. Iniciar Backend
```bash
cd backend
npm install  # Solo primera vez
node server.js
```

**Verificar:**
```
✅ Connected to SQLite database
Server running on port 3000
Swagger docs available at http://localhost:3000/api-docs
```

### 2. Abrir Frontend
```
Abrir navegador en: http://localhost:3000
```

### 3. Login
- Usar credenciales de prueba
- El sistema redirige al dashboard según el rol

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Backend no inicia
**Error:** `EADDRINUSE: address already in use`
**Solución:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Reiniciar
node server.js
```

### Token expirado
**Error:** "Token inválido o expirado"
**Solución:** Cerrar sesión y volver a iniciar sesión

### Solicitudes no aparecen en Órdenes
**Error:** Dropdown vacío en "Nueva Orden"
**Solución:**
1. Verificar que la solicitud está "autorizada"
2. Verificar que tiene cotización seleccionada (`is_selected = 1`)
3. Abrir consola F12 y ver logs
4. Verificar backend logs

### Navbar muestra "Usuario" y "Rol"
**Causa:** Caché del navegador
**Solución:**
```
Ctrl + Shift + Delete
Borrar caché
Recargar página (Ctrl + F5)
```

---

## 📚 DOCUMENTOS ADICIONALES

1. **SESION_COMPLETA_2025-10-28.md** - Última sesión de correcciones
2. **FIX_ADMIN_PERMISOS_SIDEBAR_2025-10-28.md** - Corrección permisos admin
3. **FIX_ORDENES_COMPRA_2025-10-28.md** - Corrección órdenes de compra
4. **ROLES_SISTEMA.md** - Detalle de roles y permisos
5. **FLUJO_COTIZACIONES_COMPLETO.md** - Flujo detallado de cotizaciones

---

## 📞 SOPORTE

**Documentación:** Revisar archivos .md en la raíz del proyecto
**Logs del sistema:** Abrir consola F12 en el navegador
**Logs del backend:** Ver terminal donde corre `node server.js`

---

**Guía creada:** 28 de Octubre de 2025
**Sistema de Compras Cielito Home v2.5.5**
**Estado:** ✅ PRODUCCIÓN
