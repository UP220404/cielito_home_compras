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
// Limitar tasa de solicitudes
const apiLimiter = rateLimit ({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === 'production' ? 100 : 500, // Más estricto en producción
  message: { error: 'Demasiadas peticiones, por favor intente más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // No limitar healthcheck
    return req.path === '/health' || req.path === '/';
  }
})

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

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

// Configurar Socket.IO con CORS
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? [
            process.env.FRONTEND_URL,
            'https://sistemas-compras-cielito.vercel.app',
            'https://frontend-43u1l0ape-proyectos-072d4a72.vercel.app',
            'https://frontend-proyectos-072d4a72.vercel.app',
            'https://frontend-n1hdh5778-proyectos-072d4a72.vercel.app',
            'https://frontend-mz5wu9vdj-proyectos-072d4a72.vercel.app',
            'https://frontend-c1fb3fiij-proyectos-072d4a72.vercel.app'
          ].filter(Boolean)
        : [
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:3000'
          ];

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

// Manejar conexiones Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  // El cliente envía su userId al conectarse
  socket.on('authenticate', (userId) => {
    socket.userId = userId;
    socket.join(`user_${userId}`);
    console.log(`✅ Usuario ${userId} autenticado y unido a su sala`);
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
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Para permitir PDFs
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "http://localhost:3000", "http://127.0.0.1:3000"],
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
  hidePoweredBy: true,  // Ocultar header X-Powered-By
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
  next();
});

// Configuración de CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      'https://sistemas-compras-cielito.vercel.app', // ✅ URL principal actual
      'https://frontend-43u1l0ape-proyectos-072d4a72.vercel.app',
      'https://frontend-proyectos-072d4a72.vercel.app',
      'https://frontend-n1hdh5778-proyectos-072d4a72.vercel.app',
      'https://frontend-mz5wu9vdj-proyectos-072d4a72.vercel.app',
      'https://frontend-c1fb3fiij-proyectos-072d4a72.vercel.app'
    ].filter(Boolean) // Filtrar valores undefined/null
  : [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000'
    ];

app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin para:
    // - Healthchecks de Render/hosting
    // - Testing con Postman
    // - Requests internos del servidor
    if (!origin) {
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

// Rutas API
app.use('/api/', apiLimiter);
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
app.use('/api/invoices', invoicesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/drafts', draftsRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/area-columns', areaColumnsRoutes);
app.use('/api/migrate-columns', migrateColumnsRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

        // Warm-up de la base de datos Neon (necesario para activar la BD)
        const db = require('./config/database');
        (async () => {
          try {
            console.log('🔥 Activando base de datos Neon...');
            await db.getAsync('SELECT 1 as test');
            console.log('✅ Base de datos activada correctamente');

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
