// Servicio de Socket.IO para notificaciones en tiempo real

class SocketService {
  constructor() {
    this.io = null;
  }

  // Inicializar con la instancia de Socket.IO
  initialize(io) {
    this.io = io;
    console.log('✅ SocketService inicializado');
  }

  // Emitir notificación a un usuario específico
  emitToUser(userId, event, data) {
    if (!this.io) {
      console.warn('⚠️ Socket.IO no está inicializado');
      return;
    }

    console.log(`📤 Emitiendo evento "${event}" a usuario ${userId}`);
    this.io.to(`user_${userId}`).emit(event, data);
  }

  // Emitir notificación a múltiples usuarios
  emitToUsers(userIds, event, data) {
    if (!this.io) {
      console.warn('⚠️ Socket.IO no está inicializado');
      return;
    }

    userIds.forEach(userId => {
      this.emitToUser(userId, event, data);
    });
  }

  // Emitir a todos los usuarios de un rol específico
  emitToRole(role, event, data) {
    if (!this.io) {
      console.warn('⚠️ Socket.IO no está inicializado');
      return;
    }

    console.log(`📤 Emitiendo evento "${event}" a rol ${role}`);
    this.io.to(`role_${role}`).emit(event, data);
  }

  // Broadcast a todos los clientes conectados
  broadcast(event, data) {
    if (!this.io) {
      console.warn('⚠️ Socket.IO no está inicializado');
      return;
    }

    console.log(`📤 Broadcasting evento "${event}" a todos los clientes`);
    this.io.emit(event, data);
  }

  // Emitir nueva notificación (usado por el sistema de notificaciones)
  emitNewNotification(userId, notification) {
    this.emitToUser(userId, 'new_notification', notification);
  }

  // Emitir actualización de contador de notificaciones
  emitUnreadCount(userId, count) {
    this.emitToUser(userId, 'unread_count', { count });
  }
}

// Exportar instancia única (singleton)
module.exports = new SocketService();
