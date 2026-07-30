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
    const user = queryOne('SELECT * FROM users WHERE email = ? AND active = 1', [email]);

    if (!user) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = generateToken(user);

    run(
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
    const existing = queryOne('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = run(
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
    const user = queryOne(
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

// GET /api/auth/users
router.get('/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    const { queryAll } = getDB();
    const users = queryAll('SELECT id, username, email, full_name, role, active, created_at FROM users ORDER BY full_name');
    res.json(users);
  } catch (err) {
    console.error('Users error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
