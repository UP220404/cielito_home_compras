// Generar folio único para solicitudes
const generateRequestFolio = async (db) => {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  
  try {
    // Obtener el último folio del año
    const lastRequest = await db.getAsync(
      `SELECT folio FROM requests 
       WHERE folio LIKE ? 
       ORDER BY id DESC 
       LIMIT 1`,
      [`${prefix}%`]
    );
    
    let nextNumber = 1;
    if (lastRequest) {
      const lastNumber = parseInt(lastRequest.folio.split('-')[2]);
      nextNumber = lastNumber + 1;
    }
    
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generando folio:', error);
    // Fallback con timestamp
    return `${prefix}${Date.now().toString().slice(-6)}`;
  }
};

// Generar folio único para órdenes de compra
const generateOrderFolio = async (db) => {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const prefix = `OC-${year}${month}-`;
  
  try {
    const lastOrder = await db.getAsync(
      `SELECT folio FROM purchase_orders 
       WHERE folio LIKE ? 
       ORDER BY id DESC 
       LIMIT 1`,
      [`${prefix}%`]
    );
    
    let nextNumber = 1;
    if (lastOrder) {
      const lastNumber = parseInt(lastOrder.folio.split('-')[1].slice(6));
      nextNumber = lastNumber + 1;
    }
    
    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generando folio de orden:', error);
    return `${prefix}${Date.now().toString().slice(-8)}`;
  }
};

// Calcular días hábiles entre dos fechas
const calculateBusinessDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let businessDays = 0;
  
  const currentDate = new Date(start);
  while (currentDate <= end) {
    // 0 = Domingo, 6 = Sábado
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return businessDays;
};

// Verificar si una fecha es día hábil
const isBusinessDay = (date) => {
  const dayOfWeek = new Date(date).getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
};

// Obtener la siguiente fecha hábil
const getNextBusinessDay = (date) => {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  while (!isBusinessDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
};

// Formatear fecha para base de datos (YYYY-MM-DD)
const formatDateForDB = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Formatear fecha para mostrar (DD/MM/YYYY)
const formatDateForDisplay = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-MX');
};

// Formatear moneda mexicana
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

// Sanitizar texto para prevenir XSS
const sanitizeText = (text) => {
  if (!text) return '';
  return text
    .toString()
    .replace(/[<>]/g, '')
    .trim();
};

// Validar email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generar password temporal
const generateTempPassword = (length = 8) => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Obtener IP del cliente
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
};

// Calcular prioridad automática basada en urgencia y fecha
const calculateAutoPriority = (urgency, deliveryDate) => {
  const daysUntilDelivery = Math.ceil(
    (new Date(deliveryDate) - new Date()) / (1000 * 60 * 60 * 24)
  );
  
  if (urgency === 'alta' && daysUntilDelivery <= 3) {
    return 'critica';
  } else if (urgency === 'alta' || daysUntilDelivery <= 7) {
    return 'urgente';
  } else {
    return 'normal';
  }
};

// Validar horario laboral
const isBusinessHour = (date = new Date()) => {
  const hour = date.getHours();
  return hour >= 9 && hour < 18; // 9 AM a 6 PM
};

// Obtener usuarios por rol
const getUsersByRole = async (db, role) => {
  try {
    return await db.allAsync(
      'SELECT id, name, email FROM users WHERE role = ? AND is_active = 1',
      [role]
    );
  } catch (error) {
    console.error('Error obteniendo usuarios por rol:', error);
    return [];
  }
};

// Calcular métricas de tiempo
const calculateTimeMetrics = (createdAt, completedAt = null) => {
  const created = new Date(createdAt);
  const completed = completedAt ? new Date(completedAt) : new Date();
  
  const totalHours = Math.ceil((completed - created) / (1000 * 60 * 60));
  const businessDays = calculateBusinessDays(created, completed);
  
  return {
    totalHours,
    businessDays,
    isOverdue: businessDays > 5 // Más de 5 días hábiles se considera retrasado
  };
};

// Respuesta estándar de API
const apiResponse = (success, data = null, message = null, error = null) => {
  const response = { success };
  
  if (data) response.data = data;
  if (message) response.message = message;
  if (error) response.error = error;
  
  return response;
};

// Paginación
const paginate = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return {
    limit: Math.min(limit, 100), // Máximo 100 registros por página
    offset: Math.max(offset, 0)
  };
};

module.exports = {
  generateRequestFolio,
  generateOrderFolio,
  calculateBusinessDays,
  isBusinessDay,
  getNextBusinessDay,
  formatDateForDB,
  formatDateForDisplay,
  formatCurrency,
  sanitizeText,
  isValidEmail,
  generateTempPassword,
  getClientIP,
  calculateAutoPriority,
  isBusinessHour,
  getUsersByRole,
  calculateTimeMetrics,
  apiResponse,
  paginate
};
