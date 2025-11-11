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
// Limitar tasa de solicitudes
const apiLimiter = rateLimit ({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // 1000 peticiones por minuto (muy permisivo para desarrollo)
  message: { error: 'Demasiadas peticiones, por favor intente más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
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

const app = express();

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
}));

// Configuración de CORS
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      'https://cielito-home-compras.vercel.app',
      'https://gestion-compras-ch.onrender.com'
    ].filter(Boolean) // Filtrar valores undefined/null
  : [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000'
    ];

app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (como Postman, mobile apps, etc.)
    if (!origin) return callback(null, true);

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
      schedules: '/api/schedules'
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

// Función para inicializar la base de datos si es necesario
async function initializeDatabase() {
  // Solo para PostgreSQL (cuando DATABASE_URL existe)
  if (!process.env.DATABASE_URL) {
    return; // SQLite no necesita inicialización
  }

  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Verificar si la tabla users existe
    await pool.query('SELECT 1 FROM users LIMIT 1');
    console.log('✅ Base de datos ya inicializada');
    await pool.end();
  } catch (error) {
    // Si no existe, ejecutar script de inicialización
    console.log('🔧 Inicializando esquema de PostgreSQL...');
    await pool.end();

    // Ejecutar el script de inicialización
    await require('./init-postgres');
    console.log('✅ Esquema inicializado correctamente');
  }
}

// Iniciar servidor
if (process.env.NODE_ENV !== 'test') {
  // Primero inicializar la base de datos
  initializeDatabase()
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log('\n🚀 ====================================');
        console.log('   SISTEMA DE COMPRAS CIELITO HOME');
        console.log('====================================');
        console.log(`📡 Server running on port ${PORT}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 API URL: http://localhost:${PORT}`);
        console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
        console.log('====================================\n');

        // Iniciar scheduler de solicitudes programadas
        const schedulerService = require('./services/schedulerService');
        schedulerService.start();
      });

      // Manejo graceful de cierre
      process.on('SIGTERM', () => {
        console.log('🛑 SIGTERM received, shutting down gracefully');
        const schedulerService = require('./services/schedulerService');
        schedulerService.stop();
        server.close(() => {
          console.log('✅ Process terminated');
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
    server.close(() => {
      console.log('✅ Process terminated');
    });
  });
}

module.exports = app;
