// ===== Global State =====
let currentUser = null;
let clientsCache = [];
let usersCache = [];
let projectsCache = [];

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  const token = API.getToken();
  if (token) {
    initializeApp();
  }
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('clientForm').addEventListener('submit', handleClientSave);
  document.getElementById('projectForm').addEventListener('submit', handleProjectSave);
  document.getElementById('userForm').addEventListener('submit', handleUserSave);
  updateCurrentDate();
  setInterval(updateCurrentDate, 60000);
});

function updateCurrentDate() {
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('currentDate').textContent = now.toLocaleDateString('es-ES', opts);
}

// ===== Authentication =====
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  try {
    const result = await API.login(email, password);
    API.setToken(result.token);
    currentUser = result.user;
    showToast('Inicio de sesion exitoso', 'success');
    initializeApp();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
  }
}

async function initializeApp() {
  try {
    currentUser = await API.getProfile();
  } catch (e) {}
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();
  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userRole').textContent = currentUser.role;
  if (currentUser.role === 'admin') {
    document.getElementById('usersNav').style.display = 'flex';
  }
  showSection('dashboard');
  loadDashboard();
}

function logout() {
  API.clearToken();
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginForm').reset();
  showToast('Sesion cerrada', 'success');
}

// ===== Navigation =====
function showSection(section) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('section-' + section);
  if (el) el.classList.add('active');
  const titles = { dashboard: 'Dashboard', clients: 'Clientes', projects: 'Proyectos', users: 'Usuarios' };
  document.getElementById('sectionTitle').textContent = titles[section] || section;
  if (section === 'dashboard') loadDashboard();
  if (section === 'clients') loadClients();
  if (section === 'projects') loadProjects();
  if (section === 'users') loadUsers();
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ===== Toast =====
function showToast(message, type) {
  if (!type) type = 'info';
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== Modal Helpers =====
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// ===== Dashboard =====
async function loadDashboard() {
  try {
    const stats = await API.getDashboardStats();
    document.getElementById('totalClients').textContent = stats.totalClients;
    document.getElementById('totalProjects').textContent = stats.activeProjects;
    document.getElementById('totalTasks').textContent = stats.pendingTasks;
    document.getElementById('totalUsers').textContent = stats.totalUsers;
    const activityEl = document.getElementById('recentActivity');
    if (stats.recentActivity.length === 0) {
      activityEl.innerHTML = '<p class="text-muted">Sin actividad reciente</p>';
    } else {
      activityEl.innerHTML = '<ul class="activity-list">' + stats.recentActivity.map(a => {
        const ic = a.action === 'create' ? 'create' : a.action === 'update' ? 'update' : a.action === 'delete' ? 'delete' : 'login';
        const icons = { create: 'fa-plus', update: 'fa-edit', delete: 'fa-trash', login: 'fa-sign-in-alt' };
        return '<li class="activity-item"><div class="activity-icon ' + ic + '"><i class="fas ' + (icons[a.action] || 'fa-circle') + '"></i></div><div class="activity-detail"><div class="activity-action">' + escapeHtml(a.description) + '</div><div class="activity-time">' + (a.user_name || 'Sistema') + ' · ' + formatDate(a.created_at) + '</div></div></li>';
      }).join('') + '</ul>';
    }
    const statusEl = document.getElementById('projectsByStatus');
    const sLabels = { planning: 'Planificacion', in_progress: 'En Progreso', on_hold: 'En Pausa', completed: 'Completado', cancelled: 'Cancelado' };
    const colors = { planning: '#3b82f6', in_progress: '#10b981', on_hold: '#f59e0b', completed: '#6b7280', cancelled: '#ef4444' };
    if (stats.projectsByStatus.length === 0) {
      statusEl.innerHTML = '<p class="text-muted">Sin proyectos registrados</p>';
    } else {
      const total = stats.projectsByStatus.reduce((sum, s) => sum + s.count, 0);
      statusEl.innerHTML = stats.projectsByStatus.map(s => '<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;"><span>' + (sLabels[s.status] || s.status) + '</span><span><strong>' + s.count + '</strong> (' + Math.round(s.count/total*100) + '%)</span></div><div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + (s.count/total*100) + '%;background:' + (colors[s.status] || '#3b82f6') + ';border-radius:4px;transition:width 0.3s;"></div></div></div>').join('');
    }
  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

// ===== Clients =====
async function loadClients(search) {
  if (!search) search = '';
  try {
    const params = {};
    if (search) params.search = search;
    const clients = await API.getClients(params);
    clientsCache = clients;
    const tbody = document.getElementById('clientsBody');
    if (clients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se encontraron clientes</td></tr>';
      return;
    }
    tbody.innerHTML = clients.map(c => '<tr><td><strong>' + escapeHtml(c.company_name) + '</strong></td><td>' + escapeHtml(c.contact_name) + '</td><td>' + (c.email ? '<a href="mailto:' + c.email + '">' + escapeHtml(c.email) + '</a>' : '<span class="text-muted">—</span>') + '</td><td>' + (c.phone || '<span class="text-muted">—</span>') + '</td><td><span class="status-badge status-' + c.status + '">' + statusLabel(c.status) + '</span></td><td><div class="action-btns"><button class="btn-view" onclick="editClient(' + c.id + ')" title="Editar"><i class="fas fa-edit"></i></button><button class="btn-delete" onclick="deleteClient(' + c.id + ')" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>').join('');
  } catch (error) {
    document.getElementById('clientsBody').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error: ' + error.message + '</td></tr>';
  }
}

function searchClients() {
  loadClients(document.getElementById('clientSearch').value);
}

function openClientModal(clientData) {
  document.getElementById('clientModalTitle').textContent = clientData ? 'Editar Cliente' : 'Nuevo Cliente';
  if (clientData) {
    document.getElementById('clientId').value = clientData.id;
    document.getElementById('clientCompany').value = clientData.company_name;
    document.getElementById('clientContact').value = clientData.contact_name;
    document.getElementById('clientEmail').value = clientData.email || '';
    document.getElementById('clientPhone').value = clientData.phone || '';
    document.getElementById('clientAddress').value = clientData.address || '';
    document.getElementById('clientCity').value = clientData.city || '';
    document.getElementById('clientTaxId').value = clientData.tax_id || '';
    document.getElementById('clientStatus').value = clientData.status;
    document.getElementById('clientNotes').value = clientData.notes || '';
  } else {
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientStatus').value = 'active';
  }
  openModal('clientModal');
}

function editClient(id) {
  const client = clientsCache.find(c => c.id === id);
  if (client) openClientModal(client);
}

async function deleteClient(id) {
  if (!confirm('Esta seguro de eliminar este cliente?')) return;
  try {
    await API.deleteClient(id);
    showToast('Cliente eliminado exitosamente', 'success');
    loadClients(document.getElementById('clientSearch').value);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleClientSave(e) {
  e.preventDefault();
  const id = document.getElementById('clientId').value;
  const data = {
    company_name: document.getElementById('clientCompany').value,
    contact_name: document.getElementById('clientContact').value,
    email: document.getElementById('clientEmail').value || null,
    phone: document.getElementById('clientPhone').value || null,
    address: document.getElementById('clientAddress').value || null,
    city: document.getElementById('clientCity').value || null,
    tax_id: document.getElementById('clientTaxId').value || null,
    status: document.getElementById('clientStatus').value,
    notes: document.getElementById('clientNotes').value || null
  };
  try {
    if (id) {
      await API.updateClient(id, data);
      showToast('Cliente actualizado exitosamente', 'success');
    } else {
      await API.createClient(data);
      showToast('Cliente creado exitosamente', 'success');
    }
    closeModal('clientModal');
    loadClients(document.getElementById('clientSearch').value);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ===== Projects =====
async function loadProjects(search) {
  if (!search) search = '';
  try {
    const params = {};
    if (search) params.search = search;
    const projects = await API.getProjects(params);
    projectsCache = projects;
    const tbody = document.getElementById('projectsBody');
    if (projects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No se encontraron proyectos</td></tr>';
      return;
    }
    tbody.innerHTML = projects.map(p => '<tr><td><strong>' + escapeHtml(p.name) + '</strong></td><td>' + (p.client_name || '<span class="text-muted">Sin cliente</span>') + '</td><td><span class="status-badge status-' + p.status + '">' + projectStatusLabel(p.status) + '</span></td><td><span class="status-badge priority-' + p.priority + '">' + priorityLabel(p.priority) + '</span></td><td>' + (p.start_date || '<span class="text-muted">—</span>') + '</td><td>' + (p.end_date || '<span class="text-muted">—</span>') + '</td><td><div class="action-btns"><button class="btn-view" onclick="viewProject(' + p.id + ')" title="Ver detalle"><i class="fas fa-eye"></i></button><button class="btn-edit" onclick="editProject(' + p.id + ')" title="Editar"><i class="fas fa-edit"></i></button><button class="btn-delete" onclick="deleteProject(' + p.id + ')" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>').join('');
  } catch (error) {
    document.getElementById('projectsBody').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error: ' + error.message + '</td></tr>';
  }
}

function searchProjects() {
  loadProjects(document.getElementById('projectSearch').value);
}

async function openProjectModal(projectData) {
  try {
    const clients = await API.getClients();
    const users = await API.getUsers();
    const clientSelect = document.getElementById('projectClient');
    clientSelect.innerHTML = '<option value="">Seleccionar cliente</option>' + clients.map(c => '<option value="' + c.id + '">' + escapeHtml(c.company_name) + '</option>').join('');
    const assignedSelect = document.getElementById('projectAssigned');
    assignedSelect.innerHTML = '<option value="">Seleccionar usuario</option>' + users.map(u => '<option value="' + u.id + '">' + escapeHtml(u.full_name) + '</option>').join('');
    document.getElementById('projectModalTitle').textContent = projectData ? 'Editar Proyecto' : 'Nuevo Proyecto';
    if (projectData) {
      document.getElementById('projectId').value = projectData.id;
      document.getElementById('projectName').value = projectData.name;
      document.getElementById('projectDescription').value = projectData.description || '';
      document.getElementById('projectClient').value = projectData.client_id || '';
      document.getElementById('projectAssigned').value = projectData.assigned_to || '';
      document.getElementById('projectStatus').value = projectData.status;
      document.getElementById('projectPriority').value = projectData.priority;
      document.getElementById('projectStartDate').value = projectData.start_date || '';
      document.getElementById('projectEndDate').value = projectData.end_date || '';
      document.getElementById('projectBudget').value = projectData.budget || 0;
    } else {
      document.getElementById('projectForm').reset();
      document.getElementById('projectId').value = '';
    }
    openModal('projectModal');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

function editProject(id) {
  const project = projectsCache.find(p => p.id === id);
  if (project) openProjectModal(project);
}

async function deleteProject(id) {
  if (!confirm('Esta seguro de eliminar este proyecto?')) return;
  try {
    await API.deleteProject(id);
    showToast('Proyecto eliminado exitosamente', 'success');
    loadProjects(document.getElementById('projectSearch').value);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleProjectSave(e) {
  e.preventDefault();
  const id = document.getElementById('projectId').value;
  const data = {
    name: document.getElementById('projectName').value,
    description: document.getElementById('projectDescription').value || null,
    client_id: document.getElementById('projectClient').value || null,
    assigned_to: document.getElementById('projectAssigned').value || null,
    status: document.getElementById('projectStatus').value,
    priority: document.getElementById('projectPriority').value,
    start_date: document.getElementById('projectStartDate').value || null,
    end_date: document.getElementById('projectEndDate').value || null,
    budget: parseFloat(document.getElementById('projectBudget').value) || 0
  };
  try {
    if (id) {
      await API.updateProject(id, data);
      showToast('Proyecto actualizado exitosamente', 'success');
    } else {
      await API.createProject(data);
      showToast('Proyecto creado exitosamente', 'success');
    }
    closeModal('projectModal');
    loadProjects(document.getElementById('projectSearch').value);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function viewProject(id) {
  try {
    const project = await API.getProject(id);
    const sLabels = { planning: 'Planificacion', in_progress: 'En Progreso', on_hold: 'En Pausa', completed: 'Completado', cancelled: 'Cancelado' };
    const pLabels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
    const tLabels = { pending: 'Pendiente', in_progress: 'En Progreso', completed: 'Completada', cancelled: 'Cancelada' };
    let html = '<div class="project-detail"><div class="info-grid">';
    html += '<div class="info-item"><label>Estado</label><span class="status-badge status-' + project.status + '">' + (sLabels[project.status] || project.status) + '</span></div>';
    html += '<div class="info-item"><label>Prioridad</label><span class="status-badge priority-' + project.priority + '">' + (pLabels[project.priority] || project.priority) + '</span></div>';
    html += '<div class="info-item"><label>Cliente</label><div>' + (project.client_name || 'Sin cliente') + '</div></div>';
    html += '<div class="info-item"><label>Asignado a</label><div>' + (project.assigned_name || 'Sin asignar') + '</div></div>';
    html += '<div class="info-item"><label>Fecha Inicio</label><div>' + (project.start_date || '—') + '</div></div>';
    html += '<div class="info-item"><label>Fecha Fin</label><div>' + (project.end_date || '—') + '</div></div>';
    html += '<div class="info-item"><label>Presupuesto</label><div>S/ ' + (project.budget ? project.budget.toFixed(2) : '0.00') + '</div></div>';
    html += '<div class="info-item"><label>Creado por</label><div>' + (project.creator_name || '—') + '</div></div></div>';
    if (project.description) {
      html += '<h4>Descripcion</h4><p>' + escapeHtml(project.description) + '</p>';
    }
    html += '<h4>Tareas (' + project.tasks.length + ')</h4>';
    html += '<div style="margin-bottom:15px;"><button class="btn btn-primary btn-sm" onclick="addTask(' + project.id + ')"><i class="fas fa-plus"></i> Agregar Tarea</button></div>';
    if (project.tasks.length === 0) {
      html += '<p class="text-muted">Sin tareas registradas</p>';
    } else {
      html += project.tasks.map(t => '<div class="task-item"><div class="task-info"><div class="task-title">' + escapeHtml(t.title) + '</div><div class="task-meta">' + (t.assigned_name ? 'Asignado: ' + t.assigned_name + ' · ' : '') + (t.due_date ? 'Vence: ' + t.due_date + ' · ' : '') + '<span class="status-badge status-' + t.status + '">' + (tLabels[t.status] || t.status) + '</span></div></div><div class="action-btns">' + (t.status !== 'completed' ? '<button class="btn-edit btn-sm" onclick="completeTask(' + t.id + ',' + project.id + ')" title="Completar"><i class="fas fa-check"></i></button>' : '') + '<button class="btn-delete btn-sm" onclick="deleteTask(' + t.id + ',' + project.id + ')" title="Eliminar"><i class="fas fa-trash"></i></button></div></div>').join('');
    }
    html += '</div>';
    document.getElementById('viewProjectTitle').textContent = '📋 ' + escapeHtml(project.name);
    document.getElementById('viewProjectBody').innerHTML = html;
    openModal('viewProjectModal');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

async function addTask(projectId) {
  const title = prompt('Nombre de la tarea:');
  if (!title) return;
  try {
    await API.createTask(projectId, { title: title });
    showToast('Tarea creada exitosamente', 'success');
    viewProject(projectId);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function completeTask(taskId, projectId) {
  try {
    await API.updateTask(taskId, { status: 'completed' });
    showToast('Tarea completada', 'success');
    viewProject(projectId);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteTask(taskId, projectId) {
  if (!confirm('Eliminar esta tarea?')) return;
  try {
    await API.deleteTask(taskId);
    showToast('Tarea eliminada', 'success');
    viewProject(projectId);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ===== Users (Admin only) =====
async function loadUsers() {
  if (currentUser.role !== 'admin') return;
  try {
    const users = await API.getUsers();
    usersCache = users;
    const tbody = document.getElementById('usersBody');
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay usuarios registrados</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(u => '<tr><td><strong>' + escapeHtml(u.full_name) + '</strong></td><td>' + escapeHtml(u.email) + '</td><td>' + escapeHtml(u.username) + '</td><td><span class="status-badge ' + (u.role === 'admin' ? 'status-active' : 'status-in_progress') + '">' + (u.role === 'admin' ? 'Administrador' : 'Usuario') + '</span></td><td><span class="status-badge ' + (u.active ? 'status-active' : 'status-inactive') + '">' + (u.active ? 'Activo' : 'Inactivo') + '</span></td><td><div class="action-btns"><button class="btn-delete" onclick="deactivateUser(' + u.id + ')" title="' + (u.active ? 'Desactivar' : 'Activar') + '"><i class="fas ' + (u.active ? 'fa-ban' : 'fa-check') + '"></i></button></div></td></tr>').join('');
  } catch (error) {
    document.getElementById('usersBody').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error: ' + error.message + '</td></tr>';
  }
}

function openUserModal() {
  document.getElementById('userForm').reset();
  openModal('userModal');
}

async function handleUserSave(e) {
  e.preventDefault();
  const data = {
    username: document.getElementById('userUsername').value,
    email: document.getElementById('userEmail').value,
    password: document.getElementById('userPassword').value,
    full_name: document.getElementById('userFullName').value,
    role: document.getElementById('userRole').value
  };
  try {
    await API.registerUser(data);
    showToast('Usuario creado exitosamente', 'success');
    closeModal('userModal');
    loadUsers();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deactivateUser(id) {
  showToast('Funcionalidad en desarrollo', 'info');
}

// ===== Utility Functions =====
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var date = new Date(dateStr);
  var now = new Date();
  var diffMs = now - date;
  var diffMins = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMs / 3600000);
  var diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return 'Hace ' + diffMins + ' min';
  if (diffHours < 24) return 'Hace ' + diffHours + ' h';
  if (diffDays < 7) return 'Hace ' + diffDays + ' dias';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function statusLabel(status) {
  var labels = { active: 'Activo', inactive: 'Inactivo', lead: 'Prospecto' };
  return labels[status] || status;
}

function projectStatusLabel(status) {
  var labels = { planning: 'Planificacion', in_progress: 'En Progreso', on_hold: 'En Pausa', completed: 'Completado', cancelled: 'Cancelado' };
  return labels[status] || status;
}

function priorityLabel(priority) {
  var labels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
  return labels[priority] || priority;
}

