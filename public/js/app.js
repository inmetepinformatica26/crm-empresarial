// ===== Global State =====
let currentUser = null;
let clientsCache = [];
let usersCache = [];
let projectsCache = [];

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  const token = API.getToken();
  // Cargar logo y nombre de empresa siempre, incluso en la pantalla de login
  // (el GET /api/settings ahora es público)
  loadSettings();
  if (token) {
    initializeApp();
  }
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('clientForm').addEventListener('submit', handleClientSave);
  document.getElementById('projectForm').addEventListener('submit', handleProjectSave);
  document.getElementById('userForm').addEventListener('submit', handleUserSave);
  document.getElementById('editUserForm').addEventListener('submit', handleEditUserSave);
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
    document.getElementById('settingsBtn').style.display = 'flex';
  }
  loadSettings();
  showSection('dashboard');
  loadDashboard();
}

// ===== Configuración de Empresa =====
async function loadSettings() {
  try {
    const settings = await API.getSettings();
    if (settings.company_name) {
      document.getElementById('loginCompanyName').textContent = settings.company_name;
      document.getElementById('sidebarCompanyName').textContent = settings.company_name;
      fitSidebarTitle();
    }
    if (settings.logo) {
      document.getElementById('loginLogo').src = settings.logo;
      document.getElementById('sidebarLogo').src = settings.logo;
    }
  } catch (e) {
    console.error('Error cargando configuración:', e);
  }
}

// Ajusta el tamaño de fuente del título del sidebar para que el nombre completo quepa sin puntos suspensivos
function fitSidebarTitle() {
  const el = document.getElementById('sidebarCompanyName');
  if (!el) return;
  // Reset a tamaño base
  el.style.fontSize = '20px';
  // Reducir progresivamente hasta que el texto quepa en una sola línea, con un mínimo legible
  // Si aún con el mínimo no cabe, se dejará que el texto envuelva (wrap) en varias líneas
  let size = 20;
  while (size > 12 && el.scrollWidth > el.clientWidth + 1) {
    size -= 1;
    el.style.fontSize = size + 'px';
  }
  // Guardar el tamaño actual para el ajuste responsivo
  el.dataset.fitSize = size;
}

// Re-ajusta el título al cambiar el tamaño de la ventana / al contraer el sidebar
function refitSidebarTitle() {
  const el = document.getElementById('sidebarCompanyName');
  if (!el) return;
  const current = el.textContent;
  if (current) {
    fitSidebarTitle();
  }
}

window.addEventListener('resize', refitSidebarTitle);

function openSettingsModal() {
  // Cargar valores actuales
  document.getElementById('settingsCompanyName').value = document.getElementById('sidebarCompanyName').textContent;
  const logo = document.getElementById('sidebarLogo').src;
  if (logo && logo !== 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🏢</text></svg>') {
    document.getElementById('settingsLogoPreview').src = logo;
  } else {
    document.getElementById('settingsLogoPreview').src = 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🏢</text></svg>';
  }
  openModal('settingsModal');
}

let pendingLogo = null;

function onLogoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    pendingLogo = e.target.result;
    document.getElementById('settingsLogoPreview').src = pendingLogo;
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  pendingLogo = null;
  document.getElementById('settingsLogoPreview').src = 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🏢</text></svg>';
}

async function saveSettings() {
  try {
    const companyName = document.getElementById('settingsCompanyName').value.trim();
    const data = {};
    if (companyName) {
      data.company_name = companyName;
    }
    if (pendingLogo) {
      data.logo = pendingLogo;
    }
    await API.updateSettings(data);
    showToast('Configuración guardada exitosamente', 'success');
    closeModal('settingsModal');
    loadSettings();
  } catch (error) {
    showToast(error.message, 'error');
  }
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
  if (section === 'users' && currentUser && currentUser.role !== 'admin') {
    showToast('Acceso denegado. Solo administradores.', 'error');
    section = 'dashboard';
  }
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

    // Make tasks card clickable
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(card => {
      const label = card.querySelector('.stat-label');
      if (label && label.textContent === 'Tareas Pendientes') {
        card.onclick = viewAllTasks;
      }
    });

    const activityEl = document.getElementById('recentActivity');
    if (stats.recentActivity.length === 0) {
      activityEl.innerHTML = '<p class="text-muted">Sin actividad reciente</p>';
    } else {
      activityEl.innerHTML = '<ul class="activity-list">' + stats.recentActivity.map(a => {
        const icons = { create: 'fa-plus', update: 'fa-edit', delete: 'fa-trash', login: 'fa-sign-in-alt' };
        const ic = a.action === 'create' ? 'create' : a.action === 'update' ? 'update' : a.action === 'delete' ? 'delete' : 'login';
        return '<li class="activity-item"><div class="activity-icon ' + ic + '"><i class="fas ' + (icons[a.action] || 'fa-circle') + '"></i></div><div class="activity-detail"><div class="activity-action">' + escapeHtml(a.description) + '</div><div class="activity-time">' + (a.user_name || 'Sistema') + ' &middot; ' + formatDate(a.created_at) + '</div></li>';
      }).join('') + '</ul>';
    }

    const statusEl = document.getElementById('projectsByStatus');
    const sLabels = { planning: 'Planificacion', in_progress: 'En Progreso', on_hold: 'En Pausa', completed: 'Completado', cancelled: 'Cancelado' };
    const colors = { planning: '#3b82f6', in_progress: '#10b981', on_hold: '#f59e0b', completed: '#6b7280', cancelled: '#ef4444' };
    if (stats.projectsByStatus.length === 0) {
      statusEl.innerHTML = '<p class="text-muted">Sin proyectos registrados</p>';
    } else {
      const total = stats.projectsByStatus.reduce((sum, s) => sum + s.count, 0);
      statusEl.innerHTML = stats.projectsByStatus.map(s => '<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px;"><span>' + (sLabels[s.status] || s.status) + '</span><span><strong>' + s.count + '</strong> (' + Math.round(s.count / total * 100) + '%)</span></div><div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + (s.count / total * 100) + '%;background:' + (colors[s.status] || '#3b82f6') + ';border-radius:4px;transition:width 0.3s;"></div></div>').join('');
    }
  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

// ===== View All Tasks =====
async function viewAllTasks() {
  try {
    document.getElementById('tasksModalBody').innerHTML = '<p class="text-muted">Cargando...</p>';
    openModal('tasksModal');
    const tasks = await API.getAllTasks();
    const tLabels = { pending: 'Pendiente', in_progress: 'En Progreso', completed: 'Completada', cancelled: 'Cancelada' };
    const pLabels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
    if (tasks.length === 0) {
      document.getElementById('tasksModalBody').innerHTML = '<p class="text-muted">No hay tareas registradas</p>';
      return;
    }
    document.getElementById('tasksModalBody').innerHTML = '<div class="table-container"><table class="table"><thead><tr><th>Tarea</th><th>Proyecto</th><th>Asignado</th><th>Estado</th><th>Prioridad</th><th>Vence</th></tr></thead><tbody>' + tasks.map(t => '<tr><td><strong>' + escapeHtml(t.title) + '</strong></td><td>' + (t.project_name || '<span class="text-muted">&mdash;</span>') + '</td><td>' + (t.assigned_name || '<span class="text-muted">&mdash;</span>') + '</td><td><span class="status-badge status-' + t.status + '">' + (tLabels[t.status] || t.status) + '</span></td><td><span class="status-badge priority-' + t.priority + '">' + (pLabels[t.priority] || t.priority) + '</span></td><td>' + (t.due_date || '<span class="text-muted">&mdash;</span>') + '</td></tr>').join('') + '</tbody></table></div>';
  } catch (error) {
    document.getElementById('tasksModalBody').innerHTML = '<p class="text-danger">Error: ' + error.message + '</p>';
    showToast('Error: ' + error.message, 'error');
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
    tbody.innerHTML = clients.map(c => '<tr><td><strong>' + escapeHtml(c.company_name) + '</strong></td><td>' + escapeHtml(c.contact_name) + '</td><td>' + (c.email ? '<a href="mailto:' + c.email + '">' + escapeHtml(c.email) + '</a>' : '<span class="text-muted">&mdash;</span>') + '</td><td>' + (c.phone || '<span class="text-muted">&mdash;</span>') + '</td><td><span class="status-badge status-' + c.status + '">' + statusLabel(c.status) + '</span></td><td><div class="action-btns"><button class="btn-view" onclick="editClient(' + c.id + ')" title="Editar"><i class="fas fa-edit"></i></button><button class="btn-delete" onclick="deleteClient(' + c.id + ')" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>').join('');
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
    tbody.innerHTML = projects.map(p => '<tr><td><strong>' + escapeHtml(p.name) + '</strong></td><td>' + (p.client_name || '<span class="text-muted">Sin cliente</span>') + '</td><td><span class="status-badge status-' + p.status + '">' + projectStatusLabel(p.status) + '</span></td><td><span class="status-badge priority-' + p.priority + '">' + priorityLabel(p.priority) + '</span></td><td>' + (p.start_date || '<span class="text-muted">&mdash;</span>') + '</td><td>' + (p.end_date || '<span class="text-muted">&mdash;</span>') + '</td><td><div class="action-btns"><button class="btn-view" onclick="viewProject(' + p.id + ')" title="Ver detalle"><i class="fas fa-eye"></i></button><button class="btn-edit" onclick="editProject(' + p.id + ')" title="Editar"><i class="fas fa-edit"></i></button><button class="btn-delete" onclick="deleteProject(' + p.id + ')" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>').join('');
  } catch (error) {
    document.getElementById('projectsBody').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error: ' + error.message + '</td></tr>';
  }
}

function searchProjects() {
  loadProjects(document.getElementById('projectSearch').value);
}

async function openProjectModal(projectData) {
  try {
    const [clients, users] = await Promise.all([
      API.getClients({ status: 'active' }),
      API.getAssignableUsers()
    ]);
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

// ===== Exportar Proyectos a Excel =====
function exportProjectsToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Error: la libreria de Excel no cargo correctamente', 'error');
    return;
  }
  if (!projectsCache || projectsCache.length === 0) {
    showToast('No hay proyectos para exportar', 'info');
    return;
  }

  const sLabels = { planning: 'Planificacion', in_progress: 'En Progreso', on_hold: 'En Pausa', completed: 'Completado', cancelled: 'Cancelado' };
  const pLabels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

  const rows = projectsCache.map(p => ({
    'Nombre': p.name,
    'Cliente': p.client_name || 'Sin cliente',
    'Estado': sLabels[p.status] || p.status,
    'Prioridad': pLabels[p.priority] || p.priority,
    'Fecha Inicio': p.start_date || '',
    'Fecha Fin': p.end_date || '',
    'Presupuesto ($)': p.budget ? Number(p.budget) : 0,
    'Asignado a': p.assigned_name || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Proyectos');

  const now = new Date();
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  XLSX.writeFile(wb, 'proyectos_' + dateStr + '.xlsx');

  showToast('Proyectos exportados a Excel', 'success');
}

// ===== View Project Detail (FIXED - proper HTML structure) =====
async function viewProject(id) {
  try {
    const project = await API.getProject(id);
    const sLabels = { planning: 'Planificacion', in_progress: 'En Progreso', on_hold: 'En Pausa', completed: 'Completado', cancelled: 'Cancelado' };
    const pLabels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
    const tLabels = { pending: 'Pendiente', in_progress: 'En Progreso', completed: 'Completada', cancelled: 'Cancelada' };

    var html = '';
    html += '<div class="project-detail">';
    html += '<div class="info-grid">';

    html += '<div class="info-item">';
    html += '<label>Estado</label>';
    html += '<div><span class="status-badge status-' + project.status + '">' + (sLabels[project.status] || project.status) + '</span></div>';
    html += '</div>';

    html += '<div class="info-item">';
    html += '<label>Prioridad</label>';
    html += '<div><span class="status-badge priority-' + project.priority + '">' + (pLabels[project.priority] || project.priority) + '</span></div>';
    html += '</div>';

    html += '<div class="info-item">';
    html += '<label>Cliente</label>';
    html += '<div>' + (project.client_name || 'Sin cliente') + '</div>';
    html += '</div>';

    html += '<div class="info-item">';
    html += '<label>Asignado a</label>';
    html += '<div>' + (project.assigned_name || 'Sin asignar') + '</div>';
    html += '</div>';

    html += '<div class="info-item">';
    html += '<label>Fecha Inicio</label>';
    html += '<div>' + (project.start_date || '&mdash;') + '</div>';
    html += '</div>';

    html += '<div class="info-item">';
    html += '<label>Fecha Fin</label>';
    html += '<div>' + (project.end_date || '&mdash;') + '</div>';
    html += '</div>';

    html += '<div class="info-item">';
    html += '<label>Presupuesto</label>';
html += '<div>$ ' + (project.budget ? project.budget.toFixed(2) : '0.00') + '</div>';
    html += '</div>';

    html += '<div class="info-item">';
    html += '<label>Creado por</label>';
    html += '<div>' + (project.creator_name || '&mdash;') + '</div>';
    html += '</div>';

    html += '</div>'; // close info-grid

    if (project.description) {
      html += '<h4 style="margin-top:20px;color:#475569;">Descripcion</h4>';
      html += '<p>' + escapeHtml(project.description) + '</p>';
    }

    html += '<h4 style="margin-top:20px;color:#475569;">Tareas (' + project.tasks.length + ')</h4>';
    html += '<div style="margin-bottom:15px;"><button class="btn btn-primary btn-sm" onclick="addTask(' + project.id + ')"><i class="fas fa-plus"></i> Agregar Tarea</button></div>';

    if (project.tasks.length === 0) {
      html += '<p class="text-muted">Sin tareas registradas</p>';
    } else {
      html += '<div class="task-list">';
      for (var i = 0; i < project.tasks.length; i++) {
        var t = project.tasks[i];
        html += '<div class="task-item">';
        html += '<div class="task-info">';
        html += '<div class="task-title">' + escapeHtml(t.title) + '</div>';
        html += '<div class="task-meta">';
        if (t.assigned_name) { html += 'Asignado: ' + escapeHtml(t.assigned_name) + ' &middot; '; }
        if (t.due_date) { html += 'Vence: ' + t.due_date + ' &middot; '; }
        html += '<span class="status-badge status-' + t.status + '">' + (tLabels[t.status] || t.status) + '</span>';
        html += '</div>'; // close task-meta
        html += '</div>'; // close task-info
        html += '<div class="action-btns">';
        if (t.status !== 'completed') {
          html += '<button class="btn-edit btn-sm" onclick="completeTask(' + t.id + ',' + project.id + ')" title="Completar"><i class="fas fa-check"></i></button>';
        }
        html += '<button class="btn-delete btn-sm" onclick="deleteTask(' + t.id + ',' + project.id + ')" title="Eliminar"><i class="fas fa-trash"></i></button>';
        html += '</div>'; // close action-btns
        html += '</div>'; // close task-item
      }
      html += '</div>'; // close task-list
    }

    html += '</div>'; // close project-detail

    document.getElementById('viewProjectTitle').textContent = '\uD83D\uDCCB ' + escapeHtml(project.name);
    document.getElementById('viewProjectBody').innerHTML = html;
    openModal('viewProjectModal');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// ===== Task Management =====
async function addTask(projectId) {
  var title = prompt('Nombre de la tarea:');
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
    tbody.innerHTML = users.map(function(u) {
      return '<tr><td><strong>' + escapeHtml(u.full_name) + '</strong></td><td>' + escapeHtml(u.email) + '</td><td>' + escapeHtml(u.username) + '</td><td><span class="status-badge ' + (u.role === 'admin' ? 'status-active' : 'status-in_progress') + '">' + (u.role === 'admin' ? 'Administrador' : 'Usuario') + '</span></td><td><span class="status-badge ' + (u.active ? 'status-active' : 'status-inactive') + '">' + (u.active ? 'Activo' : 'Inactivo') + '</span></td><td><div class="action-btns"><button class="btn-view" onclick="editUser(' + u.id + ')" title="Editar"><i class="fas fa-edit"></i></button><button class="btn-edit" onclick="deactivateUser(' + u.id + ')" title="' + (u.active ? 'Desactivar' : 'Activar') + '"><i class="fas ' + (u.active ? 'fa-ban' : 'fa-check') + '"></i></button><button class="btn-delete" onclick="deleteUser(' + u.id + ')" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>';
    }).join('');
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
  var data = {
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

// ===== User Management: Deactivate, Edit, Delete =====
async function deactivateUser(id) {
  var user = usersCache.find(function(u) { return u.id === id; });
  var action = user && user.active ? 'desactivar' : 'activar';
  if (!confirm('Esta seguro de ' + action + ' este usuario?')) return;
  try {
    var result = await API.toggleUserStatus(id);
    showToast(result.message, 'success');
    loadUsers();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function editUser(id) {
  var user = usersCache.find(function(u) { return u.id === id; });
  if (!user) return;
  document.getElementById('editUserId').value = user.id;
  document.getElementById('editUserFullName').value = user.full_name;
  document.getElementById('editUserUsername').value = user.username;
  document.getElementById('editUserEmail').value = user.email;
  document.getElementById('editUserPassword').value = '';
  document.getElementById('editUserRole').value = user.role;
  openModal('editUserModal');
}

async function handleEditUserSave(e) {
  e.preventDefault();
  var id = document.getElementById('editUserId').value;
  var data = {
    full_name: document.getElementById('editUserFullName').value,
    username: document.getElementById('editUserUsername').value,
    email: document.getElementById('editUserEmail').value,
    role: document.getElementById('editUserRole').value
  };
  var password = document.getElementById('editUserPassword').value;
  if (password) {
    data.password = password;
  }
  try {
    await API.updateUser(id, data);
    showToast('Usuario actualizado exitosamente', 'success');
    closeModal('editUserModal');
    loadUsers();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteUser(id) {
  if (!confirm('Esta seguro de eliminar este usuario? Esta accion no se puede deshacer.')) return;
  try {
    await API.deleteUser(id);
    showToast('Usuario eliminado exitosamente', 'success');
    loadUsers();
  } catch (error) {
    showToast(error.message, 'error');
  }
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
