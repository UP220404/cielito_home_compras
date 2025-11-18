# Sistema de Compras Cielito Home

Sistema web completo para la gestión de solicitudes de compra, cotizaciones, órdenes de compra y proveedores.

## 🚀 Características

- **Gestión de Solicitudes**: Crear, aprobar y seguimiento de solicitudes de compra
- **Sistema de Cotizaciones**: Gestión de cotizaciones de proveedores
- **Órdenes de Compra**: Generación automática de órdenes con PDFs
- **Proveedores**: Catálogo completo de proveedores
- **Dashboard Analytics**: Estadísticas y reportes en tiempo real
- **Notificaciones**: Sistema de notificaciones en tiempo real y por email
- **Reportes Excel/PDF**: Exportación de datos en múltiples formatos
- **Sistema de Roles**: Control de acceso por roles (Director, Compras, Solicitante, Admin)

## 🏗️ Arquitectura

```
cielito-compras/
├── backend/          # API Node.js + Express
│   ├── config/       # Configuración DB y Email
│   ├── middleware/   # Autenticación y validaciones
│   ├── routes/       # Endpoints API
│   ├── services/     # Servicios (Email, PDF, Notificaciones)
│   └── utils/        # Utilidades y helpers
└── frontend/         # Cliente web HTML/CSS/JS
    ├── css/          # Estilos
    ├── js/           # Lógica del cliente
    └── pages/        # Páginas HTML
```

## 🛠️ Tecnologías

### Backend
- **Node.js** + **Express** - Servidor web
- **SQLite** - Base de datos
- **JWT** - Autenticación
- **Nodemailer** - Envío de emails
- **PDFKit** - Generación de PDFs
- **ExcelJS** - Reportes Excel
- **bcryptjs** - Encriptación de passwords

### Frontend
- **HTML5** + **CSS3** + **JavaScript ES6**
- **Bootstrap 5.3** - Framework CSS
- **Chart.js** - Gráficas
- **DataTables** - Tablas dinámicas
- **Font Awesome** - Íconos

## 📦 Instalación

### 1. Clonar repositorio
```bash
cd "c:\Users\lenin\OneDrive\Documentos\Cielito Home\Sistema_Compras"
```

### 2. Configurar Backend
```bash
cd backend
npm install
```

### 3. Variables de entorno
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

### 4. Inicializar base de datos
```bash
npm run init-db
npm run seed
```

### 5. Iniciar servidor
```bash
npm start
# o para desarrollo:
npm run dev
```

### 6. Acceder al sistema
- **Frontend**: http://localhost:5500 (con Live Server)
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 👥 Usuarios por Defecto

| Email | Password | Rol | Descripción |
|-------|----------|-----|-------------|
| direcciongeneral@cielitohome.com | cielito2025 | Director | Yessica Tovar - Autoriza solicitudes |
| compras@cielitohome.com | cielito2025 | Purchaser | Brenda Espino - Gestiona cotizaciones y órdenes |
| sistemas@cielitohome.com | cielito2025 | Requester | Paulina González - Crea solicitudes (Sistemas) |
| sistemas16ch@gmail.com | cielito2025 | Admin | Lenin Silva - Administrador del sistema |

**Otros usuarios Requesters:**
- marketing@cielitohome.com (Ivan Arellano - Marketing)
- juridico@cielitohome.com (Mariana Cadena - Jurídico)
- atencionaclientes@cielitohome.com (Nayeli Pulido - Atención a clientes)
- logistica1cielitohome@gmail.com (Jacel Saldaña - Logística)
- diroperacionescielitohome@gmail.com (Yadira Luna - Operaciones)
- sistemas5cielitohome@gmail.com (Estefania Gutierrez - Mantenimiento)
- atencionmedicacielitoh@gmail.com (Miriam Muñoz - Servicio Médico)

## 🔧 Configuración

### Base de Datos
El sistema usa SQLite por defecto. Para PostgreSQL:
```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Email
Configurar SMTP en `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
```

### JWT
```env
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRES_IN=7d
```

## 🌎 Configuración de ambientes y variables de entorno

El backend utiliza archivos `.env` para separar la configuración de desarrollo, producción y testing. Ejemplos:
- `.env.development` para desarrollo
- `.env.production` para producción
- `.env.test` para testing

Copia el archivo `.env.example` y renómbralo según el ambiente que desees configurar. Edita los valores según tu entorno.

**Variables críticas:**
- `JWT_SECRET`: Clave secreta para autenticación
- `DATABASE_URL`: Ruta de la base de datos

**Ejemplo de inicio:**
```bash
npm run dev      # Desarrollo
npm start        # Producción
npm run test     # Testing
```

**Nota:** Los archivos `.env*` están excluidos del repositorio por seguridad.

## 📱 Uso del Sistema

### 1. **Solicitantes**
- Crear solicitudes de compra
- Ver estado de sus solicitudes
- Recibir notificaciones de cambios

### 2. **Directores**
- Autorizar/rechazar solicitudes
- Ver dashboard ejecutivo
- Recibir reportes automáticos

### 3. **Área de Compras**
- Gestionar cotizaciones
- Crear órdenes de compra
- Administrar proveedores
- Generar reportes

### 4. **Administradores**
- Gestionar usuarios
- Configurar sistema
- Acceso completo a reportes

## 📊 Reportes Disponibles

- **Excel**: Solicitudes, Proveedores, Órdenes de Compra
- **PDF**: Órdenes de compra, Reportes personalizados
- **Dashboard**: KPIs en tiempo real, gráficas interactivas

## 🔒 Seguridad

- Autenticación JWT
- Validación de datos con express-validator
- Encriptación de passwords con bcrypt
- Logs de auditoría completos
- Headers de seguridad con Helmet

## 🚀 Despliegue

### Desarrollo Local
```bash
npm run dev
```

### Producción
1. Configurar variables de entorno de producción
2. Usar PostgreSQL en lugar de SQLite
3. Configurar SMTP real
4. Configurar HTTPS

```bash
NODE_ENV=production npm start
```

## 📁 Estructura de Archivos

```
backend/
├── config/
│   ├── database.js     # Conexión BD
│   └── email.js        # Config email
├── middleware/
│   ├── auth.js         # Autenticación
│   └── errorHandler.js # Manejo errores
├── routes/
│   ├── auth.js         # Login/registro
│   ├── requests.js     # Solicitudes
│   ├── quotations.js   # Cotizaciones
│   ├── suppliers.js    # Proveedores
│   ├── orders.js       # Órdenes compra
│   ├── analytics.js    # Dashboard
│   ├── reports.js      # Reportes
│   └── notifications.js # Notificaciones
├── services/
│   ├── emailService.js      # Envío emails
│   ├── pdfService.js        # Generación PDFs
│   └── notificationService.js # Notificaciones
└── utils/
    ├── validators.js   # Validaciones
    └── helpers.js      # Utilidades
```

## 🔄 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Usuario actual
- `POST /api/auth/change-password` - Cambiar password

### Solicitudes
- `GET /api/requests` - Listar solicitudes
- `POST /api/requests` - Crear solicitud
- `GET /api/requests/:id` - Ver solicitud
- `PATCH /api/requests/:id/status` - Cambiar estado

### Cotizaciones
- `GET /api/quotations/request/:id` - Cotizaciones de solicitud
- `POST /api/quotations` - Crear cotización
- `PATCH /api/quotations/:id/select` - Seleccionar cotización

### Proveedores
- `GET /api/suppliers` - Listar proveedores
- `POST /api/suppliers` - Crear proveedor
- `PUT /api/suppliers/:id` - Actualizar proveedor

### Órdenes de Compra
- `GET /api/orders` - Listar órdenes
- `POST /api/orders` - Crear orden
- `GET /api/orders/:id/pdf` - Descargar PDF

## 🐛 Troubleshooting

### Error de base de datos
```bash
rm database.sqlite
npm run init-db
npm run seed
```

### Error de permisos
Verificar que el usuario tenga el rol correcto en la base de datos.

### Error de email
Verificar configuración SMTP en `.env`.

## 📞 Soporte

Para soporte técnico, contactar al administrador del sistema.

## 📄 Licencia

© 2024 Cielito Home. Todos los derechos reservados.
