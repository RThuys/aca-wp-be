// const sqlite3 = require('sqlite3').verbose();
// const path = require('path');
const createClient = require('@libsql/client').createClient;

// const dbPath = path.join(__dirname, 'attendance.db');
// const db = new sqlite3.Database(dbPath, (err) => {
//   if (err) {
//     console.error('Error opening database:', err);
//   } else {
//     console.log('Connected to SQLite database');
//     initializeDatabase();
//   }
// });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function initializeDatabase() {
  db.serialize(() => {
    // Users table (coaches/admins)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Members table
    db.run(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        tpf INTEGER DEFAULT 0,
        bestuur INTEGER DEFAULT 0,
        trainer INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      UPDATE members SET tpf = 0 WHERE tpf IS NULL;
    `);

    db.run(`
      UPDATE members SET bestuur = 0 WHERE bestuur IS NULL;
    `);

    // add is_tryout column if it doesn't exist
    db.run(`
      ALTER TABLE members ADD COLUMN is_tryout INTEGER DEFAULT 0;
    `, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding is_tryout column:', err);
      }
    }
    );

    // add trainer column if it doesn't exist
    db.run(`
      ALTER TABLE members ADD COLUMN trainer INTEGER DEFAULT 0;
    `, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding trainer column:', err);
      }
    }
    );

    // Practice sessions
    db.run(`
      CREATE TABLE IF NOT EXISTS practice_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        created_by INTEGER NOT NULL,
        trainer_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (trainer_id) REFERENCES users(id)
      )
    `);

    // Session trainers (many-to-many)
    db.run(`
      CREATE TABLE IF NOT EXISTS session_trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES practice_sessions(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(session_id, user_id)
      )
    `);

    // Add trainer_id column if it doesn't exist (for existing databases)
    db.run(`
      ALTER TABLE practice_sessions ADD COLUMN trainer_id INTEGER REFERENCES users(id)
    `, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding trainer_id column:', err);
      }
    });

    // Attendance records
    db.run(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        present INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES practice_sessions(id),
        FOREIGN KEY (member_id) REFERENCES members(id),
        UNIQUE(session_id, member_id)
      )
    `);

    // Payments records
    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        date DATE NOT NULL,
        amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id)
      )
    `);
  });
}

module.exports = db;
