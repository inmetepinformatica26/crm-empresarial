const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

function getDB() {
  return require('../database');
}

// GET /api/clients
router.get('/', verifyToken, async (req, res) => {
  try {
    const { queryAll } = getDB();
    const { search, status } = req.query;

    let sql = 'SELECT c.*, u.full_name as created_by_name, (SELECT COUNT(*) FROM projects WHERE client_id = c.id) as project_count FROM clients c LEFT JOIN users u ON c.created_by = u.id WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (c.company_name LIKE ? OR c.contact_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
      const term = '%' + search + '%';
      params.push(term, term, term, term);
    }
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY c.created_at DESC';

    const clients = queryAll(sql, params);
    res.json(clients);
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/clients/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { queryOne, queryAll } = getDB();
    const client = queryOne('SELECT c.*, u.full_name as created_by_name FROM clients c LEFT JOIN users u ON c.created_by = u.id WHERE c.id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    client.projects = queryAll('SELECT id, name, status, priority, start_date, end_date FROM projects WHERE client_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(client);
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/clients
router.post('/', verifyToken, async (req, res) => {
  try {
    const { company_name, contact_name, email, phone, address, city, country, tax_id, notes, status } = req.body;
    if (!company_name || !contact_name) {
      return res.status(400).json({ error: 'Nombre de empresa y contacto son requeridos' });
    }

    const { run, queryOne } = getDB();
    const result = run(
      'INSERT INTO clients (company_name, contact_name, email, phone, address, city, country, tax_id, notes, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [company_name, contact_name, email || null, phone || null, address || null, city || null, country || 'Peru', tax_id || null, notes || null, status || 'active', req.user.id]
    );

    run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'create', 'client', result.lastInsertRowid, 'Cliente creado: ' + company_name]);

    const client = queryOne('SELECT * FROM clients WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(client);
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/clients/:id
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { run, queryOne } = getDB();
    const existing = queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { company_name, contact_name, email, phone, address, city, country, tax_id, notes, status } = req.body;

    run('UPDATE clients SET company_name=?, contact_name=?, email=?, phone=?, address=?, city=?, country=?, tax_id=?, notes=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [
        company_name || existing.company_name,
        contact_name || existing.contact_name,
        email !== undefined ? email : existing.email,
        phone !== undefined ? phone : existing.phone,
        address !== undefined ? address : existing.address,
        city !== undefined ? city : existing.city,
        country || existing.country,
        tax_id !== undefined ? tax_id : existing.tax_id,
        notes !== undefined ? notes : existing.notes,
        status || existing.status,
        req.params.id
      ]);

    run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'update', 'client', req.params.id, 'Cliente actualizado: ' + (company_name || existing.company_name)]);

    const client = queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json(client);
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { run, queryOne } = getDB();
    const existing = queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });

    run('DELETE FROM clients WHERE id = ?', [req.params.id]);
    run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, description) VALUES (?,?,?,?,?)',
      [req.user.id, 'delete', 'client', req.params.id, 'Cliente eliminado: ' + existing.company_name]);

    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (err) {
    console.error('Delete client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
