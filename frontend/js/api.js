class API {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: this.getHeaders(options.auth !== false)
    };

    try {
      const response = await fetch(url, config);
      
      // Manejar respuestas no JSON (como archivos)
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        if (response.ok) {
          return response;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        // Manejar errores específicos
        if (response.status === 401) {
          this.handleUnauthorized();
          throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      
      // Manejar errores de red
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(CONFIG.MESSAGES.NETWORK_ERROR);
      }
      
      throw error;
    }
  }

  handleUnauthorized() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (!window.location.pathname.includes('login.html')) {
      // Determinar si estamos en /pages o en raíz
      const currentPath = window.location.pathname;
      if (currentPath.includes('/pages/')) {
        window.location.href = 'login.html';
      } else {
        window.location.href = 'pages/login.html';
      }
    }
  }

  // Auth methods
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false
    });
    
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    return data;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Determinar si estamos en /pages o en raíz
    const currentPath = window.location.pathname;
    if (currentPath.includes('/pages/')) {
      window.location.href = 'login.html';
    } else {
      window.location.href = 'pages/login.html';
    }
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  // Request methods
  async getMyRequests(page = 1, limit = 10, filters = {}) {
    const params = new URLSearchParams({ page, limit, ...filters });
    return this.request(`/requests/my?${params}`);
  }

  async getAllRequests(page = 1, limit = 10, filters = {}) {
    const params = new URLSearchParams({ page, limit, ...filters });
    return this.request(`/requests?${params}`);
  }

  async createRequest(data) {
    return this.request('/requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getRequestById(id) {
    return this.request(`/requests/${id}`);
  }

  async updateRequestStatus(id, status, reason = null) {
    return this.request(`/requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason })
    });
  }

  async deleteRequest(id) {
    return this.request(`/requests/${id}`, {
      method: 'DELETE'
    });
  }

  async getRequestStats() {
    return this.request('/requests/stats/summary');
  }

  // Quotation methods
  async getQuotationsByRequest(requestId) {
    return this.request(`/quotations/request/${requestId}`);
  }

  async createQuotation(data) {
    return this.request('/quotations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateQuotation(id, data) {
    return this.request(`/quotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async selectQuotation(id) {
    return this.request(`/quotations/${id}/select`, {
      method: 'PATCH'
    });
  }

  async deleteQuotation(id) {
    return this.request(`/quotations/${id}`, {
      method: 'DELETE'
    });
  }

  // Supplier methods
  async getSuppliers(page = 1, limit = 20, filters = {}) {
    const params = new URLSearchParams({ page, limit, ...filters });
    return this.request(`/suppliers?${params}`);
  }

  async getSupplierById(id) {
    return this.request(`/suppliers/${id}`);
  }

  async createSupplier(data) {
    return this.request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateSupplier(id, data) {
    return this.request(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async toggleSupplier(id) {
    return this.request(`/suppliers/${id}/toggle`, {
      method: 'PATCH'
    });
  }

  async getSupplierCategories() {
    return this.request('/suppliers/categories/list');
  }

  // Order methods
  async getPurchaseOrders(page = 1, limit = 10, filters = {}) {
    const params = new URLSearchParams({ page, limit, ...filters });
    return this.request(`/orders?${params}`);
  }

  async getPurchaseOrderById(id) {
    return this.request(`/orders/${id}`);
  }

  async createPurchaseOrder(data) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateOrderStatus(id, status, actual_delivery = null, notes = null) {
    return this.request(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, actual_delivery, notes })
    });
  }

  async downloadOrderPDF(id) {
    const response = await this.request(`/orders/${id}/pdf`);
    return response; // Retorna la respuesta fetch para manejar el blob
  }

  async getOrderStats() {
    return this.request('/orders/stats/summary');
  }

  // Analytics methods
  async getAnalyticsSummary() {
    return this.request('/analytics/summary');
  }

  async getSpendingByArea(startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/analytics/spending-by-area?${params}`);
  }

  async getRequestsByMonth() {
    return this.request('/analytics/requests-by-month');
  }

  async getTopSuppliers() {
    return this.request('/analytics/top-suppliers');
  }

  async getStatusDistribution() {
    return this.request('/analytics/status-distribution');
  }

  async getMonthlySpending() {
    return this.request('/analytics/monthly-spending');
  }

  async getResponseTimes() {
    return this.request('/analytics/response-times');
  }

  // Report methods
  async downloadRequestsExcel(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseURL}/reports/requests/excel?${params}`, {
      headers: this.getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Error descargando reporte');
    }
    
    return response.blob();
  }

  async downloadSuppliersExcel() {
    const response = await fetch(`${this.baseURL}/reports/suppliers/excel`, {
      headers: this.getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Error descargando reporte');
    }
    
    return response.blob();
  }

  async downloadOrdersExcel(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseURL}/reports/purchase-orders/excel?${params}`, {
      headers: this.getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Error descargando reporte');
    }
    
    return response.blob();
  }

  // Notification methods
  async getNotifications(page = 1, limit = 20, unreadOnly = false) {
    const params = new URLSearchParams({ page, limit, unread_only: unreadOnly });
    return this.request(`/notifications?${params}`);
  }

  async getUnreadCount() {
    return this.request('/notifications/unread-count');
  }

  async markNotificationAsRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH'
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/mark-all-read', {
      method: 'PATCH'
    });
  }

  async deleteNotification(id) {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE'
    });
  }

  // User management (admin only)
  async getUsers() {
    return this.request('/auth/users');
  }

  async toggleUser(id) {
    return this.request(`/auth/users/${id}/toggle`, {
      method: 'PATCH'
    });
  }

  async createUser(data) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

// Instancia global de la API
const api = new API(CONFIG.API_URL);

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
