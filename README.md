# Sistema de Compras - Cielito Home

Sistema completo de gestion de compras empresariales con flujo de solicitudes, cotizaciones, ordenes de compra y control presupuestario.

## Tabla de Contenidos
- [Tecnologias](#tecnologias)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Base de Datos](#base-de-datos)
- [API Endpoints](#api-endpoints)
- [Roles y Permisos](#roles-y-permisos)
- [Estados de Solicitudes](#estados-de-solicitudes)
- [Variables de Entorno](#variables-de-entorno)
- [Despliegue](#despliegue)
- [Servicios en la Nube](#servicios-en-la-nube)

---

## Tecnologias

### Backend
| Tecnologia | Version | Uso |
|------------|---------|-----|
| Node.js | 18+ | Runtime |
| Express.js | 4.21.x | Framework web |
| PostgreSQL | 15+ | Base de datos (Neon) |
| pg | 8.16.x | Driver PostgreSQL |
| Socket.IO | 4.8.x | Notificaciones en tiempo real |
| JWT (jsonwebtoken) | 9.0.x | Autenticacion |
| bcryptjs | 2.4.x | Hash de contrasenas |
| PDFKit | 0.15.x | Generacion de PDFs |
| Nodemailer | 6.10.x | Envio de emails |
| node-cron | 3.0.x | Tareas programadas |
| Winston | 3.18.x | Logging |
| Helmet | 7.2.x | Seguridad HTTP |
| ExcelJS | 4.4.x | Exportacion a Excel |
| Swagger | 6.2.x | Documentacion API |
| express-rate-limit | 6.11.x | Rate limiting |
| express-validator | 7.2.x | Validacion de datos |
| multer | 2.0.x | Upload de archivos |
| cors | 2.8.x | Cross-Origin Resource Sharing |
| morgan | 1.10.x | HTTP request logger |
| cookie-parser | 1.4.x | Parsing de cookies |

### Frontend
| Tecnologia | Uso |
|------------|-----|
| HTML5 | Estructura |
| CSS3 | Estilos (custom + Bootstrap 5) |
| JavaScript ES6+ | Logica del cliente |
| Bootstrap 5.3 | Framework CSS |
| Font Awesome 6 | Iconos |
| Chart.js | Graficas |
| Socket.IO Client | Notificaciones en tiempo real |

### Infraestructura
| Servicio | Uso |
|----------|-----|
| Render | Backend hosting |
| Vercel | Frontend hosting |
| Neon | Base de datos PostgreSQL serverless |
| Gmail SMTP | Envio de correos |
| GitHub | Control de versiones |

---

## Arquitectura

```
+------------------+     +------------------+     +------------------+
|    Frontend      |---->|     Backend      |---->|   PostgreSQL     |
|    (Vercel)      |<----|    (Render)      |<----|     (Neon)       |
+------------------+     +------------------+     +------------------+
         |                       |
         |                       v
         |               +------------------+
         +-------------->|   Socket.IO      |
                         |  (Real-time)     |
                         +------------------+
```

### Patron de Arquitectura
- **Backend**: API REST con Express.js
- **Autenticacion**: JWT con tokens en localStorage
- **Base de Datos**: PostgreSQL con queries parametrizadas (prevencion SQL injection)
- **Real-time**: Socket.IO para notificaciones instantaneas
- **Seguridad**: Helmet, CORS, Rate Limiting, bcrypt

---

## Estructura del Proyecto

```
Sistema_Compras/
|-- backend/
|   |-- config/
|   |   |-- database.js          # Conexion PostgreSQL (Neon) con reintentos
|   |   +-- email.js             # Configuracion SMTP
|   |-- middleware/
|   |   |-- auth.js              # Middleware JWT (authMiddleware, requireRole)
|   |   +-- errorHandler.js      # Manejo global de errores
|   |-- migrations/
|   |   |-- 008_add_area_schedules.js
|   |   |-- 009_add_borrador_status.js
|   |   |-- 010_add_programada_status.js
|   |   |-- 011_remove_urgency_unify_priority.js
|   |   |-- 012_add_warranty_fields.js
|   |   |-- add-budgets-invoices.js
|   |   |-- create_no_requirements_table.js
|   |   +-- ...
|   |-- routes/
|   |   |-- auth.js              # Login, registro, perfil, usuarios
|   |   |-- requests.js          # CRUD solicitudes (incluye programadas)
|   |   |-- quotations.js        # Cotizaciones
|   |   |-- suppliers.js         # Proveedores
|   |   |-- orders.js            # Ordenes de compra
|   |   |-- analytics.js         # Estadisticas y dashboard
|   |   |-- reports.js           # Reportes Excel/PDF
|   |   |-- notifications.js     # Notificaciones
|   |   |-- budgets.js           # Presupuestos por area
|   |   |-- invoices.js          # Facturas
|   |   |-- schedules.js         # Horarios permitidos por area
|   |   |-- drafts.js            # Borradores de solicitudes
|   |   |-- noRequirements.js    # Periodos sin requerimientos
|   |   |-- cron.js              # Jobs programados (solicitudes automaticas)
|   |   |-- schema.js            # Informacion del esquema BD
|   |   +-- area-columns.js      # Configuracion columnas por area
|   |-- services/
|   |   |-- emailService.js      # Envio de correos con templates
|   |   |-- notificationService.js # Crear notificaciones en BD
|   |   |-- pdfService.js        # Generacion de PDFs (ordenes)
|   |   |-- schedulerService.js  # Cron jobs (cada minuto)
|   |   +-- socketService.js     # WebSockets para real-time
|   |-- utils/
|   |   |-- helpers.js           # Funciones utilitarias (apiResponse, getClientIP)
|   |   |-- logger.js            # Winston logger configurado
|   |   +-- validators.js        # Validaciones con express-validator
|   |-- server.js                # Entry point principal
|   |-- init-postgres.js         # Inicializador de BD PostgreSQL
|   |-- init-db.js               # Inicializador SQLite (legacy)
|   +-- package.json
|
|-- frontend/
|   |-- components/
|   |   |-- navbar.html          # Barra de navegacion
|   |   +-- sidebar.html         # Menu lateral
|   |-- css/
|   |   |-- styles.css           # Estilos principales
|   |   |-- dashboard.css        # Estilos dashboard
|   |   |-- app.css              # Estilos generales app
|   |   |-- animations.css       # Animaciones
|   |   |-- pro-enhancements.css # Mejoras visuales
|   |   +-- sidebar-collapsible.css
|   |-- js/
|   |   |-- api.js               # Cliente API (clase API)
|   |   |-- app.js               # Logica principal
|   |   |-- auth.js              # Manejo de autenticacion
|   |   |-- config.js            # CONFIG.API_URL
|   |   |-- dashboard.js         # Logica del dashboard
|   |   |-- nueva-solicitud.js   # Crear/programar solicitudes
|   |   |-- mis-solicitudes.js   # Listado solicitudes usuario
|   |   |-- compras-panel.js     # Panel de compras
|   |   |-- detalle-solicitud.js # Detalle de solicitud
|   |   |-- detalle-orden.js     # Detalle de orden
|   |   |-- notifications.js     # Manejo de notificaciones
|   |   |-- analytics.js         # Graficas y estadisticas
|   |   |-- reports.js           # Generacion de reportes
|   |   |-- suppliers.js         # Gestion proveedores
|   |   |-- facturas.js          # Gestion facturas
|   |   |-- mi-presupuesto.js    # Vista presupuesto
|   |   +-- utils.js             # Utilidades frontend
|   |-- pages/
|   |   |-- dashboard.html
|   |   |-- nueva-solicitud.html
|   |   |-- mis-solicitudes.html
|   |   |-- compras-panel.html
|   |   |-- detalle-solicitud.html
|   |   |-- detalle-orden.html
|   |   |-- analytics.html
|   |   |-- proveedores.html
|   |   |-- configuracion.html
|   |   +-- ...
|   |-- index.html               # Pagina de login
|   +-- 404.html                 # Pagina no encontrada
|
+-- README.md
```

---

## Base de Datos

### Sistema de Conexion (database.js)

El sistema usa PostgreSQL con Neon (serverless). Caracteristicas:
- Reintentos automaticos para conexiones suspendidas
- Conversion automatica de placeholders (? a $1, $2...)
- Metodos: `getAsync()`, `allAsync()`, `runAsync()`, `auditLog()`

### Tablas del Sistema

#### 1. users - Usuarios del sistema
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,           -- Hash bcrypt
  role VARCHAR(50) NOT NULL,                -- requester, purchaser, director, admin
  area VARCHAR(100),                        -- Area/departamento
  position VARCHAR(100),                    -- Puesto
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. suppliers - Proveedores
```sql
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rfc VARCHAR(20),                          -- RFC fiscal
  contact_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  category VARCHAR(100),                    -- Categoria del proveedor
  rating DECIMAL(3,2) DEFAULT 0,            -- Calificacion 0-5
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. requests - Solicitudes de compra
```sql
CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  folio VARCHAR(50) UNIQUE NOT NULL,        -- SOL-YYYYMMDD-XXX
  user_id INTEGER NOT NULL REFERENCES users(id),
  area VARCHAR(100) NOT NULL,
  request_date DATE NOT NULL,
  delivery_date DATE,                       -- Fecha requerida entrega
  priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- normal, urgente, critica
  justification TEXT,
  status VARCHAR(50) DEFAULT 'pendiente',   -- Ver seccion Estados
  authorized_by INTEGER REFERENCES users(id),
  authorized_at TIMESTAMP,
  rejection_reason TEXT,
  budget_approved BOOLEAN DEFAULT false,    -- Aprobacion exceso presupuestal
  is_draft BOOLEAN DEFAULT false,           -- Es borrador
  draft_data TEXT,                          -- JSON del borrador
  is_scheduled BOOLEAN DEFAULT false,       -- Esta programada
  scheduled_send_date TIMESTAMP,            -- Fecha programada de envio
  scheduled_for TIMESTAMP,                  -- (Legacy)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Estados validos (CHECK constraint):**
- borrador, programada, pendiente, cotizando, autorizada
- rechazada, emitida, en_transito, recibida, cancelada

#### 4. request_items - Items de solicitud
```sql
CREATE TABLE request_items (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  material VARCHAR(255) NOT NULL,           -- Nombre del material
  specifications TEXT,                      -- Especificaciones tecnicas
  approximate_cost DECIMAL(10,2),           -- Costo aproximado
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'unidad',        -- pza, kg, lt, mt, etc.
  in_stock BOOLEAN DEFAULT false,           -- Hay en inventario
  location VARCHAR(255),                    -- Ubicacion sugerida
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. quotations - Cotizaciones
```sql
CREATE TABLE quotations (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  quoted_by INTEGER NOT NULL REFERENCES users(id),
  total_amount DECIMAL(10,2) NOT NULL,
  delivery_date DATE,                       -- Fecha entrega prometida
  delivery_time VARCHAR(100),               -- Tiempo de entrega (texto)
  payment_terms VARCHAR(255),               -- Condiciones de pago
  validity_days INTEGER DEFAULT 30,         -- Dias de vigencia
  notes TEXT,
  is_selected BOOLEAN DEFAULT false,        -- Cotizacion ganadora
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 6. quotation_items - Items de cotizacion
```sql
CREATE TABLE quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  request_item_id INTEGER REFERENCES request_items(id),
  material VARCHAR(255) NOT NULL,
  specifications TEXT,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'unidad',
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 7. purchase_orders - Ordenes de compra
```sql
CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  folio VARCHAR(50) UNIQUE NOT NULL,        -- OC-YYYYMMDD-XXX
  request_id INTEGER NOT NULL REFERENCES requests(id),
  quotation_id INTEGER REFERENCES quotations(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'emitida',     -- emitida, en_transito, recibida, cancelada
  expected_delivery DATE,
  actual_delivery DATE,
  notes TEXT,
  pdf_path VARCHAR(255),                    -- Ruta del PDF generado
  requires_invoice BOOLEAN DEFAULT false,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 8. budgets - Presupuestos por area
```sql
CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  area VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,      -- Presupuesto asignado
  spent_amount DECIMAL(12,2) DEFAULT 0,     -- Monto gastado
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(area, year)                        -- Un presupuesto por area/ano
);
```

#### 9. invoices - Facturas
```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  invoice_number VARCHAR(100),
  invoice_date DATE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,        -- IVA
  total_amount DECIMAL(10,2) NOT NULL,
  file_path VARCHAR(255),                   -- Ruta del archivo
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 10. area_schedules - Horarios permitidos por area
```sql
CREATE TABLE area_schedules (
  id SERIAL PRIMARY KEY,
  area VARCHAR(100) NOT NULL,
  day_of_week INTEGER NOT NULL,             -- 0=Dom, 1=Lun, 2=Mar... 6=Sab
  start_time TIME NOT NULL,                 -- Ej: 09:00
  end_time TIME NOT NULL,                   -- Ej: 17:00
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(area, day_of_week)
);
```

#### 11. no_requirements - Periodos sin requerimientos
```sql
CREATE TABLE no_requirements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  area VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,                               -- Motivo
  status VARCHAR(20) DEFAULT 'pendiente',   -- pendiente, aprobado, rechazado
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 12. notifications - Notificaciones
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,                -- info, success, warning, danger
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),                        -- Link relacionado
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 13. audit_log - Log de auditoria
```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,         -- Tabla afectada
  record_id INTEGER,                        -- ID del registro
  action VARCHAR(50) NOT NULL,              -- create, update, delete
  old_values TEXT,                          -- JSON valores anteriores
  new_values TEXT,                          -- JSON valores nuevos
  user_id INTEGER REFERENCES users(id),
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 14. system_config - Configuracion del sistema
```sql
CREATE TABLE system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 15. email_log - Log de emails
```sql
CREATE TABLE email_log (
  id SERIAL PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',     -- pending, sent, failed
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indices para Performance
```sql
CREATE INDEX idx_requests_user_id ON requests(user_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_folio ON requests(folio);
CREATE INDEX idx_quotations_request_id ON quotations(request_id);
CREATE INDEX idx_quotations_supplier_id ON quotations(supplier_id);
CREATE INDEX idx_purchase_orders_request_id ON purchase_orders(request_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

---

## API Endpoints

### Base URL
- **Local**: `http://localhost:3000/api`
- **Produccion**: `https://gestion-compras-ch.onrender.com/api`
- **Documentacion Swagger**: `/api-docs`

### Autenticacion (/auth)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| POST | /auth/login | Iniciar sesion | Publico |
| POST | /auth/register | Registrar usuario | admin |
| GET | /auth/me | Obtener usuario actual | Autenticado |
| PUT | /auth/profile | Actualizar perfil | Autenticado |
| PUT | /auth/change-password | Cambiar contrasena | Autenticado |
| GET | /auth/users | Listar usuarios | admin |
| PUT | /auth/users/:id | Actualizar usuario | admin |
| DELETE | /auth/users/:id | Desactivar usuario | admin |

### Solicitudes (/requests)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /requests | Listar solicitudes | Autenticado |
| GET | /requests/:id | Obtener solicitud | Autenticado |
| POST | /requests | Crear solicitud | Autenticado |
| POST | /requests/scheduled | Crear solicitud programada | Autenticado |
| PUT | /requests/:id | Actualizar solicitud | Propietario/Admin |
| PUT | /requests/:id/status | Cambiar estado | Segun estado |
| DELETE | /requests/:id | Cancelar solicitud | Propietario/Admin |

### Cotizaciones (/quotations)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /quotations | Listar cotizaciones | purchaser, admin |
| GET | /quotations/request/:requestId | Por solicitud | purchaser, admin |
| POST | /quotations | Crear cotizacion | purchaser, admin |
| PUT | /quotations/:id | Actualizar cotizacion | purchaser, admin |
| PUT | /quotations/:id/select | Seleccionar cotizacion | purchaser, admin |
| DELETE | /quotations/:id | Eliminar cotizacion | purchaser, admin |

### Proveedores (/suppliers)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /suppliers | Listar proveedores | Autenticado |
| GET | /suppliers/:id | Obtener proveedor | Autenticado |
| POST | /suppliers | Crear proveedor | purchaser, admin |
| PUT | /suppliers/:id | Actualizar proveedor | purchaser, admin |
| DELETE | /suppliers/:id | Desactivar proveedor | admin |

### Ordenes de Compra (/orders)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /orders | Listar ordenes | purchaser, admin |
| GET | /orders/:id | Obtener orden | Autenticado |
| POST | /orders | Crear orden | purchaser, admin |
| PUT | /orders/:id/status | Cambiar estado | purchaser, admin |
| GET | /orders/:id/pdf | Descargar PDF | Autenticado |

### Analytics (/analytics)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /analytics/dashboard | Estadisticas generales | Autenticado |
| GET | /analytics/my-stats | Estadisticas personales | Autenticado |
| GET | /analytics/by-area | Por area | director, admin |
| GET | /analytics/trends | Tendencias | Autenticado |

### Reportes (/reports)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /reports/requests | Reporte solicitudes | purchaser, admin |
| GET | /reports/orders | Reporte ordenes | purchaser, admin |
| GET | /reports/suppliers | Reporte proveedores | purchaser, admin |
| GET | /reports/export/:type | Exportar a Excel | purchaser, admin |

### Notificaciones (/notifications)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /notifications | Listar notificaciones | Autenticado |
| GET | /notifications/unread-count | Contar no leidas | Autenticado |
| PUT | /notifications/:id/read | Marcar como leida | Autenticado |
| PUT | /notifications/read-all | Marcar todas leidas | Autenticado |

### Presupuestos (/budgets)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /budgets | Listar presupuestos | director, admin |
| GET | /budgets/:area/:year | Por area/ano | Autenticado |
| POST | /budgets | Crear presupuesto | admin |
| PUT | /budgets/:id | Actualizar presupuesto | admin |
| POST | /budgets/approve-excess | Aprobar exceso | director, admin |
| POST | /budgets/reject-excess | Rechazar exceso | director, admin |

### Horarios (/schedules)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /schedules | Listar horarios | Autenticado |
| GET | /schedules/check | Verificar horario actual | Autenticado |
| GET | /schedules/next-available | Proximo disponible | Autenticado |
| POST | /schedules | Crear/actualizar | admin |
| DELETE | /schedules/:id | Eliminar horario | admin |

### Borradores (/drafts)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /drafts | Listar borradores | Autenticado |
| GET | /drafts/:id | Obtener borrador | Autenticado |
| POST | /drafts | Guardar borrador | Autenticado |
| PUT | /drafts/:id | Actualizar borrador | Autenticado |
| DELETE | /drafts/:id | Eliminar borrador | Autenticado |
| POST | /drafts/:id/submit | Enviar borrador | Autenticado |

### Facturas (/invoices)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /invoices | Listar facturas | purchaser, admin |
| GET | /invoices/:id | Obtener factura | purchaser, admin |
| POST | /invoices | Crear factura | purchaser, admin |
| PUT | /invoices/:id | Actualizar factura | purchaser, admin |

### No Requerimientos (/no-requirements)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| GET | /no-requirements | Listar | Autenticado |
| POST | /no-requirements | Crear solicitud | Autenticado |
| PUT | /no-requirements/:id/approve | Aprobar | director, admin |
| PUT | /no-requirements/:id/reject | Rechazar | director, admin |

### Cron Jobs (/cron)
| Metodo | Endpoint | Descripcion | Roles |
|--------|----------|-------------|-------|
| POST | /cron/process-scheduled | Procesar programadas | Sistema |
| GET | /cron/status | Estado del scheduler | admin |

---

## Roles y Permisos

### Roles del Sistema

| Rol | Valor BD | Descripcion |
|-----|----------|-------------|
| Solicitante | `requester` | Crea solicitudes de su area |
| Comprador | `purchaser` | Gestiona cotizaciones y ordenes |
| Director | `director` | Autoriza solicitudes y presupuestos |
| Administrador | `admin` | Control total del sistema |

### Matriz de Permisos Detallada

| Accion | requester | purchaser | director | admin |
|--------|-----------|-----------|----------|-------|
| **Solicitudes** |
| Crear solicitud | SI | SI | SI | SI |
| Ver propias | SI | SI | SI | SI |
| Ver todas | NO | SI | SI | SI |
| Editar propias (borrador) | SI | SI | SI | SI |
| Cancelar propias | SI | SI | SI | SI |
| **Cotizaciones** |
| Ver cotizaciones | NO | SI | SI | SI |
| Crear cotizacion | NO | SI | NO | SI |
| Seleccionar cotizacion | NO | SI | NO | SI |
| **Autorizacion** |
| Autorizar solicitudes | NO | NO | SI | SI |
| Rechazar solicitudes | NO | NO | SI | SI |
| Aprobar exceso presupuesto | NO | NO | SI | SI |
| **Ordenes** |
| Ver ordenes | NO | SI | SI | SI |
| Crear orden | NO | SI | NO | SI |
| Actualizar estado orden | NO | SI | NO | SI |
| **Proveedores** |
| Ver proveedores | SI | SI | SI | SI |
| Crear/editar proveedor | NO | SI | NO | SI |
| **Usuarios** |
| Ver usuarios | NO | NO | NO | SI |
| Crear usuarios | NO | NO | NO | SI |
| Editar usuarios | NO | NO | NO | SI |
| **Presupuestos** |
| Ver presupuesto area | SI | SI | SI | SI |
| Configurar presupuestos | NO | NO | NO | SI |
| **Configuracion** |
| Configurar horarios | NO | NO | NO | SI |
| Ver analytics global | NO | SI | SI | SI |
| **Validaciones** |
| Sujeto a horarios | SI | SI | NO | NO |
| Sujeto a no-requerimientos | SI | SI | NO | NO |

---

## Estados de Solicitudes

### Diagrama de Flujo

```
                                    +------------+
                                    |  borrador  |
                                    +-----+------+
                                          |
                                          | (Enviar)
                                          v
+------------+    (Programar)     +------------+
| programada |<-------------------| pendiente  |
+-----+------+                    +-----+------+
      |                                 |
      | (Automatico al llegar hora)     | (Compras asigna)
      +----------------+----------------+
                       |
                       v
                 +------------+
                 | cotizando  |
                 +-----+------+
                       |
          +------------+------------+
          |                         |
          v                         v
    +------------+           +------------+
    | autorizada |           | rechazada  |
    +-----+------+           +------------+
          |
          | (Crear OC)
          v
    +------------+
    |  emitida   |
    +-----+------+
          |
          | (Proveedor envia)
          v
    +------------+
    | en_transito|
    +-----+------+
          |
          | (Recibir)
          v
    +------------+
    |  recibida  |
    +------------+

(Cualquier estado puede ir a 'cancelada' segun permisos)
```

### Descripcion de Estados

| Estado | Descripcion | Quien puede cambiar |
|--------|-------------|---------------------|
| `borrador` | Solicitud guardada sin enviar | Solicitante |
| `programada` | Programada para envio automatico | Sistema (cron) |
| `pendiente` | Enviada, esperando atencion | Solicitante -> Sistema |
| `cotizando` | En proceso de cotizacion | Comprador |
| `autorizada` | Aprobada por direccion | Director |
| `rechazada` | Rechazada por direccion | Director |
| `emitida` | Orden de compra generada | Comprador |
| `en_transito` | Pedido en camino del proveedor | Comprador |
| `recibida` | Pedido entregado | Comprador |
| `cancelada` | Solicitud cancelada | Solicitante/Admin |

---

## Variables de Entorno

### Backend (.env.development / .env.production)

```env
# ======== BASE DE DATOS ========
# PostgreSQL (Neon) - REQUERIDO
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# ======== AUTENTICACION ========
# JWT Secret - MINIMO 32 caracteres
JWT_SECRET=tu_clave_secreta_super_segura_de_al_menos_32_caracteres

# ======== SERVIDOR ========
PORT=3000
NODE_ENV=development   # development | production | test

# ======== CORS ========
# URL del frontend (para permitir peticiones)
FRONTEND_URL=https://sistemas-compras-cielito.vercel.app

# ======== EMAIL SMTP (Gmail) ========
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_app_password_de_16_caracteres   # App Password de Google
EMAIL_FROM="Sistema Compras" <tu_email@gmail.com>

# ======== OPCIONALES ========
# Rate limiting
RATE_LIMIT_WINDOW=60000   # 1 minuto en ms
RATE_LIMIT_MAX=100        # Peticiones por ventana

# Logging
LOG_LEVEL=info            # error, warn, info, debug
```

### Frontend (config.js)

```javascript
const CONFIG = {
  // URL del backend API
  API_URL: 'https://gestion-compras-ch.onrender.com/api',

  // Para desarrollo local:
  // API_URL: 'http://localhost:3000/api',

  // Configuracion de Socket.IO
  SOCKET_URL: 'https://gestion-compras-ch.onrender.com'
};
```

### Generar JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Configurar App Password de Gmail
1. Ir a cuenta Google > Seguridad
2. Activar verificacion en 2 pasos
3. Buscar "Contrasenas de aplicaciones"
4. Crear nueva para "Correo" + "Otro"
5. Usar la contrasena de 16 caracteres generada

---

## Despliegue

### Backend en Render

1. **Crear Web Service**
   - Ir a render.com > Dashboard > New > Web Service
   - Conectar repositorio GitHub

2. **Configuracion**
   ```
   Name: gestion-compras-ch
   Region: Oregon (us-west)
   Branch: backUpg (o main)
   Root Directory: (vacio)
   Runtime: Node
   Build Command: cd backend && npm install
   Start Command: cd backend && npm start
   ```

3. **Variables de Entorno**
   - Agregar todas las variables de `.env.production`

4. **Inicializar Base de Datos**
   ```bash
   # En Shell de Render o localmente con DATABASE_URL
   cd backend
   node init-postgres.js
   ```

### Frontend en Vercel

1. **Importar Proyecto**
   - Ir a vercel.com > New Project
   - Importar repositorio

2. **Configuracion**
   ```
   Framework Preset: Other
   Root Directory: frontend
   Build Command: (vacio)
   Output Directory: .
   Install Command: (vacio)
   ```

3. **Actualizar config.js**
   - Cambiar `API_URL` a la URL de Render

### Base de Datos en Neon

1. **Crear Proyecto**
   - Ir a neon.tech > Create Project
   - Seleccionar region cercana

2. **Obtener Connection String**
   - Dashboard > Connection Details
   - Copiar PostgreSQL connection string

3. **Inicializar Tablas**
   ```bash
   # Con DATABASE_URL configurada
   cd backend
   node init-postgres.js
   ```

---

## Servicios en la Nube (URLs Actuales)

| Servicio | URL |
|----------|-----|
| Frontend | https://sistemas-compras-cielito.vercel.app |
| Backend API | https://gestion-compras-ch.onrender.com |
| API Docs (Swagger) | https://gestion-compras-ch.onrender.com/api-docs |
| Health Check | https://gestion-compras-ch.onrender.com/health |
| Base de Datos | Neon PostgreSQL (conexion privada) |

### Credenciales por Defecto

> **IMPORTANTE**: Cambiar inmediatamente en produccion

| Usuario | Email | Contrasena | Rol |
|---------|-------|------------|-----|
| Admin | admin@sistema.com | admin123 | admin |

---

## Funcionalidades Especiales

### 1. Validacion de Horarios
- Solo `requester` y `purchaser` tienen restriccion
- `director` y `admin` pueden crear en cualquier momento
- Si esta fuera de horario, se ofrece programar envio automatico
- Horarios configurables por area y dia de semana

### 2. Solicitudes Programadas
- Se guardan con `is_scheduled = true` y `scheduled_send_date`
- Cron job (schedulerService) corre cada 60 segundos
- Cuando llega la hora: convierte a `pendiente` y notifica
- Envia email a compradores automaticamente

### 3. No Requerimientos
- Areas pueden solicitar periodos sin necesidad de compras
- Requiere aprobacion de director
- Bloquea creacion de solicitudes en esos periodos
- Validacion adicional despues de horarios

### 4. Control Presupuestario
- Cada area tiene presupuesto anual asignado
- Sistema alerta cuando solicitud excede disponible
- Director puede aprobar o rechazar excesos
- Se actualiza `spent_amount` al crear ordenes

### 5. Notificaciones en Tiempo Real
- Socket.IO para actualizaciones instantaneas
- Contador en navbar se actualiza automaticamente
- Notificaciones por email para eventos importantes
- Tipos: info, success, warning, danger

### 6. Generacion de PDFs
- Ordenes de compra en PDF con PDFKit
- Incluye: datos empresa, proveedor, items, totales
- Se guardan en `/backend/pdfs/`
- Descarga directa desde la aplicacion

### 7. Reportes y Exportacion
- Reportes en Excel con ExcelJS
- Filtros por fecha, estado, area, proveedor
- Graficas con Chart.js
- Dashboard con KPIs principales

---

## Troubleshooting

### Error: "column X does not exist"
- Verificar que todas las migraciones se ejecutaron
- Comparar esquema con `init-postgres.js`
- Ejecutar: `node init-postgres.js` (no borra datos existentes)

### Error: "Connection terminated unexpectedly"
- Neon suspende conexiones inactivas (>5 min)
- El codigo tiene reintentos automaticos (3 intentos)
- Esto es normal, el retry deberia funcionar

### CORS errors en navegador
- Verificar que el origen esta en `allowedOrigins` (server.js)
- Agregar URL del frontend a la configuracion
- En desarrollo, usar http://localhost:5500

### JWT expired / Invalid token
- Tokens expiran despues de 24 horas
- Frontend debe redirigir al login automaticamente
- Limpiar localStorage: `localStorage.clear()`

### Emails no se envian
- Verificar App Password de Gmail (16 caracteres)
- Verificar variables SMTP_* en .env
- Revisar email_log para errores

### Solicitud programada no se envia
- Verificar que schedulerService esta corriendo (logs)
- Verificar hora de Mexico (UTC-6)
- Revisar que scheduled_send_date ya paso

---

## Mantenimiento

### Logs
- Backend: Console de Render (o local con `npm run dev`)
- Winston logger con niveles: error, warn, info, debug
- Archivos de log en produccion (configurable)

### Backups
- Neon realiza backups automaticos (7 dias retencion)
- Exportar datos periodicamente via reportes Excel
- Considerar pg_dump para backups manuales

### Monitoreo
- Health check: GET /health
- Render proporciona metricas basicas
- Considerar: UptimeRobot, Better Uptime

### Actualizaciones
1. Hacer cambios en rama feature
2. Probar localmente
3. Merge a `backUpg`
4. Render despliega automaticamente
5. Vercel despliega frontend automaticamente

---

## Licencia

Proyecto privado - Cielito Home 2024-2026

---

## Contacto

Para soporte tecnico o consultas sobre el sistema, contactar al equipo de desarrollo.
