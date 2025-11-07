# 🚀 Guía de Deployment en Render

Esta guía explica cómo deployar el Sistema de Compras Cielito Home en Render usando PostgreSQL.

## 📋 Requisitos Previos

- Cuenta en [Render.com](https://render.com)
- Cuenta en [GitHub](https://github.com) (con el código ya subido)
- Base de datos limpia (ya ejecutaste `clean-database-for-deployment.js`)

## 🗄️ Paso 1: Crear Base de Datos PostgreSQL

1. Inicia sesión en [Render.com](https://dashboard.render.com)
2. Click en **"New +"** → **"PostgreSQL"**
3. Configura la base de datos:
   - **Name**: `sistema-compras-db`
   - **Database**: `sistema_compras`
   - **User**: (se genera automáticamente)
   - **Region**: Selecciona la más cercana a México (ej: Oregon, USA)
   - **Plan**: **Free** (para empezar)
4. Click en **"Create Database"**
5. **IMPORTANTE**: Copia la **Internal Database URL** (la necesitarás después)
   - Ejemplo: `postgresql://sistema_compras_user:xxx@dpg-xxx.oregon-postgres.render.com/sistema_compras`

## 🔧 Paso 2: Inicializar el Esquema de PostgreSQL

1. En la página de tu base de datos en Render, busca **"Connect"**
2. Copia el comando de conexión PSQL
3. En tu computadora local, ejecuta:

```bash
cd backend
export DATABASE_URL="TU_DATABASE_URL_DE_RENDER"
node init-postgres.js
```

Este script creará todas las tablas necesarias en PostgreSQL.

## 📦 Paso 3: Migrar Datos (OPCIONAL)

**Solo si quieres migrar tus datos de SQLite a PostgreSQL:**

```bash
cd backend
export DATABASE_URL="TU_DATABASE_URL_DE_RENDER"
node migrate-sqlite-to-postgres.js
```

**NOTA**: Si deployaste la DB limpia (sin datos de prueba), puedes saltar este paso.

## 🌐 Paso 4: Crear Web Service en Render

1. En Render Dashboard, click en **"New +"** → **"Web Service"**
2. Conecta tu repositorio de GitHub:
   - Click en **"Connect Account"** si es la primera vez
   - Busca tu repositorio: `UP220404/Gestion_Compras_CH`
   - Click en **"Connect"**
3. Configura el Web Service:

   **Configuración Básica:**
   - **Name**: `sistema-compras-backend`
   - **Region**: La misma que tu base de datos (ej: Oregon)
   - **Branch**: `backUpg` (o `main` según tu rama de producción)
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free**

## 🔑 Paso 5: Configurar Variables de Entorno

En la sección **"Environment"**, agrega las siguientes variables:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=tu_internal_database_url_de_render
JWT_SECRET=tu_secreto_jwt_super_seguro_aleatorio_123456
SESSION_SECRET=tu_secreto_session_super_seguro_aleatorio_789

# Email (Gmail)
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password_de_gmail

# Frontend URL (actualizarás después)
FRONTEND_URL=https://sistema-compras-frontend.onrender.com
```

**IMPORTANTE**:
- Reemplaza `DATABASE_URL` con la URL Internal que copiaste en el Paso 1
- Genera contraseñas seguras aleatorias para `JWT_SECRET` y `SESSION_SECRET`
- Para `EMAIL_PASS`, usa una [App Password de Gmail](https://support.google.com/accounts/answer/185833)

## 🎨 Paso 6: Crear Web Service para Frontend

1. En Render Dashboard, click en **"New +"** → **"Static Site"**
2. Conecta el mismo repositorio de GitHub
3. Configura el Static Site:

   **Configuración Básica:**
   - **Name**: `sistema-compras-frontend`
   - **Branch**: `backUpg` (o tu rama de producción)
   - **Root Directory**: `frontend`
   - **Build Command**: (dejar vacío, es solo HTML/CSS/JS)
   - **Publish Directory**: `.` (punto)

4. Click en **"Create Static Site"**

## 🔗 Paso 7: Configurar URLs

### A. Actualizar Backend con URL de Frontend

1. Ve a tu **Web Service del backend**
2. En **"Environment"**, actualiza:
   ```env
   FRONTEND_URL=https://TU_NOMBRE_FRONTEND.onrender.com
   ```
3. Guarda los cambios

### B. Actualizar Frontend con URL de Backend

1. En tu código local, abre `frontend/js/config.js`
2. Actualiza la línea 3-5:
   ```javascript
   const CONFIG = {
     API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
       ? 'http://localhost:3000/api'
       : 'https://TU_NOMBRE_BACKEND.onrender.com/api',
   ```
3. Commit y push los cambios:
   ```bash
   git add frontend/js/config.js
   git commit -m "Actualizar API_URL para producción"
   git push origin backUpg
   ```
4. Render re-deployrá automáticamente el frontend

## ✅ Paso 8: Verificar el Deployment

1. **Backend**: Ve a `https://TU_NOMBRE_BACKEND.onrender.com/api/health`
   - Deberías ver: `{"status":"ok","database":"connected"}`

2. **Frontend**: Ve a `https://TU_NOMBRE_FRONTEND.onrender.com`
   - Deberías ver la página de login del sistema

3. **Login Inicial**:
   - Si migraste datos, usa tus credenciales existentes
   - Si es una DB nueva, necesitas crear el primer usuario admin manualmente:

```sql
-- Conecta a tu DB de Render vía PSQL y ejecuta:
INSERT INTO users (name, email, password, role, area, is_active)
VALUES ('Admin', 'admin@cielitohome.com', '$2a$10$...', 'admin', 'Sistemas', true);
```

**Nota**: El password debe estar hasheado con bcrypt. Usa un script local para generarlo.

## 🔧 Troubleshooting

### Error: "Database connection failed"
- Verifica que `DATABASE_URL` esté correcta en las variables de entorno
- Asegúrate de usar la **Internal Database URL**, no la External

### Error: "CORS blocked"
- Verifica que `FRONTEND_URL` en el backend apunte al dominio correcto del frontend
- Revisa que `backend/server.js` tenga configurado CORS correctamente

### Frontend no se conecta al backend
- Verifica que `API_URL` en `frontend/js/config.js` apunte al backend correcto
- Asegúrate de que sea HTTPS, no HTTP

### El servicio se "duerme" después de 15 minutos
- Es normal en el plan Free de Render
- El servicio se "despierta" automáticamente al recibir una petición (tarda ~30 segundos)
- Para evitarlo, considera actualizar al plan Starter ($7/mes)

## 📊 Monitoreo

### Logs del Backend
1. Ve a tu Web Service en Render
2. Click en la pestaña **"Logs"**
3. Verás todos los logs en tiempo real

### Logs de la Base de Datos
1. Ve a tu PostgreSQL Database en Render
2. Click en la pestaña **"Logs"**
3. Puedes ver queries y errores

## 🔄 Actualizar el Sistema

Cada vez que hagas cambios en GitHub (push), Render automáticamente:
1. Detecta el cambio
2. Re-ejecuta el build
3. Redeploya el servicio

**No necesitas hacer nada manual** después del primer deployment.

## 💰 Costos

### Plan Free (Actual)
- **Base de Datos PostgreSQL**: Gratis (90 días, luego expira)
- **Web Service Backend**: Gratis (se duerme después de 15 min inactivo)
- **Static Site Frontend**: Gratis (siempre activo)
- **Limitaciones**:
  - DB expira a los 90 días
  - Backend se duerme después de 15 min
  - 750 horas/mes de runtime

### Plan Recomendado para Producción
- **PostgreSQL Starter**: $7/mes (sin expiración, 256MB RAM)
- **Web Service Starter**: $7/mes (siempre activo, 512MB RAM)
- **Static Site**: Gratis
- **Total**: $14/mes

## 🎯 Checklist Final

- [ ] Base de datos PostgreSQL creada en Render
- [ ] Esquema inicializado con `init-postgres.js`
- [ ] Datos migrados (opcional) con `migrate-sqlite-to-postgres.js`
- [ ] Web Service backend configurado y deployrdo
- [ ] Variables de entorno configuradas correctamente
- [ ] Static Site frontend deployrdo
- [ ] `API_URL` actualizada en frontend
- [ ] `FRONTEND_URL` actualizada en backend
- [ ] Login funciona correctamente
- [ ] Emails se envían correctamente (opcional)

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Render
2. Verifica las variables de entorno
3. Consulta la [documentación de Render](https://render.com/docs)
4. Contacta a soporte de Render (son muy rápidos)

---

🎉 **¡Listo!** Tu sistema de compras ahora está en producción con PostgreSQL.
