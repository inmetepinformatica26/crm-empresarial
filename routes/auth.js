const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { generateToken, verifyToken } = require('../middleware/auth');

// Helper to get db helpers - must be called after database is initialized
function getDB() {
  return require('../database');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const { queryOne, run } = getDB();
    const user = await queryOne('SELECT * FROM users WHERE email = ? AND active = 1', [email]);

    if (!user) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = generateToken(user);

    await run(
      'INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [user.id, 'login', 'user', user.id, 'Inicio de sesion']
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/register
router.post('/register', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden crear usuarios' });
    }

    const { username, email, password, full_name, role } = req.body;
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    const { queryOne, run } = getDB();
    const existing = await queryOne('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await run(
      'INSERT INTO users (username, email, password, full_name, role) VALUES (?,?,?,?,?)',
      [username, email, hashedPassword, full_name, role || 'user']
    );

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: { id: result.lastInsertRowid, username, email, full_name, role: role || 'user' }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const { queryOne } = getDB();
    const user = await queryOne(
      'SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/users - admin only
router.get('/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    const { queryAll } = getDB();
    const users = await queryAll('SELECT id, username, email, full_name, role, active, created_at FROM users ORDER BY full_name');
    res.json(users);
  } catch (err) {
    console.error('Users error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/assignable - accessible by any authenticated user for project assignment
router.get('/assignable', verifyToken, async (req, res) => {
  try {
    const { queryAll } = getDB();
    const users = await queryAll('SELECT id, full_name FROM users WHERE active = 1 ORDER BY full_name');
    res.json(users);
  } catch (err) {
    console.error('Assignable users error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/auth/users/:id/toggle-status - admin only
router.put('/users/:id/toggle-status', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    const { run, queryOne } = getDB();
    const user = await queryOne('SELECT id, active FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const newStatus = user.active ? 0 : 1;
    await run('UPDATE users SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, req.params.id]);

    await run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'update', 'user', req.params.id, 'Usuario ' + (newStatus ? 'activado' : 'desactivado')]);

    res.json({ message: 'Usuario ' + (newStatus ? 'activado' : 'desactivado') + ' exitosamente', active: newStatus });
  } catch (err) {
    console.error('Toggle user status error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/auth/users/:id - admin only (editar usuario)
router.put('/users/:id', verifyToken, async (req, res) => {
  try {
if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { run, queryOne } = getDB();
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { username, email, password, full_name, role } = req.body;

    // Check if username or email already taken by another user
    if (username || email) {
      const existing = await queryOne('SELECT id FROM users WHERE (email = ? OR username = ?) AND id != ?',
        [email || user.email, username || user.username, req.params.id]);
      if (existing) {
        return res.status(400).json({ error: 'El usuario o email ya existe' });
      }
    }

    let updateSql = 'UPDATE users SET full_name=?, email=?, username=?, role=?, updated_at=CURRENT_TIMESTAMP';
    const params = [full_name || user.full_name, email || user.email, username || user.username, role || user.role];

    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      updateSql += ', password=?';
      params.push(hashedPassword);
    }

    updateSql += ' WHERE id=?';
    params.push(req.params.id);

    await run(updateSql, params);

    await run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'update', 'user', req.params.id, 'Usuario actualizado: ' + (full_name || user.full_name)]);

    const updated = await queryOne('SELECT id, username, email, full_name, role, active, created_at FROM users WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/auth/users/:id - admin only
router.delete('/users/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { run, queryOne } = getDB();
const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }

    // Limpiar registros dependientes para evitar violación de clave foránea
    await run('DELETE FROM activity_log WHERE user_id = ?', [req.params.id]);
    await run('UPDATE clients SET created_by = NULL WHERE created_by = ?', [req.params.id]);
    await run('UPDATE projects SET created_by = NULL WHERE created_by = ?', [req.params.id]);
    await run('UPDATE projects SET assigned_to = NULL WHERE assigned_to = ?', [req.params.id]);
    await run('UPDATE tasks SET created_by = NULL WHERE created_by = ?', [req.params.id]);
    await run('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?', [req.params.id]);

    await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    await run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'delete', 'user', req.params.id, 'Usuario eliminado: ' + user.full_name]);

    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
