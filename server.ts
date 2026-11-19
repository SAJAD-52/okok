// ============================================================================
// JADIJCB: High-Performance Full-Stack Express Server with Native SQLite DB
// Provides persistent storage for Bookings, Notifications, Machines & Clients
// Connects External Customers, Contractors and Owners in Real-Time
// ============================================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';
import * as webpush from 'web-push';
import {
  runPublicTendersScrape,
  startMidnightTendersScheduler,
  getNextMidnightCasablancaIso,
  mapRowToTender,
  mapRowToRun,
} from './src/server/tendersScraper';

const app = express();
const PRIMARY_PORT = 3000;
const SECONDARY_PORT = process.env.PORT && parseInt(process.env.PORT, 10) !== PRIMARY_PORT ? parseInt(process.env.PORT, 10) : null;
const isProd = process.env.NODE_ENV === 'production';

// Ensure data folder exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database with self-healing recovery if corrupted
const DB_PATH = path.join(DATA_DIR, 'jadijcb.db');

function createTables(database: DatabaseSync) {
  database.exec(`
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

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      subscription_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_otps (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      verified INTEGER DEFAULT 0,
      used INTEGER DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public_tenders (
      id TEXT PRIMARY KEY,
      reference_code TEXT NOT NULL,
      dedup_key TEXT UNIQUE NOT NULL,
      title_ar TEXT NOT NULL,
      title_fr TEXT NOT NULL,
      contracting_authority TEXT,
      sector TEXT DEFAULT 'other',
      city TEXT,
      region TEXT,
      award_date TEXT,
      amount_mad REAL DEFAULT 0,
      winning_company TEXT NOT NULL,
      company_city TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      company_website TEXT,
      source_url TEXT,
      source_domain TEXT,
      machinery_needed_json TEXT,
      summary_ar TEXT,
      summary_fr TEXT,
      scraped_at TEXT NOT NULL,
      scan_batch_id TEXT
    );

    CREATE TABLE IF NOT EXISTS tender_scrape_runs (
      id TEXT PRIMARY KEY,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      sector_filter TEXT,
      region_filter TEXT,
      found_count INTEGER DEFAULT 0,
      new_count INTEGER DEFAULT 0,
      sources_json TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );
  `);
}

function initDatabase(): DatabaseSync {
  try {
    const instance = new DatabaseSync(DB_PATH);
    try {
      instance.exec('PRAGMA journal_mode = WAL;');
      instance.exec('PRAGMA synchronous = NORMAL;');
    } catch (e) {
      console.warn('SQLite PRAGMA notice:', e);
    }
    createTables(instance);
    return instance;
  } catch (err: any) {
    console.warn('SQLite database recovery triggered:', err);
    try {
      if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
      if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
      if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');
    } catch (cleanErr) {
      console.warn('Could not clean corrupted database files:', cleanErr);
    }
    const freshInstance = new DatabaseSync(DB_PATH);
    try {
      freshInstance.exec('PRAGMA journal_mode = WAL;');
      freshInstance.exec('PRAGMA synchronous = NORMAL;');
    } catch {}
    createTables(freshInstance);
    return freshInstance;
  }
}

const db = initDatabase();

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

// Initialize Web Push VAPID keys (from env or persisted in data/vapid.json)
const VAPID_PATH = path.join(DATA_DIR, 'vapid.json');
function loadOrCreateVapidKeys(): { publicKey: string; privateKey: string } {
  const envPub = (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (envPub && envPriv) {
    return { publicKey: envPub, privateKey: envPriv };
  }
  try {
    if (fs.existsSync(VAPID_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_PATH, 'utf-8'));
      if (parsed?.publicKey && parsed?.privateKey) {
        return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
      }
    }
  } catch {
    // Regenerate below
  }
  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_PATH, JSON.stringify(generated, null, 2));
  } catch {
    // ignore write errors
  }
  return generated;
}

const vapidKeys = loadOrCreateVapidKeys();
try {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contact@jadijcb.ma',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (err) {
  console.warn('Web Push VAPID configuration notice:', err);
}

// Security Headers & CORS
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Lightweight In-Memory Rate Limiter (safe for shared mobile carrier IPs)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function createRateLimiter(windowMs: number, maxRequests: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip =
      String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const key = `${ip}:${windowMs}:${maxRequests}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message_ar: 'تم تجاوز الحد المسموح من الطلبات، يرجى الانتظار قليلاً',
      });
    }
    return next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets.entries()) {
    if (now > v.resetAt) rateBuckets.delete(k);
  }
}, 60_000);

const apiGeneralLimiter = createRateLimiter(60_000, 600);
const apiMutationLimiter = createRateLimiter(60_000, 60);
app.use('/api', apiGeneralLimiter);

// Supabase JWT Verification Middleware
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const isSupabaseAuthEnabled = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('placeholder')
);
if (!isSupabaseAuthEnabled) {
  console.warn('⚠️ [SECURITY] Supabase env vars not configured on server; JWT auth running in local-sandbox mode.');
}

interface VerifiedUser {
  id: string;
  email?: string;
  role?: string;
  isAdmin: boolean;
}
interface AuthedRequest extends express.Request {
  authUser?: VerifiedUser | null;
}

const tokenCache = new Map<string, { user: VerifiedUser; expiresAt: number }>();
async function resolveVerifiedUser(token: string): Promise<VerifiedUser | null> {
  if (!token || !isSupabaseAuthEnabled) return null;
  const cached = tokenCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.user;
  }
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) return null;
    const userJson: any = await resp.json();
    if (!userJson?.id) return null;
    const email = String(userJson.email || '').toLowerCase().trim();
    const metaRole = String(userJson.user_metadata?.role || userJson.role || '');
    const isAdmin =
      email === 'said.cpge24@gmail.com' ||
      email === 'said.cpge240@gmail.com' ||
      metaRole === 'admin';
    const verified: VerifiedUser = {
      id: String(userJson.id),
      email,
      role: metaRole,
      isAdmin,
    };
    tokenCache.set(token, { user: verified, expiresAt: Date.now() + 30_000 });
    return verified;
  } catch {
    return null;
  }
}

function extractBearerToken(req: express.Request): string {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  if (req.query?.token) return String(req.query.token).trim();
  return '';
}

async function optionalAuth(req: AuthedRequest, _res: express.Response, next: express.NextFunction) {
  const token = extractBearerToken(req);
  if (token) {
    req.authUser = await resolveVerifiedUser(token);
  }
  next();
}

async function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  // Reject forged legacy mock admin ID anywhere
  const claimedIds = [
    req.query?.user_id,
    req.query?.owner_id,
    req.body?.user_id,
    req.body?.sender_id,
    req.body?.owner_id,
  ].map((v) => String(v || ''));
  if (claimedIds.includes('super_admin_said_root')) {
    return res.status(403).json({ success: false, error: 'Forbidden invalid identity' });
  }

  const token = extractBearerToken(req);
  if (isSupabaseAuthEnabled) {
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const verified = await resolveVerifiedUser(token);
    if (!verified) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token' });
    }
    req.authUser = verified;
  } else if (token) {
    req.authUser = await resolveVerifiedUser(token);
  }
  next();
}

// Real-Time Server-Sent Events (SSE) Hub for instant cross-device chat & alerts
const sseClients = new Map<string, Set<express.Response>>();

function pushSseEvent(userId: string, eventName: string, payload: Record<string, any>) {
  if (!userId) return;
  const targets = sseClients.get(String(userId));
  if (!targets || targets.size === 0) return;
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const clientRes of Array.from(targets)) {
    try {
      clientRes.write(frame);
    } catch {
      targets.delete(clientRes);
    }
  }
}

app.get('/api/events', requireAuth, (req: AuthedRequest, res) => {
  const userId = String(req.query.user_id || '').trim();
  if (!userId) {
    return res.status(400).json({ success: false, error: 'user_id required' });
  }
  if (req.authUser && !req.authUser.isAdmin && req.authUser.id !== userId) {
    return res.status(403).json({ success: false, error: 'Forbidden SSE user_id mismatch' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, userId })}\n\n`);

  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId)!.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const set = sseClients.get(userId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        sseClients.delete(userId);
      }
    }
  });
});

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
app.get('/api/bookings', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { owner_id, machine_id, client_id, status } = req.query;

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params: any[] = [];

    if (req.authUser && !req.authUser.isAdmin) {
      query += ` AND (owner_id = ? OR client_id = ? OR machine_id IN (SELECT id FROM machines WHERE owner_id = ?))`;
      params.push(req.authUser.id, req.authUser.id, req.authUser.id);
    }

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
      const targetOwner = req.authUser && !req.authUser.isAdmin ? req.authUser.id : String(owner_id);
      if (req.authUser && !req.authUser.isAdmin && String(owner_id) !== req.authUser.id) {
        return res.status(403).json({ success: false, error: 'Forbidden owner_id' });
      }
      query += ` AND (owner_id = ? OR owner_id IS NULL OR owner_id = '' OR owner_id = 'owner' OR owner_id = 'demo-owner' OR machine_id IN (SELECT id FROM machines WHERE owner_id = ?))`;
      params.push(targetOwner, targetOwner);
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

// 3. Bookings - POST Create New Booking (allows public marketplace guest booking with rate limit)
app.post('/api/bookings', apiMutationLimiter, optionalAuth, (req: AuthedRequest, res) => {
  try {
    const b = req.body;
    if (!b.machine_id) {
      return res.status(400).json({ success: false, error: 'machine_id is required' });
    }
    if (!b.client_name || !b.client_phone) {
      return res.status(400).json({ success: false, error: 'client_name and client_phone are required' });
    }
    if (isSupabaseAuthEnabled && !req.authUser) {
      // Unauthenticated guest booking cannot spoof client_id, payment status, or pre-approved status
      b.client_id = null;
      b.status = 'pending';
      b.payment_status = 'unpaid';
      b.paid_amount = 0;
    } else if (req.authUser && !req.authUser.isAdmin && b.client_id && b.client_id !== req.authUser.id) {
      b.client_id = req.authUser.id;
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

    // 3. Fallback to passed owner_id if machine had no specific owner (NEVER to super admin)
    if (!resolvedOwnerId || resolvedOwnerId === 'super_admin_said_root' || resolvedOwnerId === 'admin') {
      if (b.owner_id && b.owner_id !== 'super_admin_said_root' && b.owner_id !== 'admin') {
        resolvedOwnerId = b.owner_id;
      } else {
        resolvedOwnerId = 'usr_owner_casa_01';
      }
    }

    // Auto sync machine into SQLite if machine object provided
    if (b.machine && typeof b.machine === 'object' && b.machine.id) {
      try {
        db.prepare(`
          INSERT INTO machines (id, owner_id, title_ar, title_fr, brand, model, category, city, daily_rate, hourly_rate, is_published, data_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            owner_id = COALESCE(excluded.owner_id, machines.owner_id),
            title_ar = excluded.title_ar,
            title_fr = excluded.title_fr,
            data_json = excluded.data_json
        `).run(
          b.machine.id,
          b.machine.owner_id || resolvedOwnerId || null,
          b.machine.title_ar || b.machine.brand || 'الآلية',
          b.machine.title_fr || b.machine.brand || 'Engin',
          b.machine.brand || '',
          b.machine.model || '',
          b.machine.category || 'excavator',
          b.machine.city || 'الدار البيضاء',
          Number(b.machine.daily_rate) || 2000,
          Number(b.machine.hourly_rate) || 350,
          1,
          JSON.stringify(b.machine),
          now
        );
      } catch {
        // ignore
      }
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
app.patch('/api/bookings/:id', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existing: any = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    if (req.authUser && !req.authUser.isAdmin) {
      const mRow: any = db.prepare('SELECT owner_id FROM machines WHERE id = ?').get(existing.machine_id);
      const isAuthorized =
        existing.owner_id === req.authUser.id ||
        existing.client_id === req.authUser.id ||
        mRow?.owner_id === req.authUser.id;
      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: 'Forbidden booking access' });
      }
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
app.delete('/api/bookings/:id', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const existing: any = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (existing && req.authUser && !req.authUser.isAdmin) {
      const mRow: any = db.prepare('SELECT owner_id FROM machines WHERE id = ?').get(existing.machine_id);
      if (existing.owner_id !== req.authUser.id && mRow?.owner_id !== req.authUser.id) {
        return res.status(403).json({ success: false, error: 'Forbidden booking deletion' });
      }
    }
    db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Notifications - GET List
app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { user_id, unread_only, role } = req.query;
    const effectiveUserId =
      req.authUser && !req.authUser.isAdmin ? req.authUser.id : user_id ? String(user_id) : '';

    if (req.authUser && !req.authUser.isAdmin && user_id && String(user_id) !== req.authUser.id) {
      return res.status(403).json({ success: false, error: 'Forbidden notifications access' });
    }

    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params: any[] = [];

    if (effectiveUserId) {
      const roleStr = String(role || '');
      const isIsolatedRole =
        roleStr === 'client' || roleStr === 'contractor' || roleStr === 'driver';
      if (isIsolatedRole) {
        query += ` AND user_id = ?`;
      } else {
        query += ` AND (user_id = ? OR user_id = 'owner' OR user_id IS NULL OR user_id = '')`;
      }
      params.push(effectiveUserId);
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
app.patch('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    if (req.authUser && !req.authUser.isAdmin) {
      const notifRow: any = db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(id);
      if (notifRow && notifRow.user_id && notifRow.user_id !== 'owner' && notifRow.user_id !== req.authUser.id) {
        return res.status(403).json({ success: false, error: 'Forbidden notification update' });
      }
    }
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Notifications - Mark All as Read
app.post('/api/notifications/mark-all-read', requireAuth, (req: AuthedRequest, res) => {
  try {
    const requestedId = req.body?.user_id;
    const effectiveUserId =
      req.authUser && !req.authUser.isAdmin ? req.authUser.id : requestedId;
    if (effectiveUserId) {
      db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id = 'owner'`).run(effectiveUserId);
    } else if (!isSupabaseAuthEnabled || req.authUser?.isAdmin) {
      db.prepare('UPDATE notifications SET is_read = 1').run();
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8a. Notifications - Mark Conversation Chat Notifications Read
app.post('/api/notifications/mark-conversation-read', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { user_id, conversation_id } = req.body || {};
    const effectiveUserId =
      req.authUser && !req.authUser.isAdmin ? req.authUser.id : user_id;
    if (!effectiveUserId || !conversation_id) {
      return res.status(400).json({ success: false, error: 'user_id and conversation_id required' });
    }
    const rows = db
      .prepare(`SELECT id, data_json FROM notifications WHERE user_id = ? AND type = 'chat_message' AND is_read = 0`)
      .all(String(effectiveUserId)) as any[];
    for (const r of rows) {
      try {
        const parsed = r.data_json ? JSON.parse(r.data_json) : {};
        if (parsed.conversation_id === conversation_id) {
          db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(r.id);
        }
      } catch {}
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8b. Notifications - Create Custom In-App Notification
app.post('/api/notifications', apiMutationLimiter, requireAuth, (req: AuthedRequest, res) => {
  try {
    const { user_id, title_ar, title_fr, body_ar, body_fr, type, data } = req.body || {};
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
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
      now
    );
    if (user_id) {
      pushSseEvent(String(user_id), 'notification', {
        id,
        user_id,
        title_ar: title_ar || 'إشعار جديد',
        title_fr: title_fr || 'Nouvelle notification',
        body_ar: body_ar || '',
        body_fr: body_fr || '',
        type: type || 'info',
        data: data || {},
        created_at: now,
      });
    }
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
app.post('/api/machines', apiMutationLimiter, requireAuth, (req: AuthedRequest, res) => {
  try {
    const machine = req.body;
    if (!machine || !machine.id) {
      return res.status(400).json({ success: false, error: 'Machine with id is required' });
    }
    if (req.authUser && !req.authUser.isAdmin) {
      machine.owner_id = req.authUser.id;
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
app.get('/api/clients', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { owner_id } = req.query;
    const effectiveOwner =
      req.authUser && !req.authUser.isAdmin ? req.authUser.id : owner_id ? String(owner_id) : '';
    let query = 'SELECT * FROM clients';
    const params: any[] = [];
    if (effectiveOwner) {
      query += ' WHERE owner_id = ?';
      params.push(effectiveOwner);
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

app.post('/api/clients', requireAuth, (req: AuthedRequest, res) => {
  try {
    const client = req.body;
    if (!client || !client.name || !client.phone) {
      return res.status(400).json({ success: false, error: 'Client name and phone are required' });
    }
    if (req.authUser && !req.authUser.isAdmin) {
      client.owner_id = req.authUser.id;
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
app.get('/api/conversations', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { user_id } = req.query;
    const effectiveUserId =
      req.authUser && !req.authUser.isAdmin ? req.authUser.id : user_id ? String(user_id) : '';
    let query = 'SELECT * FROM conversations WHERE 1=1';
    const params: any[] = [];
    if (effectiveUserId) {
      query += ' AND (participant_a = ? OR participant_b = ?)';
      params.push(effectiveUserId, effectiveUserId);
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
app.post('/api/conversations', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { id, machine_id, participant_a, participant_b, machine, target_profile } = req.body || {};
    if (!participant_a || !participant_b) {
      return res.status(400).json({ success: false, error: 'Both participants are required' });
    }
    if (
      req.authUser &&
      !req.authUser.isAdmin &&
      req.authUser.id !== participant_a &&
      req.authUser.id !== participant_b
    ) {
      return res.status(403).json({ success: false, error: 'Forbidden conversation participant' });
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
app.get('/api/messages', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { conversation_id } = req.query;
    if (!conversation_id) {
      return res.status(400).json({ success: false, error: 'conversation_id is required' });
    }
    if (req.authUser && !req.authUser.isAdmin) {
      const conv: any = db
        .prepare('SELECT participant_a, participant_b FROM conversations WHERE id = ?')
        .get(String(conversation_id));
      if (conv && conv.participant_a !== req.authUser.id && conv.participant_b !== req.authUser.id) {
        return res.status(403).json({ success: false, error: 'Forbidden conversation messages' });
      }
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

async function sendWebPushToTargets(
  targetIds: string[],
  payload: Record<string, any>,
  externalSubs?: any[]
): Promise<{ sent: number; total: number }> {
  const subsMap = new Map<string, any>();
  if (targetIds.length > 0) {
    const placeholders = targetIds.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`)
      .all(...targetIds);
    for (const r of rows as any[]) {
      try {
        subsMap.set(r.endpoint, JSON.parse(r.subscription_json));
      } catch {
        subsMap.set(r.endpoint, {
          endpoint: r.endpoint,
          keys: { p256dh: r.p256dh, auth: r.auth },
        });
      }
    }
  }

  if (Array.isArray(externalSubs)) {
    for (const s of externalSubs) {
      if (s?.endpoint && s?.p256dh && s?.auth) {
        subsMap.set(s.endpoint, {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        });
      }
    }
  }

  const bodyStr = JSON.stringify(payload || {});
  let sent = 0;

  await Promise.all(
    Array.from(subsMap.entries()).map(async ([endpoint, sub]) => {
      try {
        await webpush.sendNotification(sub, bodyStr);
        sent += 1;
      } catch (pushErr: any) {
        if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
          try {
            db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
          } catch {}
        }
      }
    })
  );

  return { sent, total: subsMap.size };
}

function stripDispatchMarkerServer(text: string): string {
  const raw = String(text || '');
  const markers = ['#DISPATCH_DATA:', '#DISPATCH_DEAL:', '#DRIVER_OFFER:', '#DRIVER_DEAL:'];
  let cutIdx = -1;
  for (const m of markers) {
    const idx = raw.indexOf(m);
    if (idx !== -1 && (cutIdx === -1 || idx < cutIdx)) {
      cutIdx = idx;
    }
  }
  const sliced = cutIdx === -1 ? raw : raw.slice(0, cutIdx);
  return sliced
    .replace(/\s*\[JADIJCB_DISPATCH:[^\]]+\]\s*/g, '')
    .replace(/\s*\[JADIJCB_DEAL:[^\]]+\]\s*/g, '')
    .trim();
}

// 15. Messages - POST Send Message
app.post('/api/messages', apiMutationLimiter, requireAuth, (req: AuthedRequest, res) => {
  try {
    const {
      id: clientMsgId,
      conversation_id,
      sender_id,
      body,
      recipient_id,
      sender_name,
      recipient_role,
    } = req.body || {};
    if (!conversation_id || !sender_id || !body) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (req.authUser && !req.authUser.isAdmin && String(sender_id) !== req.authUser.id) {
      return res.status(403).json({ success: false, error: 'Forbidden sender_id spoof' });
    }

    const msgId = clientMsgId
      ? String(clientMsgId)
      : `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const trimmed = String(body).trim();
    const cleanPreview = stripDispatchMarkerServer(trimmed) || 'رسالة جديدة';
    const shortPreview =
      cleanPreview.length > 90 ? cleanPreview.substring(0, 90) + '...' : cleanPreview;

    db.prepare(`
      INSERT OR IGNORE INTO messages (id, conversation_id, sender_id, body, read_at, created_at)
      VALUES (?, ?, ?, ?, NULL, ?)
    `).run(msgId, conversation_id, sender_id, trimmed, now);

    // Update conversation last_message & timestamp
    db.prepare(`
      UPDATE conversations
      SET last_message = ?, last_message_at = ?
      WHERE id = ?
    `).run(cleanPreview, now, conversation_id);

    // If recipient is known, insert an in-app notification & trigger Web Push
    if (recipient_id) {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const titleAr = sender_name ? `رسالة من ${sender_name} 💬` : 'رسالة جديدة في المحادثة 💬';
      const titleFr = sender_name ? `Message de ${sender_name} 💬` : 'Nouveau message 💬';
      const isRecipientContractor =
        recipient_role === 'client' || recipient_role === 'contractor';
      const isRecipientDriver = recipient_role === 'driver';
      const targetUrl = isRecipientDriver
        ? `/driver/messages?conv=${encodeURIComponent(String(conversation_id))}`
        : isRecipientContractor
        ? `/entreprise/messages?conv=${encodeURIComponent(String(conversation_id))}`
        : `/owner/messages?conv=${encodeURIComponent(String(conversation_id))}`;

      db.prepare(`
        INSERT INTO notifications (id, user_id, title_ar, title_fr, body_ar, body_fr, type, is_read, data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        notifId,
        recipient_id,
        titleAr,
        titleFr,
        shortPreview,
        shortPreview,
        'chat_message',
        JSON.stringify({
          conversation_id,
          message_id: msgId,
          sender_id,
          sender_name: sender_name || '',
          url: targetUrl,
        }),
        now
      );

      // Fire real-time SSE push to connected recipient tabs/devices
      pushSseEvent(String(recipient_id), 'chat_message', {
        id: msgId,
        conversation_id,
        sender_id,
        sender_name: sender_name || '',
        body: trimmed,
        preview: shortPreview,
        title_ar: titleAr,
        title_fr: titleFr,
        url: targetUrl,
        created_at: now,
      });

      // Fire background Web Push to recipient's registered devices
      sendWebPushToTargets([String(recipient_id)], {
        id: msgId,
        type: 'chat_message',
        title: titleAr,
        body: shortPreview,
        tag: `jadijcb-chat-${conversation_id}`,
        url: targetUrl,
        icon: '/pwa-icon-192.png',
      }).catch(() => {});
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

// 16. Web Push - Get VAPID Public Key
app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({ success: true, publicKey: vapidKeys.publicKey });
});

// 17. Web Push - Save User Subscription
app.post('/api/push/subscribe', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { user_id, subscription } = req.body || {};
    const effectiveUserId =
      req.authUser && !req.authUser.isAdmin ? req.authUser.id : user_id;
    if (!effectiveUserId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ success: false, error: 'Valid user_id and push subscription required' });
    }
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, subscription_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        subscription_json = excluded.subscription_json,
        updated_at = excluded.updated_at
    `).run(
      String(subscription.endpoint),
      String(effectiveUserId),
      String(subscription.keys.p256dh),
      String(subscription.keys.auth),
      JSON.stringify(subscription),
      now,
      now
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 18. Web Push - Send Background Notification to Target User IDs
app.post('/api/push/dispatch', apiMutationLimiter, requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { owner_ids, subscriptions: externalSubs, payload } = req.body || {};
    const targetIds: string[] = Array.isArray(owner_ids) ? owner_ids.map(String) : [];

    const result = await sendWebPushToTargets(targetIds, payload || {}, externalSubs);
    res.json({ success: true, sent: result.sent, total: result.total });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 19. Machine Location Relocation (when dispatch deal accepted)
app.patch('/api/machines/:id/location', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, city } = req.body || {};
    const row: any = db.prepare('SELECT * FROM machines WHERE id = ?').get(id);
    if (!row) {
      return res.json({ success: true, updated: false });
    }
    if (req.authUser && !req.authUser.isAdmin && row.owner_id && row.owner_id !== req.authUser.id) {
      return res.status(403).json({ success: false, error: 'Forbidden machine relocation' });
    }
    let data: any = {};
    try {
      data = JSON.parse(row.data_json || '{}');
    } catch {}
    data.lat = Number(lat);
    data.lng = Number(lng);
    data.location_lat = Number(lat);
    data.location_lng = Number(lng);
    if (city) data.city = city;

    db.prepare('UPDATE machines SET city = COALESCE(?, city), data_json = ? WHERE id = ?').run(
      city || null,
      JSON.stringify(data),
      id
    );
    res.json({ success: true, updated: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 20. WhatsApp OTP Activation & Password Reset Routes
// ============================================================================

const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function normalizeMoroccanPhoneServer(rawInput: string): string {
  let cleaned = String(rawInput || '').trim().replace(/[\s\-\.\(\)\/]/g, '');
  if (cleaned.startsWith('00212')) cleaned = '+212' + cleaned.slice(5);
  else if (cleaned.startsWith('212') && !cleaned.startsWith('+212')) cleaned = '+212' + cleaned.slice(3);
  if ((cleaned.startsWith('06') || cleaned.startsWith('07')) && cleaned.length === 10) {
    cleaned = '+212' + cleaned.slice(1);
  }
  if ((cleaned.startsWith('6') || cleaned.startsWith('7')) && cleaned.length === 9) {
    cleaned = '+212' + cleaned;
  }
  return /^\+212[67]\d{8}$/.test(cleaned) ? cleaned : '';
}

function getWhatsAppGatewayProvider(): 'meta' | 'ultramsg' | 'webhook' | 'none' {
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return 'meta';
  }
  if (process.env.ULTRAMSG_INSTANCE_ID && process.env.ULTRAMSG_TOKEN) {
    return 'ultramsg';
  }
  if (process.env.WHATSAPP_OTP_WEBHOOK_URL) {
    return 'webhook';
  }
  return 'none';
}

function hashOtpCode(code: string, saltHex?: string): string {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(code, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyOtpHash(code: string, stored: string): boolean {
  const [salt, expectedHex] = String(stored || '').split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(code, salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

async function checkSupabasePhoneRegistered(phoneE164: string): Promise<boolean | null> {
  if (!isSupabaseAuthEnabled) return null;
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_phone_registered`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_phone: phoneE164 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return Boolean(data);
  } catch {
    return null;
  }
}

async function dispatchWhatsAppOtpMessage(
  phoneE164: string,
  otpCode: string,
  purpose: 'register' | 'reset_password',
  lang: 'ar' | 'fr'
): Promise<{ sent: boolean; provider: string; error?: string }> {
  const provider = getWhatsAppGatewayProvider();
  if (provider === 'none') {
    return { sent: false, provider: 'none', error: 'GATEWAY_NOT_CONFIGURED' };
  }

  const digits = phoneE164.replace(/\D/g, '');
  const message =
    lang === 'fr'
      ? purpose === 'reset_password'
        ? `🔐 JADIJCB — Votre code de réinitialisation du mot de passe est : *${otpCode}*\nValable pendant 10 minutes. Ne le partagez avec personne.`
        : `✅ JADIJCB — Votre code d'activation de compte est : *${otpCode}*\nValable pendant 10 minutes.`
      : purpose === 'reset_password'
      ? `🔐 منصة JADIJCB — كود إعادة تعيين كلمة المرور الخاص بك هو: *${otpCode}*\nصالح لمدة 10 دقائق. لا تشاركه مع أي شخص.`
      : `✅ منصة JADIJCB — كود تفعيل حسابك هو: *${otpCode}*\nصالح لمدة 10 دقائق.`;

  if (provider === 'meta') {
    const token = process.env.WHATSAPP_ACCESS_TOKEN!.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
    const templateName = (process.env.WHATSAPP_OTP_TEMPLATE_NAME || '').trim();
    const templateLang = (process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'ar').trim();

    const bodyPayload = templateName
      ? {
          messaging_product: 'whatsapp',
          to: digits,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: otpCode }] },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: otpCode }],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: digits,
          type: 'text',
          text: { preview_url: false, body: message },
        };

    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });
    if (!resp.ok) {
      return { sent: false, provider: 'meta', error: await resp.text() };
    }
    return { sent: true, provider: 'meta' };
  }

  if (provider === 'ultramsg') {
    const instanceId = process.env.ULTRAMSG_INSTANCE_ID!.trim();
    const token = process.env.ULTRAMSG_TOKEN!.trim();
    const resp = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        to: phoneE164,
        body: message,
      }),
    });
    if (!resp.ok) {
      return { sent: false, provider: 'ultramsg', error: await resp.text() };
    }
    return { sent: true, provider: 'ultramsg' };
  }

  const webhookUrl = process.env.WHATSAPP_OTP_WEBHOOK_URL!.trim();
  const webhookSecret = (process.env.WHATSAPP_OTP_WEBHOOK_SECRET || '').trim();
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(webhookSecret ? { Authorization: `Bearer ${webhookSecret}` } : {}),
    },
    body: JSON.stringify({
      phone: phoneE164,
      digits,
      code: otpCode,
      purpose,
      lang,
      message,
    }),
  });
  if (!resp.ok) {
    return { sent: false, provider: 'webhook', error: await resp.text() };
  }
  return { sent: true, provider: 'webhook' };
}

async function updateSupabasePasswordAsServiceRole(
  phoneE164: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseAuthEnabled || !SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: 'SERVICE_ROLE_NOT_CONFIGURED' };
  }
  const digits = phoneE164.replace(/\D/g, '');
  const syntheticEmail = `${digits}@users.jadijcb.app`;

  try {
    const listResp = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(syntheticEmail)}&page=1&per_page=20`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!listResp.ok) {
      return { success: false, error: 'ADMIN_USER_LOOKUP_FAILED' };
    }
    const listJson: any = await listResp.json();
    const users: any[] = Array.isArray(listJson?.users) ? listJson.users : [];
    const target = users.find(
      (u) =>
        String(u.email || '').toLowerCase() === syntheticEmail.toLowerCase() ||
        String(u.phone || '') === phoneE164
    );
    if (!target?.id) {
      return { success: false, error: 'ACCOUNT_NOT_FOUND' };
    }

    const updResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${target.id}`, {
      method: 'PUT',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: newPassword,
        email_confirm: true,
      }),
    });
    if (!updResp.ok) {
      return { success: false, error: await updResp.text() };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'RESET_FAILED' };
  }
}

app.get('/api/auth/whatsapp-otp/status', (_req, res) => {
  const provider = getWhatsAppGatewayProvider();
  res.json({
    success: true,
    gatewayConfigured: provider !== 'none',
    provider,
    canResetSelfService: provider !== 'none' && Boolean(SUPABASE_SERVICE_ROLE_KEY || isSupabaseAuthEnabled),
  });
});

app.post('/api/auth/whatsapp-otp/send', apiMutationLimiter, async (req, res) => {
  try {
    const phone = normalizeMoroccanPhoneServer(req.body?.phone || '');
    const purpose = req.body?.purpose === 'reset_password' ? 'reset_password' : 'register';
    const lang = req.body?.lang === 'fr' ? 'fr' : 'ar';

    if (!phone) {
      return res.status(400).json({ success: false, error: 'INVALID_PHONE' });
    }

    const isRegistered = await checkSupabasePhoneRegistered(phone);
    if (purpose === 'register' && isRegistered === true) {
      return res.status(409).json({ success: false, error: 'PHONE_ALREADY_REGISTERED' });
    }
    if (purpose === 'reset_password' && isRegistered === false) {
      return res.status(404).json({ success: false, error: 'ACCOUNT_NOT_FOUND' });
    }

    const provider = getWhatsAppGatewayProvider();
    if (provider === 'none') {
      return res.json({
        success: true,
        delivery: 'gateway_not_configured',
        gatewayConfigured: false,
        provider: 'none',
      });
    }

    // Rate limiting: 30s cooldown & max 6 codes per hour per phone
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const recentRows = db
      .prepare(
        `SELECT created_at FROM whatsapp_otps WHERE phone = ? AND purpose = ? AND created_at > ? ORDER BY created_at DESC`
      )
      .all(phone, purpose, oneHourAgo) as any[];

    if (recentRows.length >= 6) {
      return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
    }
    if (recentRows[0]?.created_at) {
      const elapsedMs = Date.now() - new Date(recentRows[0].created_at).getTime();
      if (elapsedMs < 30_000) {
        return res.status(429).json({
          success: false,
          error: 'COOLDOWN_ACTIVE',
          retryAfterSeconds: Math.ceil((30_000 - elapsedMs) / 1000),
        });
      }
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 10 * 60_000).toISOString();
    const id = `otp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Invalidate previous unconsumed codes for this phone & purpose
    db.prepare(`UPDATE whatsapp_otps SET used = 1 WHERE phone = ? AND purpose = ? AND used = 0`).run(
      phone,
      purpose
    );

    db.prepare(
      `INSERT INTO whatsapp_otps (id, phone, purpose, code_hash, attempts, max_attempts, verified, used, expires_at, created_at)
       VALUES (?, ?, ?, ?, 0, 5, 0, 0, ?, ?)`
    ).run(id, phone, purpose, hashOtpCode(otpCode), expiresIso, nowIso);

    // Sync to Supabase OTP table if service role key is configured
    if (isSupabaseAuthEnabled && SUPABASE_SERVICE_ROLE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/rpc/store_whatsapp_otp`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_phone: phone,
          p_purpose: purpose,
          p_code: otpCode,
          p_ttl_seconds: 600,
        }),
      }).catch(() => {});
    }

    const dispatch = await dispatchWhatsAppOtpMessage(phone, otpCode, purpose, lang);
    if (!dispatch.sent) {
      return res.status(502).json({
        success: false,
        error: 'WHATSAPP_SEND_FAILED',
        detail: dispatch.error,
      });
    }

    return res.json({
      success: true,
      delivery: 'whatsapp',
      gatewayConfigured: true,
      provider: dispatch.provider,
      expiresInSeconds: 600,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

app.post('/api/auth/whatsapp-otp/verify', apiMutationLimiter, async (req, res) => {
  try {
    const phone = normalizeMoroccanPhoneServer(req.body?.phone || '');
    const purpose = req.body?.purpose === 'reset_password' ? 'reset_password' : 'register';
    const code = String(req.body?.code || '').replace(/\D/g, '');

    if (!phone || code.length !== 6) {
      return res.status(400).json({ success: false, error: 'INVALID_OTP' });
    }

    const row: any = db
      .prepare(
        `SELECT * FROM whatsapp_otps WHERE phone = ? AND purpose = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`
      )
      .get(phone, purpose);

    if (!row) {
      // Fallback to Supabase RPC if OTP was stored there
      if (isSupabaseAuthEnabled) {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_whatsapp_otp_code`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_phone: phone, p_purpose: purpose, p_code: code }),
        });
        if (rpcRes.ok) {
          const rpcJson: any = await rpcRes.json();
          if (rpcJson?.success) {
            return res.json({ success: true, verified: true });
          }
          return res.status(400).json({ success: false, error: rpcJson?.error || 'INVALID_OTP' });
        }
      }
      return res.status(400).json({ success: false, error: 'OTP_NOT_FOUND' });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'OTP_EXPIRED' });
    }
    if (Number(row.attempts) >= Number(row.max_attempts || 5)) {
      return res.status(429).json({ success: false, error: 'TOO_MANY_ATTEMPTS' });
    }
    if (!verifyOtpHash(code, row.code_hash)) {
      db.prepare(`UPDATE whatsapp_otps SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
      return res.status(400).json({
        success: false,
        error: 'INVALID_OTP',
        remainingAttempts: Math.max(0, Number(row.max_attempts || 5) - (Number(row.attempts) + 1)),
      });
    }

    db.prepare(`UPDATE whatsapp_otps SET verified = 1 WHERE id = ?`).run(row.id);

    // Mirror verification in Supabase if applicable
    if (isSupabaseAuthEnabled) {
      fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_whatsapp_otp_code`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_phone: phone, p_purpose: purpose, p_code: code }),
      }).catch(() => {});
    }

    return res.json({ success: true, verified: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

app.post('/api/auth/whatsapp-otp/reset-password', apiMutationLimiter, async (req, res) => {
  try {
    const phone = normalizeMoroccanPhoneServer(req.body?.phone || '');
    const code = String(req.body?.code || '').replace(/\D/g, '');
    const newPassword = String(req.body?.newPassword || '');

    if (!phone) {
      return res.status(400).json({ success: false, error: 'INVALID_PHONE' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'WEAK_PASSWORD' });
    }
    if (code.length !== 6) {
      return res.status(400).json({ success: false, error: 'INVALID_OTP' });
    }

    const row: any = db
      .prepare(
        `SELECT * FROM whatsapp_otps WHERE phone = ? AND purpose = 'reset_password' AND used = 0 ORDER BY created_at DESC LIMIT 1`
      )
      .get(phone);

    if (!row) {
      // Try Supabase RPC directly
      if (isSupabaseAuthEnabled) {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reset_password_with_whatsapp_otp`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_phone: phone,
            p_code: code,
            p_new_password: newPassword,
          }),
        });
        if (rpcRes.ok) {
          const rpcJson: any = await rpcRes.json();
          if (rpcJson?.success) {
            return res.json({ success: true });
          }
          return res.status(400).json({ success: false, error: rpcJson?.error || 'RESET_FAILED' });
        }
      }
      return res.status(400).json({ success: false, error: 'OTP_NOT_FOUND' });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'OTP_EXPIRED' });
    }
    if (Number(row.attempts) >= Number(row.max_attempts || 5)) {
      return res.status(429).json({ success: false, error: 'TOO_MANY_ATTEMPTS' });
    }
    if (!verifyOtpHash(code, row.code_hash)) {
      db.prepare(`UPDATE whatsapp_otps SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
      return res.status(400).json({ success: false, error: 'INVALID_OTP' });
    }

    let passwordUpdated = false;
    let lastError: string | undefined;

    // Try Supabase Admin API first if service role is configured
    if (SUPABASE_SERVICE_ROLE_KEY) {
      const adminRes = await updateSupabasePasswordAsServiceRole(phone, newPassword);
      if (adminRes.success) {
        passwordUpdated = true;
      } else {
        lastError = adminRes.error;
      }
    }

    // Fallback to Supabase RPC if OTP was also synced to Supabase
    if (!passwordUpdated && isSupabaseAuthEnabled) {
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reset_password_with_whatsapp_otp`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_phone: phone,
          p_code: code,
          p_new_password: newPassword,
        }),
      });
      if (rpcRes.ok) {
        const rpcJson: any = await rpcRes.json();
        if (rpcJson?.success) {
          passwordUpdated = true;
        } else {
          lastError = rpcJson?.error || lastError;
        }
      }
    }

    if (!passwordUpdated) {
      return res.status(500).json({
        success: false,
        error: lastError || 'PASSWORD_UPDATE_REQUIRES_SERVICE_ROLE',
      });
    }

    db.prepare(`UPDATE whatsapp_otps SET verified = 1, used = 1 WHERE id = ?`).run(row.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

// Super Admin: Permanently delete user account via Supabase Service Role API
app.post('/api/admin/delete-account', apiMutationLimiter, async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const caller = await resolveVerifiedUser(token);
    if (!caller || !caller.isAdmin) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }

    const userId = String(req.body?.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, error: 'INVALID_USER_ID' });
    }
    if (userId === caller.id) {
      return res.status(400).json({ success: false, error: 'CANNOT_DELETE_SELF' });
    }

    if (!isSupabaseAuthEnabled || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(501).json({ success: false, error: 'SERVICE_ROLE_NOT_CONFIGURED' });
    }

    // 1. Delete profile row first (cascades machines, bookings, etc.)
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    // 2. Delete auth.users record so phone number is completely freed
    const authDelResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!authDelResp.ok && authDelResp.status !== 404) {
      const errTxt = await authDelResp.text();
      return res.status(500).json({ success: false, error: errTxt || 'AUTH_DELETE_FAILED' });
    }

    return res.json({ success: true, userId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

// Super Admin: Toggle user suspension via Supabase Service Role API
app.post('/api/admin/toggle-suspend', apiMutationLimiter, async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const caller = await resolveVerifiedUser(token);
    if (!caller || !caller.isAdmin) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    }

    const userId = String(req.body?.userId || '').trim();
    const suspend = Boolean(req.body?.suspend);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'INVALID_USER_ID' });
    }
    if (userId === caller.id) {
      return res.status(400).json({ success: false, error: 'CANNOT_SUSPEND_SELF' });
    }

    if (!isSupabaseAuthEnabled || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(501).json({ success: false, error: 'SERVICE_ROLE_NOT_CONFIGURED' });
    }

    const nextStatus = suspend ? 'suspended' : 'active';
    const updResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ subscription_status: nextStatus }),
    });

    if (!updResp.ok) {
      const errTxt = await updResp.text();
      return res.status(500).json({ success: false, error: errTxt || 'SUSPEND_FAILED' });
    }

    if (suspend) {
      await fetch(`${SUPABASE_URL}/rest/v1/machines?owner_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_published: false }),
      }).catch(() => {});
    }

    return res.json({ success: true, is_suspended: suspend, subscription_status: nextStatus });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

// ============================================================================
// OWNER-ONLY MOROCCAN PUBLIC WORKS TENDERS RADAR (/api/tenders)
// ============================================================================

async function verifyOwnerOrAdminAccess(req: AuthedRequest): Promise<{ allowed: boolean; role: string }> {
  if (!req.authUser) {
    return { allowed: !isSupabaseAuthEnabled, role: 'owner' };
  }
  if (req.authUser.isAdmin) {
    return { allowed: true, role: 'admin' };
  }
  let resolvedRole = String(req.authUser.role || '').toLowerCase();
  const token = extractBearerToken(req);

  if (isSupabaseAuthEnabled && token && req.authUser.id) {
    try {
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(req.authUser.id)}&select=role`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (profRes.ok) {
        const rows: any = await profRes.json();
        if (Array.isArray(rows) && rows[0]?.role) {
          resolvedRole = String(rows[0].role).toLowerCase();
        }
      }
    } catch {
      // Fallback to metadata role
    }
  }

  const forbiddenRoles = new Set(['client', 'contractor', 'driver']);
  if (forbiddenRoles.has(resolvedRole)) {
    return { allowed: false, role: resolvedRole };
  }
  return { allowed: true, role: resolvedRole || 'owner' };
}

let activeManualScrapeInFlight = false;

app.get('/api/tenders', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const access = await verifyOwnerOrAdminAccess(req);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: 'OWNER_ONLY_FEATURE',
        message_ar: 'هذه الميزة مخصصة لأصحاب الآليات فقط.',
        message_fr: 'Cette fonctionnalité est réservée exclusivement aux propriétaires d’engins.',
      });
    }

    const sector = String(req.query.sector || '').trim();
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 120));

    let rows: any[] = [];
    if (sector && sector !== 'all') {
      rows = db
        .prepare(
          `SELECT * FROM public_tenders WHERE sector = ? ORDER BY scraped_at DESC, award_date DESC LIMIT ?`
        )
        .all(sector, limit);
    } else {
      rows = db
        .prepare(
          `SELECT * FROM public_tenders ORDER BY scraped_at DESC, award_date DESC LIMIT ?`
        )
        .all(limit);
    }

    const runRows: any[] = db
      .prepare(`SELECT * FROM tender_scrape_runs ORDER BY started_at DESC LIMIT 8`)
      .all();

    return res.json({
      success: true,
      tenders: rows.map(mapRowToTender),
      runs: runRows.map(mapRowToRun),
      lastRun: runRows[0] ? mapRowToRun(runRows[0]) : null,
      isServerScanRunning: Boolean(runRows[0]?.status === 'running'),
      nextMidnightAt: getNextMidnightCasablancaIso(),
      scheduleTimezone: 'Africa/Casablanca',
      scheduleTime: '00:00',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

app.post('/api/tenders/scan', requireAuth, apiMutationLimiter, async (req: AuthedRequest, res) => {
  try {
    if (!req.authUser?.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'SERVER_AUTOMATED_ONLY',
        message_ar: 'يتم مسح الصفقات العمومية تلقائياً من الخادم يومياً عند الساعة 00:00 فقط.',
        message_fr: 'Le scan des marchés publics est exécuté automatiquement par le serveur à 00h00.',
      });
    }

    if (activeManualScrapeInFlight) {
      return res.status(409).json({
        success: false,
        error: 'SCAN_ALREADY_RUNNING',
        message_ar: 'عملية مسح الويب المغربي قيد التنفيذ حالياً، يرجى الانتظار بضع ثوانٍ.',
        message_fr: 'Une analyse du web marocain est déjà en cours, veuillez patienter quelques secondes.',
      });
    }

    activeManualScrapeInFlight = true;
    try {
      const sectorFilter = String(req.body?.sector || 'all').trim();
      const regionFilter = String(req.body?.region || 'all').trim();
      const result = await runPublicTendersScrape(db, {
        triggerType: 'manual',
        sectorFilter,
        regionFilter,
      });

      const allRows: any[] = db
        .prepare(`SELECT * FROM public_tenders ORDER BY scraped_at DESC, award_date DESC LIMIT 120`)
        .all();

      return res.json({
        success: true,
        run: result.run,
        newCount: result.newCount,
        updatedCount: result.updatedCount,
        tenders: allRows.map(mapRowToTender),
        nextMidnightAt: getNextMidnightCasablancaIso(),
      });
    } finally {
      activeManualScrapeInFlight = false;
    }
  } catch (err: any) {
    const code = String(err?.code || '');
    const status = Number(err?.status) || (code === 'GEMINI_API_KEY_MISSING' ? 503 : 500);
    return res.status(status).json({
      success: false,
      error: code || 'SCRAPE_ERROR',
      message_ar:
        code === 'GEMINI_API_KEY_MISSING'
          ? 'خدمة المسح الذكي غير مفعلة على الخادم حالياً (مفتاح الخدمة غير مضبوط).'
          : `تعذر إتمام مسح الصفقات العمومية حالياً: ${err?.message || 'خطأ في الخادم'}`,
      message_fr:
        code === 'GEMINI_API_KEY_MISSING'
          ? 'Le service d’extraction intelligente n’est pas configuré sur le serveur.'
          : `Impossible de finaliser l’analyse des marchés publics : ${err?.message || 'Erreur serveur'}`,
    });
  }
});

// ============================================================================
// FRONTEND SERVING (Vite Middleware in Dev, Static in Prod)
// ============================================================================

async function startServer() {
  // Start daily 00:00 (Africa/Casablanca) Moroccan Public Works Tenders Scraper
  startMidnightTendersScheduler(db, (result) => {
    for (const [uid] of sseClients.entries()) {
      pushSseEvent(uid, 'tenders_updated', {
        newCount: result.newCount,
        totalProcessed: result.tenders.length,
        finishedAt: result.run.finished_at,
      });
    }
  });

  if (isProd) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Mount Vite in middleware mode with HMR disabled to prevent WebSocket collisions
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Primary listener on port 3000 as required by environment
  app.listen(PRIMARY_PORT, '0.0.0.0', () => {
    console.log(`🚀 JADIJCB Full-Stack Server running on http://0.0.0.0:${PRIMARY_PORT} (${isProd ? 'Production' : 'Development'})`);
  });

  // Secondary listener if environment passes a different PORT (e.g. 8080)
  if (SECONDARY_PORT) {
    try {
      app.listen(SECONDARY_PORT, '0.0.0.0', () => {
        console.log(`🚀 Secondary listener active on http://0.0.0.0:${SECONDARY_PORT}`);
      });
    } catch (e) {
      console.warn('Secondary port bind notice:', e);
    }
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
