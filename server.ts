// ============================================================================
// JADIJCB: High-Performance Full-Stack Express Server with Native SQLite DB
// Provides persistent storage for Bookings, Notifications, Machines & Clients
// Connects External Customers, Contractors and Owners in Real-Time
// ============================================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

// Ensure data folder exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
const DB_PATH = path.join(DATA_DIR, 'jadijcb.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & foreign keys for concurrency and reliability
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
} catch (e) {
  console.warn('SQLite PRAGMA notice:', e);
}

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    owner_id TEXT,
    client_id TEXT,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_ref_id TEXT,
    start_at TEXT,
    end_at TEXT,
    start_date TEXT,
    end_date TEXT,
    total_price REAL DEFAULT 0,
    deposit_amount REAL DEFAULT 0,
    rate_type TEXT DEFAULT 'daily',
    with_operator INTEGER DEFAULT 1,
    fuel_included INTEGER DEFAULT 0,
    delivery_requested INTEGER DEFAULT 0,
    delivery_fee REAL DEFAULT 0,
    site_address TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    paid_amount REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    machine_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title_ar TEXT NOT NULL,
    title_fr TEXT NOT NULL,
    body_ar TEXT NOT NULL,
    body_fr TEXT NOT NULL,
    type TEXT DEFAULT 'booking_request',
    is_read INTEGER DEFAULT 0,
    data_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    title_ar TEXT,
    title_fr TEXT,
    brand TEXT,
    model TEXT,
    category TEXT,
    city TEXT,
    daily_rate REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    listing_mode TEXT DEFAULT 'rent',
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    cin_or_ice TEXT,
    company TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    data_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    machine_id TEXT,
    participant_a TEXT NOT NULL,
    participant_b TEXT NOT NULL,
    last_message TEXT,
    last_message_at TEXT NOT NULL,
    data_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL
  );
`);

try {
  db.exec(`
    UPDATE bookings 
    SET owner_id = (SELECT owner_id FROM machines WHERE machines.id = bookings.machine_id)
    WHERE machine_id IN (SELECT id FROM machines WHERE owner_id IS NOT NULL AND owner_id != '')
      AND (owner_id IS NULL OR owner_id = '' OR owner_id = 'owner' OR owner_id != (SELECT owner_id FROM machines WHERE machines.id = bookings.machine_id));
  `);
} catch (syncErr) {
  console.warn('SQLite booking owner backfill notice:', syncErr);
}

console.log('✅ SQLite Database initialized at:', DB_PATH);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to format booking row
function formatBooking(row: any) {
  if (!row) return null;
  let machine = null;
  if (row.machine_json) {
    try {
      machine = JSON.parse(row.machine_json);
    } catch {
      machine = null;
    }
  }

  return {
    id: row.id,
    machine_id: row.machine_id,
    owner_id: row.owner_id,
    client_id: row.client_id,
    client_name: row.client_name,
    client_phone: row.client_phone,
    client_ref_id: row.client_ref_id,
    start_at: row.start_at || row.start_date,
    end_at: row.end_at || row.end_date,
    start_date: row.start_date || row.start_at,
    end_date: row.end_date || row.end_at,
    total_price: Number(row.total_price) || 0,
    deposit_amount: Number(row.deposit_amount) || 0,
    rate_type: row.rate_type || 'daily',
    with_operator: Boolean(row.with_operator),
    fuel_included: Boolean(row.fuel_included),
    delivery_requested: Boolean(row.delivery_requested),
    delivery_fee: Number(row.delivery_fee) || 0,
    site_address: row.site_address || '',
    status: row.status || 'pending',
    notes: row.notes || '',
    paid_amount: Number(row.paid_amount) || 0,
    balance_due: Number(row.balance_due) || 0,
    payment_status: row.payment_status || 'unpaid',
    machine,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Helper to format notification row
function formatNotification(row: any) {
  if (!row) return null;
  let data = {};
  if (row.data_json) {
    try {
      data = JSON.parse(row.data_json);
    } catch {
      data = {};
    }
  }

  return {
    id: row.id,
    user_id: row.user_id,
    title_ar: row.title_ar,
    title_fr: row.title_fr,
    body_ar: row.body_ar,
    body_fr: row.body_fr,
    type: row.type || 'booking_request',
    is_read: Boolean(row.is_read),
    read: Boolean(row.is_read),
    data,
    created_at: row.created_at,
  };
}

// ============================================================================
// API ROUTES
// ============================================================================

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'sqlite3-native',
    database: DB_PATH,
    timestamp: new Date().toISOString(),
  });
});

// 2. Bookings - GET List
app.get('/api/bookings', (req, res) => {
  try {
    const { owner_id, machine_id, client_id, status } = req.query;

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params: any[] = [];

    if (machine_id) {
      query += ' AND machine_id = ?';
      params.push(String(machine_id));
    }
    if (client_id) {
      query += ' AND client_id = ?';
      params.push(String(client_id));
    }
    if (status) {
      query += ' AND status = ?';
      params.push(String(status));
    }
    if (owner_id) {
      // If owner_id specified, also match bookings where owner_id is null or 'owner' or matches
      query += ` AND (owner_id = ? OR owner_id IS NULL OR owner_id = '' OR owner_id = 'owner' OR owner_id = 'demo-owner' OR machine_id IN (SELECT id FROM machines WHERE owner_id = ?))`;
      params.push(String(owner_id), String(owner_id));
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    const bookings = rows.map(formatBooking);

    res.json({ success: true, count: bookings.length, bookings });
  } catch (err: any) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Bookings - POST Create New Booking
app.post('/api/bookings', (req, res) => {
  try {
    const b = req.body;
    if (!b.machine_id) {
      return res.status(400).json({ success: false, error: 'machine_id is required' });
    }
    if (!b.client_name || !b.client_phone) {
      return res.status(400).json({ success: false, error: 'client_name and client_phone are required' });
    }

    const id = b.id || `bkg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const createdAt = b.created_at || now;
    const startAt = b.start_at || b.start_date || now;
    const endAt = b.end_at || b.end_date || now;

    // Check conflict on active/pending bookings for the same machine
    const conflictStmt = db.prepare(`
      SELECT * FROM bookings 
      WHERE machine_id = ? 
        AND status IN ('pending', 'active', 'in_progress', 'confirmed')
        AND id != ?
        AND (
          (start_at <= ? AND end_at >= ?) OR
          (start_at >= ? AND start_at <= ?)
        )
      LIMIT 1
    `);
    const conflict = conflictStmt.get(b.machine_id, id, endAt, startAt, startAt, endAt);

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: 'BOOKING_CONFLICT',
        message_ar: 'الآلية محجوزة مسبقاً في هذه التواريخ',
        message_fr: 'Cet engin est déjà réservé sur ces dates',
      });
    }

    // Determine target machine details and guaranteed true owner
    let machineJson = '';
    let machineTitle = 'الآلية';
    let machineTitleFr = 'Engin';
    let resolvedOwnerId = '';

    // 1. Prioritize database lookup for machine owner
    try {
      const mRow: any = db.prepare('SELECT * FROM machines WHERE id = ?').get(b.machine_id);
      if (mRow) {
        machineJson = mRow.data_json || '';
        machineTitle = mRow.title_ar || mRow.title_fr || 'الآلية';
        machineTitleFr = mRow.title_fr || mRow.title_ar || 'Engin';
        if (mRow.owner_id) {
          resolvedOwnerId = mRow.owner_id;
        }
      }
    } catch {
      // Ignore lookup error
    }

    // 2. Attached machine object
    if (!resolvedOwnerId && b.machine && typeof b.machine === 'object') {
      if (!machineJson) machineJson = JSON.stringify(b.machine);
      if (machineTitle === 'الآلية' && (b.machine.title_ar || b.machine.title_fr)) {
        machineTitle = b.machine.title_ar || b.machine.title_fr;
        machineTitleFr = b.machine.title_fr || b.machine.title_ar;
      }
      if (b.machine.owner_id) {
        resolvedOwnerId = b.machine.owner_id;
      }
    }

    // 3. Fallback to passed owner_id if machine had no specific owner
    if (!resolvedOwnerId) {
      resolvedOwnerId = b.owner_id || '';
    }

    const insertStmt = db.prepare(`
      INSERT INTO bookings (
        id, machine_id, owner_id, client_id, client_name, client_phone, client_ref_id,
        start_at, end_at, start_date, end_date, total_price, deposit_amount,
        rate_type, with_operator, fuel_included, delivery_requested, delivery_fee,
        site_address, status, notes, paid_amount, balance_due, payment_status,
        machine_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      id,
      b.machine_id,
      resolvedOwnerId || null,
      b.client_id || null,
      b.client_name.trim(),
      b.client_phone.trim(),
      b.client_ref_id || null,
      startAt,
      endAt,
      startAt,
      endAt,
      Number(b.total_price) || 0,
      Number(b.deposit_amount) || 0,
      b.rate_type || 'daily',
      b.with_operator ? 1 : 0,
      b.fuel_included ? 1 : 0,
      b.delivery_requested ? 1 : 0,
      Number(b.delivery_fee) || 0,
      b.site_address ? b.site_address.trim() : '',
      b.status || 'pending',
      b.notes ? b.notes.trim() : '',
      Number(b.paid_amount) || 0,
      Number(b.balance_due || b.total_price) || 0,
      b.payment_status || 'unpaid',
      machineJson,
      createdAt,
      now
    );

    // AUTOMATIC NOTIFICATION FOR OWNER
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const priceFormatted = Number(b.total_price || 0).toLocaleString('fr-FR');
    const notifStmt = db.prepare(`
      INSERT INTO notifications (
        id, user_id, title_ar, title_fr, body_ar, body_fr, type, is_read, data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const notifData = {
      booking_id: id,
      machine_id: b.machine_id,
      client_name: b.client_name.trim(),
      client_phone: b.client_phone.trim(),
      total_price: Number(b.total_price) || 0,
      start_at: startAt,
      end_at: endAt,
    };

    notifStmt.run(
      notifId,
      resolvedOwnerId || 'owner',
      'طلب كراء جديد وارد 🚜',
      'Nouvelle demande de location reçue 🚜',
      `طلب الزبون ${b.client_name.trim()} كراء "${machineTitle}" بقيمة ${priceFormatted} د.م.`,
      `Le client ${b.client_name.trim()} a réservé "${machineTitleFr}" (${priceFormatted} MAD).`,
      'booking_request',
      0,
      JSON.stringify(notifData),
      now
    );

    const savedRow: any = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    const createdBooking = formatBooking(savedRow);

    console.log(`✅ [DB] New booking created: ${id} for machine ${b.machine_id} by ${b.client_name}`);

    res.status(201).json({
      success: true,
      booking: createdBooking,
      notification_id: notifId,
    });
  } catch (err: any) {
    console.error('Error creating booking:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Bookings - PATCH Update Status / Details
app.patch('/api/bookings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existing: any = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const now = new Date().toISOString();
    const newStatus = updates.status || existing.status;
    const newNotes = updates.notes !== undefined ? updates.notes : existing.notes;
    const newPaid = updates.paid_amount !== undefined ? Number(updates.paid_amount) : existing.paid_amount;
    const newPaymentStatus = updates.payment_status || existing.payment_status;

    const stmt = db.prepare(`
      UPDATE bookings 
      SET status = ?, notes = ?, paid_amount = ?, payment_status = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(newStatus, newNotes, newPaid, newPaymentStatus, now, id);

    // If status changed to active or cancelled, create notification
    if (newStatus !== existing.status) {
      const notifId = `notif_status_${Date.now()}`;
      const isAccepted = newStatus === 'active' || newStatus === 'confirmed';
      const notifStmt = db.prepare(`
        INSERT INTO notifications (
          id, user_id, title_ar, title_fr, body_ar, body_fr, type, is_read, data_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      notifStmt.run(
        notifId,
        existing.owner_id || 'owner',
        isAccepted ? 'تم تأكيد طلب الكراء بنجاح ✅' : 'تم إلغاء/رفض طلب الكراء ❌',
        isAccepted ? 'Réservation confirmée avec succès ✅' : 'Réservation annulée/refusée ❌',
        isAccepted
          ? `تم قبول وتأكيد حجز الزبون ${existing.client_name}.`
          : `تم تغيير حالة حجز الزبون ${existing.client_name} إلى (${newStatus}).`,
        isAccepted
          ? `La réservation pour ${existing.client_name} est confirmée.`
          : `La réservation pour ${existing.client_name} a été modifiée (${newStatus}).`,
        'status_update',
        0,
        JSON.stringify({ booking_id: id, status: newStatus }),
        now
      );
    }

    const updatedRow: any = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    res.json({ success: true, booking: formatBooking(updatedRow) });
  } catch (err: any) {
    console.error('Error updating booking:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Bookings - DELETE
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Notifications - GET List
app.get('/api/notifications', (req, res) => {
  try {
    const { user_id, unread_only } = req.query;

    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params: any[] = [];

    if (user_id) {
      query += ` AND (user_id = ? OR user_id = 'owner' OR user_id IS NULL OR user_id = '')`;
      params.push(String(user_id));
    }
    if (unread_only === 'true') {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const rows = db.prepare(query).all(...params);
    const notifications = rows.map(formatNotification);

    res.json({
      success: true,
      count: notifications.length,
      unread_count: notifications.filter((n) => !n.is_read).length,
      notifications,
    });
  } catch (err: any) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Notifications - Mark Single as Read
app.patch('/api/notifications/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Notifications - Mark All as Read
app.post('/api/notifications/mark-all-read', (req, res) => {
  try {
    const { user_id } = req.body || {};
    if (user_id) {
      db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id = 'owner'`).run(user_id);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1').run();
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8b. Notifications - Create Custom In-App Notification
app.post('/api/notifications', (req, res) => {
  try {
    const { user_id, title_ar, title_fr, body_ar, body_fr, type, data } = req.body || {};
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO notifications (id, user_id, title_ar, title_fr, body_ar, body_fr, type, is_read, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      user_id || 'owner',
      title_ar || 'إشعار جديد',
      title_fr || 'Nouvelle notification',
      body_ar || '',
      body_fr || '',
      type || 'info',
      data ? JSON.stringify(data) : null,
      new Date().toISOString()
    );
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Machines - GET List
app.get('/api/machines', (req, res) => {
  try {
    const { owner_id } = req.query;
    let query = 'SELECT * FROM machines';
    const params: any[] = [];

    if (owner_id) {
      query += ' WHERE owner_id = ?';
      params.push(String(owner_id));
    }
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params);
    const machines = rows.map((r: any) => {
      try {
        return JSON.parse(r.data_json);
      } catch {
        return {
          id: r.id,
          owner_id: r.owner_id,
          title_ar: r.title_ar,
          title_fr: r.title_fr,
          brand: r.brand,
          model: r.model,
          daily_rate: r.daily_rate,
        };
      }
    });

    res.json({ success: true, count: machines.length, machines });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Machines - POST Save / Update Machine
app.post('/api/machines', (req, res) => {
  try {
    const machine = req.body;
    if (!machine || !machine.id) {
      return res.status(400).json({ success: false, error: 'Machine with id is required' });
    }

    const now = new Date().toISOString();
    const dataJson = JSON.stringify(machine);

    const stmt = db.prepare(`
      INSERT INTO machines (
        id, owner_id, title_ar, title_fr, brand, model, category, city, daily_rate, sale_price, listing_mode, data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner_id = excluded.owner_id,
        title_ar = excluded.title_ar,
        title_fr = excluded.title_fr,
        brand = excluded.brand,
        model = excluded.model,
        category = excluded.category,
        city = excluded.city,
        daily_rate = excluded.daily_rate,
        sale_price = excluded.sale_price,
        listing_mode = excluded.listing_mode,
        data_json = excluded.data_json
    `);

    stmt.run(
      machine.id,
      machine.owner_id || null,
      machine.title_ar || '',
      machine.title_fr || '',
      machine.brand || '',
      machine.model || '',
      machine.category || machine.category_id || '',
      machine.city || '',
      Number(machine.rate_daily || machine.daily_rate) || 0,
      Number(machine.sale_price) || 0,
      machine.listing_mode || 'rent',
      dataJson,
      machine.created_at || now
    );

    res.json({ success: true, machine });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Clients - GET & POST
app.get('/api/clients', (req, res) => {
  try {
    const { owner_id } = req.query;
    let query = 'SELECT * FROM clients';
    const params: any[] = [];
    if (owner_id) {
      query += ' WHERE owner_id = ?';
      params.push(String(owner_id));
    }
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params);
    const clients = rows.map((r: any) => {
      try {
        return JSON.parse(r.data_json);
      } catch {
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          cin_or_ice: r.cin_or_ice,
        };
      }
    });

    res.json({ success: true, count: clients.length, clients });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/clients', (req, res) => {
  try {
    const client = req.body;
    if (!client || !client.name || !client.phone) {
      return res.status(400).json({ success: false, error: 'Client name and phone are required' });
    }

    const id = client.id || `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const dataJson = JSON.stringify({ ...client, id });

    const stmt = db.prepare(`
      INSERT INTO clients (id, owner_id, name, phone, cin_or_ice, company, email, address, notes, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        cin_or_ice = excluded.cin_or_ice,
        data_json = excluded.data_json
    `);

    stmt.run(
      id,
      client.owner_id || null,
      client.name.trim(),
      client.phone.trim(),
      client.cin_or_ice || '',
      client.company || '',
      client.email || '',
      client.address || '',
      client.notes || '',
      dataJson,
      now
    );

    res.json({ success: true, client: { ...client, id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Conversations - GET List
app.get('/api/conversations', (req, res) => {
  try {
    const { user_id } = req.query;
    let query = 'SELECT * FROM conversations WHERE 1=1';
    const params: any[] = [];
    if (user_id) {
      query += ' AND (participant_a = ? OR participant_b = ?)';
      params.push(String(user_id), String(user_id));
    }
    query += ' ORDER BY last_message_at DESC LIMIT 50';
    const rows = db.prepare(query).all(...params);
    const conversations = rows.map((r: any) => {
      let data = {};
      try {
        if (r.data_json) data = JSON.parse(r.data_json);
      } catch {}
      return {
        id: r.id,
        machine_id: r.machine_id,
        participant_a: r.participant_a,
        participant_b: r.participant_b,
        last_message: r.last_message,
        last_message_at: r.last_message_at,
        created_at: r.created_at,
        ...data,
      };
    });
    res.json({ success: true, conversations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Conversations - POST Create or Get Existing
app.post('/api/conversations', (req, res) => {
  try {
    const { id, machine_id, participant_a, participant_b, machine, target_profile } = req.body || {};
    if (!participant_a || !participant_b) {
      return res.status(400).json({ success: false, error: 'Both participants are required' });
    }

    // Check existing
    const existing: any = db.prepare(`
      SELECT * FROM conversations
      WHERE (participant_a = ? AND participant_b = ?)
         OR (participant_a = ? AND participant_b = ?)
      ORDER BY last_message_at DESC LIMIT 1
    `).get(participant_a, participant_b, participant_b, participant_a);

    if (existing) {
      let data = {};
      try {
        if (existing.data_json) data = JSON.parse(existing.data_json);
      } catch {}
      return res.json({
        success: true,
        conversation: {
          id: existing.id,
          machine_id: existing.machine_id,
          participant_a: existing.participant_a,
          participant_b: existing.participant_b,
          last_message: existing.last_message,
          last_message_at: existing.last_message_at,
          ...data,
        },
      });
    }

    const convId = id || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const dataJson = JSON.stringify({ machine, target_profile });

    db.prepare(`
      INSERT INTO conversations (id, machine_id, participant_a, participant_b, last_message, last_message_at, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(convId, machine_id || null, participant_a, participant_b, '', now, dataJson, now);

    res.json({
      success: true,
      conversation: {
        id: convId,
        machine_id: machine_id || null,
        participant_a,
        participant_b,
        last_message: '',
        last_message_at: now,
        machine,
        target_profile,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Messages - GET List by Conversation ID
app.get('/api/messages', (req, res) => {
  try {
    const { conversation_id } = req.query;
    if (!conversation_id) {
      return res.status(400).json({ success: false, error: 'conversation_id is required' });
    }
    const rows = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(String(conversation_id));

    res.json({ success: true, messages: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Messages - POST Send Message
app.post('/api/messages', (req, res) => {
  try {
    const { conversation_id, sender_id, body, recipient_id } = req.body || {};
    if (!conversation_id || !sender_id || !body) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const trimmed = String(body).trim();

    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, body, read_at, created_at)
      VALUES (?, ?, ?, ?, NULL, ?)
    `).run(msgId, conversation_id, sender_id, trimmed, now);

    // Update conversation last_message & timestamp
    db.prepare(`
      UPDATE conversations
      SET last_message = ?, last_message_at = ?
      WHERE id = ?
    `).run(trimmed, now, conversation_id);

    // If recipient is known, insert an in-app notification
    if (recipient_id) {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      db.prepare(`
        INSERT INTO notifications (id, user_id, title_ar, title_fr, body_ar, body_fr, type, is_read, data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        notifId,
        recipient_id,
        'رسالة جديدة في المحادثة',
        'Nouveau message dans le chat',
        trimmed.length > 70 ? trimmed.substring(0, 70) + '...' : trimmed,
        trimmed.length > 70 ? trimmed.substring(0, 70) + '...' : trimmed,
        'chat_message',
        JSON.stringify({ conversation_id, message_id: msgId, sender_id }),
        now
      );
    }

    res.json({
      success: true,
      message: {
        id: msgId,
        conversation_id,
        sender_id,
        body: trimmed,
        read_at: null,
        created_at: now,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// FRONTEND SERVING (Vite Middleware in Dev, Static in Prod)
// ============================================================================

async function startServer() {
  if (isProd) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Mount Vite in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 JADIJCB Full-Stack Server running on http://0.0.0.0:${PORT} (${isProd ? 'Production' : 'Development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
