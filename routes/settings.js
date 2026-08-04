const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// Helper to get db helpers - must be called after database is initialized
function getDB() {
  return require('../database');
}

// GET /api/settings - get company settings (logo + name)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { queryAll } = getDB();
    const rows = queryAll('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    res.json({
      company_name: settings.company_name || 'CRM Empresarial',
      logo: settings.logo || null
    });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/settings - update company settings (admin only)
router.put('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden modificar estos ajustes' });
    }

    const { run, queryOne } = getDB();
    const { company_name, logo } = req.body;

    if (company_name !== undefined) {
      const existing = queryOne('SELECT setting_key FROM settings WHERE setting_key = ?', ['company_name']);
      if (existing) {
        run('UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?', [company_name, 'company_name']);
      } else {
        run('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', ['company_name', company_name]);
      }
    }

    if (logo !== undefined) {
      const existing = queryOne('SELECT setting_key FROM settings WHERE setting_key = ?', ['logo']);
      if (existing) {
        run('UPDATE settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?', [logo, 'logo']);
      } else {
        run('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', ['logo', logo]);
      }
    }

    run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'update', 'settings', null, 'Configuración de empresa actualizada']);

    res.json({ message: 'Configuración guardada exitosamente' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
