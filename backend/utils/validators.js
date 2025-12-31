const { body, param, query, validationResult } = require('express-validator');

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Construir mensaje de error detallado
    const errorMessages = errors.array().map(err => {
      // Formatear el campo para hacerlo más legible
      let field = err.path || err.param;

      // Traducir nombres de campos técnicos a nombres amigables
      const fieldTranslations = {
        'area': 'Área',
        'delivery_date': 'Fecha de entrega',
        'priority': 'Prioridad',
        'justification': 'Justificación',
        'items': 'Items',
        'material': 'Material',
        'specifications': 'Especificaciones',
        'quantity': 'Cantidad',
        'unit': 'Unidad',
        'approximate_cost': 'Costo aproximado',
        'email': 'Correo electrónico',
        'password': 'Contraseña',
        'name': 'Nombre',
        'role': 'Rol'
      };

      // Extraer el nombre del campo limpio (ej: "items.0.material" -> "material")
      const cleanField = field.split('.').pop();
      const friendlyField = fieldTranslations[cleanField] || cleanField;

      return `• ${friendlyField}: ${err.msg}`;
    });

    // Construir mensaje principal
    const mainMessage = errorMessages.length === 1
      ? 'Se encontró el siguiente error de validación'
      : `Se encontraron ${errorMessages.length} errores de validación`;

    return res.status(400).json({
      success: false,
      message: mainMessage,
      error: errorMessages.join('\n'),
      details: errors.array()
    });
  }
  next();
};

// Validaciones para autenticación
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email válido es requerido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password debe tener al menos 6 caracteres'),
  handleValidationErrors
];

const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email válido es requerido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password debe tener al menos 6 caracteres'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nombre debe tener entre 2 y 100 caracteres'),
  body('area')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Área es requerida'),
  body('role')
    .isIn(['requester', 'purchaser', 'admin', 'director'])
    .withMessage('Rol no válido'),
  handleValidationErrors
];

// Validaciones para solicitudes
const validateRequest = [
  body('area')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Área es requerida'),
  body('delivery_date')
    .isISO8601()
    .toDate()
    .custom((value, { req }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (value <= today) {
        throw new Error('Fecha de entrega debe ser futura');
      }
      return true;
    }),
  body('priority')
    .isIn(['normal', 'urgente', 'critica'])
    .withMessage('Prioridad no válida'),
  body('justification')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Justificación debe tener entre 10 y 500 caracteres'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos un item'),
  body('items.*.material')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Material es requerido'),
  body('items.*.specifications')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Especificaciones son requeridas'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Cantidad debe ser un número entero positivo'),
  body('items.*.unit')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Unidad es requerida'),
  body('items.*.approximate_cost')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      // Si está vacío o null, es válido (campo opcional)
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // Si tiene valor, debe ser un número >= 0
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) {
        throw new Error('Costo aproximado debe ser un número mayor o igual a 0');
      }
      return true;
    }),
  handleValidationErrors
];

// Validación para cambio de estatus
const validateStatusChange = [
  body('status')
    .isIn(['pendiente', 'cotizando', 'autorizada', 'rechazada', 'pedido', 'entregada', 'cancelada'])
    .withMessage('Estado no válido'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Razón no puede exceder 500 caracteres'),
  handleValidationErrors
];

// Validaciones para proveedores
const validateSupplier = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nombre del proveedor es requerido'),
  body('rfc')
    .optional()
    .trim()
    .matches(/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/)
    .withMessage('RFC no válido'),
  body('contact_person')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Nombre de contacto muy largo'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\-\(\)\+\s]{10,20}$/)
    .withMessage('Teléfono no válido'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email no válido'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Categoría muy larga'),
  handleValidationErrors
];

// Validaciones para cotizaciones
const validateQuotation = [
  body('request_id')
    .isInt({ min: 1 })
    .withMessage('ID de solicitud requerido'),
  body('supplier_id')
    .isInt({ min: 1 })
    .withMessage('ID de proveedor requerido'),
  body('quotation_number')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Número de cotización muy largo'),
  body('total_amount')
    .isFloat({ min: 0.01 })
    .withMessage('Monto total debe ser mayor a 0'),
  body('delivery_days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Días de entrega deben estar entre 1 y 365'),
  body('payment_terms')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Términos de pago muy largos'),
  body('validity_days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Días de validez deben estar entre 1 y 90'),
  body('items')
    .optional({ checkFalsy: true })
    .isArray()
    .withMessage('Items debe ser un array'),
  body('items.*.request_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID de item de solicitud requerido'),
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Cantidad debe ser un número entero positivo'),
  body('items.*.unit_price')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Precio unitario debe ser mayor a 0'),
  body('items.*.has_invoice')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('has_invoice debe ser 0 o 1'),
  body('items.*.delivery_date')
    .optional()
    .isISO8601()
    .withMessage('Fecha de entrega debe ser válida'),
  handleValidationErrors
];

// Validaciones para órdenes de compra
const validatePurchaseOrder = [
  body('request_id')
    .isInt({ min: 1 })
    .withMessage('ID de solicitud requerido'),
  body('quotation_id')
    .isInt({ min: 1 })
    .withMessage('ID de cotización requerido'),
  body('expected_delivery')
    .isISO8601()
    .toDate()
    .custom((value) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (value <= today) {
        throw new Error('Fecha de entrega esperada debe ser futura');
      }
      return true;
    }),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notas no pueden exceder 500 caracteres'),
  handleValidationErrors
];

// Validaciones para parámetros de ID
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  handleValidationErrors
];

// Validaciones para consultas de fecha
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio no válida'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin no válida'),
  query('startDate')
    .optional()
    .custom((value, { req }) => {
      if (value && req.query.endDate && new Date(value) > new Date(req.query.endDate)) {
        throw new Error('Fecha de inicio debe ser anterior a fecha de fin');
      }
      return true;
    }),
  handleValidationErrors
];

// Validaciones para paginación
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número entero positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 5000 })
    .withMessage('Límite debe estar entre 1 y 5000'),
  handleValidationErrors
];

module.exports = {
  validateLogin,
  validateRegister,
  validateRequest,
  validateStatusChange,
  validateSupplier,
  validateQuotation,
  validatePurchaseOrder,
  validateId,
  validateDateRange,
  validatePagination,
  handleValidationErrors
};
