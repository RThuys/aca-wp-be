const createClient = require('@libsql/client').createClient;

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in environment');
}

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

// Test connection on startup
client.execute('SELECT 1')
  .then(() => console.log('✓ Turso database connected successfully'))
  .catch(err => console.error('✗ Turso connection failed:', err.message));

function normalizeParams(params) {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params;
  return [params];
}

const db = {
  async execute(sql, params = []) {
    return client.execute(sql, normalizeParams(params));
  },

  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    const promise = client.execute(sql, normalizeParams(params))
      .then((result) => {
        if (callback) {
          callback.call(
            {
              lastID: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined,
              changes: Number(result.rowsAffected ?? 0),
            },
            null,
            result
          );
        }

        return result;
      })
      .catch((err) => {
        if (callback) {
          callback(err);
          return;
        }
        throw err;
      });

    return promise;
  },

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    const promise = client.execute(sql, normalizeParams(params))
      .then((result) => {
        const rows = result.rows || [];
        if (callback) {
          callback(null, rows);
        }
        return rows;
      })
      .catch((err) => {
        if (callback) {
          callback(err);
          return;
        }
        throw err;
      });

    return promise;
  },

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    const promise = client.execute(sql, normalizeParams(params))
      .then((result) => {
        const rows = result.rows || [];
        const row = rows.length > 0 ? rows[0] : undefined;
        if (callback) {
          callback(null, row);
        }
        return row;
      })
      .catch((err) => {
        if (callback) {
          callback(err);
          return;
        }
        throw err;
      });

    return promise;
  },

  serialize(fn) {
    return fn();
  },
};

async function initializeDatabase() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
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

  await db.run(`
    UPDATE members SET tpf = 0 WHERE tpf IS NULL;
  `);

  await db.run(`
    UPDATE members SET bestuur = 0 WHERE bestuur IS NULL;
  `);

  try {
    await db.run(`ALTER TABLE members ADD COLUMN is_tryout INTEGER DEFAULT 0`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      console.error('Error adding is_tryout column:', err);
    }
  }

  try {
    await db.run(`ALTER TABLE members ADD COLUMN trainer INTEGER DEFAULT 0`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      console.error('Error adding trainer column:', err);
    }
  }

  await db.run(`
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

  await db.run(`
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

  try {
    await db.run(`ALTER TABLE practice_sessions ADD COLUMN trainer_id INTEGER REFERENCES users(id)`);
  } catch (err) {
    if (!err.message.includes('duplicate column')) {
      console.error('Error adding trainer_id column:', err);
    }
  }

  await db.run(`
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

  await db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      date DATE NOT NULL,
      amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `);

  console.log('Connected to Turso database and ensured schema exists');
}

initializeDatabase().catch((err) => {
  console.error('Database initialization error:', err);
});

module.exports = db;
