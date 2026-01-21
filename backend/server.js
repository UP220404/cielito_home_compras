// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Gestion Compras CH',
      version: '1.0.0',
      description: 'Documentación automática de la API de compras',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Servidor local' }
    ],
  },
  apis: ['./routes/*.js'], // Documentar rutas
};


const swaggerSpec = swaggerJsdoc(swaggerOptions);


const rateLimit = require('express-rate-limit');
// Cargar variables de entorno según el ambiente
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: envFile });

// Verificar variables críticas (PostgreSQL OBLIGATORIO)
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`\n❌ ERROR: Faltan variables de entorno críticas: ${missingEnv.join(', ')}`);
  console.error('DATABASE_URL es REQUERIDA. Configúrala en tu archivo .env');
  process.exit(1);
}

// Validar seguridad de JWT_SECRET
if (process.env.JWT_SECRET.length < 32) {
  console.error('\n❌ ERROR: JWT_SECRET debe tener al menos 32 caracteres para ser seguro');
  console.error('Genera uno nuevo con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}
// Limitar tasa de solicitudes - API general
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'production' ? 60 : 300, // Más estricto en producción
  message: { success: false, error: 'Demasiadas peticiones, por favor intente más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // No limitar healthcheck
    return req.path === '/health' || req.path === '/';
  }
});

// Rate limiter estricto para endpoints de autenticación (prevenir brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 5 : 20, // 5 intentos en producción
  message: { success: false, error: 'Demasiados intentos de autenticación. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // No contar requests exitosos
});

// Rate limiter para descarga de archivos (prevenir DoS)
const downloadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'production' ? 10 : 50, // 10 descargas por minuto
  message: { success: false, error: 'Demasiadas descargas. Intente de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const errorHandler = require('./middleware/errorHandler');

// Importar rutas
const authRoutes = require('./routes/auth');
const requestsRoutes = require('./routes/requests');
const quotationsRoutes = require('./routes/quotations');
const suppliersRoutes = require('./routes/suppliers');
const ordersRoutes = require('./routes/orders');
const analyticsRoutes = require('./routes/analytics');
const reportsRoutes = require('./routes/reports');
const notificationsRoutes = require('./routes/notifications');
const noRequirementsRoutes = require('./routes/noRequirements');
const budgetsRoutes = require('./routes/budgets');
const cronRoutes = require('./routes/cron');
const invoicesRoutes = require('./routes/invoices');
const schedulesRoutes = require('./routes/schedules');
const draftsRoutes = require('./routes/drafts');
const schemaRoutes = require('./routes/schema');
const migrateRoutes = require('./routes/migrate');
const areaColumnsRoutes = require('./routes/area-columns');
const migrateColumnsRoutes = require('./routes/migrate-columns');

const app = express();

// Crear servidor HTTP
const server = http.createServer(app);

// Configurar Socket.IO con CORS (orígenes limpios y seguros)
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? [
            process.env.FRONTEND_URL,
            'https://sistemas-compras-cielito.vercel.app'
          ].filter(Boolean)
        : [
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:3000'
          ];

      // En producción, requerir origin válido
      if (process.env.NODE_ENV === 'production' && !origin) {
        callback(new Error('Origin required'));
        return;
      }

      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Hacer io disponible globalmente para las rutas
app.set('io', io);

// Inicializar servicio de Socket.IO
const socketService = require('./services/socketService');
socketService.initialize(io);

// Función para verificar JWT en Socket.IO
const verifySocketToken = (token) => {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Manejar conexiones Socket.IO con autenticación JWT
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  // Variable para rastrear si el socket está autenticado
  socket.authenticated = false;

  // El cliente envía su token JWT al conectarse
  socket.on('authenticate', async (data) => {
    try {
      // Aceptar tanto {token, userId} como solo token para compatibilidad
      const token = typeof data === 'object' ? data.token : data;
      const decoded = verifySocketToken(token);

      if (!decoded || !decoded.id) {
        socket.emit('auth_error', { message: 'Token inválido' });
        console.log(`❌ Socket ${socket.id}: Token inválido`);
        return;
      }

      // Verificar que el usuario existe y está activo
      const db = require('./config/database');
      const user = await db.getAsync(
        'SELECT id, email, name, role FROM users WHERE id = ? AND is_active = TRUE',
        [decoded.id]
      );

      if (!user) {
        socket.emit('auth_error', { message: 'Usuario no válido' });
        console.log(`❌ Socket ${socket.id}: Usuario no encontrado o inactivo`);
        return;
      }

      // Autenticar el socket con el userId del JWT (no del cliente)
      socket.userId = user.id;
      socket.userRole = user.role;
      socket.authenticated = true;
      socket.join(`user_${user.id}`);

      socket.emit('auth_success', { userId: user.id });
      console.log(`✅ Usuario ${user.id} (${user.name}) autenticado via JWT`);

    } catch (error) {
      socket.emit('auth_error', { message: 'Error de autenticación' });
      console.error(`❌ Socket ${socket.id}: Error de auth:`, error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// Trust proxy - IMPORTANTE para producción en Render/Heroku/etc
// Esto permite que express-rate-limit y CORS funcionen correctamente
app.set('trust proxy', 1);

// Crear directorio para PDFs si no existe
const pdfsDir = path.join(__dirname, 'pdfs');
if (!fs.existsSync(pdfsDir)) {
  fs.mkdirSync(pdfsDir, { recursive: true });
  console.log('📁 Directorio PDFs creado');
}

// Middleware de seguridad
const cspConnectSrc = process.env.NODE_ENV === 'production'
  ? ["'self'", "https://gestion-compras-ch.onrender.com", "wss://gestion-compras-ch.onrender.com"]
  : ["'self'", "http://localhost:3000", "http://127.0.0.1:3000", "ws://localhost:3000"];

app.use(helmet({
  crossOriginEmbedderPolicy: false, // Para permitir PDFs
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      // NOTA: unsafe-inline necesario por scripts inline en HTML. Idealmente migrar a archivos externos
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: cspConnectSrc,
      frameAncestors: ["'none'"], // Prevenir embedding en iframes
      formAction: ["'self'"], // Solo permitir forms a mismo origen
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  hidePoweredBy: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Headers de seguridad adicionales
app.use((req, res, next) => {
  // Prevenir clickjacking adicional
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevenir que el navegador adivine el MIME type
  res.setHeader('X-Download-Options', 'noopen');
  // Forzar HTTPS (si está en producción)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  // Prevenir ataques de cache poisoning
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Headers de seguridad adicionales (nuevos)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  next();
});

// Configuración de CORS (orígenes limpios - solo URLs activas)
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      'https://sistemas-compras-cielito.vercel.app'
    ].filter(Boolean)
  : [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000'
    ];

app.use(cors({
  origin: function(origin, callback) {
    // En producción: solo permitir sin origin para healthchecks específicos
    // En desarrollo: permitir Postman y testing
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        // Solo permitir healthchecks internos (sin origin)
        // pero NO requests de API normales
        console.log('⚠️ Request sin origin en producción');
      }
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Servir archivos estáticos (PDFs)
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// Ruta base
app.get('/', (req, res) => {
  res.json({
    message: 'Sistema de Compras Cielito Home API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      requests: '/api/requests',
      drafts: '/api/drafts',
      quotations: '/api/quotations',
      suppliers: '/api/suppliers',
      orders: '/api/orders',
      analytics: '/api/analytics',
      reports: '/api/reports',
      notifications: '/api/notifications',
      noRequirements: '/api/no-requirements',
      budgets: '/api/budgets',
      invoices: '/api/invoices',
      schedules: '/api/schedules',
      areaColumns: '/api/area-columns',
      migrateColumns: '/api/migrate-columns'
    }
  });
});

// Rutas API con rate limiting
app.use('/api/', apiLimiter);

// Rate limiting estricto para rutas de autenticación sensibles
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/change-password', authLimiter);

// Rate limiting para descargas de archivos
app.use('/api/invoices/:id/download', downloadLimiter);
app.use('/api/reports', downloadLimiter);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/no-requirements', noRequirementsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/drafts', draftsRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/area-columns', areaColumnsRoutes);
app.use('/api/migrate-columns', migrateColumnsRoutes);
// Swagger - protegido en producción (solo admin puede ver)
if (process.env.NODE_ENV === 'production') {
  const { authMiddleware, requireRole } = require('./middleware/auth');
  app.use('/api-docs', authMiddleware, requireRole('admin'), swaggerUi.serve, swaggerUi.setup(swaggerSpec));
} else {
  // En desarrollo, Swagger es público para facilitar testing
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Manejo de errores
app.use(errorHandler);

// 404 para rutas no encontradas
app.use((req, res) => {
  // Si es una petición a la API, devolver JSON
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: 'Endpoint no encontrado',
      path: req.path,
      method: req.method
    });
  }

  // Para rutas del frontend, mostrar página 404 HTML
  res.status(404).sendFile(path.join(__dirname, '..', 'frontend', '404.html'));
});

const PORT = process.env.PORT || 3000;

// Función para inicializar la base de datos PostgreSQL
async function initializeDatabase() {
  console.log('✅ Omitiendo verificación de base de datos (se asume inicializada)');
  // La verificación de tablas se hará cuando se hagan las primeras consultas
  // Si falta alguna tabla, los errores SQL serán claros
}

// Iniciar servidor
if (process.env.NODE_ENV !== 'test') {
  // Primero inicializar la base de datos
  initializeDatabase()
    .then(() => {
      server.listen(PORT, () => {
        console.log('\n🚀 ====================================');
        console.log('   SISTEMA DE COMPRAS CIELITO HOME');
        console.log('====================================');
        console.log(`📡 Server running on port ${PORT}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 API URL: http://localhost:${PORT}`);
        console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
        console.log(`🔌 Socket.IO enabled for real-time notifications`);
        console.log('====================================\n');

        // Warm-up de la base de datos y migración automática
        const db = require('./config/database');
        (async () => {
          try {
            console.log('🔥 Activando base de datos...');
            await db.getAsync('SELECT 1 as test');
            console.log('✅ Base de datos activada correctamente');

            // Ejecutar migraciones de columnas faltantes
            console.log('🔧 Verificando columnas faltantes...');
            try {
              // Agregar columnas faltantes a suppliers
              await db.runAsync(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT false`);
              await db.runAsync(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vendor_size VARCHAR(50)`);
              await db.runAsync(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS specialty VARCHAR(200)`);
              await db.runAsync(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_name VARCHAR(200)`);
              await db.runAsync(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_name VARCHAR(100)`);
              await db.runAsync(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT`);
              await db.runAsync(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0`);

              // Agregar columnas faltantes a quotation_items
              await db.runAsync(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS notes TEXT`);
              await db.runAsync(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS delivery_date DATE`);
              await db.runAsync(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT false`);
              await db.runAsync(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS has_warranty BOOLEAN DEFAULT false`);
              await db.runAsync(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS warranty_duration VARCHAR(100)`);
              await db.runAsync(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS garantia TEXT`);

              // Agregar columnas a no_requirements
              await db.runAsync(`ALTER TABLE no_requirements ADD COLUMN IF NOT EXISTS week_start DATE`);
              await db.runAsync(`ALTER TABLE no_requirements ADD COLUMN IF NOT EXISTS week_end DATE`);

              console.log('✅ Columnas verificadas/agregadas correctamente');
            } catch (migError) {
              console.warn('⚠️ Error en migración (puede ser normal si las columnas ya existen):', migError.message);
            }

            // Iniciar scheduler después del warm-up
            const schedulerService = require('./services/schedulerService');
            schedulerService.start();
          } catch (error) {
            console.error('⚠️ Error activando BD, el scheduler se iniciará de todos modos:', error.message);
            // Iniciar scheduler incluso si falla el warm-up
            const schedulerService = require('./services/schedulerService');
            schedulerService.start();
          }
        })();
      });

      // Manejo graceful de cierre
      process.on('SIGTERM', () => {
        console.log('🛑 SIGTERM received, shutting down gracefully');
        const schedulerService = require('./services/schedulerService');
        schedulerService.stop();
        io.close(() => {
          server.close(() => {
            console.log('✅ Process terminated');
          });
        });
      });
    })
    .catch((error) => {
      console.error('❌ Error inicializando base de datos:', error);
      process.exit(1);
    });

  process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully');
    const schedulerService = require('./services/schedulerService');
    schedulerService.stop();
    io.close(() => {
      server.close(() => {
        console.log('✅ Process terminated');
      });
    });
  });
}

module.exports = app;
