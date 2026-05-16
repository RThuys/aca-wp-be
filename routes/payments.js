const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const query = `
    SELECT p.id, p.member_id, p.date, p.amount, p.created_at,
           m.name AS member_name
    FROM payments p
    JOIN members m ON p.member_id = m.id
    ORDER BY p.date DESC, p.created_at DESC
  `;

  db.all(query, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/', authMiddleware, (req, res) => {
  const { member_id, date, amount } = req.body;

  if (!member_id || !date) {
    return res.status(400).json({ error: 'Member and date are required' });
  }

  db.get('SELECT id FROM members WHERE id = ?', [member_id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Member not found' });
    }

    db.run(
      'INSERT INTO payments (member_id, date, amount) VALUES (?, ?, ?)',
      [member_id, date, amount || 0],
      function (insertErr) {
        if (insertErr) {
          return res.status(500).json({ error: 'Failed to save payment' });
        }
        res.json({ id: this.lastID, member_id, date, amount: amount || 0 });
      }
    );
  });
});

module.exports = router;
