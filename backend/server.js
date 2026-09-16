const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const session = require("express-session");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "pos-system-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 12
  }
}));

const PORT = 5000;

let isReconnecting = false;

function createDbConnection() {
  const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  connection.on('error', (error) => {
    if (error && (error.code === 'PROTOCOL_CONNECTION_LOST' || error.fatal)) {
      if (isReconnecting) return;
      isReconnecting = true;
      console.error('Database connection lost. Reconnecting to MySQL...');
      setTimeout(() => {
        if (db && db.state !== 'disconnected') {
          db.destroy();
        }

        db = createDbConnection();
        db.connect((connectError) => {
          isReconnecting = false;
          if (connectError) {
            console.error('MySQL reconnect failed:', connectError.message);
            return;
          }

          console.log('MySQL reconnected successfully!');
          initializeDatabaseSchema();
        });
      }, 1000);
      return;
    }

    console.error('Unhandled MySQL error:', error.message);
  });

  return connection;
}

let db = createDbConnection();

function initializeDatabaseSchema() {
  const createCustomersTable = `
    CREATE TABLE IF NOT EXISTS customers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(150),
      address VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  db.query(createCustomersTable, (err) => {
    if (err) {
      console.error('Error ensuring customers table exists:', err.message);
      return;
    }

    db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS address VARCHAR(255)", (addAddrErr) => {
      if (addAddrErr) {
        console.error('Error ensuring customers.address column exists:', addAddrErr.message);
      }
    });

    db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT", (addNotesErr) => {
      if (addNotesErr) {
        console.error('Error ensuring customers.notes column exists:', addNotesErr.message);
      }
    });
  });

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      full_name VARCHAR(100) NOT NULL,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(150) NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'cashier') NOT NULL DEFAULT 'cashier',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  db.query(createUsersTable, (userTableErr) => {
    if (userTableErr) {
      console.error('Error ensuring users table exists:', userTableErr.message);
      return;
    }

    db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)", (addNameErr) => {
      if (addNameErr) {
        console.error('Error ensuring users.full_name column exists:', addNameErr.message);
      }
    });
    db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50)", (addUserErr) => {
      if (addUserErr) {
        console.error('Error ensuring users.username column exists:', addUserErr.message);
      }
    });
    db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150)", (addEmailErr) => {
      if (addEmailErr) {
        console.error('Error ensuring users.email column exists:', addEmailErr.message);
      }
    });
    db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)", (addHashErr) => {
      if (addHashErr) {
        console.error('Error ensuring users.password_hash column exists:', addHashErr.message);
      }
    });
    db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('admin', 'cashier') NOT NULL DEFAULT 'cashier'", (addRoleErr) => {
      if (addRoleErr) {
        console.error('Error ensuring users.role column exists:', addRoleErr.message);
      }
    });
    db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1", (addActiveErr) => {
      if (addActiveErr) {
        console.error('Error ensuring users.is_active column exists:', addActiveErr.message);
      }
    });
  });

  db.query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id INT NULL", (saleUserErr) => {
    if (saleUserErr) {
      console.error('Error ensuring sales.user_id column exists:', saleUserErr.message);
    }
  });

  const createSettingsTable = `
    CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  db.query(createSettingsTable, (tableErr) => {
    if (tableErr) {
      console.error('Error ensuring settings table exists:', tableErr.message);
      return;
    }

    db.query('SELECT COUNT(*) AS total FROM settings', (countErr, rows) => {
      if (countErr) {
        console.error('Error checking settings rows:', countErr.message);
        return;
      }

      const total = Number(rows[0]?.total || 0);
      if (total > 0) return;

      const defaultSettings = [
        ['storeName', 'My POS Store'],
        ['storeAddress', ''],
        ['storePhone', ''],
        ['storeEmail', ''],
        ['currency', 'LKR'],
        ['taxEnabled', 'false'],
        ['taxRate', '0'],
        ['defaultPaymentMethod', 'Cash'],
        ['allowNegativeStock', 'false'],
        ['lowStockThreshold', '10'],
        ['receiptShowStoreInfo', 'true'],
        ['receiptShowDateTime', 'true'],
        ['receiptShowCashier', 'false'],
        ['receiptFooter', 'Thank you for your purchase!']
      ];

      const insertSql = `
        INSERT INTO settings (setting_key, setting_value, updated_at)
        VALUES ?
      `;

      const values = defaultSettings.map(([key, value]) => [key, value, new Date()]);
      db.query(insertSql, [values], (insertErr) => {
        if (insertErr) {
          console.error('Error seeding default settings:', insertErr.message);
        }
      });
    });
  });
}

db.connect((error) => {
  if (error) {
    console.error("Database connection failed:", error.message);
    return;
  }

  console.log("MySQL connected successfully!");
  initializeDatabaseSchema();
});

const defaultSettings = {
  storeName: 'My POS Store',
  storeAddress: '',
  storePhone: '',
  storeEmail: '',
  currency: 'LKR',
  taxEnabled: false,
  taxRate: 0,
  defaultPaymentMethod: 'Cash',
  allowNegativeStock: false,
  lowStockThreshold: 10,
  receiptShowStoreInfo: true,
  receiptShowDateTime: true,
  receiptShowCashier: false,
  receiptFooter: 'Thank you for your purchase!'
};

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return Boolean(value);
}

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getSessionUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!user.is_active) {
    req.session.destroy(() => {});
    return res.status(403).json({ error: 'Your account is inactive.' });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  if (!user.is_active) {
    req.session.destroy(() => {});
    return res.status(403).json({ error: 'Your account is inactive.' });
  }

  req.user = user;
  next();
}

function buildSafeUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    full_name: row.full_name || row.username || 'User',
    username: row.username,
    email: row.email || null,
    role: row.role || 'cashier',
    is_active: Boolean(Number(row.is_active ?? 1)),
    created_at: row.created_at || null,
  };
}

function getUserStatusBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  if (value === 0 || value === '0') return false;
  return Boolean(value ?? fallback);
}

function normalizeUserEmail(value) {
  const email = typeof value === 'string' ? value.trim() : '';
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  return email;
}

function normalizeUserPayload(input = {}, { requirePassword = false } = {}) {
  const fullName = String(input.full_name ?? input.fullName ?? '').trim();
  const username = String(input.username ?? '').trim();
  const email = normalizeUserEmail(input.email ?? '');
  const role = String(input.role ?? 'cashier');
  const password = typeof input.password === 'string' ? input.password : '';
  const isActive = getUserStatusBoolean(input.is_active ?? input.isActive ?? true, true);

  if (!fullName) {
    throw new Error('Full name is required.');
  }

  if (!username) {
    throw new Error('Username is required.');
  }

  if (!['admin', 'cashier'].includes(role)) {
    throw new Error('Role must be admin or cashier.');
  }

  if (requirePassword && !password) {
    throw new Error('Password is required.');
  }

  return {
    fullName,
    username,
    email,
    role,
    password,
    isActive,
  };
}

function normalizeSettings(payload = {}) {
  const input = payload || {};
  const normalized = { ...defaultSettings };

  normalized.storeName = typeof input.storeName === 'string' ? input.storeName.trim() : defaultSettings.storeName;
  if (!normalized.storeName) {
    throw new Error('Store name is required.');
  }

  normalized.storeAddress = typeof input.storeAddress === 'string' ? input.storeAddress.trim() : '';
  normalized.storePhone = typeof input.storePhone === 'string' ? input.storePhone.trim() : '';
  normalized.storeEmail = typeof input.storeEmail === 'string' ? input.storeEmail.trim() : '';

  const validCurrencies = ['LKR', 'USD', 'EUR', 'GBP', 'AUD'];
  const currencyValue = typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : defaultSettings.currency;
  normalized.currency = validCurrencies.includes(currencyValue) ? currencyValue : defaultSettings.currency;

  normalized.taxEnabled = parseBoolean(input.taxEnabled ?? defaultSettings.taxEnabled);
  normalized.taxRate = toSafeNumber(input.taxRate, defaultSettings.taxRate);
  if (normalized.taxRate < 0) {
    throw new Error('Tax rate cannot be negative.');
  }

  normalized.defaultPaymentMethod = ['Cash', 'Card', 'Other'].includes(input.defaultPaymentMethod) ? input.defaultPaymentMethod : defaultSettings.defaultPaymentMethod;
  normalized.allowNegativeStock = parseBoolean(input.allowNegativeStock ?? defaultSettings.allowNegativeStock);
  normalized.lowStockThreshold = Number.isInteger(Number(input.lowStockThreshold)) ? Number(input.lowStockThreshold) : defaultSettings.lowStockThreshold;
  if (normalized.lowStockThreshold < 0) {
    throw new Error('Low-stock threshold cannot be negative.');
  }

  normalized.receiptShowStoreInfo = parseBoolean(input.receiptShowStoreInfo ?? defaultSettings.receiptShowStoreInfo);
  normalized.receiptShowDateTime = parseBoolean(input.receiptShowDateTime ?? defaultSettings.receiptShowDateTime);
  normalized.receiptShowCashier = parseBoolean(input.receiptShowCashier ?? defaultSettings.receiptShowCashier);
  normalized.receiptFooter = typeof input.receiptFooter === 'string' ? input.receiptFooter.trim() || defaultSettings.receiptFooter : defaultSettings.receiptFooter;

  return normalized;
}

function getSettingsObject(rows = []) {
  const loaded = { ...defaultSettings };

  rows.forEach((row) => {
    const key = row.setting_key;
    if (!Object.prototype.hasOwnProperty.call(loaded, key)) return;

    const value = row.setting_value;

    if (['taxEnabled', 'allowNegativeStock', 'receiptShowStoreInfo', 'receiptShowDateTime', 'receiptShowCashier'].includes(key)) {
      loaded[key] = parseBoolean(value);
      return;
    }

    if (['taxRate', 'lowStockThreshold'].includes(key)) {
      loaded[key] = Number(value);
      return;
    }

    loaded[key] = value;
  });

  return loaded;
}

app.get('/api/auth/setup-status', (req, res) => {
  db.query('SELECT COUNT(*) AS total FROM users', (err, rows) => {
    if (err) {
      console.error('Error checking auth setup status:', err.message);
      return res.status(500).json({ error: 'Failed to check auth setup status' });
    }

    const hasUsers = Number(rows[0]?.total || 0) > 0;
    res.json({ hasUsers, requireFirstAdmin: !hasUsers });
  });
});

app.get('/api/auth/session', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.json({ authenticated: false, user: null });
  }

  db.query('SELECT id, full_name, username, email, role, is_active FROM users WHERE id = ? LIMIT 1', [user.id], (err, rows) => {
    if (err) {
      console.error('Error validating session user:', err.message);
      return res.status(500).json({ error: 'Failed to validate session' });
    }

    if (!rows.length) {
      req.session.destroy(() => {});
      return res.json({ authenticated: false, user: null });
    }

    const activeUser = buildSafeUser(rows[0]);
    if (!activeUser || !activeUser.is_active) {
      req.session.destroy(() => {});
      return res.json({ authenticated: false, user: null });
    }

    req.session.user = activeUser;
    return res.json({ authenticated: true, user: activeUser });
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err.message);
      return res.status(500).json({ error: 'Failed to log out' });
    }

    res.json({ success: true });
  });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username], (err, rows) => {
    if (err) {
      console.error('Error fetching user for login:', err.message);
      return res.status(500).json({ error: 'Failed to log in' });
    }

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const userRow = rows[0];
    if (!userRow.is_active) {
      return res.status(403).json({ error: 'This account is inactive.' });
    }

    const passwordMatches = bcrypt.compareSync(password, userRow.password_hash || '');
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = buildSafeUser(userRow);
    req.session.user = user;
    res.json({ authenticated: true, user });
  });
});

app.post('/api/auth/first-admin', (req, res) => {
  const fullName = String(req.body?.full_name || '').trim();
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!fullName || !username || !password) {
    return res.status(400).json({ error: 'Full name, username, and password are required.' });
  }

  db.query('SELECT COUNT(*) AS total FROM users', (countErr, rows) => {
    if (countErr) {
      console.error('Error checking users before first admin creation:', countErr.message);
      return res.status(500).json({ error: 'Failed to initialize admin account' });
    }

    if (Number(rows[0]?.total || 0) > 0) {
      return res.status(409).json({ error: 'An admin account already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    db.query('INSERT INTO users (full_name, username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [fullName, username, req.body?.email || null, passwordHash, 'admin', 1],
      (insertErr, result) => {
        if (insertErr) {
          console.error('Error creating first admin user:', insertErr.message);
          if (insertErr.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'That username or email is already in use.' });
          }
          return res.status(500).json({ error: 'Failed to create admin account' });
        }

        db.query('SELECT id, full_name, username, email, role, is_active, created_at FROM users WHERE id = ?', [result.insertId], (selectErr, userRows) => {
          if (selectErr) {
            console.error('Error fetching new admin user:', selectErr.message);
            return res.status(500).json({ error: 'Admin account created but details could not be loaded' });
          }

          const user = buildSafeUser(userRows[0]);
          req.session.user = user;
          res.status(201).json({ success: true, user });
        });
      }
    );
  });
});

app.get('/api/auth/users', requireAdmin, (req, res) => {
  db.query('SELECT id, full_name, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json((rows || []).map((row) => buildSafeUser(row)));
  });
});

app.post('/api/auth/users', requireAdmin, (req, res) => {
  try {
    const payload = normalizeUserPayload(req.body, { requirePassword: true });
    const passwordHash = bcrypt.hashSync(payload.password, 12);

    db.query('INSERT INTO users (full_name, username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.fullName, payload.username, payload.email, passwordHash, payload.role, payload.isActive ? 1 : 0],
      (insertErr, result) => {
        if (insertErr) {
          console.error('Error creating user:', insertErr.message);
          if (insertErr.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'That username or email is already in use.' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }

        db.query('SELECT id, full_name, username, email, role, is_active, created_at FROM users WHERE id = ?', [result.insertId], (selectErr, userRows) => {
          if (selectErr) {
            console.error('Error fetching created user:', selectErr.message);
            return res.status(500).json({ error: 'User created but details could not be loaded' });
          }

          res.status(201).json(buildSafeUser(userRows[0]));
        });
      }
    );
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid user data.' });
  }
});

app.put('/api/auth/users/:id', requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  try {
    const payload = normalizeUserPayload(req.body, { requirePassword: false });

    db.query('SELECT id, full_name, username, email, role, is_active FROM users WHERE id = ? LIMIT 1', [userId], (fetchErr, rows) => {
      if (fetchErr) {
        console.error('Error loading user for update:', fetchErr.message);
        return res.status(500).json({ error: 'Failed to load user' });
      }

      if (!rows.length) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const existingUser = rows[0];
      const nextRole = payload.role || existingUser.role;
      const nextActive = payload.isActive ?? Boolean(Number(existingUser.is_active ?? 1));
      const adminIsAtRisk = existingUser.role === 'admin' && Number(existingUser.is_active ?? 1) === 1 && (nextRole !== 'admin' || !nextActive);

      if (adminIsAtRisk) {
        db.query('SELECT COUNT(*) AS total FROM users WHERE role = ? AND is_active = 1 AND id != ?', ['admin', userId], (countErr, adminRows) => {
          if (countErr) {
            console.error('Error checking remaining admins:', countErr.message);
            return res.status(500).json({ error: 'Unable to validate admin protection rules.' });
          }

          if (Number(adminRows[0]?.total || 0) === 0) {
            return res.status(400).json({
              error: 'This is the only active admin account. It cannot be demoted or deactivated.'
            });
          }

          updateUserRecord();
        });
        return;
      }

      updateUserRecord();

      function updateUserRecord() {
        db.query(
          'UPDATE users SET full_name = ?, username = ?, email = ?, role = ?, is_active = ? WHERE id = ?',
          [payload.fullName, payload.username, payload.email, nextRole, nextActive ? 1 : 0, userId],
          (updateErr) => {
            if (updateErr) {
              console.error('Error updating user:', updateErr.message);
              if (updateErr.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'That username or email is already in use.' });
              }
              return res.status(500).json({ error: 'Failed to update user' });
            }

            db.query('SELECT id, full_name, username, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1', [userId], (selectErr, updatedRows) => {
              if (selectErr) {
                console.error('Error fetching updated user:', selectErr.message);
                return res.status(500).json({ error: 'User updated but details could not be loaded' });
              }

              res.json(buildSafeUser(updatedRows[0]));
            });
          }
        );
      }
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid user data.' });
  }
});

app.put('/api/auth/users/:id/password', requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const newPassword = String(req.body?.password || '');

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  db.query('SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1', [userId], (fetchErr, rows) => {
    if (fetchErr) {
      console.error('Error loading user for password change:', fetchErr.message);
      return res.status(500).json({ error: 'Failed to load user' });
    }

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 12);
    db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId], (updateErr) => {
      if (updateErr) {
        console.error('Error updating user password:', updateErr.message);
        return res.status(500).json({ error: 'Failed to update password' });
      }

      res.json({ success: true });
    });
  });
});

app.put('/api/auth/users/:id/status', requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const nextActive = getUserStatusBoolean(req.body?.is_active ?? req.body?.isActive ?? true, true);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  db.query('SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1', [userId], (fetchErr, rows) => {
    if (fetchErr) {
      console.error('Error loading user for status change:', fetchErr.message);
      return res.status(500).json({ error: 'Failed to load user' });
    }

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const existingUser = rows[0];
    const statusWillDisableLastAdmin = existingUser.role === 'admin' && Number(existingUser.is_active ?? 1) === 1 && !nextActive;

    if (statusWillDisableLastAdmin) {
      db.query('SELECT COUNT(*) AS total FROM users WHERE role = ? AND is_active = 1 AND id != ?', ['admin', userId], (countErr, adminRows) => {
        if (countErr) {
          console.error('Error checking remaining admins:', countErr.message);
          return res.status(500).json({ error: 'Unable to validate admin protection rules.' });
        }

        if (Number(adminRows[0]?.total || 0) === 0) {
          return res.status(400).json({
            error: 'This is the only active admin account. It cannot be deactivated.'
          });
        }

        updateUserStatus();
      });
      return;
    }

    updateUserStatus();

    function updateUserStatus() {
      db.query('UPDATE users SET is_active = ? WHERE id = ?', [nextActive ? 1 : 0, userId], (updateErr) => {
        if (updateErr) {
          console.error('Error updating user status:', updateErr.message);
          return res.status(500).json({ error: 'Failed to update user status' });
        }

        db.query('SELECT id, full_name, username, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1', [userId], (selectErr, userRows) => {
          if (selectErr) {
            console.error('Error fetching updated user status:', selectErr.message);
            return res.status(500).json({ error: 'User status updated but details could not be loaded' });
          }

          res.json(buildSafeUser(userRows[0]));
        });
      });
    }
  });
});

// Minimal early customers GET to ensure route is available before other middleware
app.get("/api/customers", (req, res) => {
  db.query("SELECT id, name, phone, email, address, notes, created_at FROM customers ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error("Error fetching customers (early):", err && err.message);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
    res.json(results);
  });
});

app.get("/", (req, res) => {
  res.send("POS Backend is running!");
});

app.get("/api/settings", (req, res) => {
  db.query("SELECT setting_key, setting_value FROM settings ORDER BY setting_key ASC", (err, rows) => {
    if (err) {
      console.error('Error fetching settings:', err.message);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }

    res.json(getSettingsObject(rows));
  });
});

app.put("/api/settings", (req, res) => {
  try {
    const nextSettings = normalizeSettings(req.body);
    const entries = Object.entries(nextSettings);

    const insertSql = `
      INSERT INTO settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_at = NOW()
    `;

    const tasks = entries.map(([key, value]) => new Promise((resolve, reject) => {
      const sqlValue = typeof value === 'boolean' ? String(value) : String(value ?? '');
      db.query(insertSql, [key, sqlValue], (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }));

    Promise.all(tasks)
      .then(() => {
        db.query('SELECT setting_key, setting_value FROM settings ORDER BY setting_key ASC', (selectErr, rows) => {
          if (selectErr) {
            console.error('Error reloading settings after update:', selectErr.message);
            return res.status(500).json({ error: 'Settings saved but failed to reload' });
          }

          res.json(getSettingsObject(rows));
        });
      })
      .catch((dbErr) => {
        console.error('Error saving settings:', dbErr.message);
        res.status(500).json({ error: 'Failed to save settings' });
      });
  } catch (error) {
    console.error('Settings validation error:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/products", (req, res) => {
  const sql = "SELECT * FROM products";

  db.query(sql, (error, results) => {
    if (error) {
      console.error("Error fetching products:", error.message);

      return res.status(500).json({
        error: "Failed to fetch products"
      });
    }

    res.json(results);
  });
});

app.post("/api/products", (req, res) => {
  const { name, price, stock } = req.body;

  const sql = `
    INSERT INTO products (name, price, stock)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [name, price, stock], (error, result) => {
    if (error) {
      console.error("Error adding product:", error.message);

      return res.status(500).json({
        error: "Failed to add product"
      });
    }

    res.json({
      id: result.insertId,
      name: name,
      price: price,
      stock: stock
    });
  });
});

// Checkout endpoint: create sale, sale_items, decrease stock in a transaction
app.post("/api/checkout", (req, res) => {
  const { cart, payment_method, customer_id, discount = 0, tax_rate = 0, user_id } = req.body;
  const sessionUser = getSessionUser(req);
  const effectiveUserId = Number.isInteger(Number(user_id)) ? Number(user_id) : (sessionUser ? Number(sessionUser.id) : null);

  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      console.error("Transaction start error:", err.message);
      return res.status(500).json({ error: "Failed to start transaction" });
    }

    // Fetch current price and stock for all product ids in cart
    const ids = cart.map((item) => item.id);
    const placeholders = ids.map(() => "?").join(",");
    const selectSql = `SELECT id, price, stock FROM products WHERE id IN (${placeholders})`;

    db.query(selectSql, ids, (err, results) => {
      if (err) {
        console.error("Error fetching product data:", err.message);
        return db.rollback(() => res.status(500).json({ error: "Failed to validate stock" }));
      }

      // Map results by id for quick lookup
      const productMap = {};
      results.forEach((row) => {
        productMap[row.id] = row;
      });

      // Validate stock
      for (const item of cart) {
        const prod = productMap[item.id];
        const qty = Number(item.quantity || 0);
        if (!prod) {
          return db.rollback(() => res.status(400).json({ error: `Product id ${item.id} not found` }));
        }
        if (qty <= 0) {
          return db.rollback(() => res.status(400).json({ error: `Invalid quantity for product id ${item.id}` }));
        }
        if (prod.stock < qty) {
          return db.rollback(() => res.status(400).json({ error: `Insufficient stock for product id ${item.id}` }));
        }
      }

      // Compute subtotal using DB prices to prevent client tampering
      let subtotal = 0;
      for (const item of cart) {
        const prod = productMap[item.id];
        subtotal += Number(prod.price) * Number(item.quantity);
      }

      // Validate discount and tax_rate (server-side authoritative)
      const disc = Number(discount) || 0;
      const taxRate = Number(tax_rate) || 0;
      if (!Number.isFinite(disc) || disc < 0) {
        return db.rollback(() => res.status(400).json({ error: "Invalid discount" }));
      }
      if (disc > subtotal) {
        return db.rollback(() => res.status(400).json({ error: "Discount cannot exceed subtotal" }));
      }
      if (!Number.isFinite(taxRate) || taxRate < 0) {
        return db.rollback(() => res.status(400).json({ error: "Invalid tax_rate" }));
      }

      // Calculate final total
      const taxableAmount = +(subtotal - disc).toFixed(2);
      const taxAmount = +((taxableAmount * (taxRate / 100))).toFixed(2);
      const finalTotal = +(taxableAmount + taxAmount).toFixed(2);

      // If a customer_id was provided, validate it exists
      const custId = customer_id == null ? null : Number(customer_id);
      if (custId !== null) {
        if (!Number.isInteger(custId) || custId <= 0) {
          return db.rollback(() => res.status(400).json({ error: "Invalid customer_id" }));
        }
        db.query("SELECT id FROM customers WHERE id = ?", [custId], (err, custRows) => {
          if (err) {
            console.error("Error validating customer:", err.message);
            return db.rollback(() => res.status(500).json({ error: "Failed to validate customer" }));
          }
          if (custRows.length === 0) {
            return db.rollback(() => res.status(400).json({ error: "Customer not found" }));
          }

          // proceed to insert sale with customer
          insertSaleWithCustomer(custId);
        });
      } else {
        insertSaleWithCustomer(null);
      }

      function insertSaleWithCustomer(custId) {
        const insertSaleSql = `INSERT INTO sales (total, payment_method, customer_id, user_id) VALUES (?, ?, ?, ?)`;
        db.query(insertSaleSql, [finalTotal, payment_method, custId, effectiveUserId], (err, saleResult) => {
          if (err) {
            console.error("Error inserting sale:", err.message);
            return db.rollback(() => res.status(500).json({ error: "Failed to create sale" }));
          }

          const saleId = saleResult.insertId;

          const insertItemsValues = cart.map((item) => {
            const prod = productMap[item.id];
            return [saleId, item.id, item.quantity, prod.price];
          });

          const insertItemsSql = `INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES ?`;
          db.query(insertItemsSql, [insertItemsValues], (err) => {
            if (err) {
              console.error("Error inserting sale_items:", err.message);
              return db.rollback(() => res.status(500).json({ error: "Failed to create sale items" }));
            }

            const updateStock = (index) => {
              if (index >= cart.length) {
                return db.commit((err) => {
                  if (err) {
                    console.error("Commit error:", err.message);
                    return db.rollback(() => res.status(500).json({ error: "Failed to commit transaction" }));
                  }

                  const itemsForResponse = cart.map((item) => {
                    const prod = productMap[item.id];
                    return {
                      product_id: item.id,
                      name: prod && prod.name ? prod.name : null,
                      quantity: Number(item.quantity),
                      price: Number(prod.price),
                      subtotal: Number((Number(prod.price) * Number(item.quantity)).toFixed(2))
                    };
                  });

                  const saleObj = {
                    id: saleId,
                    total: finalTotal,
                    payment_method,
                    customer_id: custId,
                    created_at: new Date(),
                    subtotal: Number(subtotal.toFixed(2)),
                    discount: Number(disc.toFixed(2)),
                    tax_rate: Number(taxRate),
                    tax_amount: Number(taxAmount.toFixed(2))
                  };

                  return res.json({ saleId: saleId, total: finalTotal, sale: saleObj, items: itemsForResponse });
                });
              }

              const item = cart[index];
              const qty = Number(item.quantity);
              const updateSql = `UPDATE products SET stock = stock - ? WHERE id = ?`;
              db.query(updateSql, [qty, item.id], (err, result) => {
                if (err) {
                  console.error("Error updating stock:", err.message);
                  return db.rollback(() => res.status(500).json({ error: "Failed to update stock" }));
                }

                if (result.affectedRows === 0) {
                  return db.rollback(() => res.status(500).json({ error: `Failed to update stock for product id ${item.id}` }));
                }

                updateStock(index + 1);
              });
            };

            updateStock(0);
          });
        });
      }
    });
  });
});

// Note: server will be started after all routes are registered (see bottom of file)

// GET /api/sales - list sales (newest first)
app.get("/api/sales", (req, res) => {
  const sql = `
    SELECT s.id, s.total, s.payment_method, s.customer_id,
      COALESCE(c.name, 'Walk-in Customer') AS customer_name,
      COALESCE(u.full_name, 'System') AS cashier_name,
      s.created_at
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching sales:", err.message);
      return res.status(500).json({ error: "Failed to fetch sales" });
    }

    res.json(results);
  });
});

// GET /api/sales/:id - sale details with items
app.get("/api/sales/:id", (req, res) => {
  const saleId = req.params.id;

  const saleSql = `
    SELECT s.id, s.total, s.payment_method, s.customer_id, s.created_at,
      c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
      u.full_name AS cashier_name, u.role AS cashier_role
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `;
  db.query(saleSql, [saleId], (err, saleRows) => {
    if (err) {
      console.error("Error fetching sale:", err.message);
      return res.status(500).json({ error: "Failed to fetch sale" });
    }

    if (saleRows.length === 0) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const sale = saleRows[0];

    const itemsSql = `
      SELECT si.product_id, p.name, si.quantity, si.price, (si.quantity * si.price) AS subtotal
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `;

    db.query(itemsSql, [saleId], (err, items) => {
      if (err) {
        console.error("Error fetching sale items:", err.message);
        return res.status(500).json({ error: "Failed to fetch sale items" });
      }

      res.json({ sale, items });
    });
  });
});

// GET /api/inventory - return products for inventory
app.get("/api/inventory", (req, res) => {
  // Order by stock ascending (low stock first), then name
  const sql = `SELECT id, name, price, stock FROM products ORDER BY stock ASC, name ASC`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching inventory:", err.message);
      return res.status(500).json({ error: "Failed to fetch inventory" });
    }
    res.json(results);
  });
});

  // Temporary test route removed

// PUT /api/inventory/:id - update stock
app.put("/api/inventory/:id", (req, res) => {
  const id = req.params.id;
  const { stock } = req.body;

  if (stock === undefined || stock === null) {
    return res.status(400).json({ error: "Missing 'stock' in request body" });
  }

  const stockNum = Number(stock);
  if (!Number.isFinite(stockNum) || stockNum < 0) {
    return res.status(400).json({ error: "Stock must be a non-negative number" });
  }

  // Verify product exists
  db.query("SELECT id FROM products WHERE id = ?", [id], (err, rows) => {
    if (err) {
      console.error("Error checking product:", err.message);
      return res.status(500).json({ error: "Failed to update stock" });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Update stock
    db.query("UPDATE products SET stock = ? WHERE id = ?", [stockNum, id], (err, result) => {
      if (err) {
        console.error("Error updating stock:", err.message);
        return res.status(500).json({ error: "Failed to update stock" });
      }

      // Return updated product
      db.query("SELECT id, name, price, stock FROM products WHERE id = ?", [id], (err, updated) => {
        if (err) {
          console.error("Error fetching updated product:", err.message);
          return res.status(500).json({ error: "Failed to fetch updated product" });
        }

        res.json(updated[0]);
      });
    });
  });
});

// debug routes removed to avoid runtime errors

// Customers endpoints
// GET /api/customers - list customers
app.get("/api/customers", (req, res) => {
  const sql = `SELECT id, name, phone, email, address, notes, created_at FROM customers ORDER BY created_at DESC`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching customers:", err.message);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
    res.json(results);
  });
});

// GET /api/customers/:id
app.get("/api/customers/:id", (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  db.query("SELECT id, name, phone, email, address, notes, created_at FROM customers WHERE id = ?", [customerId], (err, rows) => {
    if (err) {
      console.error("Error fetching customer:", err.message);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
    if (rows.length === 0) return res.status(404).json({ error: "Customer not found" });
    res.json(rows[0]);
  });
});

// GET /api/customers/:id/sales - sales for a customer
app.get('/api/customers/:id/sales', (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  const sql = `
    SELECT s.id, s.total, s.payment_method, COALESCE(c.name, 'Walk-in Customer') AS customer_name, s.created_at
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
  `;
  db.query(sql, [customerId], (err, rows) => {
    if (err) {
      console.error('Error fetching customer sales:', err.message);
      return res.status(500).json({ error: 'Failed to fetch customer sales' });
    }
    res.json(rows);
  });
});

function sanitizeCustomerInput(input = {}) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';

  if (!name) {
    throw new Error('Customer name is required');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address');
  }

  return {
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
    notes: notes || null,
  };
}

// POST /api/customers - create
app.post("/api/customers", (req, res) => {
  try {
    const payload = sanitizeCustomerInput(req.body);

    const sql = `INSERT INTO customers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [payload.name, payload.phone, payload.email, payload.address, payload.notes], (err, result) => {
      if (err) {
        console.error("Error creating customer:", err.message);
        return res.status(500).json({ error: "Failed to create customer" });
      }
      db.query("SELECT id, name, phone, email, address, notes, created_at FROM customers WHERE id = ?", [result.insertId], (err2, rows) => {
        if (err2) {
          console.error("Error fetching new customer:", err2.message);
          return res.status(500).json({ error: "Customer created but failed to fetch" });
        }
        res.status(201).json(rows[0]);
      });
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Invalid customer data" });
  }
});

// PUT /api/customers/:id - update
app.put("/api/customers/:id", (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  try {
    const payload = sanitizeCustomerInput(req.body);

    db.query("SELECT id FROM customers WHERE id = ?", [customerId], (err, rows) => {
      if (err) {
        console.error("Error checking customer:", err.message);
        return res.status(500).json({ error: "Failed to update customer" });
      }
      if (rows.length === 0) return res.status(404).json({ error: "Customer not found" });

      const sql = `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?`;
      db.query(sql, [payload.name, payload.phone, payload.email, payload.address, payload.notes, customerId], (err2) => {
        if (err2) {
          console.error("Error updating customer:", err2.message);
          return res.status(500).json({ error: "Failed to update customer" });
        }
        db.query("SELECT id, name, phone, email, address, notes, created_at FROM customers WHERE id = ?", [customerId], (err3, updated) => {
          if (err3) {
            console.error("Error fetching updated customer:", err3.message);
            return res.status(500).json({ error: "Failed to fetch updated customer" });
          }
          res.json(updated[0]);
        });
      });
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Invalid customer data" });
  }
});

// DELETE /api/customers/:id
app.delete("/api/customers/:id", (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  db.query("SELECT id FROM sales WHERE customer_id = ? LIMIT 1", [customerId], (saleErr, saleRows) => {
    if (saleErr) {
      console.error("Error checking customer sales:", saleErr.message);
      return res.status(500).json({ error: "Failed to check customer sales" });
    }

    if (saleRows.length > 0) {
      return res.status(409).json({
        error: "This customer has sales history and cannot be deleted. Historical sales are preserved to keep the record accurate."
      });
    }

    db.query("DELETE FROM customers WHERE id = ?", [customerId], (err, result) => {
      if (err) {
        console.error("Error deleting customer:", err.message);
        return res.status(500).json({ error: "Failed to delete customer" });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: "Customer not found" });
      res.json({ success: true });
    });
  });
});

// Debug: print registered routes (for troubleshooting)
try {
  if (app && app._router && Array.isArray(app._router.stack)) {
    const registered = app._router.stack
      .filter((m) => m && m.route)
      .map((m) => {
        const method = Object.keys(m.route.methods)[0] || "?";
        return `${method.toUpperCase()} ${m.route.path}`;
      });
    console.log("Registered routes:", registered);
  } else {
    console.log("Router stack not available to list routes");
  }
} catch (e) {
  console.error('Failed to list routes:', e && e.message);
}

function normalizeDateFilter(dateString, fieldName) {
  if (!dateString || dateString === '') return null;

  if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid ${fieldName} format. Use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName} value.`);
  }

  return dateString;
}

function buildDateWhereClause(reqQuery, fieldName = 'created_at') {
  const startDate = normalizeDateFilter(reqQuery.startDate, 'startDate');
  const endDate = normalizeDateFilter(reqQuery.endDate, 'endDate');

  if (startDate && endDate && startDate > endDate) {
    throw new Error('startDate cannot be later than endDate.');
  }

  const clauses = [];
  const params = [];

  if (startDate) {
    clauses.push(`DATE(${fieldName}) >= ?`);
    params.push(startDate);
  }

  if (endDate) {
    clauses.push(`DATE(${fieldName}) <= ?`);
    params.push(endDate);
  }

  return {
    whereClause: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function formatDatabaseDate(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    if (!trimmed) return null;

    const isoLike = trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00`;
    const parsed = new Date(isoLike);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return trimmed.slice(0, 10);
  }

  if (dateValue instanceof Date) {
    if (Number.isNaN(dateValue.getTime())) return null;
    return dateValue.toISOString().slice(0, 10);
  }

  if (typeof dateValue === 'number' && !Number.isNaN(dateValue)) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

// REPORTS - read-only endpoints
// GET /api/reports/summary
app.get("/api/reports/summary", (req, res) => {
  const sql = `
    SELECT
      COALESCE(SUM(total), 0) AS totalSales,
      COALESCE(COUNT(id), 0) AS totalOrders,
      COALESCE(SUM((SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE sale_id = sales.id)), 0) AS totalItemsSold,
      COALESCE(AVG(total), 0) AS averageOrderValue,
      COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN total ELSE 0 END), 0) AS todaysSales,
      COALESCE(SUM(CASE WHEN DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE() THEN total ELSE 0 END), 0) AS thisWeekSales,
      COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN total ELSE 0 END), 0) AS thisMonthSales,
      COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END), 0) AS cashSales,
      COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'card' THEN total ELSE 0 END), 0) AS cardSales
    FROM sales
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching reports summary:', err.message);
      return res.status(500).json({ error: 'Failed to fetch reports summary' });
    }

    const report = rows[0] || {};
    const payload = {
      totalSales: Number(report.totalSales || 0),
      totalOrders: Number(report.totalOrders || 0),
      totalItemsSold: Number(report.totalItemsSold || 0),
      averageOrderValue: Number(report.averageOrderValue || 0),
      todaysSales: Number(report.todaysSales || 0),
      thisWeekSales: Number(report.thisWeekSales || 0),
      thisMonthSales: Number(report.thisMonthSales || 0),
      cashSales: Number(report.cashSales || 0),
      cardSales: Number(report.cardSales || 0)
    };

    res.json(payload);
  });
});

// GET /api/reports/sales
app.get("/api/reports/sales", (req, res) => {
  try {
    const { whereClause, params } = buildDateWhereClause(req.query, 's.created_at');

    const sql = `
      SELECT DATE(s.created_at) AS date,
        COUNT(s.id) AS orders,
        COALESCE(SUM(s.total), 0) AS totalSales,
        COALESCE(AVG(s.total), 0) AS averageOrderValue
      FROM sales s
      ${whereClause}
      GROUP BY DATE(s.created_at)
      ORDER BY DATE(s.created_at) DESC
    `;

    db.query(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching sales report:', err.message);
        return res.status(500).json({ error: 'Failed to fetch sales report' });
      }

      const out = rows.map((row) => ({
        date: formatDatabaseDate(row.date),
        orders: Number(row.orders || 0),
        totalSales: Number(row.totalSales || 0),
        averageOrderValue: Number(row.averageOrderValue || 0)
      }));

      res.json(out);
    });
  } catch (error) {
    console.error('Date filter error:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// GET /api/reports/payment-methods
app.get("/api/reports/payment-methods", (req, res) => {
  try {
    const { whereClause, params } = buildDateWhereClause(req.query, 'created_at');

    const sql = `
      SELECT payment_method AS paymentMethod,
        COUNT(id) AS transactions,
        COALESCE(SUM(total), 0) AS total
      FROM sales
      ${whereClause}
      GROUP BY payment_method
      ORDER BY total DESC, transactions DESC
    `;

    db.query(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching payment method report:', err.message);
        return res.status(500).json({ error: 'Failed to fetch payment method report' });
      }

      const out = rows.map((row) => ({
        paymentMethod: row.paymentMethod || 'Other',
        transactions: Number(row.transactions || 0),
        total: Number(row.total || 0)
      }));

      res.json(out);
    });
  } catch (error) {
    console.error('Date filter error:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// GET /api/reports/top-products
app.get("/api/reports/top-products", (req, res) => {
  try {
    const { whereClause, params } = buildDateWhereClause(req.query, 's.created_at');

    const sql = `
      SELECT p.name AS name,
        COALESCE(SUM(si.quantity), 0) AS quantitySold,
        COALESCE(SUM(si.quantity * si.price), 0) AS revenue
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s ON s.id = si.sale_id
      ${whereClause}
      GROUP BY p.id, p.name
      ORDER BY quantitySold DESC, revenue DESC
      LIMIT 10
    `;

    db.query(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching top products report:', err.message);
        return res.status(500).json({ error: 'Failed to fetch top products report' });
      }

      const out = rows.map((row) => ({
        name: row.name,
        quantitySold: Number(row.quantitySold || 0),
        revenue: Number(row.revenue || 0)
      }));

      res.json(out);
    });
  } catch (error) {
    console.error('Date filter error:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// GET /api/reports/inventory
app.get("/api/reports/inventory", (req, res) => {
  const sql = `
    SELECT
      COUNT(id) AS totalProducts,
      COALESCE(SUM(stock), 0) AS totalStockUnits,
      COALESCE(SUM(CASE WHEN stock <= 10 THEN 1 ELSE 0 END), 0) AS lowStockProducts,
      COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) AS outOfStockProducts
    FROM products
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching inventory summary:', err.message);
      return res.status(500).json({ error: 'Failed to fetch inventory summary' });
    }

    const report = rows[0] || {};
    res.json({
      totalProducts: Number(report.totalProducts || 0),
      totalStockUnits: Number(report.totalStockUnits || 0),
      lowStockProducts: Number(report.lowStockProducts || 0),
      outOfStockProducts: Number(report.outOfStockProducts || 0)
    });
  });
});

// GET /api/reports/daily-sales
app.get("/api/reports/daily-sales", (req, res) => {
  try {
    const { whereClause, params } = buildDateWhereClause(req.query, 'created_at');

    const sql = `
      SELECT DATE(created_at) AS date, COALESCE(SUM(total),0) AS total, COALESCE(COUNT(id),0) AS orders
      FROM sales
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
    `;

    db.query(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching daily sales:', err.message);
        return res.status(500).json({ error: 'Failed to fetch daily sales' });
      }

      const out = rows.map(r => ({
        date: formatDatabaseDate(r.date),
        total: Number(r.total || 0),
        orders: Number(r.orders || 0)
      }));

      res.json(out);
    });
  } catch (error) {
    console.error('Date filter error:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// GET /api/dashboard - aggregate dashboard stats and supporting info (read-only)
app.get('/api/dashboard', (req, res) => {
  const range = ['today', '7d', 'month'].includes(String(req.query.range || 'month'))
    ? String(req.query.range)
    : 'month';

  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (range === '7d') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  const thresholdSql = `SELECT setting_value FROM settings WHERE setting_key = 'lowStockThreshold' LIMIT 1`;

  db.query(thresholdSql, (thresholdErr, thresholdRows) => {
    if (thresholdErr) {
      console.error('Error fetching dashboard low-stock threshold:', thresholdErr.message);
      return res.status(500).json({ error: 'Failed to load dashboard settings' });
    }

    const lowStockThreshold = Number(thresholdRows[0]?.setting_value ?? 10);

    const statsSql = `
      SELECT
        (SELECT COALESCE(COUNT(id), 0) FROM products) AS totalProducts,
        (SELECT COALESCE(SUM(stock), 0) FROM products) AS totalStockUnits,
        (SELECT COALESCE(COUNT(id), 0) FROM products WHERE stock <= ?) AS lowStockProducts,
        (SELECT COALESCE(COUNT(id), 0) FROM products WHERE stock = 0) AS outOfStockProducts,
        (SELECT COALESCE(COUNT(id), 0) FROM customers) AS totalCustomers,
        (SELECT COALESCE(SUM(total), 0) FROM sales) AS totalSales,
        (SELECT COALESCE(COUNT(id), 0) FROM sales) AS totalTransactions,
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE DATE(created_at) = CURDATE()) AS todaysSales,
        (SELECT COALESCE(COUNT(id), 0) FROM sales WHERE DATE(created_at) = CURDATE()) AS todaysTransactions
    `;

    db.query(statsSql, [lowStockThreshold], (statsErr, statsRows) => {
      if (statsErr) {
        console.error('Error fetching dashboard stats:', statsErr.message);
        return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
      }

      const stats = statsRows[0] || {};

      const overviewSql = `
        SELECT DATE(created_at) AS date,
          COALESCE(SUM(total), 0) AS salesAmount,
          COALESCE(COUNT(id), 0) AS transactionCount
        FROM sales
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `;

      db.query(overviewSql, [start.toISOString().slice(0, 19).replace('T', ' '), end.toISOString().slice(0, 19).replace('T', ' ')], (overviewErr, overviewRows) => {
        if (overviewErr) {
          console.error('Error fetching dashboard sales overview:', overviewErr.message);
          return res.status(500).json({ error: 'Failed to fetch sales overview' });
        }

        const recentSalesSql = `
          SELECT s.id, s.total, s.payment_method, s.created_at,
            COALESCE(c.name, 'Walk-in Customer') AS customer_name
          FROM sales s
          LEFT JOIN customers c ON c.id = s.customer_id
          ORDER BY s.created_at DESC
          LIMIT 10
        `;

        db.query(recentSalesSql, (recentErr, recentRows) => {
          if (recentErr) {
            console.error('Error fetching recent sales:', recentErr.message);
            return res.status(500).json({ error: 'Failed to fetch recent sales' });
          }

          const topProductsSql = `
            SELECT p.name AS name,
              COALESCE(SUM(si.quantity), 0) AS quantitySold,
              COALESCE(SUM(si.quantity * si.price), 0) AS revenue
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            GROUP BY p.id, p.name
            ORDER BY quantitySold DESC, revenue DESC
            LIMIT 10
          `;

          db.query(topProductsSql, (topErr, topRows) => {
            if (topErr) {
              console.error('Error fetching top products:', topErr.message);
              return res.status(500).json({ error: 'Failed to fetch top products' });
            }

            const lowStockSql = `
              SELECT id, name, stock
              FROM products
              WHERE stock <= ?
              ORDER BY stock ASC, name ASC
              LIMIT 10
            `;

            db.query(lowStockSql, [lowStockThreshold], (lowErr, lowRows) => {
              if (lowErr) {
                console.error('Error fetching low stock list:', lowErr.message);
                return res.status(500).json({ error: 'Failed to fetch low stock products' });
              }

              const payload = {
                stats: {
                  totalSales: Number(stats.totalSales || 0),
                  totalTransactions: Number(stats.totalTransactions || 0),
                  todaysSales: Number(stats.todaysSales || 0),
                  todaysTransactions: Number(stats.todaysTransactions || 0),
                  totalProducts: Number(stats.totalProducts || 0),
                  totalStockUnits: Number(stats.totalStockUnits || 0),
                  lowStockProducts: Number(stats.lowStockProducts || 0),
                  outOfStockProducts: Number(stats.outOfStockProducts || 0),
                  totalCustomers: Number(stats.totalCustomers || 0)
                },
                salesOverview: (overviewRows || []).map((row) => ({
                  date: row.date ? String(row.date).slice(0, 10) : null,
                  salesAmount: Number(row.salesAmount || 0),
                  transactionCount: Number(row.transactionCount || 0)
                })),
                recentSales: (recentRows || []).map((row) => ({
                  id: Number(row.id),
                  created_at: row.created_at,
                  payment_method: row.payment_method,
                  total: Number(row.total || 0),
                  customer_name: row.customer_name || 'Walk-in Customer'
                })),
                topProducts: (topRows || []).map((row) => ({
                  name: row.name,
                  quantitySold: Number(row.quantitySold || 0),
                  revenue: Number(row.revenue || 0)
                })),
                lowStockProducts: (lowRows || []).map((row) => ({
                  id: Number(row.id),
                  name: row.name,
                  stock: Number(row.stock || 0),
                  isOutOfStock: Number(row.stock || 0) === 0,
                  status: Number(row.stock || 0) === 0 ? 'Out of Stock' : 'Low Stock'
                }))
              };

              res.json(payload);
            });
          });
        });
      });
    });
  });
});

// Start server after routes are registered
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});