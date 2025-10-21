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

// Verificar variables críticas
const requiredEnv = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`\n ERROR: Faltan variables de entorno críticas: ${missingEnv.join(', ')}`);
  process.exit(1);
}
// Limitar tasa de solicitudes
const apiLimiter = rateLimit ({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones, por favor intente más tarde.' }
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


const app = express();



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
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Configuración de CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
  credentials: true
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
      quotations: '/api/quotations',
      suppliers: '/api/suppliers',
      orders: '/api/orders',
      analytics: '/api/analytics',
      reports: '/api/reports',
      notifications: '/api/notifications'
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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Manejo de errores
app.use(errorHandler);

// 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint no encontrado',
    path: req.path,
    method: req.method
  });
});

const PORT = process.env.PORT || 3000;

// Iniciar servidor
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log('\n🚀 ====================================');
    console.log('   SISTEMA DE COMPRAS CIELITO HOME');
    console.log('====================================');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API URL: http://localhost:${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log('====================================\n');
  });

  // Manejo graceful de cierre
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Process terminated');
    });
  });

  process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('✅ Process terminated');
    });
  });
}

module.exports = app;
