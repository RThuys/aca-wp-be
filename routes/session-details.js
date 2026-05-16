// Get all participations for a session
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM practice_sessions WHERE id = ?', [id], (err, session) => {
    if (err || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get attendance for this session
    db.all(
      `SELECT a.*, m.name, m.email, m.tpf, m.bestuur FROM attendance a
       JOIN members m ON a.member_id = m.id
       WHERE a.session_id = ?`,
      [id],
      (err, attendance) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ ...session, attendance });
      }
    );
  });
});