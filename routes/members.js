const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all members
router.get('/', authMiddleware, (req, res) => {
  db.all('SELECT * FROM members', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get all trainers (users)
router.get('/trainers', authMiddleware, (req, res) => {
  db.all('SELECT id, name FROM members where trainer = 1', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get member by ID
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM members WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(row);
  });
});


// Add member
router.post('/', authMiddleware, (req, res) => {
  const { name, email, tpf, bestuur, is_tryout } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  db.run(
    'INSERT INTO members (name, email, tpf, bestuur, is_tryout) VALUES (?, ?, ?, ?, ?)',
    [name, email || null, tpf || 0, bestuur || 0, is_tryout || 0],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to add member' });
      }
      res.json({ id: this.lastID, name, email, tpf: tpf || 0, bestuur: bestuur || 0, is_tryout: is_tryout || 0 });
    }
  );
});

// Get member trainers 
router.get('/:id/trainers', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.all(
    `SELECT u.id, u.name 
     FROM users u
     JOIN practice_sessions ps ON ps.trainer_id = u.id
     JOIN attendance a ON a.session_id = ps.id
     WHERE a.member_id = ? AND ps.trainer_id IS NOT NULL`,
    [id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Update member
router.put('/:id', authMiddleware, (req, res) => {
  const { name, email, tpf, bestuur, trainer } = req.body;
  const { id } = req.params;

  db.run(
    'UPDATE members SET name = ?, email = ?, tpf = ?, bestuur = ?, trainer = ? WHERE id = ?',
    [name, email || null, tpf || 0, bestuur || 0, trainer || 0, id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update member' });
      }
      res.json({ message: 'Member updated' });
    }
  );
});

// Delete member
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM members WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete member' });
    }
    res.json({ message: 'Member deleted' });
  });
});

module.exports = router;
