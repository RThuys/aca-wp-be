const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Mark attendance
router.post('/', authMiddleware, (req, res) => {
  const { session_id, member_id, present, notes } = req.body;

  if (session_id === undefined || member_id === undefined || present === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    'INSERT OR REPLACE INTO attendance (session_id, member_id, present, notes) VALUES (?, ?, ?, ?)',
    [session_id, member_id, present ? 1 : 0, notes || null],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to mark attendance' });
      }
      res.json({ message: 'Attendance recorded' });
    }
  );
});

// Get attendance for a session
router.get('/session/:session_id', authMiddleware, (req, res) => {
  const { session_id } = req.params;

  db.all(
    `SELECT a.*, m.name, m.email FROM attendance a
     JOIN members m ON a.member_id = m.id
     WHERE a.session_id = ?`,
    [session_id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Get attendance report for member
router.get('/member/:member_id', authMiddleware, (req, res) => {
  const { member_id } = req.params;

  db.all(
    `SELECT a.*, ps.date, ps.title FROM attendance a
     JOIN practice_sessions ps ON a.session_id = ps.id
     WHERE a.member_id = ?
     ORDER BY ps.date DESC`,
    [member_id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
