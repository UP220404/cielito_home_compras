const errorHandler = (err, req, res, next) => {
  console.error('🚨 Error:', err.message);
  console.error('Stack:', err.stack);

  // Errores de validación de express-validator
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Datos de entrada inválidos',
      details: err.details || err.message
    });
  }

  // Errores de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Token inválido'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expirado'
    });
  }

  // Errores de base de datos SQLite
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      success: false,
      error: 'Violación de restricción en base de datos',
      details: err.message
    });
  }

  // Error de archivo no encontrado
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      error: 'Archivo o recurso no encontrado'
    });
  }

  // Errores de permisos
  if (err.message.includes('No autorizado') || err.message.includes('Forbidden')) {
    return res.status(403).json({
      success: false,
      error: 'No tienes permisos para realizar esta acción'
    });
  }

  // Error genérico del servidor
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
