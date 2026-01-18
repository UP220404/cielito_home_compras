/**
 * Middleware de sanitización de entrada
 * Previene XSS y otros ataques de inyección
 */

// Función para sanitizar texto (elimina tags HTML y caracteres peligrosos)
const sanitizeText = (text) => {
  if (typeof text !== 'string') return text;

  return text
    // Eliminar tags HTML
    .replace(/<[^>]*>/g, '')
    // Escapar caracteres especiales HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Eliminar caracteres de control (excepto newline y tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Limitar longitud máxima para prevenir DoS
    .substring(0, 10000)
    .trim();
};

// Campos que deben ser sanitizados
const SANITIZE_FIELDS = [
  'justification',
  'material',
  'specifications',
  'notes',
  'reason',
  'rejection_reason',
  'description',
  'comments',
  'address',
  'contact_name',
  'payment_terms',
  'delivery_time'
];

/**
 * Middleware que sanitiza campos de texto en req.body
 */
const sanitizeRequestBody = (req, res, next) => {
  if (!req.body) return next();

  // Sanitizar campos de primer nivel
  SANITIZE_FIELDS.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      req.body[field] = sanitizeText(req.body[field]);
    }
  });

  // Sanitizar arrays (como items)
  if (Array.isArray(req.body.items)) {
    req.body.items = req.body.items.map(item => {
      const sanitizedItem = { ...item };
      SANITIZE_FIELDS.forEach(field => {
        if (sanitizedItem[field] && typeof sanitizedItem[field] === 'string') {
          sanitizedItem[field] = sanitizeText(sanitizedItem[field]);
        }
      });
      return sanitizedItem;
    });
  }

  next();
};

/**
 * Middleware que valida y sanitiza parámetros de URL
 */
const sanitizeParams = (req, res, next) => {
  if (!req.params) return next();

  Object.keys(req.params).forEach(key => {
    if (typeof req.params[key] === 'string') {
      // Solo permitir caracteres alfanuméricos, guiones y underscores
      req.params[key] = req.params[key].replace(/[^a-zA-Z0-9\-_]/g, '');
    }
  });

  next();
};

/**
 * Middleware que valida y sanitiza query strings
 */
const sanitizeQuery = (req, res, next) => {
  if (!req.query) return next();

  Object.keys(req.query).forEach(key => {
    if (typeof req.query[key] === 'string') {
      // Sanitizar pero permitir más caracteres para búsquedas
      req.query[key] = req.query[key]
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .substring(0, 200)
        .trim();
    }
  });

  next();
};

module.exports = {
  sanitizeText,
  sanitizeRequestBody,
  sanitizeParams,
  sanitizeQuery,
  SANITIZE_FIELDS
};
