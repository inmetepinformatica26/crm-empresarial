// ===== API Service =====
const API = {
  baseURL: '/api',
  token: null,

  setToken(token) {
    this.token = token;
    localStorage.setItem('crm_token', token);
  },

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('crm_token');
    }
    return this.token;
  },

  clearToken() {
    this.token = null;
    localStorage.removeItem('crm_token');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
      }

      return data;
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('403')) {
        logout();
      }
      throw error;
    }
  },

  // Auth
  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  getProfile() {
    return this.request('/auth/profile');
  },

getUsers() {
    return this.request('/auth/users');
  },

  getAssignableUsers() {
    return this.request('/auth/assignable');
  },

  toggleUserStatus(id) {
    return this.request(`/auth/users/${id}/toggle-status`, {
      method: 'PUT'
    });
  },

  registerUser(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  // Clients
  getClients(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/clients${query ? '?' + query : ''}`);
  },

  getClient(id) {
    return this.request(`/clients/${id}`);
  },

  createClient(clientData) {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData)
    });
  },

  updateClient(id, clientData) {
    return this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData)
    });
  },

  deleteClient(id) {
    return this.request(`/clients/${id}`, {
      method: 'DELETE'
    });
  },

  // Projects
  getProjects(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/projects${query ? '?' + query : ''}`);
  },

  getProject(id) {
    return this.request(`/projects/${id}`);
  },

  createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
  },

  updateProject(id, projectData) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData)
    });
  },

  deleteProject(id) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE'
    });
  },

  // Tasks
  createTask(projectId, taskData) {
    return this.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  updateTask(id, taskData) {
    return this.request(`/projects/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  },

  deleteTask(id) {
    return this.request(`/projects/tasks/${id}`, {
      method: 'DELETE'
    });
  },

// Tasks
  getAllTasks() {
    return this.request('/projects/tasks/all');
  },

// Dashboard
  getDashboardStats() {
    return this.request('/projects/dashboard/stats');
  },

  // Settings
  getSettings() {
    return this.request('/settings');
  },

  updateSettings(data) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // User management
  updateUser(id, userData) {
    return this.request(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  },

  deleteUser(id) {
    return this.request(`/auth/users/${id}`, {
      method: 'DELETE'
    });
  }
};
