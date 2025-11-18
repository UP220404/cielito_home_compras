const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token no proporcionado' 
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario aún existe y está activo
    const user = await db.getAsync(
      'SELECT id, email, name, area, role, is_active FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Usuario no válido o inactivo' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expirado' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido' 
    });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'No autenticado' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'No autorizado para esta acción' 
      });
    }
    
    next();
  };
};

// Middleware para verificar si es el propietario del recurso o tiene rol elevado
const requireOwnershipOrRole = (resourceField = 'user_id', ...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'No autenticado' 
      });
    }

    // Los roles permitidos pueden acceder a cualquier recurso
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Si hay un ID en los parámetros, verificar ownership
    if (req.params.id) {
      try {
        const tableName = req.route.path.includes('request') ? 'requests' : 
                         req.route.path.includes('quotation') ? 'quotations' :
                         req.route.path.includes('order') ? 'purchase_orders' : null;

        if (tableName) {
          const resource = await db.getAsync(
            `SELECT ${resourceField} FROM ${tableName} WHERE id = ?`,
            [req.params.id]
          );

          if (!resource) {
            return res.status(404).json({ 
              success: false, 
              error: 'Recurso no encontrado' 
            });
          }

          if (resource[resourceField] !== req.user.id) {
            return res.status(403).json({ 
              success: false, 
              error: 'No autorizado para acceder a este recurso' 
            });
          }
        }
      } catch (error) {
        console.error('Error verificando ownership:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Error verificando permisos' 
        });
      }
    }

    next();
  };
};

module.exports = { 
  authMiddleware, 
  requireRole, 
  requireOwnershipOrRole 
};
