# Configuración del Sistema de Compras Cielito Home

## 🚀 Configuración Inicial Rápida

### 1. Preparar el Backend

```bash
cd backend
npm install
```

### 2. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
copy .env.example .env

# O en Linux/Mac:
cp .env.example .env
```

El archivo `.env` por defecto funciona para desarrollo local. Puedes editarlo si necesitas cambios específicos.

### 3. Inicializar Base de Datos

```bash
# Solo crear las tablas y admin por defecto
npm run init-db

# O si quieres empezar completamente limpio
npm run reset-db
```

### 4. (Opcional) Agregar Datos de Cielito Home

```bash
# Solo si quieres los usuarios reales y datos de ejemplo
npm run seed
```

### 5. Iniciar el Servidor

```bash
# Desarrollo (con auto-restart)
npm run dev

# O producción
npm start
```

### 6. Abrir el Frontend

- Abre VS Code en la carpeta del proyecto
- Instala la extensión "Live Server" si no la tienes
- Click derecho en `frontend/index.html` > "Open with Live Server"
- O simplemente abre: http://localhost:5500

## 👥 Usuarios por Defecto

### Usuario Administrador (siempre se crea)
- **Email:** admin@sistema.com
- **Contraseña:** admin123
- **Rol:** Administrador

### Usuarios de Cielito Home (solo si ejecutas seed)
- **direcciongeneral@cielitohome.com** / cielito2025 - Yessica Tovar (Director)
- **compras@cielitohome.com** / cielito2025 - Brenda Espino (Compras)
- **sistemas16ch@gmail.com** / cielito2025 - Lenin Silva (Admin)
- **sistemas@cielitohome.com** / cielito2025 - Paulina González (Solicitante)
- Y más usuarios...

## 🔧 Comandos Útiles

```bash
# Backend
cd backend

# Limpiar y empezar de nuevo
npm run reset-db

# Solo agregar datos de prueba
npm run seed

# Limpiar y agregar datos de prueba
npm run clean-start

# Ver logs del servidor
npm run dev
```

## 🌐 URLs del Sistema

- **Frontend:** http://localhost:5500
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

## ⚡ Solución Rápida de Problemas

### Error: "Cannot GET /api/..."
El backend no está corriendo. Ejecuta `npm start` en la carpeta backend.

### Error: "No se puede conectar"
Verifica que:
1. El backend esté corriendo en puerto 3000
2. El frontend esté en puerto 5500
3. No haya firewall bloqueando los puertos

### Error: "Token inválido"
Limpia el localStorage del navegador:
```javascript
// En la consola del navegador:
localStorage.clear();
```

### Error de CORS
Asegúrate que `FRONTEND_URL` en `.env` sea `http://localhost:5500`

### Base de datos corrupta
```bash
cd backend
npm run reset-db
```

## 🔒 Variables de Entorno Mínimas

Para desarrollo local, estas variables son suficientes:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=./database.sqlite
JWT_SECRET=mi_secreto_para_desarrollo
FRONTEND_URL=http://localhost:5500
```

## 📝 Estructura de Archivos
