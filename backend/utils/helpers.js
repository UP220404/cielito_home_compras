// Generar folio único para solicitudes
const generateRequestFolio = async () => {
  const db = require('../config/database');
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;

  try {
    // Obtener el último folio del año ordenado por el folio mismo, no por ID
    const lastRequest = await db.getAsync(
      `SELECT folio FROM requests
       WHERE folio LIKE ?
       ORDER BY folio DESC
       LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNumber = 1;
    if (lastRequest) {
      const lastNumber = parseInt(lastRequest.folio.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    const newFolio = `${prefix}${nextNumber.toString().padStart(3, '0')}`;

    // Verificar que el folio no existe (protección contra race conditions)
    const exists = await db.getAsync(
      'SELECT id FROM requests WHERE folio = ?',
      [newFolio]
    );

    if (exists) {
      // Si existe, intentar con el siguiente número
      console.warn(`Folio ${newFolio} ya existe, intentando con siguiente número`);
      nextNumber++;
      return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
    }

    return newFolio;
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
       ORDER BY folio DESC
       LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNumber = 1;
    if (lastOrder) {
      // Formato: OC-202601-0001 -> split da ["OC", "202601", "0001"]
      const lastNumber = parseInt(lastOrder.folio.split('-')[2]);
      // Si lastNumber es NaN (por folios corruptos), empezar desde 1
      if (!isNaN(lastNumber) && lastNumber > 0) {
        nextNumber = lastNumber + 1;
      }
    }

    const newFolio = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

    // Verificar que el folio no existe (protección contra race conditions)
    const exists = await db.getAsync(
      'SELECT id FROM purchase_orders WHERE folio = ?',
      [newFolio]
    );

    if (exists) {
      // Si existe, intentar con el siguiente número
      console.warn(`Folio ${newFolio} ya existe, intentando con siguiente número`);
      nextNumber++;
      return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
    }

    return newFolio;
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

// Obtener fecha/hora actual en zona horaria de México
const getMexicoDate = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
};

const getCurrentTimestamp = () => {
  const now = getMexicoDate();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`; // "YYYY-MM-DD HH:MM:SS"
};

// Formatear fecha para base de datos (YYYY-MM-DD)
const formatDateForDB = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  // Ajustar a zona horaria de México
  const mexicoDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const year = mexicoDate.getFullYear();
  const month = String(mexicoDate.getMonth() + 1).padStart(2, '0');
  const day = String(mexicoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Formatear fecha y hora para base de datos (YYYY-MM-DD HH:MM:SS)
const formatDateTimeForDB = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  // Ajustar a zona horaria de México
  const mexicoDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const year = mexicoDate.getFullYear();
  const month = String(mexicoDate.getMonth() + 1).padStart(2, '0');
  const day = String(mexicoDate.getDate()).padStart(2, '0');
  const hours = String(mexicoDate.getHours()).padStart(2, '0');
  const minutes = String(mexicoDate.getMinutes()).padStart(2, '0');
  const seconds = String(mexicoDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
      'SELECT id, name, email FROM users WHERE role = ? AND is_active = TRUE',
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

/**
 * Calcula el rango de la "semana" para un área según su horario asignado
 * - Si el área tiene horario (ej: miércoles), la semana va de miércoles a martes
 * - Si no tiene horario, la semana va de lunes a domingo
 * @param {string} area - Nombre del área
 * @param {Date} referenceDate - Fecha de referencia (default: hoy)
 * @returns {Promise<{startDate: string, endDate: string, dayOfWeek: number|null}>}
 */
const getAreaWeekRange = async (area, referenceDate = null) => {
  const db = require('../config/database');

  // Obtener fecha de México
  const now = referenceDate ? new Date(referenceDate) : getMexicoDate();
  const currentDayOfWeek = now.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado

  try {
    // Buscar si el área tiene un horario asignado
    const schedule = await db.getAsync(
      `SELECT day_of_week FROM area_schedules
       WHERE area = ? AND is_active = true
       ORDER BY day_of_week ASC
       LIMIT 1`,
      [area]
    );

    let weekStartDay;

    if (schedule) {
      // El área tiene horario - la semana empieza el día del horario
      weekStartDay = schedule.day_of_week;
    } else {
      // Sin horario - semana empieza el lunes (día 1)
      weekStartDay = 1;
    }

    // Calcular cuántos días retroceder para llegar al inicio de la semana
    let daysToSubtract = currentDayOfWeek - weekStartDay;
    if (daysToSubtract < 0) {
      daysToSubtract += 7; // Si el día de inicio ya pasó esta semana, ir a la semana anterior
    }

    // Fecha de inicio de la semana
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - daysToSubtract);
    startDate.setHours(0, 0, 0, 0);

    // Fecha de fin de la semana (6 días después del inicio)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      dayOfWeek: schedule ? schedule.day_of_week : null
    };
  } catch (error) {
    console.error('Error calculando semana del área:', error);
    // Fallback: semana lunes a domingo
    const monday = new Date(now);
    monday.setDate(now.getDate() - (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: sunday.toISOString().split('T')[0],
      dayOfWeek: null
    };
  }
};

/**
 * Verifica si el área tiene solicitudes en la semana actual
 * @param {string} area - Nombre del área
 * @param {string} startDate - Inicio de semana (YYYY-MM-DD)
 * @param {string} endDate - Fin de semana (YYYY-MM-DD)
 * @returns {Promise<{hasRequests: boolean, count: number}>}
 */
const checkAreaRequestsInWeek = async (area, startDate, endDate) => {
  const db = require('../config/database');

  try {
    const result = await db.getAsync(
      `SELECT COUNT(*) as count FROM requests
       WHERE area = ?
       AND status NOT IN ('cancelada', 'rechazada')
       AND DATE(created_at) >= ?
       AND DATE(created_at) <= ?`,
      [area, startDate, endDate]
    );

    return {
      hasRequests: result.count > 0,
      count: result.count
    };
  } catch (error) {
    console.error('Error verificando solicitudes del área:', error);
    return { hasRequests: false, count: 0 };
  }
};

/**
 * Verifica si el área tiene no-requerimientos en la semana actual
 * @param {string} area - Nombre del área
 * @param {string} startDate - Inicio de semana (YYYY-MM-DD)
 * @param {string} endDate - Fin de semana (YYYY-MM-DD)
 * @returns {Promise<{hasNoRequirements: boolean, status: string|null}>}
 */
const checkAreaNoRequirementsInWeek = async (area, startDate, endDate) => {
  const db = require('../config/database');

  try {
    // Buscar no-requerimientos que se solapen con la semana
    // pendiente o aprobado = bloquea
    const result = await db.getAsync(
      `SELECT id, status, start_date, end_date FROM no_requirements
       WHERE area = ?
       AND status IN ('pendiente', 'aprobado')
       AND (
         (start_date <= ? AND end_date >= ?) OR
         (start_date >= ? AND start_date <= ?)
       )
       ORDER BY created_at DESC
       LIMIT 1`,
      [area, endDate, startDate, startDate, endDate]
    );

    return {
      hasNoRequirements: !!result,
      status: result ? result.status : null,
      noRequirement: result || null
    };
  } catch (error) {
    console.error('Error verificando no-requerimientos del área:', error);
    return { hasNoRequirements: false, status: null, noRequirement: null };
  }
};

module.exports = {
  generateRequestFolio,
  generateOrderFolio,
  calculateBusinessDays,
  isBusinessDay,
  getNextBusinessDay,
  getMexicoDate,
  getCurrentTimestamp,
  formatDateForDB,
  formatDateTimeForDB,
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
  paginate,
  getAreaWeekRange,
  checkAreaRequestsInWeek,
  checkAreaNoRequirementsInWeek
};
