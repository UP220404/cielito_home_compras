# 🔧 Configuración de Variables de Entorno

## 📋 Tabla de Contenidos
1. [Backend (Node.js)](#backend-nodejs)
2. [Frontend (HTML + JS)](#frontend-html--js)
3. [Despliegue en Render](#despliegue-en-render)
4. [Despliegue en Vercel](#despliegue-en-vercel)
5. [Solución de Problemas](#solución-de-problemas)

---

## 🎯 Backend (Node.js)

### Archivos de Configuración

#### `.env.development` (Local - SQLite)
```env
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

FRONTEND_URL=http://localhost:5500

# Database - SQLite (dejar vacío)
DB_TYPE=sqlite
DATABASE_URL=

# JWT
JWT_SECRET=tu_secreto_super_seguro_cambiar_en_produccion_12345
JWT_EXPIRES_IN=7d

# Email (opcional en desarrollo)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
EMAIL_USER=noreply@cielitohome.com
EMAIL_PASS=
EMAIL_ENABLED=false

# Otros
MAX_FILE_SIZE=5242880
ENABLE_CRON=true
LOG_LEVEL=debug
ENABLE_CORS=true
```

#### `.env.production` (Render - PostgreSQL)
```env
NODE_ENV=production
PORT=3000

# URL del frontend desplegado
FRONTEND_URL=https://cielito-home-compras.vercel.app

# Database - PostgreSQL
DB_TYPE=postgresql
DATABASE_URL=postgresql://usuario:password@host/database

# JWT (usar un secreto fuerte en producción)
JWT_SECRET=un_secreto_muy_seguro_y_aleatorio_para_produccion
JWT_EXPIRES_IN=7d

# Email (configurar con servicio real)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
EMAIL_ENABLED=true

# Otros
MAX_FILE_SIZE=5242880
ENABLE_CRON=true
```

### Cómo Funciona

El backend detecta automáticamente el entorno:
```javascript
// server.js
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: envFile });
```

- **Local**: Lee `.env.development` → Usa SQLite
- **Producción**: Lee `.env.production` → Usa PostgreSQL

---

## 🌐 Frontend (HTML + JS)

### Estructura de Archivos

```
frontend/
├── .env.local              # Variables locales (no se sube a Git)
├── .env.example            # Ejemplo para otros desarrolladores
├── js/
│   ├── env.js              # Cargador de variables de entorno
│   ├── config.js           # Configuración que usa env.js
│   └── api.js              # Cliente API
├── generate-env.js         # Script para generar env.js en build
└── vercel.json             # Configuración de Vercel
```

### `.env.local` (Desarrollo Local)
```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=Sistema de Compras Cielito Home
VITE_APP_VERSION=1.0.0
```

> **Nota**: Este archivo NO se usa directamente. Es solo referencia. El archivo `env.js` es el que se carga en el navegador.

### `js/env.js` (Se carga en el navegador)
```javascript
// Este archivo se genera automáticamente en Vercel
// Para desarrollo local, contiene valores por defecto

const ENV_CONFIG = {
  API_URL: 'http://localhost:3000/api',
  APP_NAME: 'Sistema de Compras Cielito Home',
  APP_VERSION: '1.0.0',
  ENVIRONMENT: 'development'
};

// Detecta producción automáticamente
const isProduction = window.location.hostname !== 'localhost' &&
                     window.location.hostname !== '127.0.0.1';

if (isProduction) {
  ENV_CONFIG.API_URL = window.__ENV?.API_URL || 'https://gestion-compras-ch.onrender.com/api';
  ENV_CONFIG.ENVIRONMENT = 'production';
}

window.ENV = ENV_CONFIG;
```

### Orden de Carga en HTML
```html
<!-- Cargar env.js ANTES de config.js -->
<script src="js/env.js?v=20251111"></script>
<script src="js/config.js?v=20251111v5"></script>
```

---

## ☁️ Despliegue en Render (Backend)

### 1. Configurar Variables de Entorno

En el Dashboard de Render:

```
Environment Variables:
NODE_ENV=production
DATABASE_URL=<tu-postgresql-url-de-render>
JWT_SECRET=<generar-secreto-seguro>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://cielito-home-compras.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
EMAIL_ENABLED=true
MAX_FILE_SIZE=5242880
ENABLE_CRON=true
```

### 2. Comando de Start

```bash
npm start
```

Render ejecutará automáticamente `node server.js` con `NODE_ENV=production`.

---

## 🚀 Despliegue en Vercel (Frontend)

### 1. Archivo `vercel.json`

```json
{
  "version": 2,
  "name": "sistema-compras-cielito-home",
  "buildCommand": "node generate-env.js",
  "env": {
    "API_URL": "@api-url"
  }
}
```

### 2. Configurar Variables de Entorno en Vercel

#### Opción A: Desde el Dashboard

1. Ir a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agregar:
   ```
   API_URL = https://gestion-compras-ch.onrender.com/api
   ```
4. Seleccionar: **Production**, **Preview**, **Development**

#### Opción B: Desde CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Agregar variable
vercel env add API_URL production
# Pegar: https://gestion-compras-ch.onrender.com/api

# Para preview/development también
vercel env add API_URL preview
vercel env add API_URL development
```

### 3. Script `generate-env.js`

Este script se ejecuta durante el build en Vercel:

```javascript
// Lee las variables de entorno de Vercel
const API_URL = process.env.API_URL || 'https://gestion-compras-ch.onrender.com/api';

// Genera js/env.js con los valores correctos
const envContent = `
const ENV_CONFIG = {
  API_URL: '${API_URL}',
  ENVIRONMENT: 'production',
  BUILD_TIME: '${new Date().toISOString()}'
};
window.ENV = ENV_CONFIG;
`;

fs.writeFileSync('js/env.js', envContent);
```

### 4. Redeploy

Después de configurar las variables:

```bash
# Opción 1: Push a Git (auto-deploy)
git add .
git commit -m "Configure environment variables"
git push

# Opción 2: Deploy manual
vercel --prod
```

---

## 🔍 Verificación

### Backend

```bash
# Terminal local
cd backend
npm run dev

# Verificar que cargue el entorno correcto
# Debe mostrar: "📊 Using SQLITE database"
```

### Frontend

1. Abrir http://localhost:5500 (o tu servidor local)
2. Abrir DevTools → Console
3. Debe mostrar:
   ```
   🔧 Environment Config: {API_URL: "http://localhost:3000/api", ENVIRONMENT: "development"}
   🔧 CONFIG cargado: {version: "2025-11-11-v5", API_URL: "http://localhost:3000/api", ...}
   ```

### Producción

1. Abrir tu sitio en Vercel
2. DevTools → Console
3. Debe mostrar:
   ```
   🚀 Production environment loaded: production
   🔧 CONFIG cargado: {API_URL: "https://gestion-compras-ch.onrender.com/api", ...}
   ```

---

## ❌ Solución de Problemas

### Error: "API_URL is undefined"

**Causa**: `env.js` se carga después de `config.js`

**Solución**: Verificar orden en HTML:
```html
<!-- ✅ CORRECTO -->
<script src="js/env.js"></script>
<script src="js/config.js"></script>

<!-- ❌ INCORRECTO -->
<script src="js/config.js"></script>
<script src="js/env.js"></script>
```

### Error: "CORS blocked"

**Causa**: Backend no permite el origen del frontend

**Solución**: Verificar `FRONTEND_URL` en backend `.env`:
```env
# Backend .env.production
FRONTEND_URL=https://tu-sitio.vercel.app
```

### Error: "Database error" en producción

**Causa**: `DATABASE_URL` no configurada en Render

**Solución**: Agregar variable en Render Dashboard

### Frontend no usa las variables de Vercel

**Causa**: El script `generate-env.js` no se ejecutó

**Solución**:
1. Verificar `vercel.json` tiene `"buildCommand": "node generate-env.js"`
2. Hacer redeploy: `vercel --prod`

---

## 📚 Resumen

| Componente | Desarrollo | Producción |
|------------|-----------|------------|
| **Backend** | `.env.development` + SQLite | `.env.production` + PostgreSQL |
| **Frontend** | `env.js` (local defaults) | `env.js` (generado por Vercel) |
| **API URL** | `http://localhost:3000/api` | `https://gestion-compras-ch.onrender.com/api` |

### Archivos que NO se suben a Git
```gitignore
.env
.env.local
.env.*.local
backend/.env.development
backend/.env.production
frontend/.env.local
```

### Archivos que SÍ se suben a Git
```
✅ .env.example
✅ backend/.env.example
✅ frontend/.env.example
✅ frontend/js/env.js (versión de desarrollo con valores por defecto)
✅ frontend/generate-env.js
✅ vercel.json
✅ ENV_SETUP.md (esta documentación)
```

---

## 🎉 ¡Listo!

Tu aplicación ahora:
- ✅ Usa variables de entorno en backend y frontend
- ✅ Se adapta automáticamente a desarrollo y producción
- ✅ Es fácil de desplegar en Render y Vercel
- ✅ No expone información sensible en el código

**¿Dudas?** Consulta este archivo o revisa los logs de despliegue.
