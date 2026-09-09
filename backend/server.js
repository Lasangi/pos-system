const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

function initializeDatabaseSchema() {
  // Ensure customers table exists for Customer Management feature.
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

db.on('error', (error) => {
  if (error && (error.code === 'PROTOCOL_CONNECTION_LOST' || error.fatal)) {
    console.error('Database connection lost. Reconnecting to MySQL...');
    setTimeout(() => {
      db.connect((connectError) => {
        if (connectError) {
          console.error('MySQL reconnect failed:', connectError.message);
          return;
        }

        console.log('MySQL reconnected successfully!');
        initializeDatabaseSchema();
      });
    }, 1000);
  } else {
    console.error('Unhandled MySQL error:', error.message);
  }
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
  const { cart, payment_method, customer_id, discount = 0, tax_rate = 0 } = req.body;

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
        const insertSaleSql = `INSERT INTO sales (total, payment_method, customer_id) VALUES (?, ?, ?)`;
        db.query(insertSaleSql, [finalTotal, payment_method, custId], (err, saleResult) => {
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
      COALESCE(c.name, 'Walk-in Customer') AS customer_name, s.created_at
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
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
      c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
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

// POST /api/customers - create
app.post("/api/customers", (req, res) => {
  const { name, phone, email, address, notes } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: "Customer name is required" });
  }

  const sql = `INSERT INTO customers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)`;
  db.query(sql, [name.trim(), phone || null, email || null, address || null, notes || null], (err, result) => {
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
});

// PUT /api/customers/:id - update
app.put("/api/customers/:id", (req, res) => {
  const customerId = Number(req.params.id);
  const { name, phone, email, address, notes } = req.body;

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: "Customer name is required" });
  }

  db.query("SELECT id FROM customers WHERE id = ?", [customerId], (err, rows) => {
    if (err) {
      console.error("Error checking customer:", err.message);
      return res.status(500).json({ error: "Failed to update customer" });
    }
    if (rows.length === 0) return res.status(404).json({ error: "Customer not found" });

    const sql = `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?`;
    db.query(sql, [name.trim(), phone || null, email || null, address || null, notes || null, customerId], (err2) => {
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
});

// DELETE /api/customers/:id
app.delete("/api/customers/:id", (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: "Invalid customer id" });
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
      ${whereClause.replace('created_at', 's.created_at')}
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