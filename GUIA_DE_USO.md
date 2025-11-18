# 📘 GUÍA COMPLETA DE USO - Sistema de Compras Cielito Home

## 🚀 INICIO RÁPIDO

### ✅ PASO 1: Iniciar el Servidor Backend

```powershell
# Navega a la carpeta backend
cd backend

# Inicia el servidor
npm start
```

**Deberías ver:**
```
🚀 ====================================
   SISTEMA DE COMPRAS CIELITO HOME
====================================
📡 Server running on port 3002
```

---

### ✅ PASO 2: Abrir el Frontend

**Opción A - Con Live Server (Recomendado):**
1. Instala la extensión "Live Server" en VS Code
2. Click derecho en `frontend/index.html`
3. Selecciona "Open with Live Server"
4. Se abrirá en `http://localhost:5500`

**Opción B - Con NPM:**
```powershell
cd frontend
npx serve -p 5500
```

---

### ✅ PASO 3: Acceder al Sistema

1. **URL:** `http://localhost:5500`
2. Click en **"Iniciar Sesión"**
3. Usa una de estas credenciales:

| Rol | Email | Password | Permisos |
|-----|-------|----------|----------|
| 🔧 **Admin** | sistemas16ch@gmail.com | cielito2025 | Acceso total |
| 👑 **Director** | direcciongeneral@cielitohome.com | cielito2025 | Autorizar solicitudes |
| 🛒 **Compras** | compras@cielitohome.com | cielito2025 | Cotizaciones y órdenes |
| 👤 **Solicitante** | sistemas@cielitohome.com | cielito2025 | Crear solicitudes |

---

## 📋 FLUJO COMPLETO DEL SISTEMA

### 1️⃣ **SOLICITANTE crea una solicitud**

1. Inicia sesión con un usuario **Solicitante**
2. Ve a **"Nueva Solicitud"** en el menú
3. Completa el formulario:
   - **Área:** Tu área (ej: Sistemas)
   - **Urgencia:** Baja / Media / Alta
   - **Prioridad:** Normal / Urgente / Crítica
   - **Justificación:** Por qué necesitas esto
   - **Fecha de entrega:** Cuándo lo necesitas
   - **Items:** Agrega productos/servicios que necesitas
     - Material
     - Especificaciones
     - Cantidad
     - Costo aproximado
4. Click en **"Crear Solicitud"**
5. ✅ La solicitud queda en estado **"Pendiente"**

---

### 2️⃣ **DIRECTOR autoriza la solicitud**

1. Inicia sesión con usuario **Director**
2. Ve al **Dashboard**
3. Verás solicitudes pendientes
4. Click en **"Ver detalles"** de una solicitud
5. Revisa la información
6. Click en **"Autorizar"** (o "Rechazar" si no procede)
7. ✅ La solicitud cambia a estado **"Autorizada"**

---

### 3️⃣ **COMPRAS cotiza con proveedores**

1. Inicia sesión con usuario **Compras**
2. Ve a **"Panel de Compras"**
3. En la pestaña **"Autorizadas"** verás las solicitudes aprobadas
4. Click en **"Cotizar"** (ícono $)
5. Agrega cotizaciones de diferentes proveedores:
   - Selecciona proveedor
   - Monto total
   - Días de entrega
   - Términos de pago
6. Cuando tengas varias cotizaciones, **selecciona la mejor**
7. ✅ La solicitud cambia a estado **"Cotizando"**

---

### 4️⃣ **COMPRAS genera la orden de compra**

1. Ve a **"Órdenes de Compra"**
2. Click en **"Nueva Orden"**
3. Selecciona la solicitud y cotización ganadora
4. Click en **"Generar Orden"**
5. Se genera un **PDF automáticamente**
6. ✅ La solicitud cambia a estado **"Comprada"**

---

### 5️⃣ **COMPRAS recibe el producto**

1. Cuando llegue el producto, ve a **"Órdenes de Compra"**
2. Busca la orden
3. Cambia el estado a **"Recibida"**
4. ✅ La solicitud cambia a estado **"Entregada"**

---

## 🔧 GESTIÓN DE PROVEEDORES

1. Ve a **"Proveedores"** en el menú
2. Click en **"Nuevo Proveedor"**
3. Completa:
   - Nombre
   - RFC
   - Contacto
   - Teléfono
   - Email
   - Dirección
   - Categoría (ej: Tecnología, Papelería)
4. Click en **"Guardar"**

---

## 👥 GESTIÓN DE USUARIOS (Solo Admin)

1. Inicia sesión como **Admin**
2. Ve a **"Usuarios"** en el menú
3. Click en **"Nuevo Usuario"**
4. Completa:
   - Nombre
   - Email
   - Contraseña
   - Área
   - Rol (Solicitante / Compras / Director / Admin)
5. Click en **"Guardar"**

---

## 📊 REPORTES Y ANALYTICS

### Dashboard
- Ve a **"Dashboard"** para ver:
  - Total de solicitudes
  - Pendientes
  - Completadas
  - Gráficas de estado
  - Actividad reciente

### Analytics (Solo Director/Admin)
- Ve a **"Analytics"** para ver:
  - Gasto por área
  - Solicitudes por mes
  - Top proveedores
  - Tiempos de respuesta

### Reportes
- Ve a **"Reportes"**
- Exporta a Excel:
  - Todas las solicitudes
  - Proveedores
  - Órdenes de compra
- Aplica filtros por fecha, área, estado, etc.

---

## 🔔 NOTIFICACIONES

El sistema envía notificaciones cuando:
- ✅ Tu solicitud es autorizada
- ❌ Tu solicitud es rechazada
- 💰 Se agrega una cotización
- 📦 Se genera una orden de compra
- ✅ Tu orden es recibida

Para ver notificaciones:
1. Click en el ícono de **campana** 🔔 en el navbar
2. Ve a **"Notificaciones"** para ver todas

---

## ⚙️ CONFIGURACIÓN

Ve a **"Configuración"** para:
- Ver información del sistema
- Limpiar caché del navegador
- Cambiar preferencias
- Cerrar sesión

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### ❌ Error: "Failed to load resource"
**Solución:**
```javascript
// En consola del navegador (F12):
localStorage.clear();
location.reload();
```

### ❌ No puedo iniciar sesión
**Solución:**
1. Verifica que el backend esté corriendo (`npm start` en `/backend`)
2. Verifica que estés en `http://localhost:5500`
3. Usa las credenciales correctas (password: `cielito2025`)

### ❌ El diseño se ve raro
**Solución:**
```
Presiona: Ctrl + Shift + R
(Esto fuerza la recarga sin caché)
```

### ❌ Backend dice "EADDRINUSE"
**Solución:**
```powershell
# El puerto ya está en uso, mata el proceso:
Get-NetTCPConnection -LocalPort 3002 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Luego reinicia:
npm start
```

---

## 📞 SOPORTE

**Desarrollado por:**
- Lenin Silva
- Equipo de Sistemas - Cielito Home
- Email: sistemas16ch@gmail.com

**Versión:** 1.0.0
**Fecha:** Octubre 2025

---

## 🎯 CASOS DE USO COMUNES

### Caso 1: Comprar 3 laptops para Sistemas
1. **Login:** sistemas@cielitohome.com
2. **Nueva Solicitud**
3. **Agregar items:**
   - Laptop Dell Inspiron 15 | Cantidad: 3 | Costo: $15,000 c/u
   - Monitor LG 24" | Cantidad: 3 | Costo: $4,500 c/u
4. **Justificación:** "Renovación de equipos por obsolescencia"
5. **Crear Solicitud** ✅

### Caso 2: Autorizar solicitud urgente
1. **Login:** direcciongeneral@cielitohome.com
2. **Dashboard** → Ver solicitudes pendientes
3. **Revisar** solicitud
4. **Autorizar** ✅

### Caso 3: Cotizar con 3 proveedores
1. **Login:** compras@cielitohome.com
2. **Panel Compras** → Tab "Autorizadas"
3. **Cotizar** (ícono $)
4. **Agregar 3 cotizaciones:**
   - Proveedor A: $65,000 | 15 días
   - Proveedor B: $62,000 | 20 días
   - Proveedor C: $67,000 | 10 días
5. **Seleccionar** la mejor opción ✅

---

## 🎨 ATAJOS DE TECLADO

- `Ctrl + Shift + R` - Recargar sin caché
- `F12` - Abrir DevTools
- `Ctrl + K` - Buscar (en tablas DataTables)

---

## 📸 CAPTURAS DE PANTALLA

*(El sistema está listo para usar. Las capturas se pueden agregar después)*

---

**🎉 ¡Sistema listo para usar! Sigue esta guía y no tendrás problemas.**
