const express = require('express');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all practice sessions
router.get('/', authMiddleware, (req, res) => {
  db.all(
    'SELECT * FROM practice_sessions ORDER BY date DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Create practice session
router.post('/', authMiddleware, (req, res) => {
  const { date, title, description, trainer_id } = req.body;
  const userId = req.user.id;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  db.run(
    'INSERT INTO practice_sessions (date, title, description, created_by, trainer_id) VALUES (?, ?, ?, ?, ?)',
    [date, title || date.toString(), description || null, userId, trainer_id || null],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create session' });
      }
      res.json({ id: this.lastID, date, title, description, created_by: userId, trainer_id });
    }
  );
});

// Get all trainers (users) - must come before /:id route
router.get('/trainers/list', authMiddleware, (req, res) => {
  db.all('SELECT id, name FROM users', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get session with attendance and trainer info
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT 
      ps.id, 
      ps.date, 
      ps.title, 
      ps.description, 
      ps.created_by, 
      ps.trainer_id,
      ps.created_at
    FROM practice_sessions ps 
    WHERE ps.id = ?`,
    [id],
    (err, session) => {
      if (err) {
        console.error('Error fetching session:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get trainers for this session
      db.all(
        `SELECT u.id, u.name FROM session_trainers st
         JOIN users u ON st.user_id = u.id
         WHERE st.session_id = ?`,
        [id],
        (err, trainers) => {
          if (err) {
            console.error('Error fetching trainers:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          // Get attendance for this session
          db.all(
            `SELECT a.*, m.name, m.email, m.tpf, m.bestuur FROM attendance a
             JOIN members m ON a.member_id = m.id
             WHERE a.session_id = ?`,
            [id],
            (err, attendance) => {
              if (err) {
                console.error('Error fetching attendance:', err);
                return res.status(500).json({ error: 'Database error' });
              }

              // Get tryouts (members marked as tryout)
              db.all(
                `SELECT m.* FROM members m
                 WHERE m.is_tryout = 1`,
                (err, tryouts) => {
                  if (err) {
                    console.error('Error fetching tryouts:', err);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  res.json({ ...session, trainers: trainers || [], attendance, tryouts: tryouts || [], tryout_count: (tryouts || []).length });
                }
              );
            }
          );
        }
      );
    }
  );
});

// Delete session
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM practice_sessions WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete session' });
    }
    res.json({ message: 'Session deleted' });
  });
});

// Add trainer to session
router.post('/:id/trainers', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  db.run(
    'UPDATE practice_sessions SET trainer_id = ? WHERE id = ?',
    [user_id, id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to add trainer' });
      }
      res.json({ message: 'Trainer added' });
    }
  )
});

// Remove trainer from session
router.post('/:id/trainers/remove', authMiddleware, (req, res) => {
  const { id, user_id } = req.params;

  db.run(
    'UPDATE practice_sessions SET trainer_id = NULL WHERE id = ?',
    [id, user_id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to remove trainer' });
      }
      res.json({ message: 'Trainer removed' });
    }
  );
});

module.exports = router;
