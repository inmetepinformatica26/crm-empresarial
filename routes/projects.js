const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

function getDB() {
  return require('../database');
}

// GET /api/projects
router.get('/', verifyToken, async (req, res) => {
  try {
    const { queryAll } = getDB();
    const { search, status, client_id } = req.query;

    let sql = 'SELECT p.*, c.company_name as client_name, u.full_name as assigned_name FROM projects p LEFT JOIN clients c ON p.client_id = c.id LEFT JOIN users u ON p.assigned_to = u.id WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const term = '%' + search + '%';
      params.push(term, term);
    }
    if (status) {
      sql += ' AND p.status = ?';
      params.push(status);
    }
    if (client_id) {
      sql += ' AND p.client_id = ?';
      params.push(client_id);
    }
    sql += ' ORDER BY p.created_at DESC';

    const projects = queryAll(sql, params);
    res.json(projects);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/projects/dashboard/stats
router.get('/dashboard/stats', verifyToken, async (req, res) => {
  try {
    const { queryAll, queryOne } = getDB();

    const totalClients = queryOne('SELECT COUNT(*) as count FROM clients').count;
    const activeClients = queryOne("SELECT COUNT(*) as count FROM clients WHERE status='active'").count;
    const totalProjects = queryOne('SELECT COUNT(*) as count FROM projects').count;
    const activeProjects = queryOne("SELECT COUNT(*) as count FROM projects WHERE status NOT IN ('completed','cancelled')").count;
    const totalTasks = queryOne('SELECT COUNT(*) as count FROM tasks').count;
    const pendingTasks = queryOne("SELECT COUNT(*) as count FROM tasks WHERE status IN ('pending','in_progress')").count;
    const totalUsers = queryOne('SELECT COUNT(*) as count FROM users WHERE active=1').count;

    const recentActivity = queryAll('SELECT a.*, u.full_name as user_name FROM activity_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 10');
    const projectsByStatus = queryAll('SELECT status, COUNT(*) as count FROM projects GROUP BY status');
    const clientsByStatus = queryAll('SELECT status, COUNT(*) as count FROM clients GROUP BY status');

    res.json({
      totalClients, activeClients, totalProjects, activeProjects,
      totalTasks, pendingTasks, totalUsers,
      recentActivity, projectsByStatus, clientsByStatus
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/projects/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { queryOne, queryAll } = getDB();
    const project = queryOne('SELECT p.*, c.company_name as client_name, c.contact_name as client_contact, u.full_name as assigned_name, cr.full_name as creator_name FROM projects p LEFT JOIN clients c ON p.client_id = c.id LEFT JOIN users u ON p.assigned_to = u.id LEFT JOIN users cr ON p.created_by = cr.id WHERE p.id = ?', [req.params.id]);

    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    project.tasks = queryAll('SELECT t.*, u.full_name as assigned_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.project_id = ? ORDER BY t.created_at DESC', [req.params.id]);
    res.json(project);
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/projects
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, client_id, status, priority, start_date, end_date, budget, assigned_to } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre del proyecto es requerido' });

    const { run, queryOne } = getDB();
    const result = run(
      'INSERT INTO projects (name, description, client_id, status, priority, start_date, end_date, budget, created_by, assigned_to) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name, description || null, client_id || null, status || 'planning', priority || 'medium', start_date || null, end_date || null, budget || 0, req.user.id, assigned_to || null]
    );

    run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'create', 'project', result.lastInsertRowid, 'Proyecto creado: ' + name]);

    const project = queryOne('SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(project);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/projects/:id
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { run, queryOne } = getDB();
    const existing = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const { name, description, client_id, status, priority, start_date, end_date, budget, assigned_to } = req.body;

    run('UPDATE projects SET name=?, description=?, client_id=?, status=?, priority=?, start_date=?, end_date=?, budget=?, assigned_to=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [
        name || existing.name,
        description !== undefined ? description : existing.description,
        client_id !== undefined ? client_id : existing.client_id,
        status || existing.status, priority || existing.priority,
        start_date !== undefined ? start_date : existing.start_date,
        end_date !== undefined ? end_date : existing.end_date,
        budget !== undefined ? budget : existing.budget,
        assigned_to !== undefined ? assigned_to : existing.assigned_to,
        req.params.id
      ]);

    run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'update', 'project', req.params.id, 'Proyecto actualizado: ' + (name || existing.name)]);

    const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(project);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { run, queryOne } = getDB();
    const existing = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Proyecto no encontrado' });

    run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'delete', 'project', req.params.id, 'Proyecto eliminado: ' + existing.name]);

    res.json({ message: 'Proyecto eliminado exitosamente' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/projects/:id/tasks
router.post('/:id/tasks', verifyToken, async (req, res) => {
  try {
    const { title, description, assigned_to, priority, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'El titulo de la tarea es requerido' });

    const { run, queryOne } = getDB();
    const result = run(
      'INSERT INTO tasks (title, description, project_id, assigned_to, priority, due_date, created_by) VALUES (?,?,?,?,?,?,?)',
      [title, description || null, req.params.id, assigned_to || null, priority || 'medium', due_date || null, req.user.id]
    );

    run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'create', 'task', result.lastInsertRowid, 'Tarea creada: ' + title]);

    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/projects/tasks/:id
router.put('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const { run, queryOne } = getDB();
    const existing = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Tarea no encontrada' });

    const { title, description, status, priority, assigned_to, due_date } = req.body;

    run('UPDATE tasks SET title=?, description=?, status=?, priority=?, assigned_to=?, due_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [
        title || existing.title,
        description !== undefined ? description : existing.description,
        status || existing.status, priority || existing.priority,
        assigned_to !== undefined ? assigned_to : existing.assigned_to,
        due_date !== undefined ? due_date : existing.due_date,
        req.params.id
      ]);

    const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(task);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/projects/tasks/:id
router.delete('/tasks/:id', verifyToken, async (req, res) => {
  try {
    const { run, queryOne } = getDB();
    const existing = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Tarea no encontrada' });

    run('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tarea eliminada exitosamente' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
