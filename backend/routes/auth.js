const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const {body, validationResult} = require('express-validator');
const { param } = require('express-validator');
const { handleValidationErrors } = require('../utils/validators');
const db = require('../config/database');
const logger = require('../utils/logger');
const { validateLogin, validateRegister } = require('../utils/validators');
const { authMiddleware } = require('../middleware/auth');
const { apiResponse, getClientIP } = require('../utils/helpers');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario (solo admin)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               area:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       409:
 *         description: El email ya está registrado
 *       403:
 *         description: No autorizado
 */
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtener información del usuario actual
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Información del usuario actual
 *       404:
 *         description: Usuario no encontrado
 */
/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Cambiar contraseña
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada exitosamente
 *       400:
 *         description: Contraseñas requeridas o inválidas
 *       401:
 *         description: Contraseña actual incorrecta
 */
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 */
/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Listar usuarios (solo admin)
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       403:
 *         description: No autorizado
 */
/**
 * @swagger
 * /api/auth/users/{id}/toggle:
 *   patch:
 *     summary: Activar/desactivar usuario (solo admin)
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario activado/desactivado exitosamente
 *       400:
 *         description: No puedes desactivar tu propia cuenta
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */

// POST /api/auth/login - Iniciar sesión
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const clientIP = getClientIP(req);

    // Buscar usuario
    const user = await db.getAsync(
      'SELECT id, email, password, name, area, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json(apiResponse(false, null, null, 'Credenciales inválidas'));
    }

    if (!user.is_active) {
      return res.status(401).json(apiResponse(false, null, null, 'Usuario inactivo'));
    }

    // Verificar password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json(apiResponse(false, null, null, 'Credenciales inválidas'));
    }

    // Generar JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log de auditoría
    await db.auditLog('users', user.id, 'login', null, { ip: clientIP }, user.id, clientIP);

    // Actualizar última conexión
    await db.runAsync(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Respuesta sin password
    const { password: _, ...userWithoutPassword } = user;

    res.json(apiResponse(true, {
      token,
      user: userWithoutPassword
    }, 'Login exitoso'));

  } catch (error) {
    logger.error('Error en /login: %o', error);
    next(error);
  }
});

// POST /api/auth/register - Registrar nuevo usuario (solo admin)
router.post('/register', authMiddleware, validateRegister, async (req, res, next) => {
  try {
    // Solo admin puede registrar usuarios
    if (req.user.role !== 'admin') {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    const { email, password, name, area, role } = req.body;

    // Verificar si el email ya existe
    const existingUser = await db.getAsync(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(409).json(apiResponse(false, null, null, 'El email ya está registrado'));
    }

    // Hashear password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insertar usuario
    const result = await db.runAsync(
      'INSERT INTO users (email, password, name, area, role) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, name, area, role]
    );

    // Log de auditoría
    await db.auditLog('users', result.id, 'create', null, { email, name, area, role }, req.user.id, getClientIP(req));

    res.status(201).json(apiResponse(true, {
      id: result.id,
      email,
      name,
      area,
      role
    }, 'Usuario registrado exitosamente'));

  } catch (error) {
    logger.error('Error en /register: %o', error);
    next(error);
  }
});

// GET /api/auth/me - Obtener información del usuario actual
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await db.getAsync(
      'SELECT id, email, name, area, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json(apiResponse(false, null, null, 'Usuario no encontrado'));
    }

    res.json(apiResponse(true, user));

  } catch (error) {
    logger.error('Error en /me: %o', error);
    next(error);
  }
});

// Removed duplicate endpoint - using better implementation below

// POST /api/auth/logout - Cerrar sesión (opcional, principalmente frontend)
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    // Log de auditoría
    await db.auditLog('users', req.user.id, 'logout', null, { ip: getClientIP(req) }, req.user.id, getClientIP(req));

    res.json(apiResponse(true, null, 'Sesión cerrada exitosamente'));

  } catch (error) {
    logger.error('Error en /logout: %o', error);
    next(error);
  }
});

// GET /api/auth/users - Listar usuarios (solo admin)
router.get('/users', authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    const users = await db.allAsync(
      `SELECT id, email, name, area, role, is_active, created_at, updated_at 
       FROM users 
       ORDER BY name ASC`
    );

    res.json(apiResponse(true, users));

  } catch (error) {
    logger.error('Error en /users: %o', error);
    next(error);
  }
});



// GET /api/auth/users/:id - Obtener un usuario específico (solo admin)
router.get('/users/:id',
  authMiddleware,
  param('id').isInt().withMessage('ID de usuario inválido'),
  handleValidationErrors,
  async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    const userId = parseInt(req.params.id);

    const user = await db.getAsync(`
      SELECT id, name, email, role, area, is_active, created_at, updated_at
      FROM users
      WHERE id = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json(apiResponse(false, null, null, 'Usuario no encontrado'));
    }

    res.json(apiResponse(true, user));

  } catch (error) {
    logger.error('Error en /users/:id GET: %o', error);
    next(error);
  }
});

// PUT /api/auth/users/:id - Actualizar usuario (solo admin)
router.put('/users/:id',
  authMiddleware,
  param('id').isInt().withMessage('ID de usuario inválido'),
  body('name').notEmpty().withMessage('El nombre es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('area').notEmpty().withMessage('El área es requerida'),
  body('role').isIn(['admin', 'director', 'purchaser', 'requester']).withMessage('Rol inválido'),
  body('password').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  handleValidationErrors,
  async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    const userId = parseInt(req.params.id);
    const { name, email, area, role, password } = req.body;

    // Verificar que el usuario existe
    const existingUser = await db.getAsync(
      'SELECT id, email FROM users WHERE id = ?',
      [userId]
    );

    if (!existingUser) {
      return res.status(404).json(apiResponse(false, null, null, 'Usuario no encontrado'));
    }

    // Verificar que el email no esté en uso por otro usuario
    if (email !== existingUser.email) {
      const emailExists = await db.getAsync(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (emailExists) {
        return res.status(409).json(apiResponse(false, null, null, 'El email ya está en uso'));
      }
    }

    // Preparar datos para actualizar
    let updateQuery = `
      UPDATE users
      SET name = ?, email = ?, area = ?, role = ?, updated_at = CURRENT_TIMESTAMP
    `;
    let updateParams = [name, email, area, role];

    // Si se proporciona contraseña, hashearla y agregarla
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = ?';
      updateParams.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(userId);

    await db.runAsync(updateQuery, updateParams);

    // Log de auditoría
    await db.auditLog('users', userId, 'update',
      existingUser,
      { name, email, area, role, password_changed: !!password },
      req.user.id,
      getClientIP(req)
    );

    res.json(apiResponse(true, null, 'Usuario actualizado exitosamente'));

  } catch (error) {
    logger.error('Error en /users/:id PUT: %o', error);
    next(error);
  }
});

// DELETE /api/auth/users/:id - Eliminar usuario (solo admin)
router.delete('/users/:id',
  authMiddleware,
  param('id').isInt().withMessage('ID de usuario inválido'),
  handleValidationErrors,
  async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    const userId = parseInt(req.params.id);

    // No permitir eliminar la propia cuenta
    if (userId === req.user.id) {
      return res.status(400).json(apiResponse(false, null, null, 'No puedes eliminar tu propia cuenta'));
    }

    // Verificar que el usuario existe
    const user = await db.getAsync(
      'SELECT id, name, email FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json(apiResponse(false, null, null, 'Usuario no encontrado'));
    }

    // Eliminar usuario
    await db.runAsync('DELETE FROM users WHERE id = ?', [userId]);

    // Log de auditoría
    await db.auditLog('users', userId, 'delete', user, null, req.user.id, getClientIP(req));

    res.json(apiResponse(true, null, 'Usuario eliminado exitosamente'));

  } catch (error) {
    logger.error('Error en /users/:id DELETE: %o', error);
    next(error);
  }
});

// PATCH /api/auth/users/:id/toggle - Activar/desactivar usuario (solo admin)
router.patch('/users/:id/toggle',
  authMiddleware,
  param('id').isInt().withMessage('ID de usuario inválido'),
  handleValidationErrors,
  async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json(apiResponse(false, null, null, 'No autorizado'));
    }

    const userId = parseInt(req.params.id);
    
    if (userId === req.user.id) {
      return res.status(400).json(apiResponse(false, null, null, 'No puedes desactivar tu propia cuenta'));
    }

    // Obtener estado actual
    const user = await db.getAsync(
      'SELECT is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json(apiResponse(false, null, null, 'Usuario no encontrado'));
    }

    const newStatus = user.is_active ? 0 : 1;

    // Actualizar estado
    await db.runAsync(
      'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, userId]
    );

    // Log de auditoría
    await db.auditLog('users', userId, 'update', { is_active: user.is_active }, { is_active: newStatus }, req.user.id, getClientIP(req));

    res.json(apiResponse(true, { is_active: newStatus }, 
      `Usuario ${newStatus ? 'activado' : 'desactivado'} exitosamente`));

  } catch (error) {
    logger.error('Error en /users/:id/toggle: %o', error);
    next(error);
  }
});

// POST /api/auth/change-password - Cambiar contraseña
router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('La contraseña actual es requerida'),
  body('newPassword').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Obtener usuario con contraseña
    const user = await db.getAsync(
      'SELECT id, email, password, name FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json(apiResponse(false, null, null, 'Usuario no encontrado'));
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json(apiResponse(false, null, null, 'La contraseña actual es incorrecta'));
    }

    // Validar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json(apiResponse(false, null, null, 'La nueva contraseña debe ser diferente a la actual'));
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await db.runAsync(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );

    // Log de auditoría
    await db.auditLog('users', userId, 'change_password', null, { changed: true }, userId, getClientIP(req));

    logger.info(`Usuario ${user.name} (${user.email}) cambió su contraseña`);

    res.json(apiResponse(true, null, 'Contraseña actualizada exitosamente'));

  } catch (error) {
    logger.error('Error en /auth/change-password: %o', error);
    next(error);
  }
});

module.exports = router;
