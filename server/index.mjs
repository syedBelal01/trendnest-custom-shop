console.log("🔥 NEW VERSION DEPLOYED");
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { normalizeIndianMobileOrThrow, normalizeIndianMobileOptional } from './indianPhone.mjs';
import { resolveMx } from 'dns/promises';
import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

console.log('[api] boot', { file: import.meta.url, cwd: process.cwd() });

function sanitizeProductDescription(raw) {
  const s = String(raw ?? '');
  if (!s.trim()) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(s);
  if (!looksLikeHtml) return s.trim();
  return sanitizeHtml(s, {
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'a'],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = String(attribs?.href ?? '').trim();
        if (!href) return { tagName: 'a', attribs: { rel: 'noopener noreferrer nofollow', target: '_blank' } };
        return {
          tagName: 'a',
          attribs: {
            href,
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
        };
      },
    },
  }).trim();
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// Always load .env from project root (folder above server/), not only from process.cwd()
// In local/dev, prefer values from the repo .env even if the parent process already has env vars set.
// In production, this has no effect because there is no repo .env file on the server.
dotenv.config({ path: join(__dirname, '..', '.env'), override: true });

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
/** Max days after delivery that a customer may request a return. */
const RETURN_WINDOW_DAYS = Math.max(1, Math.floor(Number(process.env.RETURN_WINDOW_DAYS || 7)));

// --- Shiprocket (shipping) ---
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;
const SHIPROCKET_WEBHOOK_SECRET = process.env.SHIPROCKET_WEBHOOK_SECRET;
// Shiprocket "Webhook Token" field is sent as x-api-key header.
const SHIPROCKET_WEBHOOK_TOKEN = process.env.SHIPROCKET_WEBHOOK_TOKEN;
// If true, require and verify the signature header for webhooks.
// Default false for backwards compatibility: Shiprocket commonly authenticates webhooks via x-api-key.
const SHIPROCKET_WEBHOOK_REQUIRE_SIGNATURE = String(process.env.SHIPROCKET_WEBHOOK_REQUIRE_SIGNATURE || '')
  .trim()
  .toLowerCase() === 'true';
const SHIPROCKET_PICKUP_LOCATION_NAME = process.env.SHIPROCKET_PICKUP_LOCATION_NAME;
const SHIPROCKET_PICKUP_PINCODE = process.env.SHIPROCKET_PICKUP_PINCODE;
const SHIPROCKET_HTTP_TIMEOUT_MS = Number(process.env.SHIPROCKET_HTTP_TIMEOUT_MS || 12_000);
const SHIPROCKET_CACHE_TTL_MS = Number(process.env.SHIPROCKET_CACHE_TTL_MS || 5 * 60_000);
const FREE_SHIPPING_MIN_TOTAL = process.env.FREE_SHIPPING_MIN_TOTAL != null ? Number(process.env.FREE_SHIPPING_MIN_TOTAL) : null;
const COD_SHIPPING_SURCHARGE = process.env.COD_SHIPPING_SURCHARGE != null ? Number(process.env.COD_SHIPPING_SURCHARGE) : null;
const SHIPROCKET_DEFAULT_WEIGHT_KG = Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG || 0.5);
const SHIPROCKET_DEFAULT_LENGTH_CM = Number(process.env.SHIPROCKET_DEFAULT_LENGTH_CM || 25);
const SHIPROCKET_DEFAULT_BREADTH_CM = Number(process.env.SHIPROCKET_DEFAULT_BREADTH_CM || 20);
const SHIPROCKET_DEFAULT_HEIGHT_CM = Number(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM || 5);
const FRONTEND_PUBLIC_URL = process.env.FRONTEND_PUBLIC_URL
  ? String(process.env.FRONTEND_PUBLIC_URL).trim().replace(/\/+$/, '')
  : 'https://trendnest99.in';
const REVIEW_INVITE_VALID_DAYS = Math.max(1, Math.floor(Number(process.env.REVIEW_INVITE_VALID_DAYS || 7)));
/** After a failed Shiprocket login, skip new auth attempts for this long (reduces load on bad credentials). */
const SHIPROCKET_AUTH_FAILURE_COOLDOWN_MS = Math.max(
  10_000,
  Math.floor(Number(process.env.SHIPROCKET_AUTH_FAILURE_COOLDOWN_MS || 90_000))
);
/** Max automated shipment creation attempts (first try + retries) before manualRequired. */
const SHIPROCKET_SHIPMENT_MAX_ATTEMPTS = Math.max(1, Math.floor(Number(process.env.SHIPROCKET_SHIPMENT_MAX_ATTEMPTS || 4)));
/** Base delay for exponential backoff between shipment retries (ms). */
const SHIPROCKET_SHIPMENT_RETRY_BASE_MS = Math.max(500, Math.floor(Number(process.env.SHIPROCKET_SHIPMENT_RETRY_BASE_MS || 2000)));
/** Cap for shipment retry delay (ms). */
const SHIPROCKET_SHIPMENT_RETRY_MAX_MS = Math.max(
  SHIPROCKET_SHIPMENT_RETRY_BASE_MS,
  Math.floor(Number(process.env.SHIPROCKET_SHIPMENT_RETRY_MAX_MS || 120_000))
);
/** When Shiprocket omits a parseable ETD, use this for ETA (days) so checkout can require a complete quote. */
const SHIPROCKET_FALLBACK_ETA_DAYS = Math.max(1, Math.floor(Number(process.env.SHIPROCKET_FALLBACK_ETA_DAYS || 5)));
/**
 * Dev / emergency only: allow COD & Razorpay checkout with ₹0 shipping when Shiprocket is down or not configured.
 * Production must leave this unset/false so totals always include a real quote.
 */
const ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE =
  (process.env.ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE || '').trim().toLowerCase() === 'true';

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

/** In-memory Shiprocket token cache (best-effort). */
const shiprocketTokenCache = {
  token: /** @type {string|null} */ (null),
  obtainedAtMs: 0,
  // token is typically valid for ~10 days, but we refresh conservatively.
  expiresAtMs: 0,
};

/** Recent auth failures — avoid hammering Shiprocket with invalid credentials or network errors. */
const shiprocketAuthFailureCache = {
  untilMs: 0,
  reason: /** @type {string} */ (''),
};

function recordShiprocketAuthFailure(reason) {
  const until = Date.now() + SHIPROCKET_AUTH_FAILURE_COOLDOWN_MS;
  shiprocketAuthFailureCache.untilMs = until;
  shiprocketAuthFailureCache.reason = String(reason || 'auth_error').slice(0, 300);
  logJson('warn', 'shiprocket.auth_cooldown_armed', {
    untilMs: until,
    cooldownMs: SHIPROCKET_AUTH_FAILURE_COOLDOWN_MS,
    reason: shiprocketAuthFailureCache.reason,
    trace: 'credentials_invalid_or_network',
  });
}

function clearShiprocketAuthFailure() {
  shiprocketAuthFailureCache.untilMs = 0;
  shiprocketAuthFailureCache.reason = '';
}

function logJson(level, event, fields) {
  const base = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(base);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** In-memory serviceability cache (best-effort). */
const shiprocketServiceabilityCache = new Map(); // key -> { value, expiresAtMs }

function shiprocketConfigured() {
  return !!(SHIPROCKET_EMAIL && SHIPROCKET_PASSWORD && SHIPROCKET_PICKUP_LOCATION_NAME && SHIPROCKET_PICKUP_PINCODE);
}

function normalizePincode(p) {
  return String(p || '').replace(/[^\d]/g, '').slice(0, 6);
}

function normalizePhoneDigits(p) {
  const digits = String(p || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  // Common case: +91XXXXXXXXXX or 91XXXXXXXXXX
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function isProbablyValidEmail(s) {
  const x = String(s || '').trim();
  // Intentionally simple: prevents empty/obviously malformed strings from hitting Shiprocket.
  return x.includes('@') && x.includes('.') && x.length >= 6 && x.length <= 200;
}

function summarizeShiprocketAdhocPayload(p) {
  // Avoid logging PII in production logs.
  const items = Array.isArray(p?.order_items) ? p.order_items : [];
  return {
    order_id: p?.order_id,
    order_date: p?.order_date,
    pickup_location: p?.pickup_location,
    billing_city: p?.billing_city,
    billing_state: p?.billing_state,
    billing_pincode: p?.billing_pincode,
    billing_country: p?.billing_country,
    billing_email_present: !!String(p?.billing_email || '').trim(),
    billing_phone_last4: String(p?.billing_phone || '').slice(-4),
    shipping_is_billing: p?.shipping_is_billing,
    payment_method: p?.payment_method,
    sub_total: p?.sub_total,
    dims: { length: p?.length, breadth: p?.breadth, height: p?.height, weight: p?.weight },
    items_count: items.length,
    items_summary: items.slice(0, 10).map((it) => ({
      sku_present: !!String(it?.sku || '').trim(),
      units: it?.units,
      selling_price: it?.selling_price,
    })),
  };
}

function clampNum(n, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

async function shiprocketLogin() {
  const now = Date.now();
  if (shiprocketAuthFailureCache.untilMs > now) {
    const err = new Error(
      shiprocketAuthFailureCache.reason || `Shiprocket auth paused until ${new Date(shiprocketAuthFailureCache.untilMs).toISOString()}`
    );
    err.code = 'SHIPROCKET_AUTH_COOLDOWN';
    err.untilMs = shiprocketAuthFailureCache.untilMs;
    logJson('warn', 'shiprocket.auth_skip_cooldown', { untilMs: shiprocketAuthFailureCache.untilMs });
    throw err;
  }
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    logJson('warn', 'shiprocket.login_skipped_no_credentials', { trace: 'set_SHIPROCKET_EMAIL_and_PASSWORD' });
    throw new Error('Shiprocket is not configured (missing SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD).');
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), SHIPROCKET_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(SHIPROCKET_EMAIL), password: String(SHIPROCKET_PASSWORD) }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data?.message === 'string' ? data.message : 'Shiprocket auth failed';
      logJson('error', 'shiprocket.auth_failed', { status: res.status, message: msg });
      recordShiprocketAuthFailure(msg);
      throw new Error(msg);
    }
    const token = String(data?.token || '').trim();
    if (!token) {
      recordShiprocketAuthFailure('Shiprocket auth returned no token');
      throw new Error('Shiprocket auth returned no token');
    }
    clearShiprocketAuthFailure();
    shiprocketTokenCache.token = token;
    shiprocketTokenCache.obtainedAtMs = Date.now();
    // Prefer API-provided expiry if present; otherwise refresh after 9 days (token typically 10 days).
    const expiresInSec = Number(data?.expires_in ?? data?.expiresIn ?? NaN);
    if (Number.isFinite(expiresInSec) && expiresInSec > 60) {
      shiprocketTokenCache.expiresAtMs = Date.now() + expiresInSec * 1000;
    } else {
      shiprocketTokenCache.expiresAtMs = Date.now() + 9 * 24 * 60 * 60_000;
    }
    logJson('info', 'shiprocket.auth_ok', { expiresAtMs: shiprocketTokenCache.expiresAtMs });
    return token;
  } catch (e) {
    if (e?.code === 'SHIPROCKET_AUTH_COOLDOWN') throw e;
    if (Date.now() < shiprocketAuthFailureCache.untilMs) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    recordShiprocketAuthFailure(msg);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function getShiprocketToken() {
  const now = Date.now();
  if (shiprocketTokenCache.token && shiprocketTokenCache.expiresAtMs > now + 60_000) {
    return shiprocketTokenCache.token;
  }
  return shiprocketLogin();
}

async function shiprocketFetch(path, { method = 'GET', headers, body, retry401 = true } = {}) {
  const token = await getShiprocketToken();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), SHIPROCKET_HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${SHIPROCKET_BASE_URL}${path}`, {
      method,
      headers: {
        ...(headers || {}),
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: controller.signal,
    });
    if (res.status === 401 && retry401) {
      // Token likely expired; refresh once.
      logJson('warn', 'shiprocket.unauthorized_refresh', { path, method });
      shiprocketTokenCache.token = null;
      shiprocketTokenCache.expiresAtMs = 0;
      return shiprocketFetch(path, { method, headers, body, retry401: false });
    }
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.toLowerCase().includes('aborted') || msg.toLowerCase().includes('abort');
    logJson('error', 'shiprocket.request_error', { path, method, timeout: isTimeout, message: msg });
    throw err;
  } finally {
    clearTimeout(t);
  }
}

async function cancelShiprocketOrderById(shiprocketOrderId, source = 'system') {
  const idNum = Number(shiprocketOrderId);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    logJson('warn', 'shiprocket.cancel_skipped_missing_id', { shiprocketOrderId: shiprocketOrderId ?? null, source });
    return { ok: false, skipped: true };
  }
  logJson('info', 'shiprocket.cancel_attempt', { shiprocketOrderId: idNum, source });
  const { res, data } = await shiprocketFetch('/orders/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [idNum] }),
  });
  logJson('info', 'shiprocket.cancel_response', {
    shiprocketOrderId: idNum,
    source,
    status: res.status,
    ok: res.ok,
    message: typeof data?.message === 'string' ? data.message : undefined,
    responseKeys: data && typeof data === 'object' ? Object.keys(data) : typeof data,
  });
  return { ok: res.ok, status: res.status, data };
}

// Keep the dev API server alive even if Mongo drops/reconnects.
// Routes guarded by `mongoReady` will return 503 while disconnected.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudKey = process.env.CLOUDINARY_API_KEY;
const cloudSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && cloudKey && cloudSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: cloudKey,
    api_secret: cloudSecret,
  });
}

const ProductEmbeddedReviewSchema = new mongoose.Schema(
  {
    id: String,
    userName: String,
    rating: Number,
    comment: String,
    date: String,
  },
  { _id: false }
);

const VariantOptionSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  images: { type: [String], default: [] },
});

const ProductSpecificationSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    sku: { type: String, default: '' },
    onlinePrice: { type: Number, default: undefined },
    codPrice: { type: Number, default: undefined },
    originalPrice: Number,
    images: { type: [String], default: [] },
    category: { type: String, required: true },
    subcategory: String,
    /** Manual ordering within a category (lower comes first). */
    displayOrder: { type: Number, default: undefined, index: true },
    sizes: [String],
    variantOptions: { type: [VariantOptionSchema], default: undefined },
    variants: [String],
    sleeveTypes: [String],
    // Internal-only: shipping attributes used for rate calculation/logistics. Optional; defaults applied when missing.
    shipWeightKg: { type: Number, default: undefined, min: 0 },
    shipLengthCm: { type: Number, default: undefined, min: 0 },
    shipWidthCm: { type: Number, default: undefined, min: 0 },
    shipHeightCm: { type: Number, default: undefined, min: 0 },
    /** Key-value product details (Brand, Material, etc.); only complete pairs are stored after normalize. */
    specifications: { type: [ProductSpecificationSchema], default: [] },
    /** New variants model (combinations with per-variant pricing/stock/SKU). */
    variantModel: { type: Object, default: undefined },
    stock: { type: Number, default: 0 },
    rating: { type: Number, default: 4 },
    reviews: { type: [ProductEmbeddedReviewSchema], default: [] },
    isCustomPrint: Boolean,
    isTrending: Boolean,
    isBestDeal: Boolean,
    tags: [String],
  },
  { versionKey: false }
);

const Product = mongoose.model('Product', ProductSchema);

// --- Admin product drafts (wizard autosave) ---
const ProductDraftSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // draftId
    status: { type: String, required: true, enum: ['draft', 'published'], default: 'draft', index: true },
    /** New main category (e.g. Home/Fashion/Electronics). */
    categoryMain: { type: String, default: '' },
    subcategory: { type: String, default: '' },
    /** Step 2 payload (name/description/sku/brand/tags/specifications/etc.) */
    details: { type: Object, default: {} },
    /** Step 3 payload */
    images: {
      type: {
        items: { type: [String], default: [] },
        primaryIndex: { type: Number, default: 0 },
      },
      default: () => ({ items: [], primaryIndex: 0 }),
      _id: false,
    },
    /** Step 4 payload */
    variants: { type: Object, default: {} },
    /** Internal-only: shipping attributes (optional). */
    shipping: { type: Object, default: {} },
    /** Product id created when published (optional). */
    publishedProductId: { type: String, default: '' },
  },
  { versionKey: false, timestamps: true }
);

const ProductDraft = mongoose.model('ProductDraft', ProductDraftSchema);

const SALE_BANNER_THEMES = ['default', 'winter', 'summer', 'eid', 'holi', 'diwali', 'flash'];
const SALE_BANNER_STATUSES = ['draft', 'live', 'disabled'];
const HERO_BANNER_SETTINGS_ID = 'hero-banner-settings';
const HERO_FIRST_SLIDE_MODES = ['auto', 'default', 'banner'];

const HeroSaleBannerSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // banner id
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    desktopImage: { type: String, required: true, trim: true },
    mobileImage: { type: String, default: '', trim: true },
    ctaText: { type: String, default: '', trim: true },
    ctaLink: { type: String, default: '', trim: true },
    theme: { type: String, enum: SALE_BANNER_THEMES, default: 'default', index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: { type: String, enum: SALE_BANNER_STATUSES, default: 'draft', index: true },
    priority: { type: Number, default: 100, index: true },
    targetCategory: { type: String, default: '', trim: true },
    targetProductIds: { type: [String], default: [] },
  },
  { versionKey: false, timestamps: true }
);
HeroSaleBannerSchema.index({ status: 1, startDate: 1, endDate: 1, priority: 1, createdAt: -1 });

const HeroSaleBanner = mongoose.model('HeroSaleBanner', HeroSaleBannerSchema);

const HeroBannerSettingSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    firstSlideMode: { type: String, enum: HERO_FIRST_SLIDE_MODES, default: 'auto' },
    firstBannerId: { type: String, default: '', trim: true },
  },
  { versionKey: false, timestamps: true }
);

const HeroBannerSetting = mongoose.model('HeroBannerSetting', HeroBannerSettingSchema);

// --- Auth (customer accounts) ---
const UserSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    name: { type: String, default: '' },
    addresses: {
      type: [
        {
          id: String,
          label: String,
          /** Delivery contact (required for new addresses). */
          recipientName: String,
          recipientPhone: String,
          address: String,
          city: String,
          state: String,
          pincode: String,
          isDefault: Boolean,
        },
      ],
      default: [],
    },
    passwordHash: { type: String, default: null },
    passwordSalt: { type: String, default: null },
    mustResetPassword: { type: Boolean, default: true },
  },
  { versionKey: false, timestamps: true }
);

const OtpChallengeSchema = new mongoose.Schema(
  {
    challengeId: { type: String, required: true, unique: true },
    purpose: { type: String, required: true }, // e.g. "checkout" | "password_reset"
    userId: { type: String, required: false },
    email: { type: String, required: true },
    codeHash: { type: String, required: true },
    codeSalt: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
  },
  { versionKey: false, timestamps: false }
);

/** Opaque bearer tokens when cross-origin session cookies are blocked (e.g. mobile WebViews). Raw token sent once; hash stored. */
const ClientAuthTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { versionKey: false, timestamps: false }
);

const User = mongoose.model('User', UserSchema);
const OtpChallenge = mongoose.model('OtpChallenge', OtpChallengeSchema);
const ClientAuthToken = mongoose.model('ClientAuthToken', ClientAuthTokenSchema);

// --- Disposable email domain blocklist ---
const DisposableDomainSchema = new mongoose.Schema(
  {
    /** Lowercased domain, stored as document id (e.g. "mailinator.com"). */
    _id: { type: String, required: true },
    enabled: { type: Boolean, default: true, index: true },
    source: { type: String, default: '' }, // e.g. "seed" | "admin"
    reason: { type: String, default: '' },
  },
  { versionKey: false, timestamps: true, collection: 'disposable_domains' }
);

const DailyAuthMetricSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // YYYY-MM-DD
    blockedDisposable: { type: Number, default: 0 },
    blockedNoMx: { type: Number, default: 0 },
    blockedMxLookupFailed: { type: Number, default: 0 },
    rateLimitHits: { type: Number, default: 0 },
  },
  { versionKey: false, timestamps: true, collection: 'daily_auth_metrics' }
);

const DisposableDomain = mongoose.model('DisposableDomain', DisposableDomainSchema);
const DailyAuthMetric = mongoose.model('DailyAuthMetric', DailyAuthMetricSchema);

// --- Disposable domains cache (single instance) ---
const DISPOSABLE_DOMAIN_CACHE_TTL_MS = Math.max(10_000, Number(process.env.DISPOSABLE_DOMAIN_CACHE_TTL_MS || 5 * 60_000));
let disposableDomainCacheLoadedAtMs = 0;
/** @type {Set<string>} */
let disposableDomainCacheSet = new Set();

async function loadDisposableDomainsIfStale() {
  if (mongoose.connection.readyState !== 1) return;
  const now = Date.now();
  if (now - disposableDomainCacheLoadedAtMs < DISPOSABLE_DOMAIN_CACHE_TTL_MS && disposableDomainCacheSet.size > 0) return;
  const docs = await DisposableDomain.find({ enabled: true }).select({ _id: 1 }).lean();
  disposableDomainCacheSet = new Set((docs || []).map((d) => String(d._id || '').trim().toLowerCase()).filter(Boolean));
  disposableDomainCacheLoadedAtMs = now;
}

async function isDisposableDomain(domainLower) {
  const domain = String(domainLower || '').trim().toLowerCase();
  if (!domain) return false;
  await loadDisposableDomainsIfStale();
  return disposableDomainCacheSet.has(domain);
}

function invalidateDisposableDomainCache() {
  disposableDomainCacheLoadedAtMs = 0;
}

function upsertDisposableDomainCache(domainLower, enabled) {
  const domain = String(domainLower || '').trim().toLowerCase();
  if (!domain) return;
  if (enabled) disposableDomainCacheSet.add(domain);
  else disposableDomainCacheSet.delete(domain);
  disposableDomainCacheLoadedAtMs = Date.now();
}

// --- MX validation (single instance cache) ---
const MX_CACHE_TTL_MS = Math.max(10_000, Number(process.env.MX_CACHE_TTL_MS || 15 * 60_000));
const MX_LOOKUP_TIMEOUT_MS = Math.max(250, Number(process.env.MX_LOOKUP_TIMEOUT_MS || 2000));
/** @type {Map<string, { atMs: number, ok: boolean }>} */
const mxCache = new Map();

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ]);
}

async function hasValidMxOrThrow(domainLower) {
  const domain = String(domainLower || '').trim().toLowerCase();
  if (!domain) throw new Error('Invalid email');
  const cached = mxCache.get(domain);
  const now = Date.now();
  if (cached && now - cached.atMs < MX_CACHE_TTL_MS) {
    if (!cached.ok) throw new Error('no_mx');
    return true;
  }

  try {
    const records = await withTimeout(resolveMx(domain), MX_LOOKUP_TIMEOUT_MS);
    const ok = Array.isArray(records) && records.length > 0;
    mxCache.set(domain, { atMs: now, ok });
    if (!ok) throw new Error('no_mx');
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e || '');
    // Treat explicit no-record cases as no_mx; everything else is lookup failure.
    if (msg === 'no_mx' || /ENODATA|ENOTFOUND|NXDOMAIN/i.test(msg)) {
      mxCache.set(domain, { atMs: now, ok: false });
      throw new Error('no_mx');
    }
    throw new Error('mx_lookup_failed');
  }
}

// --- Rate limiting (single instance) ---
const SIGNUP_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.SIGNUP_RATE_LIMIT_WINDOW_MS || 60_000));
const SIGNUP_RATE_LIMIT_MAX = Math.max(1, Number(process.env.SIGNUP_RATE_LIMIT_MAX || 5));
const UPLOAD_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 60_000));
const UPLOAD_RATE_LIMIT_MAX = Math.max(1, Number(process.env.UPLOAD_RATE_LIMIT_MAX || 20));
const IMAGE_UPLOAD_MAX_BYTES = Math.max(1 * 1024 * 1024, Number(process.env.IMAGE_UPLOAD_MAX_BYTES || 20 * 1024 * 1024));
const DESIGN_UPLOAD_MAX_BYTES = Math.max(1 * 1024 * 1024, Number(process.env.DESIGN_UPLOAD_MAX_BYTES || 8 * 1024 * 1024));
const PAYMENT_CREATE_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.PAYMENT_CREATE_RATE_LIMIT_WINDOW_MS || 60_000));
const PAYMENT_CREATE_RATE_LIMIT_MAX = Math.max(1, Number(process.env.PAYMENT_CREATE_RATE_LIMIT_MAX || 10));
const PAYMENT_VERIFY_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.PAYMENT_VERIFY_RATE_LIMIT_WINDOW_MS || 60_000));
const PAYMENT_VERIFY_RATE_LIMIT_MAX = Math.max(1, Number(process.env.PAYMENT_VERIFY_RATE_LIMIT_MAX || 20));
const ORDER_CREATE_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.ORDER_CREATE_RATE_LIMIT_WINDOW_MS || 60_000));
const ORDER_CREATE_RATE_LIMIT_MAX = Math.max(1, Number(process.env.ORDER_CREATE_RATE_LIMIT_MAX || 8));
const ORDER_CANCEL_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.ORDER_CANCEL_RATE_LIMIT_WINDOW_MS || 60_000));
const ORDER_CANCEL_RATE_LIMIT_MAX = Math.max(1, Number(process.env.ORDER_CANCEL_RATE_LIMIT_MAX || 8));
const ADMIN_KEY_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.ADMIN_KEY_RATE_LIMIT_WINDOW_MS || 60_000));
const ADMIN_KEY_RATE_LIMIT_MAX = Math.max(1, Number(process.env.ADMIN_KEY_RATE_LIMIT_MAX || 25));
const WEBHOOK_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || 60_000));
const WEBHOOK_RATE_LIMIT_MAX = Math.max(1, Number(process.env.WEBHOOK_RATE_LIMIT_MAX || 240));
/** @type {Map<string, { count: number, resetAtMs: number }>} */
const ipRateLimitMap = new Map();

function getClientIp(req) {
  const ip = req?.ip ? String(req.ip) : '';
  return ip || 'unknown';
}

function rateLimitByIp({ keyPrefix, limit, windowMs }) {
  return async function rateLimitMiddleware(req, res, next) {
    try {
      const ip = getClientIp(req);
      const key = `${keyPrefix}:${ip}`;
      const now = Date.now();
      const cur = ipRateLimitMap.get(key);
      if (!cur || cur.resetAtMs <= now) {
        ipRateLimitMap.set(key, { count: 1, resetAtMs: now + windowMs });
        next();
        return;
      }
      if (cur.count >= limit) {
        logJson('warn', 'ratelimit.hit', { ip, path: req.path });
        await bumpDailyAuthMetric('rateLimitHits', 1);
        res.status(429).json({ error: 'Too many attempts. Please try again in a minute.' });
        return;
      }
      cur.count += 1;
      ipRateLimitMap.set(key, cur);
      next();
    } catch (e) {
      console.error(e);
      next();
    }
  };
}

const uploadRateLimit = rateLimitByIp({
  keyPrefix: 'upload',
  limit: UPLOAD_RATE_LIMIT_MAX,
  windowMs: UPLOAD_RATE_LIMIT_WINDOW_MS,
});
const paymentCreateRateLimit = rateLimitByIp({
  keyPrefix: 'payment_create',
  limit: PAYMENT_CREATE_RATE_LIMIT_MAX,
  windowMs: PAYMENT_CREATE_RATE_LIMIT_WINDOW_MS,
});
const paymentVerifyRateLimit = rateLimitByIp({
  keyPrefix: 'payment_verify',
  limit: PAYMENT_VERIFY_RATE_LIMIT_MAX,
  windowMs: PAYMENT_VERIFY_RATE_LIMIT_WINDOW_MS,
});
const orderCreateRateLimit = rateLimitByIp({
  keyPrefix: 'order_create',
  limit: ORDER_CREATE_RATE_LIMIT_MAX,
  windowMs: ORDER_CREATE_RATE_LIMIT_WINDOW_MS,
});
const orderCancelRateLimit = rateLimitByIp({
  keyPrefix: 'order_cancel',
  limit: ORDER_CANCEL_RATE_LIMIT_MAX,
  windowMs: ORDER_CANCEL_RATE_LIMIT_WINDOW_MS,
});
const adminKeyRateLimit = rateLimitByIp({
  keyPrefix: 'admin_key',
  limit: ADMIN_KEY_RATE_LIMIT_MAX,
  windowMs: ADMIN_KEY_RATE_LIMIT_WINDOW_MS,
});
const webhookRateLimit = rateLimitByIp({
  keyPrefix: 'webhook',
  limit: WEBHOOK_RATE_LIMIT_MAX,
  windowMs: WEBHOOK_RATE_LIMIT_WINDOW_MS,
});

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: ['percentage', 'flat'] }, // free_delivery is not supported
    value: { type: Number, required: true }, // percentage or flat amount
    maxDiscount: { type: Number, default: undefined }, // optional cap on discount amount
    minOrder: { type: Number, default: 0 },

    // Applicability
    scope: { type: String, required: true, enum: ['cart', 'products', 'categories'] },
    productIds: { type: [String], default: [] },
    categoryIds: { type: [String], default: [] },
    /** Optional: when set, coupon applies only if cart contains at least one matching SKU. Empty → applies to all. */
    applicableSkus: { type: [String], default: [] },

    // Valid time period
    startAt: { type: Date, default: undefined },
    endAt: { type: Date, default: undefined },

    isActive: { type: Boolean, default: true },

    // Usage limits
    usageTotalLimit: { type: Number, default: undefined }, // optional total times coupon can be used
    usagePerUserLimit: { type: Number, default: undefined }, // optional times per user

    // Restrictions (optional)
    newUsersOnly: { type: Boolean, default: false },
    allowedUserGroups: { type: [String], default: [] }, // placeholder for future group model
  },
  { versionKey: false, timestamps: true }
);

const Coupon = mongoose.model('Coupon', CouponSchema);

const CouponUsageSchema = new mongoose.Schema(
  {
    couponId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    count: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: undefined },
  },
  { versionKey: false, timestamps: true }
);

CouponUsageSchema.index({ couponId: 1, userId: 1 }, { unique: true });

const CouponUsage = mongoose.model('CouponUsage', CouponUsageSchema);

function normalizeCouponCode(code) {
  return String(code || '').trim().toUpperCase();
}

// --- Visitor analytics (admin-only visibility) ---
const VisitorSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, unique: true, index: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
  },
  { versionKey: false, collection: 'visitors' }
);

const Visitor = mongoose.model('Visitor', VisitorSchema);

const ReviewSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    productId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    images: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, default: '' },
        },
      ],
      default: [],
      _id: false,
    },
    media: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, default: '' },
          kind: { type: String, enum: ['image', 'video'], default: 'image' },
        },
      ],
      default: [],
      _id: false,
    },
  },
  { versionKey: false, timestamps: true }
);

ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
ReviewSchema.index({ productId: 1, createdAt: -1, _id: -1 });

const Review = mongoose.model('Review', ReviewSchema);

const ReviewInviteSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    tokenPrefix: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    deliveredAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: undefined },
    revokedAt: { type: Date, default: undefined },
  },
  { versionKey: false, timestamps: true }
);

ReviewInviteSchema.index({ userId: 1, orderId: 1, productId: 1 }, { unique: true });
// Optional cleanup: expired invites can be removed automatically.
ReviewInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ReviewInvite = mongoose.model('ReviewInvite', ReviewInviteSchema);

const ReviewPromptDismissalSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    dismissedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, timestamps: true }
);

ReviewPromptDismissalSchema.index({ userId: 1, productId: 1 }, { unique: true });

const ReviewPromptDismissal = mongoose.model('ReviewPromptDismissal', ReviewPromptDismissalSchema);

function toDateOrUndefined(raw) {
  if (raw == null || raw === '') return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

async function validateCouponForCart({ code, subtotal, items, userId }) {
  const couponCode = normalizeCouponCode(code);
  if (!couponCode) {
    return { ok: false, error: 'Coupon code is required' };
  }

  const coupon = await Coupon.findOne({ code: couponCode }).lean();
  if (!coupon || !coupon.isActive) {
    return { ok: false, error: 'Invalid or expired coupon' };
  }

  const now = Date.now();
  if (coupon.startAt && coupon.startAt.getTime && coupon.startAt.getTime() > now) {
    return { ok: false, error: 'Coupon is not active yet' };
  }
  if (coupon.endAt && coupon.endAt.getTime && coupon.endAt.getTime() < now) {
    return { ok: false, error: 'Coupon has expired' };
  }

  const sub = Number(subtotal);
  if (!Number.isFinite(sub) || sub < 0) return { ok: false, error: 'Invalid cart subtotal' };
  if (sub < Number(coupon.minOrder || 0)) {
    return { ok: false, error: `Minimum order ₹${coupon.minOrder || 0} required` };
  }

  const productIds = (items || []).map(i => String(i.productId)).filter(Boolean);
  const uniqIds = [...new Set(productIds)];
  const products = uniqIds.length ? await Product.find({ _id: { $in: uniqIds } }).lean() : [];
  const productById = new Map(products.map(p => [String(p._id), p]));

  const cartProductIds = new Set(productIds);
  const cartCategories = new Set(
    products
      .map(p => p?.category)
      .filter(Boolean)
      .map(String)
  );

  const cartSkus = new Set();
  for (const line of items || []) {
    const p = productById.get(String(line?.productId));
    if (!p) continue;
    const sv = line?.selectedVariant ? String(line.selectedVariant) : '';
    const vm = p.variantModel && typeof p.variantModel === 'object' ? p.variantModel : null;
    if (vm && Array.isArray(vm.items) && sv) {
      const hit = vm.items.find((it) => String(it?.key) === String(sv));
      const sku = hit?.sku ? String(hit.sku).trim() : '';
      if (sku) cartSkus.add(sku);
    } else {
      const sku = p?.sku ? String(p.sku).trim() : '';
      if (sku) cartSkus.add(sku);
    }
  }

  const applicableSkus = Array.isArray(coupon.applicableSkus)
    ? coupon.applicableSkus.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (applicableSkus.length) {
    const ok = applicableSkus.some((sku) => cartSkus.has(String(sku)));
    if (!ok) return { ok: false, error: 'Coupon does not apply to selected products' };
  }

  if (coupon.scope === 'products') {
    if (!Array.isArray(coupon.productIds) || coupon.productIds.length === 0) {
      return { ok: false, error: 'Coupon is not configured for products' };
    }
    const ok = coupon.productIds.some(pid => cartProductIds.has(String(pid)));
    if (!ok) return { ok: false, error: 'Coupon does not apply to selected products' };
  }

  if (coupon.scope === 'categories') {
    if (!Array.isArray(coupon.categoryIds) || coupon.categoryIds.length === 0) {
      return { ok: false, error: 'Coupon is not configured for categories' };
    }
    const ok = coupon.categoryIds.some(cid => cartCategories.has(String(cid)));
    if (!ok) return { ok: false, error: 'Coupon does not apply to selected categories' };
  }

  if (coupon.newUsersOnly) {
    if (!userId) return { ok: false, error: 'This coupon is for new users only' };
    const u = await User.findById(userId).lean();
    // In this app, "new users" are accounts that haven't set a password yet.
    const isNew = !!u?.mustResetPassword;
    if (!isNew) return { ok: false, error: 'This coupon is for new users only' };
  }

  // Usage validation (best-effort: enforce total and per-user only when userId exists)
  if (coupon.usageTotalLimit != null && Number.isFinite(Number(coupon.usageTotalLimit))) {
    const usedTotal = await CouponUsage.countDocuments({ couponId: String(coupon._id) });
    if (usedTotal >= Number(coupon.usageTotalLimit)) {
      return { ok: false, error: 'Coupon usage limit reached' };
    }
  }

  if (coupon.usagePerUserLimit != null && userId) {
    const u = await CouponUsage.findOne({ couponId: String(coupon._id), userId: String(userId) }).lean();
    const usedByUser = u?.count ? Number(u.count) : 0;
    if (usedByUser >= Number(coupon.usagePerUserLimit)) {
      return { ok: false, error: 'You already used this coupon' };
    }
  }

  // Compute discount amount
  const val = Number(coupon.value);
  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = Math.round((sub * val) / 100);
  } else if (coupon.type === 'flat') {
    discount = val;
  }

  if (coupon.maxDiscount != null && Number.isFinite(Number(coupon.maxDiscount))) {
    discount = Math.min(discount, Number(coupon.maxDiscount));
  }

  discount = Math.max(0, Math.min(discount, sub));

  return { ok: true, couponCode: coupon.code, discount, couponId: String(coupon._id) };
}

const MAX_CUSTOM_INLINE_BYTES = 500 * 1024;
const ORDER_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const RETURN_REQUEST_STATUSES = ['requested', 'approved', 'rejected', 'picked_up', 'received', 'refunded'];

const ReturnRequestTimelineSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    action: { type: String, required: true },
    actor: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const ReturnRequestLineSchema = new mongoose.Schema(
  {
    lineId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ReturnReverseShipmentSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ['manual', 'shiprocket'], default: 'manual' },
    awb: { type: String, default: '' },
    courierName: { type: String, default: '' },
    shipmentId: { type: Number, default: undefined },
    provider: { type: String, default: '' },
    timeline: { type: [Object], default: [] },
    webhookDedupeKeys: { type: [String], default: [] },
  },
  { _id: false }
);

const ReturnRefundSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['razorpay', 'manual', 'store_credit'], default: 'manual' },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    amount: { type: Number, default: undefined },
    currency: { type: String, default: 'INR' },
    razorpayRefundId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    error: { type: String, default: '' },
    processedAt: { type: Date, default: undefined },
  },
  { _id: false }
);

const OrderCancelRefundSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['razorpay', 'none'], default: 'none' },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    amount: { type: Number, default: undefined },
    currency: { type: String, default: 'INR' },
    razorpayRefundId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    error: { type: String, default: '' },
    processedAt: { type: Date, default: undefined },
  },
  { _id: false }
);

const ReturnRequestSchema = new mongoose.Schema(
  {
    returnId: { type: String, required: true },
    status: { type: String, enum: RETURN_REQUEST_STATUSES, default: 'requested' },
    scope: { type: String, enum: ['full', 'partial'], default: 'full' },
    lines: { type: [ReturnRequestLineSchema], default: [] },
    reason: { type: String, default: '' },
    images: { type: [String], default: [] },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: undefined },
    rejectedAt: { type: Date, default: undefined },
    pickedUpAt: { type: Date, default: undefined },
    receivedAt: { type: Date, default: undefined },
    refundedAt: { type: Date, default: undefined },
    rejectionReason: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    reverseShipment: { type: ReturnReverseShipmentSchema, default: undefined },
    refund: { type: ReturnRefundSchema, default: undefined },
    timeline: { type: [ReturnRequestTimelineSchema], default: [] },
  },
  { _id: false }
);

const OrderLineSchema = new mongoose.Schema(
  {
    lineId: String,
    productId: { type: String, required: true },
    sku: { type: String, default: '' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    selectedSize: String,
    selectedVariant: String,
    selectedSleeve: String,
    customDesignUrl: String,
    customDesignName: String,
    customProductType: String,
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, default: undefined },
      pincode: { type: String, required: true },
    },
    // Optional authenticated customer relation (set after OTP verification).
    userId: { type: String, default: undefined },
    items: { type: [OrderLineSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: String,
    /** Merchandise after discount (before shipping). */
    goodsTotal: { type: Number, default: undefined },
    shippingCharge: { type: Number, default: 0 },
    /** Internal-only: real Shiprocket shipping charge (never shown to customers). */
    actualShippingCharge: { type: Number, default: 0 },
    freeShippingApplied: { type: Boolean, default: false },
    total: { type: Number, required: true },
    // Payment is separate from fulfillment `status` (keeps COD flow unchanged).
    paymentMethod: { type: String, enum: ['cod', 'razorpay'], default: 'cod' },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'failed'], default: 'unpaid' },
    amountDue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    paidAt: Date,
    paymentFailureReason: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    shipping: {
      type: {
        provider: { type: String, default: undefined }, // 'shiprocket'
        serviceability: { type: Object, default: undefined }, // quote snapshot
        idempotencyKey: { type: String, default: undefined },
        shipmentRequestedAt: { type: Date, default: undefined },
        shipmentCreatedAt: { type: Date, default: undefined },
        // Shiprocket identifiers
        shiprocketOrderId: { type: String, default: undefined },
        shipmentId: { type: Number, default: undefined },
        awb: { type: String, default: undefined },
        courierId: { type: Number, default: undefined },
        courierName: { type: String, default: undefined },
        estimatedDeliveryDate: { type: Date, default: undefined },
        trackingStatus: { type: String, default: undefined },
        timeline: { type: [Object], default: [] },
        manualRequired: { type: Boolean, default: false },
        manualReason: { type: String, default: undefined },
        error: { type: String, default: undefined },
        courierSelection: { type: Object, default: undefined },
        rto: { type: Object, default: undefined },
        cancelledAt: { type: Date, default: undefined },
        /** True when shippingCharge/total used ₹0 placeholder (relaxed checkout); cleared after recalc. */
        estimated: { type: Boolean, default: undefined },
        /** True when serviceability-based shipping amount is locked in (checkout quote or post-recalc). */
        finalized: { type: Boolean, default: undefined },
        quoteRecalcAt: { type: Date, default: undefined },
        quoteRecalcError: { type: String, default: undefined },
        /** Set when final shipping exceeds what was collected (esp. prepaid relaxed orders). */
        pricingPendingReview: { type: Boolean, default: undefined },
        balanceDueShipping: { type: Number, default: undefined },
        shipmentAttemptCount: { type: Number, default: 0 },
        shipmentLastFailureAt: { type: Date, default: undefined },
        lastUpdatedAt: { type: Date, default: undefined },
      },
      default: undefined,
    },
    /** Admin queue: shipping/manual/retry/quote issues. */
    needsShippingReview: { type: Boolean, default: false },
    /** Admin queue: unpaid shipping balance or prepaid amount due after adjustment. */
    paymentPending: { type: Boolean, default: false },
    hasCustomPrint: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'confirmed',
    },
    shippedAt: Date,
    deliveredAt: Date,
    shippedEmailSentAt: Date,
    deliveredEmailSentAt: Date,
    emailSentAt: Date,
    emailError: String,
    /** When inventory was deducted successfully (prevents double-deduction on retries). */
    stockDeductedAt: Date,
    returnRequests: { type: [ReturnRequestSchema], default: [] },
    cancelledAt: Date,
    cancellationReason: { type: String, default: '' },
    cancellationRefund: { type: OrderCancelRefundSchema, default: undefined },
  },
  { versionKey: false, timestamps: true }
);

const Order = mongoose.model('Order', OrderSchema);

/** Tracks idempotent DB migrations (one document per migration id). */
const AppMigrationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    ranAt: { type: Date, default: Date.now },
  },
  { versionKey: false, collection: 'app_migrations' }
);
const AppMigration = mongoose.model('AppMigration', AppMigrationSchema);

// --- Payment sessions (online payments) ---
const PAYMENT_SESSION_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'expired'];
const PaymentSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    status: { type: String, enum: PAYMENT_SESSION_STATUSES, default: 'pending', index: true },
    expiresAt: { type: Date, required: true, index: true },
    userId: { type: String, default: undefined },
    customer: { type: Object, default: {} },
    items: { type: [OrderLineSchema], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: String,
    goodsTotal: { type: Number, default: undefined },
    shippingCharge: { type: Number, default: 0 },
    /** Internal-only: real Shiprocket shipping charge (never shown to customers). */
    actualShippingCharge: { type: Number, default: 0 },
    freeShippingApplied: { type: Boolean, default: false },
    total: { type: Number, required: true },
    hasCustomPrint: { type: Boolean, default: false },
    // Razorpay identifiers
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    paidAt: Date,
    orderId: String, // created Order._id after payment success
    error: String,
    /** Relaxed checkout: order created with provisional ₹0 shipping until Shiprocket recalc. */
    shippingPlaceholder: { type: Boolean, default: false },
    /** Snapshot of `resolveShippingChargeForPricing` result when checkout had a real quote (for Order shipping doc). */
    shippingQuoteSnapshot: { type: Object, default: undefined },
  },
  { versionKey: false, timestamps: true }
);
PaymentSessionSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
const PaymentSession = mongoose.model('PaymentSession', PaymentSessionSchema);

function serialize(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = o._id;
  delete o._id;
  return { id, ...o };
}

/** Normalize product.specifications for JSON (Mongo may omit key or use odd shapes). */
function serializeProductDoc(doc) {
  const o = serialize(doc);
  if (!o) return null;
  // Internal-only shipping attributes should not be exposed to storefront clients.
  delete o.shipWeightKg;
  delete o.shipLengthCm;
  delete o.shipWidthCm;
  delete o.shipHeightCm;
  const raw = o.specifications;
  if (!Array.isArray(raw)) {
    o.specifications = [];
  } else {
    o.specifications = raw
      .map((row) => ({
        label: String(row?.label ?? '').trim(),
        value: String(row?.value ?? '').trim(),
      }))
      .filter((x) => x.label.length > 0 && x.value.length > 0);
  }

  // Keep derived stock consistent for variantModel products.
  // `o.stock` is treated as a derived display value (sum of variant stocks).
  if (o.variantModel && Array.isArray(o.variantModel.items)) {
    let sum = 0;
    o.variantModel.items = o.variantModel.items.map((it) => {
      const s = Math.max(0, Math.floor(Number(it?.stock) || 0));
      sum += s;
      return { ...it, stock: s };
    });
    o.stock = sum;
  } else {
    o.stock = Math.max(0, Math.floor(Number(o.stock) || 0));
  }
  return o;
}

function isoDate(d) {
  if (!d) return undefined;
  if (d instanceof Date) return d.toISOString();
  try {
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? undefined : x.toISOString();
  } catch {
    return undefined;
  }
}

function serializeReturnTimelineEntry(e) {
  if (!e) return e;
  return { ...e, at: isoDate(e.at) };
}

function serializeReturnRequest(r) {
  if (!r) return null;
  const rev = r.reverseShipment;
  return {
    ...r,
    requestedAt: isoDate(r.requestedAt),
    approvedAt: isoDate(r.approvedAt),
    rejectedAt: isoDate(r.rejectedAt),
    pickedUpAt: isoDate(r.pickedUpAt),
    receivedAt: isoDate(r.receivedAt),
    refundedAt: isoDate(r.refundedAt),
    timeline: Array.isArray(r.timeline) ? r.timeline.map(serializeReturnTimelineEntry) : [],
    reverseShipment: rev
      ? {
          ...rev,
          timeline: Array.isArray(rev.timeline) ? rev.timeline.map(serializeReturnTimelineEntry) : [],
        }
      : undefined,
    refund: r.refund
      ? { ...r.refund, processedAt: isoDate(r.refund.processedAt) }
      : undefined,
  };
}

function stableOrderLineId(item, index) {
  if (item?.lineId != null && String(item.lineId).trim()) return String(item.lineId).trim();
  return `idx:${index}`;
}

function hasBlockingReturn(order) {
  const block = new Set(['requested', 'approved', 'picked_up', 'received']);
  const list = Array.isArray(order?.returnRequests) ? order.returnRequests : [];
  return list.some((x) => block.has(String(x?.status || '')));
}

function getReturnedQtyByLine(order) {
  const map = new Map();
  const list = Array.isArray(order?.returnRequests) ? order.returnRequests : [];
  for (const ret of list) {
    if (String(ret?.status) === 'rejected') continue;
    const lines = Array.isArray(ret?.lines) ? ret.lines : [];
    for (const ln of lines) {
      const lid = String(ln?.lineId || '');
      const q = Math.max(0, Math.floor(Number(ln?.quantity) || 0));
      if (!lid || !q) continue;
      map.set(lid, (map.get(lid) || 0) + q);
    }
  }
  return map;
}

function assertReturnEligible(order) {
  if (order?.hasCustomPrint) {
    const e = new Error('Returns are not available for custom print orders');
    e.statusCode = 400;
    throw e;
  }
  if (String(order?.status || '') !== 'delivered') {
    const e = new Error('Returns are only available after delivery');
    e.statusCode = 400;
    throw e;
  }
  const deliveredAt = order?.deliveredAt ? new Date(order.deliveredAt) : null;
  if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) {
    const e = new Error('Delivery date is not recorded for this order yet');
    e.statusCode = 400;
    throw e;
  }
  const deadline = deliveredAt.getTime() + RETURN_WINDOW_DAYS * 86400000;
  if (Date.now() > deadline) {
    const e = new Error(`Return window expired (${RETURN_WINDOW_DAYS} days from delivery)`);
    e.statusCode = 400;
    throw e;
  }
  if (hasBlockingReturn(order)) {
    const e = new Error('A return is already in progress for this order');
    e.statusCode = 409;
    throw e;
  }
}

function validateReturnLines(order, bodyLines, scope) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const byId = items.map((it, i) => ({ it, id: stableOrderLineId(it, i) }));
  const returned = getReturnedQtyByLine(order);

  if (scope !== 'partial') {
    for (const { it, id } of byId) {
      const already = returned.get(id) || 0;
      if (already > 0) {
        throw new Error('Some items were already returned; use a partial return for remaining quantities');
      }
    }
    return byId.map(({ it, id }) => ({
      lineId: id,
      quantity: Math.max(0, Math.floor(Number(it.quantity) || 0)),
    }));
  }

  if (!Array.isArray(bodyLines) || bodyLines.length === 0) {
    throw new Error('Select at least one item and quantity to return');
  }
  const out = [];
  for (const row of bodyLines) {
    const lid = String(row?.lineId || '').trim();
    const qty = Math.max(0, Math.floor(Number(row?.quantity) || 0));
    const hit = byId.find((x) => x.id === lid);
    if (!hit) throw new Error(`Invalid line: ${lid}`);
    const maxQ = (Number(hit.it.quantity) || 0) - (returned.get(lid) || 0);
    if (qty <= 0 || qty > maxQ) throw new Error(`Invalid quantity for line ${lid}`);
    out.push({ lineId: lid, quantity: qty });
  }
  return out;
}

function computeReturnGoodsRefund(order, lines) {
  const items = Array.isArray(order?.items) ? order.items : [];
  let sum = 0;
  for (const ln of lines || []) {
    const idx = items.findIndex((it, i) => stableOrderLineId(it, i) === String(ln.lineId));
    if (idx < 0) continue;
    const it = items[idx];
    sum += (Number(it.price) || 0) * (Number(ln.quantity) || 0);
  }
  return Math.max(0, Math.round(sum * 100) / 100);
}

function serializeOrder(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = o._id;
  delete o._id;
  const out = { id, ...o };
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString();
  if (out.updatedAt instanceof Date) out.updatedAt = out.updatedAt.toISOString();
  if (out.deliveredAt instanceof Date) out.deliveredAt = out.deliveredAt.toISOString();
  if (out.shippedAt instanceof Date) out.shippedAt = out.shippedAt.toISOString();
  if (out.paidAt instanceof Date) out.paidAt = out.paidAt.toISOString();
  if (out.cancelledAt instanceof Date) out.cancelledAt = out.cancelledAt.toISOString();
  if (out.cancellationRefund && typeof out.cancellationRefund === 'object') {
    if (out.cancellationRefund.processedAt instanceof Date) {
      out.cancellationRefund.processedAt = out.cancellationRefund.processedAt.toISOString();
    }
  }
  if (Array.isArray(out.returnRequests)) {
    out.returnRequests = out.returnRequests.map(serializeReturnRequest);
  }
  return out;
}

function stripShippingRatesDeep(x) {
  if (!x || typeof x !== 'object') return x;
  try {
    const o = JSON.parse(JSON.stringify(x));
    const sug = o?.courierSuggestions;
    if (Array.isArray(sug)) {
      o.courierSuggestions = sug.map((c) => {
        const cc = c && typeof c === 'object' ? { ...c } : {};
        delete cc.rate;
        return cc;
      });
    }
    return o;
  } catch {
    return x;
  }
}

function serializeOrderForClient(doc) {
  const out = serializeOrder(doc);
  if (!out) return null;
  // Never expose internal shipping cost or courier rates to customers.
  delete out.actualShippingCharge;
  if (out.shipping && typeof out.shipping === 'object') {
    if (out.shipping.serviceability) out.shipping.serviceability = stripShippingRatesDeep(out.shipping.serviceability);
    // Optional: also strip any courierSelection rate-like fields if present later.
  }
  return out;
}

function serializeOrderForAdmin(doc) {
  // Admin can see actualShippingCharge; keep full record.
  return serializeOrder(doc);
}

function serializePaymentSession(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = o._id;
  delete o._id;
  const out = { id, ...o };
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString();
  if (out.updatedAt instanceof Date) out.updatedAt = out.updatedAt.toISOString();
  if (out.expiresAt instanceof Date) out.expiresAt = out.expiresAt.toISOString();
  if (out.paidAt instanceof Date) out.paidAt = out.paidAt.toISOString();
  return out;
}

function serializePaymentSessionForClient(doc) {
  const out = serializePaymentSession(doc);
  if (!out) return null;
  delete out.actualShippingCharge;
  // Never expose stored shipping quote details to customers.
  delete out.shippingQuoteSnapshot;
  return out;
}

function adminKeyRequired(req, res, next) {
  adminKeyRateLimit(req, res, () => {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) {
      res.status(503).json({ error: 'ADMIN_API_KEY is not configured on the server.' });
      return;
    }
    const provided = req.get('x-admin-key') || req.get('X-Admin-Key') || '';
    if (provided !== expected) {
      res.status(401).json({ error: 'Invalid or missing admin key.' });
      return;
    }
    next();
  });
}

function hasValidAdminKey(req) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  const provided = String(req.get('x-admin-key') || req.get('X-Admin-Key') || '').trim();
  return !!provided && provided === String(expected);
}

function simpleEmailValid(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function normalizeEmailOrThrow(raw) {
  const input = typeof raw === 'string' ? raw : String(raw || '');
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Invalid email');
  if (!validator.isEmail(trimmed, { allow_utf8_local_part: false })) throw new Error('Invalid email');

  const normalized = validator.normalizeEmail(trimmed, {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    gmail_convert_googlemaildotcom: true,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false,
  });
  const email = String(normalized || trimmed).trim();
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) throw new Error('Invalid email');
  const domainLower = email.slice(at + 1).trim().toLowerCase();
  if (!domainLower || domainLower.includes(' ') || domainLower.includes('/')) throw new Error('Invalid email');
  return { normalizedEmail: email, domainLower };
}

function getIsoDayKey(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function bumpDailyAuthMetric(field, by = 1) {
  try {
    const key = getIsoDayKey();
    await DailyAuthMetric.updateOne({ _id: key }, { $inc: { [field]: by } }, { upsert: true });
  } catch (e) {
    // Metrics are best-effort; never block auth flows on metrics failures.
    console.error(e);
  }
}

function normalizeOrderItemsFromBody(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Order must include at least one item');
  const lines = [];
  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    const product = row.product && typeof row.product === 'object' ? row.product : null;
    const productId = String(row.productId ?? product?.id ?? '').trim();
    const name = String(row.name ?? product?.name ?? '').trim();
    const price = Number(row.price ?? product?.price);
    const quantity = Math.max(1, Math.floor(Number(row.quantity) || 1));
    if (!productId || !name || !Number.isFinite(price)) throw new Error(`Invalid line item ${i + 1}`);
    let customDesignUrl = row.customDesignUrl != null ? String(row.customDesignUrl) : row.customDesignFile != null ? String(row.customDesignFile) : '';
    const hasCustomHint = !!(row.customProductType || row.customDesignName);
    if (
      hasCustomHint &&
      customDesignUrl &&
      !/^https:\/\//i.test(customDesignUrl) &&
      !customDesignUrl.startsWith('data:')
    ) {
      throw new Error(
        'Custom design must be uploaded before checkout (use Add to Cart after the file finishes uploading).'
      );
    }
    if (customDesignUrl.startsWith('data:') && customDesignUrl.length > MAX_CUSTOM_INLINE_BYTES) {
      throw new Error('Custom design image is too large; upload a smaller file or use a hosted image URL.');
    }
    lines.push({
      lineId: String(row.cartLineId ?? row.lineId ?? `line-${i}`),
      productId,
      name,
      price,
      quantity,
      selectedSize: row.selectedSize ? String(row.selectedSize) : undefined,
      selectedVariant: row.selectedVariant ? String(row.selectedVariant) : undefined,
      selectedSleeve: row.selectedSleeve ? String(row.selectedSleeve) : undefined,
      customDesignUrl: customDesignUrl || undefined,
      customDesignName: row.customDesignName ? String(row.customDesignName) : undefined,
      customProductType: row.customProductType ? String(row.customProductType) : undefined,
    });
  }
  return lines;
}

// --- Shiprocket fulfillment helpers ---
function parseEtdDays(etd) {
  const s = String(etd || '').trim();
  if (!s) return null;
  const m = s.match(/(\d+)\s*-\s*(\d+)/) || s.match(/(\d+)/);
  if (!m) return null;
  return Math.max(0, Number(m[1]) || 0);
}

function scoreCourierCandidate(c) {
  // Lower score is better.
  const rate = Number(c?.rate);
  const days = parseEtdDays(c?.etd);
  const rating = c?.rating != null && Number.isFinite(Number(c.rating)) ? Number(c.rating) : null;

  // Normalize: cost dominates, ETA second, reliability third.
  const costScore = Number.isFinite(rate) ? rate : 1e9;
  const etaScore = days != null ? days * 20 : 200; // heuristic weight
  const reliabilityPenalty = rating != null ? (5 - clampNum(rating, { min: 0, max: 5 })) * 5 : 0;
  return costScore + etaScore + reliabilityPenalty;
}

function pickBalancedCourier(companies) {
  const list = (Array.isArray(companies) ? companies : [])
    .map((c) => ({
      courierId: Number(c?.courier_company_id ?? c?.courier_id ?? 0) || undefined,
      courierName: String(c?.courier_name || c?.courier_company_name || '').trim() || undefined,
      rate: Number(c?.rate ?? c?.freight_charge ?? c?.total_charges ?? NaN),
      etd: String(c?.etd || c?.estimated_delivery_days || '').trim(),
      rating: c?.rating != null ? Number(c.rating) : undefined,
    }))
    .filter((c) => c.courierId && Number.isFinite(c.rate) && c.rate >= 0);

  if (!list.length) return null;
  // Take top 20 cheapest first for efficiency, then score.
  const candidates = list.sort((a, b) => a.rate - b.rate).slice(0, 20);
  const scored = candidates
    .map((c) => ({ c, score: scoreCourierCandidate(c) }))
    .sort((a, b) => a.score - b.score);
  return scored[0]?.c ?? candidates[0];
}

async function fetchShiprocketServiceabilityForOrder({ deliveryPincode, cod, weightKg }) {
  const pickup = normalizePincode(SHIPROCKET_PICKUP_PINCODE);
  const delivery = normalizePincode(deliveryPincode);
  const weight = clampNum(weightKg, { min: 0.1, max: 25 });

  const qs = new URLSearchParams({
    pickup_postcode: pickup,
    delivery_postcode: delivery,
    cod: cod ? '1' : '0',
    weight: String(Math.round(weight * 100) / 100),
  });

  const { res: srRes, data } = await shiprocketFetch(`/courier/serviceability?${qs.toString()}`);
  if (!srRes.ok) {
    const msg = typeof data?.message === 'string' ? data.message : 'Shiprocket serviceability failed';
    const err = new Error(msg);
    err.statusCode = 502;
    throw err;
  }
  const companies = Array.isArray(data?.data?.available_courier_companies) ? data.data.available_courier_companies : [];
  return { companies, raw: data };
}

function extractShiprocketOrderId(data) {
  return String(data?.order_id || data?.data?.order_id || data?.payload?.order_id || '').trim();
}

function extractShiprocketShipmentId(data) {
  const raw = data?.shipment_id ?? data?.data?.shipment_id ?? data?.payload?.shipment_id ?? null;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractShipmentIdFromOrderShow(showData) {
  // Shiprocket response formats vary; try common nests.
  const direct = extractShiprocketShipmentId(showData);
  if (direct) return direct;
  const d = showData?.data ?? showData?.payload ?? showData;

  const candidates = [];
  if (Array.isArray(d?.shipments)) candidates.push(d.shipments);
  if (Array.isArray(d?.data?.shipments)) candidates.push(d.data.shipments);
  if (Array.isArray(d?.order?.shipments)) candidates.push(d.order.shipments);

  for (const arr of candidates) {
    const first = arr?.[0];
    const maybe = first?.shipment_id ?? first?.id ?? first?.shipmentId ?? null;
    const n = maybe != null ? Number(maybe) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function createShiprocketShipmentForOrderDoc(orderLean) {
  if (!shiprocketConfigured()) {
    const err = new Error('Shiprocket is not configured on the server');
    err.statusCode = 503;
    throw err;
  }
  const orderId = String(orderLean?._id || orderLean?.id || '').trim();
  if (!orderId) throw new Error('Missing order id for shipment creation');
  const customer = orderLean.customer || {};
  const deliveryPincode = normalizePincode(customer.pincode);
  const cod = String(orderLean.paymentMethod || '') !== 'razorpay';
  if (deliveryPincode.length !== 6) {
    const err = new Error('Invalid delivery pincode for Shiprocket');
    err.statusCode = 400;
    throw err;
  }

  const items = Array.isArray(orderLean.items) ? orderLean.items : [];
  const qtySum = items.reduce((acc, it) => acc + Math.max(0, Math.floor(Number(it?.quantity) || 0)), 0);

  // Prefer per-product shipping attributes (fallback to configured defaults).
  const itemProductIds = Array.from(
    new Set(
      items
        .map((it) => String(it?.productId ?? it?._id ?? it?.id ?? '').trim())
        .filter(Boolean)
    )
  );
  const shipById = new Map();
  if (itemProductIds.length) {
    const prods = await Product.find({ _id: { $in: itemProductIds } })
      .select({ _id: 1, shipWeightKg: 1, shipLengthCm: 1, shipWidthCm: 1, shipHeightCm: 1 })
      .lean();
    for (const p of prods) shipById.set(String(p._id), p);
  }

  const weightSum = items.reduce((acc, it) => {
    const pid = String(it?.productId ?? it?._id ?? it?.id ?? '').trim();
    const qty = Math.max(0, Math.floor(Number(it?.quantity) || 0));
    const p = shipById.get(pid);
    const w = Number(p?.shipWeightKg);
    const per = Number.isFinite(w) && w > 0 ? w : SHIPROCKET_DEFAULT_WEIGHT_KG;
    return acc + qty * per;
  }, 0);
  const weightKg = clampNum((weightSum || (qtySum || 1) * SHIPROCKET_DEFAULT_WEIGHT_KG), { min: 0.1, max: 25 });

  const dimMax = { l: SHIPROCKET_DEFAULT_LENGTH_CM, w: SHIPROCKET_DEFAULT_BREADTH_CM, h: SHIPROCKET_DEFAULT_HEIGHT_CM };
  for (const it of items) {
    const pid = String(it?.productId ?? it?._id ?? it?.id ?? '').trim();
    const p = shipById.get(pid);
    const l = Number(p?.shipLengthCm);
    const w = Number(p?.shipWidthCm);
    const h = Number(p?.shipHeightCm);
    if (Number.isFinite(l) && l > 0) dimMax.l = Math.max(dimMax.l, l);
    if (Number.isFinite(w) && w > 0) dimMax.w = Math.max(dimMax.w, w);
    if (Number.isFinite(h) && h > 0) dimMax.h = Math.max(dimMax.h, h);
  }
  const pkgLength = clampNum(dimMax.l, { min: 1, max: 200 });
  const pkgBreadth = clampNum(dimMax.w, { min: 1, max: 200 });
  const pkgHeight = clampNum(dimMax.h, { min: 1, max: 200 });

  // Pre-fetch serviceability so we can select courier deterministically.
  const { companies, raw: serviceabilityRaw } = await fetchShiprocketServiceabilityForOrder({
    deliveryPincode,
    cod,
    weightKg,
  });
  if (!companies.length) {
    const err = new Error('Not serviceable for this pincode');
    err.statusCode = 409;
    throw err;
  }
  const selected = pickBalancedCourier(companies);

  // Create Shiprocket order (adhoc).
  const orderDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const billingCustomerName = String(customer.name || '').trim();
  const billingCity = String(customer.city || '').trim();
  const billingState = String(customer.state || '').trim();
  const billingEmail = String(customer.email || '').trim();
  const billingPhoneDigits = normalizePhoneDigits(customer.phone);
  const billingPincodeNum = Number(deliveryPincode);

  if (!billingCustomerName) {
    const err = new Error('Missing customer name for Shiprocket billing');
    err.statusCode = 400;
    throw err;
  }
  if (!billingCity) {
    const err = new Error('Missing customer city for Shiprocket billing');
    err.statusCode = 400;
    throw err;
  }
  if (!billingState) {
    const err = new Error('Missing customer state for Shiprocket billing');
    err.statusCode = 400;
    throw err;
  }
  if (!isProbablyValidEmail(billingEmail)) {
    const err = new Error('Invalid customer email for Shiprocket billing');
    err.statusCode = 400;
    throw err;
  }
  if (billingPhoneDigits.length !== 10) {
    const err = new Error('Invalid customer phone for Shiprocket billing (need 10 digits)');
    err.statusCode = 400;
    throw err;
  }
  if (!Number.isFinite(billingPincodeNum) || String(billingPincodeNum).length !== 6) {
    const err = new Error('Invalid billing pincode for Shiprocket');
    err.statusCode = 400;
    throw err;
  }

  const orderItems = items.map((it, idx) => {
    const name = String(it?.name || '').trim();
    const sku = String(it?.sku || it?.productId || it?._id || it?.id || '').trim() || `item-${idx + 1}`;
    const units = Math.max(1, Math.floor(Number(it?.quantity) || 1));
    const sellingPrice = Math.max(0, Number(it?.price) || 0);
    if (!name) {
      const err = new Error(`Missing item name for Shiprocket (item #${idx + 1})`);
      err.statusCode = 400;
      throw err;
    }
    if (!sku) {
      const err = new Error(`Missing item sku for Shiprocket (item #${idx + 1})`);
      err.statusCode = 400;
      throw err;
    }
    if (!(sellingPrice > 0)) {
      const err = new Error(`Invalid item selling_price for Shiprocket (item #${idx + 1})`);
      err.statusCode = 400;
      throw err;
    }
    return {
      name,
      sku,
      units,
      selling_price: sellingPrice,
      discount: 0,
      tax: 0,
      hsn: '',
    };
  });

  const computedSubTotal = orderItems.reduce((acc, it) => acc + Number(it.selling_price) * Number(it.units), 0);
  const subTotal = Math.max(0, Number.isFinite(computedSubTotal) ? computedSubTotal : 0);

  const payload = {
    order_id: orderId,
    order_date: orderDate,
    pickup_location: String(SHIPROCKET_PICKUP_LOCATION_NAME),
    billing_customer_name: billingCustomerName,
    billing_last_name: '',
    billing_address: String(customer.address || ''),
    billing_city: billingCity,
    billing_pincode: billingPincodeNum,
    billing_state: billingState,
    billing_country: 'India',
    billing_email: billingEmail,
    billing_phone: Number(billingPhoneDigits),
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method: cod ? 'COD' : 'Prepaid',
    sub_total: subTotal,
    length: pkgLength,
    breadth: pkgBreadth,
    height: pkgHeight,
    weight: weightKg,
  };

  logJson('info', 'shiprocket.adhoc_create_attempt', {
    orderId,
    cod,
    pickupLocation: String(SHIPROCKET_PICKUP_LOCATION_NAME),
    pickupPincode: normalizePincode(SHIPROCKET_PICKUP_PINCODE),
    deliveryPincode,
    weightKg,
    selectedCourierId: selected?.courierId,
    selectedCourierName: selected?.courierName,
    payload: summarizeShiprocketAdhocPayload(payload),
  });

  const { res: createRes, data: createData } = await shiprocketFetch('/orders/create/adhoc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  logJson('info', 'shiprocket.adhoc_create_response', {
    orderId,
    status: createRes.status,
    ok: createRes.ok,
    message: typeof createData?.message === 'string' ? createData.message : undefined,
    responseKeys: createData && typeof createData === 'object' ? Object.keys(createData) : typeof createData,
  });

  if (!createRes.ok) {
    const msg = typeof createData?.message === 'string' ? createData.message : 'Shiprocket order creation failed';
    const err = new Error(msg);
    err.statusCode = 502;
    throw err;
  }

  const shiprocketOrderId = extractShiprocketOrderId(createData);
  let shipmentId = extractShiprocketShipmentId(createData);
  if (!shipmentId) {
    const msgRaw = typeof createData?.message === 'string' ? createData.message : '';
    logJson('warn', 'shiprocket.adhoc_create_missing_shipment_id', {
      orderId,
      shiprocketOrderId: shiprocketOrderId || undefined,
      status: createRes.status,
      message: msgRaw || undefined,
      responseKeys: createData && typeof createData === 'object' ? Object.keys(createData) : typeof createData,
    });

    if (msgRaw.toLowerCase().includes('wrong pickup location')) {
      const err = new Error(
        `Shiprocket pickup_location mismatch: set SHIPROCKET_PICKUP_LOCATION_NAME to the exact Pickup Address name from Shiprocket (Settings → Pickup Address). Shiprocket message: ${msgRaw}`
      );
      err.code = 'SHIPROCKET_BAD_PICKUP_LOCATION';
      err.statusCode = 503;
      throw err;
    }
  }

  if (!shipmentId && shiprocketOrderId) {
    const { res: showRes, data: showData } = await shiprocketFetch(`/orders/show/${encodeURIComponent(shiprocketOrderId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (showRes.ok) {
      shipmentId = extractShipmentIdFromOrderShow(showData);
      if (shipmentId) {
        logJson('info', 'shiprocket.order_show_recovered_shipment_id', {
          orderId,
          shiprocketOrderId,
          shipmentId,
        });
      } else {
        logJson('warn', 'shiprocket.order_show_no_shipment_id', {
          orderId,
          shiprocketOrderId,
          responseKeys: showData && typeof showData === 'object' ? Object.keys(showData) : typeof showData,
        });
      }
    } else {
      logJson('warn', 'shiprocket.order_show_failed', {
        orderId,
        shiprocketOrderId,
        status: showRes.status,
        message: typeof showData?.message === 'string' ? showData.message : undefined,
      });
    }
  }

  if (!shipmentId) {
    const err = new Error('Shiprocket order creation returned no shipment_id');
    err.statusCode = 502;
    throw err;
  }

  // Assign AWB (courier selection).
  const assignBody = {
    shipment_id: shipmentId,
    courier_id: selected?.courierId,
  };
  const { res: awbRes, data: awbData } = await shiprocketFetch('/courier/assign/awb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignBody),
  });
  if (!awbRes.ok) {
    const msg = typeof awbData?.message === 'string' ? awbData.message : 'Shiprocket AWB assignment failed';
    const err = new Error(msg);
    err.statusCode = 502;
    throw err;
  }

  logJson('info', 'shiprocket.awb_assign_response', {
    orderId,
    shipmentId,
    status: awbRes.status,
    ok: awbRes.ok,
    responseKeys: awbData && typeof awbData === 'object' ? Object.keys(awbData) : typeof awbData,
    dataKeys:
      awbData && typeof awbData === 'object' && awbData.data && typeof awbData.data === 'object'
        ? Object.keys(awbData.data)
        : undefined,
    // Safe subset only (do not log full payload)
    hasAwbCode: Boolean(awbData?.awb_code || awbData?.data?.awb_code || awbData?.data?.response?.awb_code || awbData?.payload?.awb_code),
    hasCourierName: Boolean(
      awbData?.courier_name || awbData?.data?.courier_name || awbData?.data?.response?.courier_name || awbData?.payload?.courier_name
    ),
  });

  const awb = String(
    awbData?.awb_code ??
      awbData?.data?.awb_code ??
      awbData?.data?.response?.awb_code ??
      awbData?.payload?.awb_code ??
      awbData?.payload?.data?.awb_code ??
      awbData?.awb ??
      awbData?.data?.awb ??
      ''
  ).trim();
  const courierNameRaw = String(
    awbData?.courier_name ??
      awbData?.data?.courier_name ??
      awbData?.data?.response?.courier_name ??
      awbData?.payload?.courier_name ??
      awbData?.payload?.data?.courier_name ??
      selected?.courierName ??
      ''
  ).trim();
  const courierName = courierNameRaw || undefined;

  logJson('info', 'shiprocket.awb_assign_extracted', {
    orderId,
    shipmentId,
    courierId: selected?.courierId,
    awbPrefix: awb ? awb.slice(0, 6) : undefined,
    courierName,
  });

  // Pickup request (non-fatal if it fails; can be retried by admin ops).
  try {
    await shiprocketFetch('/courier/generate/pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipment_id: [shipmentId] }),
    });
  } catch {
    // ignore
  }

  const etdDays = selected?.etd ? parseEtdDays(selected.etd) : null;
  const estimatedDeliveryDate = etdDays != null ? new Date(Date.now() + etdDays * 24 * 60 * 60_000) : null;

  return {
    shiprocketOrderId: shiprocketOrderId || undefined,
    shipmentId,
    awb: awb || undefined,
    courierId: selected?.courierId,
    courierName,
    estimatedDeliveryDate,
    serviceability: {
      quote: serviceabilityRaw,
      selectedCourier: selected,
    },
  };
}

async function ensureShiprocketShipmentForOrderId(orderId, source = 'system') {
  const id = String(orderId || '').trim();
  if (!id) return;

  if (!shiprocketConfigured()) {
    logJson('warn', 'shiprocket.shipment_skipped_no_config', {
      orderId: id,
      source,
      trace: 'missing_credentials_or_pickup',
    });
    return;
  }

  const preCheck = await Order.findById(id).lean();
  if (!preCheck) return;
  if (preCheck?.shipping?.shipmentCreatedAt || preCheck?.shipping?.shipmentId) return;

  const blockPre = shipmentBlockedByPaymentOrQuote(preCheck);
  if (blockPre.blocked) {
    logJson('warn', 'shiprocket.shipment_blocked', {
      orderId: id,
      source,
      reason: blockPre.reason,
      trace: 'payment_or_quote_gate',
    });
    logIntegrationNotifyPending({
      event: 'shipment_deferred',
      orderId: id,
      deferReason: blockPre.reason,
    });
    return;
  }

  // Atomic claim: only one actor can request shipment creation.
  const claimed = await Order.findOneAndUpdate(
    {
      _id: id,
      $or: [{ shipping: { $exists: false } }, { 'shipping.shipmentCreatedAt': { $exists: false } }],
      'shipping.shipmentRequestedAt': { $exists: false },
    },
    {
      $set: {
        'shipping.provider': 'shiprocket',
        'shipping.idempotencyKey': `sr:${id}`,
        'shipping.shipmentRequestedAt': new Date(),
        'shipping.manualRequired': false,
        'shipping.manualReason': undefined,
        'shipping.error': undefined,
        'shipping.lastUpdatedAt': new Date(),
      },
      $push: {
        'shipping.timeline': {
          at: new Date().toISOString(),
          kind: 'shipment_request',
          source,
        },
      },
    },
    { new: false }
  ).lean();

  if (!claimed) return;

  try {
    const orderLean = await Order.findById(id).lean();
    if (!orderLean) return;
    if (orderLean?.shipping?.shipmentCreatedAt || orderLean?.shipping?.shipmentId) return;

    const blockPost = shipmentBlockedByPaymentOrQuote(orderLean);
    if (blockPost.blocked) {
      logJson('warn', 'shiprocket.shipment_blocked_after_claim', {
        orderId: id,
        source,
        reason: blockPost.reason,
      });
      logIntegrationNotifyPending({
        event: 'shipment_deferred',
        orderId: id,
        deferReason: blockPost.reason,
      });
      await Order.updateOne(
        { _id: id },
        {
          $unset: { 'shipping.shipmentRequestedAt': 1 },
          $set: { 'shipping.lastUpdatedAt': new Date() },
          $push: {
            'shipping.timeline': {
              at: new Date().toISOString(),
              kind: 'shipment_blocked',
              source,
              status: blockPost.reason,
            },
          },
        }
      );
      await syncOrderAdminFlags(id);
      return;
    }

    logJson('info', 'shiprocket.shipment_start', { orderId: id, source });
    const created = await createShiprocketShipmentForOrderDoc({ ...orderLean, _id: id });
    const $set = {
      'shipping.provider': 'shiprocket',
      'shipping.shipmentId': created.shipmentId,
      'shipping.shipmentCreatedAt': new Date(),
      'shipping.lastUpdatedAt': new Date(),
      'shipping.manualRequired': false,
      'shipping.serviceability': created.serviceability,
      'shipping.shipmentAttemptCount': 0,
    };
    // Never overwrite good existing shipping fields with empty/undefined values.
    if (created.shiprocketOrderId) $set['shipping.shiprocketOrderId'] = created.shiprocketOrderId;
    if (created.awb) $set['shipping.awb'] = created.awb;
    if (created.courierId) $set['shipping.courierId'] = created.courierId;
    if (created.courierName) $set['shipping.courierName'] = created.courierName;
    if (created.estimatedDeliveryDate) $set['shipping.estimatedDeliveryDate'] = created.estimatedDeliveryDate;

    const persistRes = await Order.updateOne(
      { _id: id, 'shipping.shipmentCreatedAt': { $exists: false } },
      {
        $set,
        $unset: {
          'shipping.manualReason': 1,
          'shipping.error': 1,
          'shipping.shipmentLastFailureAt': 1,
        },
        $push: {
          'shipping.timeline': {
            at: new Date().toISOString(),
            kind: 'shipment_created',
            awb: created.awb,
            courierName: created.courierName,
            source,
          },
        },
      }
    );
    logJson('info', 'shiprocket.shipment_persisted', {
      orderId: id,
      source,
      matchedCount: persistRes?.matchedCount,
      modifiedCount: persistRes?.modifiedCount,
      hasAwb: Boolean(created.awb),
      hasCourierName: Boolean(created.courierName),
    });

    logJson('info', 'shiprocket.shipment_ok', {
      orderId: id,
      shipmentId: created.shipmentId,
      awb: created.awb,
      courierName: created.courierName,
      source,
    });
    await syncOrderAdminFlags(id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' ? String(err.code || '') : '';
    const orderAfter = await Order.findById(id).lean();
    const prevAttempts = Math.max(0, Math.floor(Number(orderAfter?.shipping?.shipmentAttemptCount) || 0));
    const nextAttempt = prevAttempts + 1;
    const nonRetryable =
      code === 'SHIPROCKET_BAD_PICKUP_LOCATION' ||
      msg.toLowerCase().includes('wrong pickup location') ||
      msg.toLowerCase().includes('pickup_location mismatch');
    const exhausted = nonRetryable || nextAttempt >= SHIPROCKET_SHIPMENT_MAX_ATTEMPTS;

    logJson('error', 'shiprocket.shipment_failed', {
      orderId: id,
      source,
      message: msg,
      code: code || undefined,
      attempt: nextAttempt,
      maxAttempts: SHIPROCKET_SHIPMENT_MAX_ATTEMPTS,
      exhausted,
      nonRetryable,
    });

    if (exhausted) {
      await Order.updateOne(
        { _id: id },
        {
          $set: {
            'shipping.manualRequired': true,
            'shipping.manualReason': nonRetryable
              ? `Shipment blocked by configuration error: ${msg}`
              : `Shipment failed after ${SHIPROCKET_SHIPMENT_MAX_ATTEMPTS} attempts: ${msg}`,
            'shipping.error': msg,
            'shipping.shipmentAttemptCount': nextAttempt,
            'shipping.shipmentLastFailureAt': new Date(),
            'shipping.lastUpdatedAt': new Date(),
          },
          $unset: {
            'shipping.shipmentRequestedAt': 1,
          },
          $push: {
            'shipping.timeline': {
              at: new Date().toISOString(),
              kind: 'shipment_failed_exhausted',
              error: msg,
              source,
              attempt: nextAttempt,
            },
          },
        }
      );
      logJson('error', 'shiprocket.shipment_retries_exhausted', { orderId: id, attempts: nextAttempt });
    } else {
      const delayMs = Math.min(
        SHIPROCKET_SHIPMENT_RETRY_MAX_MS,
        SHIPROCKET_SHIPMENT_RETRY_BASE_MS * 2 ** (nextAttempt - 1)
      );
      await Order.updateOne(
        { _id: id },
        {
          $set: {
            'shipping.shipmentAttemptCount': nextAttempt,
            'shipping.shipmentLastFailureAt': new Date(),
            'shipping.error': msg,
            'shipping.manualRequired': false,
            'shipping.lastUpdatedAt': new Date(),
          },
          $unset: {
            'shipping.shipmentRequestedAt': 1,
          },
          $push: {
            'shipping.timeline': {
              at: new Date().toISOString(),
              kind: 'shipment_failed_retry_scheduled',
              error: msg,
              source,
              attempt: nextAttempt,
              retryInMs: delayMs,
            },
          },
        }
      );
      logJson('warn', 'shiprocket.shipment_retry_scheduled', {
        orderId: id,
        attempt: nextAttempt,
        delayMs,
        source,
      });
      setTimeout(() => {
        void ensureShiprocketShipmentForOrderId(id, `${source}-retry-${nextAttempt}`);
      }, delayMs);
    }
    await syncOrderAdminFlags(id);
  }
}

async function sendEmailViaResend({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY ? String(process.env.RESEND_API_KEY).trim() : '';
  if (!key) return { ok: false, error: 'RESEND_API_KEY not set' };
  const from =
    process.env.RESEND_FROM_EMAIL && String(process.env.RESEND_FROM_EMAIL).trim()
      ? String(process.env.RESEND_FROM_EMAIL).trim()
      : 'TrendNest <noreply@trendnest99.in>';

  const payload = { from, to, subject, text, html };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = typeof data?.message === 'string' ? data.message : 'Resend send failed';
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Resend request failed' };
  }
}

async function sendOrderEmails(orderLean) {
  const adminTo = process.env.ORDER_ADMIN_EMAIL ? String(process.env.ORDER_ADMIN_EMAIL).trim() : '';
  const id = orderLean._id || orderLean.id;
  const { customer, items, subtotal, discount, total, couponCode } = orderLean;
  const addr = `${customer.address}, ${customer.city} - ${customer.pincode}`;
  const linesText = items
    .map((l) => {
      const lineTotal = l.price * l.quantity;
      let extra = [l.selectedSize, l.selectedVariant, l.selectedSleeve].filter(Boolean).join(', ');
      return `  • ${l.name} × ${l.quantity} @ ₹${l.price} = ₹${lineTotal}${extra ? ` (${extra})` : ''}`;
    })
    .join('\n');
  const linesHtml = items
    .map((l) => {
      const lineTotal = l.price * l.quantity;
      const extra = [l.selectedSize, l.selectedVariant, l.selectedSleeve].filter(Boolean).join(', ');
      return `<tr><td>${escapeHtml(l.name)} × ${l.quantity}</td><td>₹${l.price}</td><td>₹${lineTotal}</td><td>${escapeHtml(extra)}</td></tr>`;
    })
    .join('');

  const customerSubject = `Order confirmed — ${id} — TrendNest`;
  const customerText = `Hi ${customer.name},\n\nThank you for your order.\n\nOrder ID: ${id}\n\nItems:\n${linesText}\n\nSubtotal: ₹${subtotal}\nDiscount: ₹${discount}${couponCode ? ` (${couponCode})` : ''}\nTotal: ₹${total}\n\nDeliver to:\n${customer.name}\n${customer.phone}\n${addr}\n\nWe will notify you when your order ships.\n\n— TrendNest`;
  const customerHtml = `<p>Hi ${escapeHtml(customer.name)},</p><p>Thank you for your order.</p><p><strong>Order ID:</strong> ${escapeHtml(id)}</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Item</th><th>Price</th><th>Line total</th><th>Options</th></tr></thead><tbody>${linesHtml}</tbody></table><p>Subtotal: ₹${subtotal}<br/>Discount: ₹${discount}${couponCode ? ` (${escapeHtml(couponCode)})` : ''}<br/><strong>Total: ₹${total}</strong></p><p><strong>Deliver to:</strong><br/>${escapeHtml(customer.name)}<br/>${escapeHtml(customer.phone)}<br/>${escapeHtml(addr)}</p><p>We will notify you when your order ships.</p><p>— TrendNest</p>`;

  const adminSubject = `New order ${id} — ₹${total}`;
  const adminText = `New order received.\n\nOrder ID: ${id}\nCustomer: ${customer.name} <${customer.email}>\nPhone: ${customer.phone}\nAddress: ${addr}\n\nItems:\n${linesText}\n\nTotal: ₹${total}\nStatus: ${orderLean.status}`;

  const customerSent = await sendEmailViaResend({
    to: customer.email.trim(),
    subject: customerSubject,
    text: customerText,
    html: customerHtml,
  });
  if (!customerSent.ok) return { ok: false, error: customerSent.error || 'Failed to send customer order email' };

  if (adminTo) {
    const adminSent = await sendEmailViaResend({ to: adminTo, subject: adminSubject, text: adminText });
    if (!adminSent.ok) return { ok: false, error: adminSent.error || 'Failed to send admin order email' };
  }
  return { ok: true };
}

async function sendOrderStatusEmail({ orderLean, kind }) {
  const id = orderLean._id || orderLean.id;
  const { customer } = orderLean;

  if (kind === 'shipped') {
    const subject = `Your order is shipped — ${id} — TrendNest`;
    const text = `Hi ${customer.name},\n\nGood news! Your order has been shipped.\n\nOrder ID: ${id}\n\nWe will notify you when it is delivered.\n\n— TrendNest`;
    const html = `<p>Hi ${escapeHtml(customer.name)},</p><p><strong>Good news!</strong> Your order has been shipped.</p><p><strong>Order ID:</strong> ${escapeHtml(id)}</p><p>We will notify you when it is delivered.</p><p>— TrendNest</p>`;
    const sent = await sendEmailViaResend({ to: customer.email.trim(), subject, text, html });
    return sent.ok ? { ok: true } : { ok: false, error: sent.error || 'Failed to send shipped email' };
  }

  if (kind === 'delivered') {
    const uid = orderLean?.userId ? String(orderLean.userId).trim() : '';
    const deliveredAt = orderLean?.deliveredAt ? new Date(orderLean.deliveredAt) : null;
    const deliveredAtOk = deliveredAt && !Number.isNaN(deliveredAt.getTime());
    const items = Array.isArray(orderLean?.items) ? orderLean.items : [];

    let reviewLinksText = '';
    let reviewLinksHtml = '';
    try {
      if (uid && deliveredAtOk && items.length) {
        const productIds = [...new Set(items.map((x) => String(x?.productId || '')).filter(Boolean))];
        if (productIds.length) {
          const reviewed = await Review.find({ userId: uid, productId: { $in: productIds } }).select({ productId: 1 }).lean();
          const reviewedSet = new Set(reviewed.map((r) => String(r.productId)));
          const existingInvites = await ReviewInvite.find({ userId: uid, orderId: String(id), productId: { $in: productIds } })
            .select({ productId: 1 })
            .lean();
          const invitedSet = new Set(existingInvites.map((x) => String(x.productId)));

          const perProduct = [];
          for (const pid of productIds) {
            if (reviewedSet.has(pid)) continue;
            if (invitedSet.has(pid)) continue;

            const raw = crypto.randomBytes(24).toString('hex');
            const tokenHash = hashReviewInviteTokenRaw(raw);
            const tokenPrefix = raw.slice(0, 8);
            const expiresAt = new Date(deliveredAt.getTime() + REVIEW_INVITE_VALID_DAYS * 86400000);
            const invId = `rinv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            await ReviewInvite.create({
              _id: invId,
              tokenHash,
              tokenPrefix,
              userId: uid,
              orderId: String(id),
              productId: pid,
              deliveredAt,
              expiresAt,
            });

            const line = items.find((x) => String(x?.productId) === pid);
            const name = String(line?.name || 'Product');
            perProduct.push({ pid, name, url: buildReviewInviteLink(raw) });
          }

          if (perProduct.length) {
            reviewLinksText =
              `\n\nLeave a review (valid for ${REVIEW_INVITE_VALID_DAYS} days):\n` +
              perProduct.map((x) => `- ${x.name}: ${x.url}`).join('\n');
            reviewLinksHtml =
              `<p><strong>Leave a review</strong> (valid for ${REVIEW_INVITE_VALID_DAYS} days):</p>` +
              `<ul>` +
              perProduct
                .map((x) => `<li>${escapeHtml(x.name)}: <a href="${escapeHtml(x.url)}">${escapeHtml(x.url)}</a></li>`)
                .join('') +
              `</ul>`;
          }
        }
      }
    } catch (e) {
      logJson('error', 'review_invite_email_build_failed', {
        orderId: String(id),
        message: e instanceof Error ? e.message : String(e),
      });
    }

    const subject = `Delivered — Thank you for shopping — ${id} — TrendNest`;
    const text = `Hi ${customer.name},\n\nThank you for shopping with TrendNest99.\n\nYour order has been delivered.\nOrder ID: ${id}\n\nWe would love your feedback. If you liked the product, please leave a review.${reviewLinksText}\n\n— TrendNest`;
    const html = `<p>Hi ${escapeHtml(customer.name)},</p><p>Thank you for shopping with TrendNest99.</p><p><strong>Your order has been delivered.</strong></p><p><strong>Order ID:</strong> ${escapeHtml(id)}</p><p>We would love your feedback. If you liked the product, please leave a review.</p>${reviewLinksHtml}<p>— TrendNest</p>`;
    const sent = await sendEmailViaResend({ to: customer.email.trim(), subject, text, html });
    return sent.ok ? { ok: true } : { ok: false, error: sent.error || 'Failed to send delivered email' };
  }

  return { ok: false, error: 'Unknown status email type' };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeReview(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = o._id;
  delete o._id;
  const out = { id, ...o };
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString();
  if (out.updatedAt instanceof Date) out.updatedAt = out.updatedAt.toISOString();
  return out;
}

async function canUserReviewProduct({ userId, productId }) {
  const u = String(userId || '').trim();
  const p = String(productId || '').trim();
  if (!u || !p) return { ok: false, error: 'Invalid user or product' };

  const now = Date.now();
  const reviewWindowMs = REVIEW_INVITE_VALID_DAYS * 24 * 60 * 60 * 1000;
  const minDeliveredAt = new Date(now - reviewWindowMs);

  // Must have a delivered order within last 15 days containing the product.
  const order = await Order.findOne({
    userId: u,
    status: 'delivered',
    deliveredAt: { $gte: minDeliveredAt },
    items: { $elemMatch: { productId: p } },
  })
    .sort({ deliveredAt: -1 })
    .lean();

  if (!order) {
    return { ok: false, error: `You can review only after delivery (within ${REVIEW_INVITE_VALID_DAYS} days)` };
  }

  const existing = await Review.findOne({ productId: p, userId: u }).lean();
  if (existing) return { ok: false, error: 'You already reviewed this product' };

  return { ok: true, order };
}

function streamInvoicePdf(order, res) {
  const id = order._id || order.id;
  const safeName = String(id).replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${safeName}.pdf"`);

  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  doc.pipe(res);
  doc.fontSize(18).text('TrendNest', { align: 'center' });
  doc.moveDown(0.25);
  doc.fontSize(11).text('Tax invoice / Packing slip', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10);
  doc.text(`Order ID: ${id}`);
  const created = order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt || '';
  if (created) doc.text(`Date: ${created}`);
  doc.text(`Status: ${order.status || 'pending'}`);
  doc.moveDown();
  doc.fontSize(12).text('Bill to / Ship to', { underline: true });
  doc.fontSize(10);
  const c = order.customer;
  doc.text(c.name);
  doc.text(c.email);
  doc.text(c.phone);
  doc.text(`${c.address}, ${c.city} - ${c.pincode}`);
  doc.moveDown();
  doc.fontSize(12).text('Items', { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(9);
  let y = doc.y;
  doc.text('Description', 48, y, { width: 200 });
  doc.text('SKU', 255, y, { width: 70 });
  doc.text('Qty', 335, y, { width: 35 });
  doc.text('Price', 375, y, { width: 60 });
  doc.text('Amount', 445, y, { width: 80 });
  doc.moveDown(0.5);
  doc.moveTo(48, doc.y).lineTo(548, doc.y).stroke();
  doc.moveDown(0.25);
  for (const l of order.items || []) {
    const amt = l.price * l.quantity;
    const opts = [l.selectedSize, l.selectedVariant, l.selectedSleeve].filter(Boolean).join(', ');
    const desc = opts ? `${l.name} (${opts})` : l.name;
    const sku = String(l.sku || '').trim() || String(l.productId || '').trim();
    y = doc.y;
    doc.text(desc, 48, y, { width: 200 });
    doc.text(sku, 255, y, { width: 70 });
    doc.text(String(l.quantity), 335, y, { width: 35 });
    doc.text(`₹${l.price}`, 375, y, { width: 60 });
    doc.text(`₹${amt}`, 445, y, { width: 80 });
    doc.moveDown(0.35);
  }
  doc.moveDown();
  doc.fontSize(10);
  doc.text(`Subtotal: ₹${order.subtotal}`);
  doc.text(`Discount: ₹${order.discount || 0}${order.couponCode ? ` (${order.couponCode})` : ''}`);
  doc.fontSize(11).text(`Total: ₹${order.total}`, { continued: false });
  doc.end();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const uploadDesign = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DESIGN_UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (!ok) {
      cb(new Error('Only image or PDF files are allowed for custom designs'));
      return;
    }
    cb(null, true);
  },
});

const app = express();
// Render runs behind a proxy; required for secure cookies (`SameSite=None; Secure`).
app.set('trust proxy', 1);

// Enforce HTTPS and send HSTS in production.
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }
  const forwardedProtoRaw = String(req.get('x-forwarded-proto') || '').trim().toLowerCase();
  const forwardedProto = forwardedProtoRaw.split(',')[0]?.trim() || '';
  if (forwardedProto && forwardedProto !== 'https') {
    const host = String(req.get('host') || '').trim();
    if (host) {
      res.redirect(301, `https://${host}${req.originalUrl || ''}`);
      return;
    }
  }
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});

/** Comma-separated URLs allowed to call this API with credentials (Vercel prod, preview, www). */
function parseFrontendOrigins() {
  const raw = [process.env.FRONTEND_ORIGIN, process.env.FRONTEND_ORIGINS].filter(Boolean).join(',');
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const DEFAULT_FRONTEND_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
  'https://trendnest99.in',
  'https://www.trendnest99.in',
];

const allowedFrontendOrigins = (() => {
  const fromEnv = parseFrontendOrigins();
  return Array.from(new Set([...DEFAULT_FRONTEND_ORIGINS, ...fromEnv]));
})();
const ALLOW_VERCEL_PREVIEW_ORIGINS = (process.env.ALLOW_VERCEL_PREVIEW_ORIGINS || '').trim().toLowerCase() === 'true';

function isAllowedCorsOrigin(requestOrigin) {
  if (!requestOrigin) return false;
  // Dev convenience: allow any localhost port for Vite (ports can auto-increment).
  if (process.env.NODE_ENV !== 'production') {
    try {
      const u = new URL(requestOrigin);
      if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    } catch {
      // ignore
    }
  }
  if (allowedFrontendOrigins.includes(requestOrigin)) return true;
  if (ALLOW_VERCEL_PREVIEW_ORIGINS) {
    try {
      const u = new URL(requestOrigin);
      if (u.protocol === 'https:' && u.hostname.endsWith('.vercel.app')) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function getOriginFromReferer(referer) {
  if (!referer) return '';
  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

function requireTrustedBrowserOrigin(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    next();
    return;
  }
  const origin = String(req.get('origin') || '').trim();
  const refererOrigin = getOriginFromReferer(String(req.get('referer') || ''));
  if ((origin && isAllowedCorsOrigin(origin)) || (refererOrigin && isAllowedCorsOrigin(refererOrigin))) {
    next();
    return;
  }
  if (process.env.NODE_ENV !== 'production' && !origin && !refererOrigin) {
    next();
    return;
  }
  res.status(403).json({ error: 'Blocked by origin policy' });
}

const corsOptions = {
  origin: (requestOrigin, callback) => {
    if (allowedFrontendOrigins.length === 0) {
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('CORS is not configured for production'));
        return;
      }
      callback(null, requestOrigin || true);
      return;
    }
    if (!requestOrigin) {
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Origin header is required in production'));
        return;
      }
      callback(null, true);
      return;
    }
    if (isAllowedCorsOrigin(requestOrigin)) {
      callback(null, requestOrigin);
      return;
    }
    callback(new Error(`Not allowed by CORS: ${requestOrigin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'X-Requested-With',
    'X-Admin-Key',
  ],
};

// Explicit OPTIONS handling for preflight requests (avoids net::ERR_FAILED on missing headers).
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({
  limit: '16mb',
  verify: (req, _res, buf) => {
    // Capture raw body for webhook signature verification.
    req.rawBody = buf;
  },
}));

// Request/response debug logger (best-effort).
app.use((req, res, next) => {
  const startedAt = Date.now();
  const url = String(req.originalUrl || req.url || '');
  const hasAdminKey = !!(req.get('x-admin-key') || req.get('X-Admin-Key'));
  logJson('info', 'http.start', { method: req.method, url, hasAdminKey });
  res.on('finish', () => {
    logJson('info', 'http.finish', {
      method: req.method,
      url,
      hasAdminKey,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

// Cookie-session auth for logged-in customers.
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
const COOKIE_SECURE = (process.env.COOKIE_SECURE || '').trim().toLowerCase();
const isProd = process.env.NODE_ENV === 'production';
if (isProd && !SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}
const useMongoSessionStore = isProd && !!MONGODB_URI;
const cookieSameSite =
  COOKIE_SAMESITE === 'none' || COOKIE_SAMESITE === 'lax' || COOKIE_SAMESITE === 'strict'
    ? COOKIE_SAMESITE
    : isProd
      ? 'none'
      : 'lax';
const cookieSecure = COOKIE_SECURE ? COOKIE_SECURE === 'true' : isProd;
app.use(
  session({
    name: 'tn_session',
    secret: SESSION_SECRET || 'dev-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    // In dev, avoid Mongo-backed sessions: flaky/blocked Mongo networking can turn all requests into 500s.
    // In production, use MongoStore when MONGODB_URI is configured.
    store: useMongoSessionStore
      ? MongoStore.create({
          mongoUrl: MONGODB_URI,
          collectionName: 'sessions',
          ttl: Math.floor(SESSION_TTL_MS / 1000),
        })
      : undefined,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
      maxAge: SESSION_TTL_MS,
    },
  })
);

app.use(attachClientBearerAuth);

function parseCookieHeader(h) {
  const out = {};
  const raw = typeof h === 'string' ? h : '';
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function looksLikeHex(s, minLen = 16) {
  const v = String(s || '').trim();
  if (v.length < minLen) return false;
  return /^[a-f0-9]+$/i.test(v);
}

function isAdminRequest(req) {
  const path = String(req.originalUrl || req.url || '').toLowerCase();
  if (path.startsWith('/api/admin')) return true;
  if (path.startsWith('/api/orders')) return true;
  const expected = String(process.env.ADMIN_API_KEY || '');
  const sent = String(req.get('x-admin-key') || req.get('X-Admin-Key') || '').trim();
  if (expected && sent && sent === expected) return true;
  return false;
}

// Best-effort unique visitor counter: assigns an anonymous cookie and upserts a Visitor record.
// Never blocks requests; skips admin routes/requests.
app.use(async (req, res, next) => {
  try {
    if (req.method !== 'GET') {
      return next();
    }
    if (isAdminRequest(req)) {
      return next();
    }
    // Avoid counting the webhook endpoints.
    const p = String(req.path || req.url || '');
    if (p.startsWith('/api/webhooks')) {
      return next();
    }

    const cookies = parseCookieHeader(req.headers.cookie);
    let vid = String(cookies.tn_vid || '').trim();
    if (!looksLikeHex(vid, 24)) {
      vid = crypto.randomBytes(16).toString('hex');
      res.cookie('tn_vid', vid, {
        httpOnly: true,
        sameSite: cookieSameSite,
        secure: cookieSecure,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }

    const now = new Date();
    // Upsert visitor row; unique visitor = first insert.
    // Best-effort: errors should never impact the request.
    void Visitor.updateOne(
      { visitorId: vid },
      { $setOnInsert: { visitorId: vid, firstSeenAt: now }, $set: { lastSeenAt: now } },
      { upsert: true }
    ).catch((e) => {
      logJson('warn', 'visitor.upsert_failed', { message: e instanceof Error ? e.message : String(e) });
    });
  } catch (e) {
    // ignore
  }
  next();
});

function saveSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      resolve();
      return;
    }
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

app.get('/', (_req, res) => {
  res.type('text/plain').send('Backend is running 🚀');
});

function debugRoutesEnabled(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
}

app.get('/api/__debug/routes', debugRoutesEnabled, (_req, res) => {
  try {
    const stack = (app && app._router && Array.isArray(app._router.stack)) ? app._router.stack : [];
    const routes = [];
    for (const layer of stack) {
      if (layer && layer.route && layer.route.path) {
        routes.push({
          path: layer.route.path,
          methods: layer.route.methods || {},
        });
      }
    }
    res.json({ count: routes.length, routes: routes.slice(0, 200) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.get('/api/__debug/delay', debugRoutesEnabled, (_req, res) => {
  setTimeout(() => {
    if (!res.headersSent) res.json({ ok: true, waitedMs: 750 });
  }, 750);
});

app.get('/api/__debug/orders-count', debugRoutesEnabled, mongoReady, async (_req, res) => {
  try {
    const count = await Order.countDocuments({});
    res.json({ ok: true, count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'count_failed' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1,
    cloudinary: !!(cloudName && cloudKey && cloudSecret),
    /** When true, storefront may complete checkout without a Shiprocket quote (see ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE). */
    allowCheckoutWithoutShippingQuote: ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE,
  });
});

/**
 * Server-side shipping quote (same rules as checkout). Cached by pincode + weight + COD + goods threshold.
 */
async function resolveShippingChargeForPricing({ pincode, cod, pricedLines, goodsAfterDiscount }) {
  const pin = normalizePincode(pincode);
  if (pin.length !== 6) {
    return {
      ok: false,
      reason: 'bad_pincode',
      shippingCharge: 0,
      freeShippingApplied: false,
      courierSuggestions: [],
    };
  }
  if (!shiprocketConfigured()) {
    return {
      ok: false,
      reason: 'unavailable',
      shippingCharge: 0,
      freeShippingApplied: false,
      courierSuggestions: [],
    };
  }

  const lines = Array.isArray(pricedLines) ? pricedLines : [];
  const qtySum = lines.reduce((acc, l) => acc + Math.max(0, Math.floor(Number(l?.quantity) || 0)), 0);

  // Prefer per-product shipping weights (fallback to configured default).
  const productIds = Array.from(
    new Set(
      lines
        .map((l) => String(l?.productId ?? l?.id ?? '').trim())
        .filter(Boolean)
    )
  );
  const productWeightById = new Map();
  if (productIds.length) {
    const prods = await Product.find({ _id: { $in: productIds } })
      .select({ _id: 1, shipWeightKg: 1 })
      .lean();
    for (const p of prods) {
      const n = Number(p?.shipWeightKg);
      if (Number.isFinite(n) && n > 0) productWeightById.set(String(p._id), n);
    }
  }

  const weightSum = lines.reduce((acc, l) => {
    const pid = String(l?.productId ?? l?.id ?? '').trim();
    const qty = Math.max(0, Math.floor(Number(l?.quantity) || 0));
    const per = productWeightById.has(pid) ? Number(productWeightById.get(pid)) : SHIPROCKET_DEFAULT_WEIGHT_KG;
    return acc + qty * per;
  }, 0);
  const weight = clampNum((weightSum || (qtySum || 1) * SHIPROCKET_DEFAULT_WEIGHT_KG), { min: 0.1, max: 25 });
  const goodsRound = Math.round(Math.max(0, Number(goodsAfterDiscount) || 0));

  const cacheKey = JSON.stringify({
    pickup: normalizePincode(SHIPROCKET_PICKUP_PINCODE),
    delivery: pin,
    cod: cod ? 1 : 0,
    weight: Math.round(weight * 100) / 100,
    g: goodsRound,
  });
  const now = Date.now();
  const hit = shiprocketServiceabilityCache.get(cacheKey);
  if (hit && hit.expiresAtMs > now && hit.value) {
    return { ...hit.value, cached: true };
  }

  const qs = new URLSearchParams({
    pickup_postcode: normalizePincode(SHIPROCKET_PICKUP_PINCODE),
    delivery_postcode: pin,
    cod: cod ? '1' : '0',
    weight: String(Math.round(weight * 100) / 100),
  });

  try {
    const { res: srRes, data } = await shiprocketFetch(`/courier/serviceability?${qs.toString()}`);
    if (!srRes.ok) {
      const out = {
        ok: false,
        reason: 'unavailable',
        error: 'Shipping service temporarily unavailable',
        shippingCharge: 0,
        freeShippingApplied: false,
        courierSuggestions: [],
      };
      shiprocketServiceabilityCache.set(cacheKey, { value: out, expiresAtMs: now + SHIPROCKET_CACHE_TTL_MS });
      return out;
    }

    const companies = Array.isArray(data?.data?.available_courier_companies)
      ? data.data.available_courier_companies
      : [];

    if (!companies.length) {
      const out = {
        ok: false,
        reason: 'not_serviceable',
        error: 'Not serviceable for this pincode',
        shippingCharge: 0,
        freeShippingApplied: false,
        courierSuggestions: [],
      };
      shiprocketServiceabilityCache.set(cacheKey, { value: out, expiresAtMs: now + SHIPROCKET_CACHE_TTL_MS });
      return out;
    }

    const suggestions = companies
      .map((c) => ({
        courierId: Number(c?.courier_company_id ?? c?.courier_id ?? 0) || undefined,
        courierName: String(c?.courier_name || c?.courier_company_name || '').trim() || undefined,
        rate: Number(c?.rate ?? c?.freight_charge ?? c?.total_charges ?? NaN),
        etd: String(c?.etd || c?.estimated_delivery_days || '').trim(),
        rating: c?.rating != null ? Number(c.rating) : undefined,
      }))
      .filter((c) => Number.isFinite(c.rate) && c.rate >= 0)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 10);

    const cheapest = suggestions[0];
    const rawCharge = cheapest ? Number(cheapest.rate) : 0;
    const surcharge = cod && Number.isFinite(COD_SHIPPING_SURCHARGE) ? Math.max(0, Number(COD_SHIPPING_SURCHARGE)) : 0;
    const computedCharge = rawCharge + surcharge;

    const freeShippingApplied =
      Number.isFinite(FREE_SHIPPING_MIN_TOTAL) &&
      FREE_SHIPPING_MIN_TOTAL != null &&
      goodsRound >= Number(FREE_SHIPPING_MIN_TOTAL);

    const etdStr = cheapest?.etd || '';
    const m = etdStr.match(/(\d+)\s*-\s*(\d+)/) || etdStr.match(/(\d+)/);
    const minDays = m ? Math.max(0, Number(m[1]) || 0) : null;
    let estimatedDeliveryDays = minDays != null ? minDays : null;
    let estimatedDeliveryDate =
      estimatedDeliveryDays != null ? new Date(Date.now() + estimatedDeliveryDays * 24 * 60 * 60_000).toISOString() : null;
    if (estimatedDeliveryDays == null) {
      estimatedDeliveryDays = SHIPROCKET_FALLBACK_ETA_DAYS;
      estimatedDeliveryDate = new Date(Date.now() + estimatedDeliveryDays * 24 * 60 * 60_000).toISOString();
    }

    const out = {
      ok: true,
      shippingCharge: freeShippingApplied ? 0 : Math.round(computedCharge),
      // Keep the real Shiprocket cost regardless of free-delivery thresholds.
      actualShippingCharge: Math.round(computedCharge),
      freeShippingApplied,
      estimatedDeliveryDays,
      estimatedDeliveryDate,
      courierSuggestions: suggestions,
      quoteId: `SRQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    shiprocketServiceabilityCache.set(cacheKey, { value: out, expiresAtMs: now + SHIPROCKET_CACHE_TTL_MS });
    return out;
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      reason: 'unavailable',
      error: 'Shipping service temporarily unavailable',
      shippingCharge: 0,
      freeShippingApplied: false,
      courierSuggestions: [],
    };
  }
}

/**
 * Shiprocket serviceability + quote (best-effort).
 * Returns shipping charge + ETA; uses caching + safe fallback when Shiprocket is unavailable.
 */
app.post('/api/shipping/serviceability', async (req, res) => {
  try {
    const body = req.body || {};
    const pincode = normalizePincode(body?.pincode);
    const paymentMethod = String(body?.paymentMethod || '').toLowerCase() === 'razorpay' ? 'razorpay' : 'cod';
    const cod = paymentMethod === 'cod';

    if (pincode.length !== 6) {
      res.status(400).json({ ok: false, error: 'Invalid pincode' });
      return;
    }

    const items = Array.isArray(body?.items) ? body.items : [];
    const goodsAfterDiscount = Number(body?.goodsAfterDiscount ?? body?.total ?? body?.subtotal ?? 0);

    const result = await resolveShippingChargeForPricing({
      pincode,
      cod,
      pricedLines: items.map((it) => ({ quantity: it?.quantity })),
      goodsAfterDiscount: Number.isFinite(goodsAfterDiscount) ? goodsAfterDiscount : 0,
    });

    // Public contract: always free delivery (₹0). Keep ETA/serviceability.
    if (result && result.ok === true) {
      const safeSuggestions = Array.isArray(result.courierSuggestions)
        ? result.courierSuggestions.map((c) => {
            const cc = c && typeof c === 'object' ? { ...c } : {};
            delete cc.rate;
            return cc;
          })
        : [];
      res.status(200).json({
        ...result,
        shippingCharge: 0,
        freeShippingApplied: true,
        courierSuggestions: safeSuggestions,
        // never expose internal charge
        actualShippingCharge: undefined,
      });
      return;
    }
    res.status(200).json(result);
  } catch (e) {
    console.error(e);
    res.status(200).json({ ok: false, reason: 'unavailable', error: 'Shipping service temporarily unavailable' });
  }
});

// Shiprocket tracking webhook (best-effort; keeps storefront status minimal).
function shiprocketFirstObjectLike(...vals) {
  for (const v of vals) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  }
  return {};
}

function shiprocketFirstString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function shiprocketFirstNumber(...vals) {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function shiprocketExtractTrackingIds(body) {
  const root = shiprocketFirstObjectLike(body);
  const data = shiprocketFirstObjectLike(root?.data, root?.payload);
  const inner = shiprocketFirstObjectLike(data?.data, data?.payload);
  const b = root;
  const d = data;
  const i = inner;

  const awb = shiprocketFirstString(
    b?.awb,
    b?.awb_code,
    b?.tracking_number,
    b?.trackingNumber,
    d?.awb,
    d?.awb_code,
    d?.tracking_number,
    i?.awb,
    i?.awb_code,
    i?.tracking_number
  );

  const shipmentId = shiprocketFirstNumber(
    b?.shipment_id,
    b?.shipmentId,
    b?.shipment,
    d?.shipment_id,
    d?.shipmentId,
    d?.shipment,
    i?.shipment_id,
    i?.shipmentId,
    i?.shipment
  );

  const shiprocketOrderId = shiprocketFirstString(
    b?.order_id,
    b?.orderId,
    b?.order_reference,
    d?.order_id,
    d?.orderId,
    d?.order_reference,
    i?.order_id,
    i?.orderId,
    i?.order_reference
  );

  const statusRaw = shiprocketFirstString(
    b?.current_status,
    b?.status,
    b?.shipment_status,
    d?.current_status,
    d?.status,
    d?.shipment_status,
    i?.current_status,
    i?.status,
    i?.shipment_status
  );

  const timestampRaw = shiprocketFirstString(
    b?.current_timestamp,
    b?.timestamp,
    b?.event_time,
    d?.current_timestamp,
    d?.timestamp,
    d?.event_time,
    i?.current_timestamp,
    i?.timestamp,
    i?.event_time
  );

  return { awb, shipmentId, shiprocketOrderId, statusRaw, timestampRaw };
}

function shiprocketParseEventTimeIso(raw) {
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function shiprocketMapStatus(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  if (!status) return null;
  // Most important: delivered must map reliably.
  if (status.includes('delivered')) return 'delivered';
  if (status.includes('shipment_created') || status.includes('shipment_request') || status.includes('packed')) return 'packed';
  if (
    status.includes('shipped') ||
    status.includes('picked_up') ||
    status.includes('picked') ||
    status.includes('pickup') ||
    status.includes('manifest') ||
    status.includes('in transit') ||
    status.includes('in_transit') ||
    status.includes('out for delivery') ||
    status.includes('out_for_delivery')
  ) return 'shipped';
  return null;
}

function orderStatusRank(s) {
  return s === 'pending'
    ? 0
    : s === 'confirmed'
      ? 0
      : s === 'packed'
        ? 1
        : s === 'shipped'
          ? 2
          : s === 'delivered'
            ? 3
            : 0;
}

async function handleShiprocketTrackingWebhook(req, res) {
  try {
    // Auth: Shiprocket UI supports a webhook token, sent as x-api-key.
    // Also supports an optional signature header when a secret is configured.
    const expectedToken = String(SHIPROCKET_WEBHOOK_TOKEN || '').trim();
    const sentToken = String(req.get('x-api-key') || req.get('X-Api-Key') || '').trim();
    const secret = String(SHIPROCKET_WEBHOOK_SECRET || '').trim();
    const sig = String(req.get('x-shiprocket-signature') || req.get('X-Shiprocket-Signature') || '').trim();
    const requireSig = Boolean(SHIPROCKET_WEBHOOK_REQUIRE_SIGNATURE);

    // Temporary debug (redacted): helps confirm what Shiprocket is sending in Render logs.
    // Remove/disable once webhook is stable.
    logJson('info', 'shiprocket.webhook_debug', {
      path: String(req.originalUrl || req.url || ''),
      hasToken: !!sentToken,
      tokenPrefix: sentToken ? sentToken.slice(0, 3) : undefined,
      expectedTokenSet: !!expectedToken,
      expectedTokenPrefix: expectedToken ? expectedToken.slice(0, 3) : undefined,
      hasSignature: !!sig,
      secretSet: !!secret,
      requireSignature: requireSig,
      contentType: String(req.get('content-type') || ''),
      userAgent: String(req.get('user-agent') || ''),
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body).slice(0, 40) : typeof req.body,
    });

    const raw = req.rawBody ? Buffer.from(req.rawBody) : Buffer.from(JSON.stringify(req.body || {}));
    const verifySignature = () => {
      if (!secret || !sig) return false;
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const a = Buffer.from(String(expected));
      const b = Buffer.from(String(sig));
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    };

    // Production must have webhook authentication configured.
    if (process.env.NODE_ENV === 'production' && !expectedToken && !secret) {
      logJson('warn', 'shiprocket.webhook_rejected', { reason: 'missing_prod_webhook_auth' });
      res.status(503).json({ ok: false });
      return;
    }

    // Token auth when configured.
    if (expectedToken && (!sentToken || sentToken !== expectedToken)) {
      logJson('warn', 'shiprocket.webhook_rejected', { reason: 'bad_token' });
      res.status(401).json({ ok: false });
      return;
    }

    // Signature auth:
    // - required when explicitly enabled
    // - also required in production when token is not configured.
    const mustCheckSignature = requireSig || (process.env.NODE_ENV === 'production' && !expectedToken);
    if (mustCheckSignature) {
      if (!secret) {
        logJson('warn', 'shiprocket.webhook_rejected', { reason: 'signature_required_but_secret_missing' });
        res.status(500).json({ ok: false });
        return;
      }
      if (!sig || !verifySignature()) {
        logJson('warn', 'shiprocket.webhook_rejected', { reason: sig ? 'bad_signature' : 'missing_signature' });
        res.status(401).json({ ok: false });
        return;
      }
    }

    const body = req.body || {};
    const { awb, shipmentId, shiprocketOrderId, statusRaw, timestampRaw } = shiprocketExtractTrackingIds(body);
    const status = String(statusRaw || '').toLowerCase();
    const eventAtPayloadIso = shiprocketParseEventTimeIso(timestampRaw);
    const eventAt = eventAtPayloadIso || new Date().toISOString();
    const eventAtKey = eventAtPayloadIso || '';

    const eventKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ awb, shipmentId, shiprocketOrderId, status, eventAt: eventAtKey }))
      .digest('hex')
      .slice(0, 32);

    // Basic payload validation: require a key and some status.
    if (!statusRaw) {
      logJson('warn', 'shiprocket.webhook_ignored', { reason: 'missing_status', awb, shipmentId, shiprocketOrderId });
      res.json({ ok: true });
      return;
    }

    const looksLikeMongoId = (s) => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s.trim());
    const qForward = awb
      ? { 'shipping.awb': awb }
      : shipmentId
        ? { 'shipping.shipmentId': shipmentId }
        : shiprocketOrderId
          ? {
              $or: [
                { 'shipping.shiprocketOrderId': shiprocketOrderId },
                ...(looksLikeMongoId(shiprocketOrderId) ? [{ _id: shiprocketOrderId }] : []),
              ],
            }
          : null;

    if (!qForward && !awb) {
      res.json({ ok: true });
      return;
    }

    let order = qForward ? await Order.findOne(qForward).lean() : null;
    let webhookKind = 'forward';
    let matchedReturnId = null;

    if (!order && awb) {
      order = await Order.findOne({
        returnRequests: { $elemMatch: { 'reverseShipment.awb': awb } },
      }).lean();
      webhookKind = 'reverse';
      if (order) {
        const hit = (order.returnRequests || []).find((r) => String(r?.reverseShipment?.awb || '') === awb);
        matchedReturnId = hit ? String(hit.returnId) : null;
      }
    }

    if (!order) {
      logJson('info', 'shiprocket.webhook_no_order', { awb, shipmentId, shiprocketOrderId, status: statusRaw });
      res.json({ ok: true });
      return;
    }

    const timelineEvent = {
      at: eventAt,
      kind: webhookKind === 'reverse' ? 'return_tracking_update' : 'tracking_update',
      status: statusRaw || undefined,
      awb: awb || undefined,
      shipmentId: shipmentId || undefined,
      raw: body,
      key: eventKey,
      source: 'shiprocket-webhook',
      returnId: matchedReturnId || undefined,
    };

    if (webhookKind === 'reverse' && matchedReturnId) {
      const ret = (order.returnRequests || []).find((r) => String(r.returnId) === matchedReturnId);
      const recentRev = Array.isArray(ret?.reverseShipment?.webhookDedupeKeys) ? ret.reverseShipment.webhookDedupeKeys : [];
      if (recentRev.includes(eventKey)) {
        logJson('info', 'shiprocket.webhook_dedupe_hit', { orderId: String(order._id), eventKey, kind: 'reverse' });
        res.json({ ok: true });
        return;
      }

      const revEvent = { ...timelineEvent, at: new Date(eventAt) };

      const updateRev = await Order.updateOne(
        { _id: String(order._id), 'returnRequests.returnId': matchedReturnId },
        {
          $set: { 'returnRequests.$[r].reverseShipment.provider': 'shiprocket' },
          $push: {
            'returnRequests.$[r].reverseShipment.timeline': revEvent,
            'returnRequests.$[r].reverseShipment.webhookDedupeKeys': { $each: [eventKey], $slice: -25 },
            'returnRequests.$[r].timeline': {
              at: new Date(),
              action: 'reverse_tracking',
              actor: 'shiprocket-webhook',
              note: String(statusRaw || '').slice(0, 500),
            },
          },
        },
        { arrayFilters: [{ 'r.returnId': matchedReturnId }] }
      );

      logJson('info', 'shiprocket.webhook_processed', {
        orderId: String(order._id),
        matched: updateRev.matchedCount,
        modified: updateRev.modifiedCount,
        awb,
        kind: 'reverse',
        returnId: matchedReturnId,
        status: statusRaw,
      });
      res.json({ ok: true });
      return;
    }

    const recent = Array.isArray(order?.shipping?.webhookDedupeKeys) ? order.shipping.webhookDedupeKeys : [];
    if (recent.includes(eventKey)) {
      logJson('info', 'shiprocket.webhook_dedupe_hit', { orderId: String(order._id), eventKey });
      res.json({ ok: true });
      return;
    }

    // Status mapping (do not regress). Shiprocket may send either event names or human statuses.
    let nextStatus = shiprocketMapStatus(statusRaw);
    if (status.includes('rto')) nextStatus = null; // keep shipped; store in shipping.rto
    if (status.includes('cancel') || status.includes('cancelled') || status.includes('canceled')) nextStatus = null;
    if (status.includes('undelivered') || status.includes('delivery failed') || status.includes('failed')) nextStatus = null;

    const $set = {
      'shipping.provider': 'shiprocket',
      'shipping.trackingStatus': statusRaw || undefined,
      'shipping.lastUpdatedAt': new Date(),
    };

    if (status.includes('rto')) {
      $set['shipping.rto'] = {
        status: statusRaw || 'RTO',
        updatedAt: eventAt,
      };
    }

    const currentStatus = String(order?.status || 'pending');
    if (nextStatus && orderStatusRank(nextStatus) >= orderStatusRank(currentStatus)) {
      $set.status = nextStatus;
      const now = new Date();
      if (nextStatus === 'shipped' && !order.shippedAt) $set.shippedAt = now;
      if (nextStatus === 'delivered' && !order.deliveredAt) $set.deliveredAt = now;
    }

    const updateRes = await Order.updateOne(
      { _id: String(order._id), 'shipping.webhookDedupeKeys': { $ne: eventKey } },
      {
        $set,
        $push: {
          'shipping.timeline': timelineEvent,
          'shipping.webhookDedupeKeys': { $each: [eventKey], $slice: -25 },
        },
      }
    );

    logJson('info', 'shiprocket.webhook_processed', {
      orderId: String(order._id),
      matched: updateRes.matchedCount,
      modified: updateRes.modifiedCount,
      awb,
      shipmentId,
      shiprocketOrderId: shiprocketOrderId || undefined,
      status: statusRaw,
      nextStatus: nextStatus || undefined,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    logJson('error', 'shiprocket.webhook_error', { message: e instanceof Error ? e.message : String(e) });
    // Webhooks should not be retried aggressively by failing hard.
    res.json({ ok: true });
  }
}

// Shiprocket blocks webhook URLs containing keywords like "shiprocket"/"sr"/"kr".
// Keep the old route for compatibility, but configure Shiprocket to use /api/webhooks/tracking.
app.post('/api/webhooks/shiprocket', webhookRateLimit, handleShiprocketTrackingWebhook);
app.post('/api/webhooks/tracking', webhookRateLimit, handleShiprocketTrackingWebhook);

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  requireTrustedBrowserOrigin(req, res, next);
}

function requireUploadAuth(req, res, next) {
  if (req.session?.userId) {
    requireTrustedBrowserOrigin(req, res, next);
    return;
  }
  const hasAdminHeader = !!String(req.get('x-admin-key') || req.get('X-Admin-Key') || '').trim();
  if (!hasAdminHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  adminKeyRateLimit(req, res, () => {
    if (!hasValidAdminKey(req)) {
      res.status(401).json({ error: 'Invalid or missing admin key.' });
      return;
    }
    requireTrustedBrowserOrigin(req, res, next);
  });
}

function serializeUser(userDoc) {
  if (!userDoc) return null;
  return {
    id: userDoc._id,
    email: userDoc.email,
    phone: userDoc.phone,
    name: userDoc.name,
    addresses: Array.isArray(userDoc.addresses) ? userDoc.addresses : [],
    mustResetPassword: !!userDoc.mustResetPassword,
    createdAt: userDoc.createdAt instanceof Date ? userDoc.createdAt.toISOString() : userDoc.createdAt,
  };
}

function maskEmail(email) {
  const [u, d] = email.split('@');
  if (!u || !d) return email;
  const head = u.slice(0, 1);
  return `${head}***@${d}`;
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function hashReviewInviteTokenRaw(raw) {
  return sha256Hex(`tn_review_invite_v1:${raw}`);
}

function buildReviewInviteLink(raw) {
  const t = String(raw || '').trim();
  return `${FRONTEND_PUBLIC_URL}/review/${encodeURIComponent(t)}`;
}

function hashClientAuthTokenRaw(raw) {
  return sha256Hex(`tn_client_auth_v1:${raw}`);
}

async function issueClientAuthToken(userId) {
  const ttlMs = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashClientAuthTokenRaw(raw);
  const expiresAt = new Date(Date.now() + ttlMs);
  await ClientAuthToken.create({ tokenHash, userId: String(userId), expiresAt });
  return raw;
}

async function revokeClientAuthTokensForUser(userId) {
  await ClientAuthToken.deleteMany({ userId: String(userId) });
}

async function attachClientBearerAuth(req, res, next) {
  try {
    if (req.session?.userId) {
      next();
      return;
    }
    const auth = req.headers.authorization;
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      next();
      return;
    }
    const raw = auth.slice(7).trim();
    if (!raw || raw.length < 32) {
      next();
      return;
    }
    const tokenHash = hashClientAuthTokenRaw(raw);
    const doc = await ClientAuthToken.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (doc?.userId) {
      req.session.userId = doc.userId;
    }
  } catch (e) {
    console.error(e);
  }
  next();
}

function genNumericCode(length) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
}

function otpEmailHtml({ code, purpose }) {
  const title = purpose === 'password_reset' ? 'Reset your password' : 'Verify your email';
  const subtitle =
    purpose === 'password_reset'
      ? 'Use this code to reset your TrendNest account password.'
      : 'Use this code to verify your email for TrendNest.';
  const purposeLabel = purpose === 'password_reset' ? 'Password reset code' : 'Verification code';
  const safeCode = escapeHtml(code);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eceff4;">
            <tr>
              <td style="padding:22px 24px;background:#0b1220;color:#fff;">
                <div style="font-size:16px;font-weight:700;letter-spacing:.2px;">TrendNest</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 8px 0;font-size:20px;line-height:1.3;color:#0b1220;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(
                  subtitle
                )}</p>

                <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
                  <div style="font-size:12px;color:#64748b;margin-bottom:8px;">${escapeHtml(purposeLabel)}</div>
                  <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#0b1220;">${safeCode}</div>
                </div>

                <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                  This code expires soon. If you didn’t request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #eef2f7;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} TrendNest99</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendOtpEmail({ to, code, purpose }) {
  const subject = purpose === 'password_reset' ? 'TrendNest99 password reset OTP' : 'TrendNest99 OTP verification';
  const text = `Your OTP code is: ${code}\n\nThis code will expire soon. If you did not request it, ignore this email.`;
  const html = otpEmailHtml({ code, purpose });

  const sent = await sendEmailViaResend({ to, subject, text, html });
  if (sent.ok) return { ok: true };
  console.error('OTP email (Resend) failed:', sent.error);
  return { ok: false, error: sent.error || 'Email send failed' };
}

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session?.userId) {
      res.json({ user: null });
      return;
    }
    const u = await User.findById(req.session.userId).lean();
    res.json({ user: u ? serializeUser(u) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load auth user' });
  }
});

app.post('/api/auth/logout', requireTrustedBrowserOrigin, async (req, res) => {
  const uid = req.session?.userId ? String(req.session.userId) : null;
  try {
    if (uid) await revokeClientAuthTokensForUser(uid);
  } catch (e) {
    console.error(e);
  }
  if (!req.session) {
    res.json({ ok: true });
    return;
  }
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.clearCookie('tn_session');
    res.json({ ok: true });
  });
});

app.get('/api/auth/email-exists', async (req, res) => {
  try {
    const email = String(req.query?.email || '').trim();
    if (!email || !simpleEmailValid(email)) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }
    const exists = !!(await User.exists({ email }));
    res.json({ exists });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// Registration initiates an email OTP challenge (verified in /api/auth/otp/verify).
app.post(
  '/api/auth/register',
  rateLimitByIp({ keyPrefix: 'auth_register', limit: SIGNUP_RATE_LIMIT_MAX, windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS }),
  async (req, res) => {
  try {
    let normalizedEmail;
    let domainLower;
    try {
      const parsed = normalizeEmailOrThrow(req.body?.email);
      normalizedEmail = parsed.normalizedEmail;
      domainLower = parsed.domainLower;
    } catch {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }
    const name = String(req.body?.name || '').trim();
    const phone = req.body?.phone;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    let normalizedPhone;
    if (phone != null && String(phone).trim()) {
      try {
        normalizedPhone = normalizeIndianMobileOrThrow(phone);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid phone number' });
        return;
      }
    }

    // Block disposable/invalid domains before creating OTP challenges.
    const ip = getClientIp(req);
    if (await isDisposableDomain(domainLower)) {
      logJson('warn', 'auth.email_blocked', { email: normalizedEmail, domain: domainLower, ip, reason: 'disposable_domain' });
      await bumpDailyAuthMetric('blockedDisposable', 1);
      res.status(400).json({ error: 'Please use a valid personal email address' });
      return;
    }
    try {
      await hasValidMxOrThrow(domainLower);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'mx_lookup_failed';
      logJson('warn', 'auth.email_blocked', { email: normalizedEmail, domain: domainLower, ip, reason });
      if (reason === 'no_mx') await bumpDailyAuthMetric('blockedNoMx', 1);
      else await bumpDailyAuthMetric('blockedMxLookupFailed', 1);
      res.status(400).json({ error: 'Please use a valid personal email address' });
      return;
    }

    const existing = await User.findOne({ email: normalizedEmail }).exec();
    if (existing) {
      res.status(409).json({ error: 'Email already registered. Please login instead.' });
      return;
    }

    const otpLen = Number(process.env.OTP_CODE_LENGTH || 6);
    const otpTtlSec = Number(process.env.OTP_TTL_SECONDS || 10 * 60);
    const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
    const code = genNumericCode(otpLen);
    const codeSalt = crypto.randomBytes(16).toString('hex');
    const codeHash = sha256Hex(`${codeSalt}:${code}`);

    const challengeId = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + otpTtlSec * 1000);

    await OtpChallenge.create({
      challengeId,
      purpose: 'auth',
      email: normalizedEmail,
      codeHash,
      codeSalt,
      expiresAt,
      attempts: 0,
      maxAttempts,
    });

    const sent = await sendOtpEmail({ to: normalizedEmail, code, purpose: 'auth' });
    if (!sent.ok) {
      res.status(503).json({ error: sent.error || 'Could not send OTP' });
      return;
    }

    res.json({
      ok: true,
      challengeId,
      masked: maskEmail(normalizedEmail),
      name,
      phone: normalizedPhone || undefined,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to register' });
  }
});

function serializeCoupon(doc) {
  if (!doc) return null;
  const out = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = out._id;
  delete out._id;
  return { id, ...out };
}

function parseIdList(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(s => String(s)).map(s => s.trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

app.get('/api/coupons', mongoReady, adminKeyRequired, async (_req, res) => {
  try {
    const docs = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json(docs.map(d => serializeCoupon(d)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list coupons' });
  }
});

// --- Admin: disposable email domain blocklist ---
app.get('/api/admin/disposable-domains', mongoReady, adminKeyRequired, async (_req, res) => {
  try {
    const docs = await DisposableDomain.find().sort({ _id: 1 }).lean();
    res.json(
      (docs || []).map((d) => ({
        domain: String(d._id || ''),
        enabled: d.enabled !== false,
        source: d.source || '',
        reason: d.reason || '',
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list disposable domains' });
  }
});

app.post('/api/admin/disposable-domains', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const raw = req.body?.domain;
    const domain = String(raw || '').trim().toLowerCase();
    if (!domain || domain.includes(' ') || domain.includes('/') || !domain.includes('.')) {
      res.status(400).json({ error: 'Invalid domain' });
      return;
    }
    await DisposableDomain.updateOne(
      { _id: domain },
      { $set: { enabled: true, source: 'admin', reason: String(req.body?.reason || '').trim() } },
      { upsert: true }
    );
    upsertDisposableDomainCache(domain, true);
    res.status(201).json({ ok: true, domain });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add disposable domain' });
  }
});

app.delete('/api/admin/disposable-domains/:domain', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const domain = String(req.params?.domain || '').trim().toLowerCase();
    if (!domain) {
      res.status(400).json({ error: 'Invalid domain' });
      return;
    }
    await DisposableDomain.updateOne({ _id: domain }, { $set: { enabled: false, source: 'admin' } }, { upsert: true });
    upsertDisposableDomainCache(domain, false);
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove disposable domain' });
  }
});

app.get('/api/admin/auth-metrics/daily', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(90, Number(req.query?.limit || 30)));
    const docs = await DailyAuthMetric.find().sort({ _id: -1 }).limit(limit).lean();
    res.json(
      (docs || []).map((d) => ({
        day: String(d._id),
        blockedDisposable: Number(d.blockedDisposable || 0),
        blockedNoMx: Number(d.blockedNoMx || 0),
        blockedMxLookupFailed: Number(d.blockedMxLookupFailed || 0),
        rateLimitHits: Number(d.rateLimitHits || 0),
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load auth metrics' });
  }
});

// --- Admin analytics: unique visitors (all time) ---
app.get('/api/admin/analytics/visitors', mongoReady, adminKeyRequired, async (_req, res) => {
  try {
    res.status(200);
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/json; charset=utf-8');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    const totalUniqueVisitors = await Visitor.countDocuments({});
    if (!res.writableEnded) {
      res.end(JSON.stringify({ totalUniqueVisitors, updatedAt: new Date().toISOString() }));
    }
  } catch (e) {
    console.error(e);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Failed to load visitor analytics' }));
    }
  }
});

app.post('/api/coupons', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const code = normalizeCouponCode(body.code);
    const type = String(body.type || '').trim();

    if (!code) {
      res.status(400).json({ error: 'Coupon code is required' });
      return;
    }
    if (!['percentage', 'flat'].includes(type)) {
      res.status(400).json({ error: 'Coupon type must be percentage or flat' });
      return;
    }

    const scope = String(body.scope || 'cart').trim();
    if (!['cart', 'products', 'categories'].includes(scope)) {
      res.status(400).json({ error: 'Invalid coupon scope' });
      return;
    }

    const coupon = await Coupon.create({
      code,
      type,
      value: Number(body.value ?? 0),
      maxDiscount: body.maxDiscount != null && body.maxDiscount !== '' ? Number(body.maxDiscount) : undefined,
      minOrder: Number(body.minOrder ?? 0),

      scope,
      productIds: parseIdList(body.productIds),
      categoryIds: parseIdList(body.categoryIds),
      applicableSkus: parseIdList(body.applicableSkus),

      startAt: toDateOrUndefined(body.startAt),
      endAt: toDateOrUndefined(body.endAt),

      isActive: body.isActive !== false,

      usageTotalLimit: body.usageTotalLimit != null && body.usageTotalLimit !== '' ? Number(body.usageTotalLimit) : undefined,
      usagePerUserLimit: body.usagePerUserLimit != null && body.usagePerUserLimit !== '' ? Number(body.usagePerUserLimit) : undefined,

      newUsersOnly: !!body.newUsersOnly,
      allowedUserGroups: parseIdList(body.allowedUserGroups),
    });

    res.status(201).json(serializeCoupon(coupon));
  } catch (e) {
    console.error(e);
    if (e && e.code === 11000) {
      res.status(409).json({ error: 'Coupon code already exists' });
      return;
    }
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to create coupon' });
  }
});

app.patch('/api/coupons/:id', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const patch = {};
    if (body.code != null) patch.code = normalizeCouponCode(body.code);
    if (body.type != null) {
      const type = String(body.type).trim();
      if (type === 'free_delivery') {
        res.status(400).json({ error: 'free_delivery is not supported' });
        return;
      }
      patch.type = type;
    }
    if (body.value != null) patch.value = Number(body.value);
    if (body.maxDiscount != null) patch.maxDiscount = body.maxDiscount === '' ? undefined : Number(body.maxDiscount);
    if (body.minOrder != null) patch.minOrder = Number(body.minOrder);
    if (body.scope != null) patch.scope = String(body.scope).trim();
    if (body.productIds != null) patch.productIds = parseIdList(body.productIds);
    if (body.categoryIds != null) patch.categoryIds = parseIdList(body.categoryIds);
    if (body.applicableSkus != null) patch.applicableSkus = parseIdList(body.applicableSkus);
    if (body.startAt !== undefined) patch.startAt = toDateOrUndefined(body.startAt);
    if (body.endAt !== undefined) patch.endAt = toDateOrUndefined(body.endAt);
    if (body.isActive != null) patch.isActive = !!body.isActive;
    if (body.usageTotalLimit !== undefined)
      patch.usageTotalLimit = body.usageTotalLimit === '' ? undefined : Number(body.usageTotalLimit);
    if (body.usagePerUserLimit !== undefined)
      patch.usagePerUserLimit = body.usagePerUserLimit === '' ? undefined : Number(body.usagePerUserLimit);
    if (body.newUsersOnly != null) patch.newUsersOnly = !!body.newUsersOnly;
    if (body.allowedUserGroups != null) patch.allowedUserGroups = parseIdList(body.allowedUserGroups);

    const updated = await Coupon.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!updated) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }

    res.json(serializeCoupon(updated));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

app.delete('/api/coupons/:id', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await Coupon.findByIdAndDelete(id);
    if (!r) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

app.post('/api/coupons/validate', mongoReady, async (req, res) => {
  try {
    const body = req.body || {};
    const code = String(body.code || '');
    const subtotal = Number(body.subtotal);
    const items = Array.isArray(body.items) ? body.items : [];
    const userId = req.session?.userId ? String(req.session.userId) : undefined;

    const result = await validateCouponForCart({ code, subtotal, items, userId });
    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Invalid coupon' });
      return;
    }

    res.json({ ok: true, couponCode: result.couponCode, discount: result.discount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

app.post(
  '/api/auth/otp/request',
  rateLimitByIp({ keyPrefix: 'auth_otp_request', limit: SIGNUP_RATE_LIMIT_MAX, windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS }),
  async (req, res) => {
  try {
    let normalizedEmail;
    let domainLower;
    try {
      const parsed = normalizeEmailOrThrow(req.body?.email || req.body?.identifier);
      normalizedEmail = parsed.normalizedEmail;
      domainLower = parsed.domainLower;
    } catch {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }
    const purpose = String(req.body?.purpose || 'checkout');

    const phoneHint = req.body?.phone;
    if (phoneHint != null && String(phoneHint).trim()) {
      try {
        normalizeIndianMobileOrThrow(phoneHint);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid phone number' });
        return;
      }
    }

    if (!['checkout', 'auth', 'password_reset'].includes(purpose)) {
      res.status(400).json({ error: 'Invalid OTP purpose' });
      return;
    }

    // For auth/checkout OTP issuance, block disposable/invalid domains.
    // For password reset, we still validate domain/MX but avoid enumeration responses below.
    const ip = getClientIp(req);
    if (await isDisposableDomain(domainLower)) {
      logJson('warn', 'auth.email_blocked', { email: normalizedEmail, domain: domainLower, ip, reason: 'disposable_domain' });
      await bumpDailyAuthMetric('blockedDisposable', 1);
      // For password_reset, keep generic response to avoid enumeration.
      if (purpose === 'password_reset') {
        res.json({ ok: true });
        return;
      }
      res.status(400).json({ error: 'Please use a valid personal email address' });
      return;
    }
    try {
      await hasValidMxOrThrow(domainLower);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'mx_lookup_failed';
      logJson('warn', 'auth.email_blocked', { email: normalizedEmail, domain: domainLower, ip, reason });
      if (reason === 'no_mx') await bumpDailyAuthMetric('blockedNoMx', 1);
      else await bumpDailyAuthMetric('blockedMxLookupFailed', 1);
      if (purpose === 'password_reset') {
        res.json({ ok: true });
        return;
      }
      res.status(400).json({ error: 'Please use a valid personal email address' });
      return;
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).exec();
    if (purpose === 'password_reset' && !existingUser) {
      // Avoid account enumeration. Still respond with a generic success.
      res.json({ ok: true });
      return;
    }

    // Create OTP challenge and send OTP email.
    const otpLen = Number(process.env.OTP_CODE_LENGTH || 6);
    const otpTtlSec = Number(process.env.OTP_TTL_SECONDS || 10 * 60);
    const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
    const code = genNumericCode(otpLen);
    const codeSalt = crypto.randomBytes(16).toString('hex');
    const codeHash = sha256Hex(`${codeSalt}:${code}`);

    const challengeId = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + otpTtlSec * 1000);

    await OtpChallenge.create({
      challengeId,
      purpose,
      userId: existingUser?._id,
      email: normalizedEmail,
      codeHash,
      codeSalt,
      expiresAt,
      attempts: 0,
      maxAttempts,
    });

    const sent = await sendOtpEmail({ to: normalizedEmail, code, purpose });
    if (!sent.ok) {
      res.status(503).json({ error: sent.error || 'Could not send OTP' });
      return;
    }

    res.json({ challengeId, masked: maskEmail(normalizedEmail) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to request OTP' });
  }
});

app.post(
  '/api/auth/otp/verify',
  requireTrustedBrowserOrigin,
  rateLimitByIp({ keyPrefix: 'auth_otp_verify', limit: SIGNUP_RATE_LIMIT_MAX, windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS }),
  async (req, res) => {
  try {
    const challengeId = String(req.body?.challengeId || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!challengeId || !code) {
      res.status(400).json({ error: 'Missing challengeId or code' });
      return;
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizeIndianMobileOptional(req.body?.phone);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid phone number' });
      return;
    }

    const challenge = await OtpChallenge.findOne({ challengeId }).exec();
    if (!challenge) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    const now = Date.now();
    if (!challenge.expiresAt || challenge.expiresAt.getTime() <= now) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      res.status(400).json({ error: 'OTP attempts exceeded' });
      return;
    }

    const candidateHash = sha256Hex(`${challenge.codeSalt}:${code}`);
    if (candidateHash !== challenge.codeHash) {
      challenge.attempts += 1;
      await challenge.save();
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    // Defense-in-depth: re-check email domain + MX before creating user.
    const ip = getClientIp(req);
    const email = String(challenge.email || '').trim();
    let normalizedEmail;
    let domainLower;
    try {
      const parsed = normalizeEmailOrThrow(email);
      normalizedEmail = parsed.normalizedEmail;
      domainLower = parsed.domainLower;
    } catch {
      logJson('warn', 'auth.email_blocked', { email, ip, reason: 'invalid_email_on_challenge' });
      res.status(400).json({ error: 'Please use a valid personal email address' });
      return;
    }
    if (await isDisposableDomain(domainLower)) {
      logJson('warn', 'auth.email_blocked', { email: normalizedEmail, domain: domainLower, ip, reason: 'disposable_domain' });
      await bumpDailyAuthMetric('blockedDisposable', 1);
      res.status(400).json({ error: 'Please use a valid personal email address' });
      return;
    }
    try {
      await hasValidMxOrThrow(domainLower);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'mx_lookup_failed';
      logJson('warn', 'auth.email_blocked', { email: normalizedEmail, domain: domainLower, ip, reason });
      if (reason === 'no_mx') await bumpDailyAuthMetric('blockedNoMx', 1);
      else await bumpDailyAuthMetric('blockedMxLookupFailed', 1);
      res.status(400).json({ error: 'Please use a valid personal email address' });
      return;
    }

    let userId = challenge.userId ? String(challenge.userId) : '';
    if (!userId && challenge.purpose !== 'password_reset') {
      const existing = normalizedEmail ? await User.findOne({ email: normalizedEmail }).exec() : null;
      if (existing) {
        userId = existing._id;
      } else {
        const newId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const created = await User.create({
          _id: newId,
          email: normalizedEmail,
          name: String(req.body?.name || '').trim() || '',
          phone: normalizedPhone,
          mustResetPassword: true,
        });
        userId = created._id;
      }
    }

    // OTP verified → login (cookie session).
    if (userId) req.session.userId = userId;

    // Cleanup old challenge.
    await OtpChallenge.deleteOne({ _id: challenge._id });

    // Safety net: backfill missing profile fields from the verified flow.
    if (userId) {
      const name = String(req.body?.name || '').trim();
      if (name || normalizedPhone) {
        const existingUser = await User.findById(userId).lean();
        if (existingUser) {
          const $set = {};
          if (name && !String(existingUser.name || '').trim()) $set.name = name;
          if (normalizedPhone && !String(existingUser.phone || '').trim()) $set.phone = normalizedPhone;
          if (Object.keys($set).length > 0) {
            await User.updateOne({ _id: userId }, { $set });
          }
        }
      }
    }

    const user = userId ? await User.findById(userId).lean() : null;
    if (userId) {
      await saveSession(req);
    }
    const serialized = user ? serializeUser(user) : null;
    let authToken;
    if (userId) {
      try {
        authToken = await issueClientAuthToken(userId);
      } catch (err) {
        console.error(err);
      }
    }
    res.json(authToken ? { user: serialized, authToken } : { user: serialized });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

app.get('/api/me/orders', mongoReady, requireAuth, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const docs = await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 }).lean();
    res.json(docs.map((d) => serializeOrderForClient(d)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load your orders' });
  }
});

app.get('/api/me/orders/:id', mongoReady, requireAuth, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Missing order id' });
      return;
    }
    const doc = await Order.findOne({ _id: id, userId: req.session.userId }).lean();
    if (!doc) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(serializeOrderForClient(doc));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load your order' });
  }
});

app.post('/api/me/orders/:id/cancel', orderCancelRateLimit, mongoReady, requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const reason = String(req.body?.reason || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Missing order id' });
      return;
    }
    if (reason && reason.length > 500) {
      res.status(400).json({ error: 'Reason is too long' });
      return;
    }

    const order = await Order.findOne({ _id: id, userId: req.session.userId }).lean();
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const status = String(order.status || '');
    if (status === 'cancelled') {
      res.json({ ok: true, order: serializeOrderForClient(order), message: 'Order already cancelled' });
      return;
    }

    const preShipment = status === 'pending' || status === 'confirmed';
    if (!preShipment) {
      res.status(409).json({ error: 'Order cannot be cancelled after it is shipped.' });
      return;
    }

    // Mark cancelled first (so repeated calls are idempotent and won’t trigger multiple refunds).
    const now = new Date();
    await Order.updateOne(
      { _id: id, userId: req.session.userId, status: { $in: ['pending', 'confirmed'] } },
      { $set: { status: 'cancelled', cancelledAt: now, cancellationReason: reason || '' } }
    );

    let fresh = await Order.findById(id).lean();
    if (!fresh) {
      res.status(500).json({ error: 'Failed to cancel order' });
      return;
    }

    // Respond immediately after local cancellation. Refund/Shiprocket actions run in background.
    res.json({
      ok: true,
      order: serializeOrderForClient(fresh),
      message: 'Order cancelled successfully. If paid online, refund will be processed within 5–7 working days.',
    });

    setImmediate(() => {
      void (async () => {
        const orderId = id;
        try {
          const latest = await Order.findById(orderId).lean();
          if (!latest) return;
          if (String(latest.status || '') !== 'cancelled') return;

          // --- Razorpay refund (initiate in background) ---
          const pm = String(latest.paymentMethod || '');
          const ps = String(latest.paymentStatus || '');
          if (pm === 'razorpay' && ps === 'paid') {
            const rf = latest.cancellationRefund;
            const st = rf && typeof rf === 'object' ? String(rf.status || '') : '';
            if (st !== 'processing' && st !== 'completed') {
              const paymentId = String(latest.razorpayPaymentId || '').trim();
              const refundRupees = Math.max(0, Number(latest.amountPaid || 0) || Number(latest.total || 0) || 0);
              const amountPaise = Math.round(refundRupees * 100);

              if (!paymentId) {
                logJson('error', 'razorpay.refund_failed', { orderId, message: 'Missing razorpayPaymentId on order' });
                await Order.updateOne(
                  { _id: orderId },
                  {
                    $set: {
                      cancellationRefund: {
                        kind: 'razorpay',
                        status: 'failed',
                        amount: refundRupees || undefined,
                        currency: 'INR',
                        razorpayPaymentId: '',
                        razorpayRefundId: '',
                        error: 'Missing razorpayPaymentId on order',
                        processedAt: new Date(),
                      },
                    },
                  }
                );
              } else if (amountPaise > 0) {
                // Mark processing before external call (idempotency).
                await Order.updateOne(
                  { _id: orderId, 'cancellationRefund.status': { $ne: 'processing' } },
                  {
                    $set: {
                      cancellationRefund: {
                        kind: 'razorpay',
                        status: 'processing',
                        amount: refundRupees,
                        currency: 'INR',
                        razorpayPaymentId: paymentId,
                        razorpayRefundId: '',
                        error: '',
                        processedAt: undefined,
                      },
                    },
                  }
                );

                logJson('info', 'razorpay.refund_attempt', {
                  orderId,
                  paymentIdPrefix: paymentId.slice(0, 8),
                  amountPaise,
                });

                try {
                  const razorpay = new Razorpay({ key_id: String(RAZORPAY_KEY_ID), key_secret: String(RAZORPAY_KEY_SECRET) });
                  const refundResp = await razorpay.payments.refund(paymentId, {
                    amount: amountPaise,
                    speed: 'normal',
                    notes: { orderId, source: 'user_cancel' },
                  });
                  const refundId = refundResp?.id ? String(refundResp.id) : '';
                  logJson('info', 'razorpay.refund_success', { orderId, refundId: refundId || undefined });
                  await Order.updateOne(
                    { _id: orderId },
                    {
                      $set: {
                        cancellationRefund: {
                          kind: 'razorpay',
                          status: 'completed',
                          amount: refundRupees,
                          currency: 'INR',
                          razorpayPaymentId: paymentId,
                          razorpayRefundId: refundId,
                          error: '',
                          processedAt: new Date(),
                        },
                      },
                    }
                  );
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  logJson('error', 'razorpay.refund_failed', { orderId, message: msg });
                  await Order.updateOne(
                    { _id: orderId },
                    {
                      $set: {
                        cancellationRefund: {
                          kind: 'razorpay',
                          status: 'failed',
                          amount: refundRupees,
                          currency: 'INR',
                          razorpayPaymentId: paymentId,
                          razorpayRefundId: '',
                          error: msg,
                          processedAt: new Date(),
                        },
                      },
                    }
                  );
                }
              }
            }
          }

          // --- Shiprocket cancel (best-effort) ---
          const safe = await Order.findById(orderId).lean();
          if (!safe) return;
          if (String(safe.status || '') !== 'cancelled') return;
          const shippedOrLater = String(safe.status || '') === 'shipped' || String(safe.status || '') === 'delivered';
          if (shippedOrLater) return;
          const srId = safe?.shipping?.shiprocketOrderId;
          if (!srId) {
            logJson('warn', 'shiprocket.cancel_skipped_missing_id', { orderId, source: 'user_cancel' });
            return;
          }
          try {
            await cancelShiprocketOrderById(srId, 'user_cancel');
          } catch (e) {
            logJson('error', 'shiprocket.cancel_failed', { orderId, message: e instanceof Error ? e.message : String(e) });
          }
        } catch (e) {
          logJson('error', 'order.cancel_background_error', { orderId: id, message: e instanceof Error ? e.message : String(e) });
        }
      })();
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

app.get('/api/me/returns', mongoReady, requireAuth, async (req, res) => {
  try {
    const docs = await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 }).lean();
    const out = [];
    for (const o of docs) {
      const list = Array.isArray(o.returnRequests) ? o.returnRequests : [];
      for (const r of list) {
        out.push({
          orderId: String(o._id),
          orderTotal: o.total,
          orderStatus: o.status,
          returnRequest: serializeReturnRequest(r),
        });
      }
    }
    out.sort((a, b) => String(b.returnRequest?.requestedAt || '').localeCompare(String(a.returnRequest?.requestedAt || '')));
    res.json({ returns: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load returns' });
  }
});

app.post('/api/returns/request', mongoReady, requireAuth, async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    const reason = String(req.body?.reason || '').trim();
    const images = Array.isArray(req.body?.images)
      ? req.body.images.map((u) => String(u).trim()).filter(Boolean).slice(0, 6)
      : [];
    const scope = String(req.body?.scope || 'full').toLowerCase() === 'partial' ? 'partial' : 'full';
    const bodyLines = Array.isArray(req.body?.lines) ? req.body.lines : null;

    if (!orderId || reason.length < 10) {
      res.status(400).json({ error: 'orderId and reason (at least 10 characters) are required' });
      return;
    }

    const order = await Order.findOne({ _id: orderId, userId: req.session.userId }).lean();
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    try {
      assertReturnEligible(order);
    } catch (err) {
      const code = Number(err.statusCode) || 400;
      res.status(code).json({ error: err.message || 'Not eligible for return' });
      return;
    }

    let normLines;
    try {
      normLines = validateReturnLines(order, bodyLines, scope);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Invalid return lines' });
      return;
    }

    const totalQty = normLines.reduce((a, l) => a + (Number(l.quantity) || 0), 0);
    if (totalQty <= 0) {
      res.status(400).json({ error: 'Nothing to return' });
      return;
    }

    const isFull = scope !== 'partial';

    const returnId = `RET-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();
    const newRet = {
      returnId,
      status: 'requested',
      scope: isFull ? 'full' : 'partial',
      lines: normLines,
      reason,
      images,
      requestedAt: now,
      timeline: [{ at: now, action: 'requested', actor: 'customer', note: '' }],
    };

    await Order.updateOne({ _id: orderId, userId: req.session.userId }, { $push: { returnRequests: newRet } });
    const updated = await Order.findById(orderId).lean();
    res.status(201).json({ order: serializeOrder(updated) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to submit return request' });
  }
});

app.get('/api/me/profile', mongoReady, requireAuth, async (req, res) => {
  try {
    const u = await User.findById(req.session.userId).lean();
    res.json({ user: u ? serializeUser(u) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.patch('/api/me/profile', mongoReady, requireAuth, async (req, res) => {
  try {
    const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
    const phoneRaw = req.body?.phone != null ? String(req.body.phone).trim() : undefined;
    const $set = {};
    const $unset = {};
    if (name !== undefined) $set.name = name;
    if (phoneRaw !== undefined) {
      if (!phoneRaw) {
        $unset.phone = '';
      } else {
        try {
          $set.phone = normalizeIndianMobileOrThrow(phoneRaw);
        } catch (e) {
          res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid phone number' });
          return;
        }
      }
    }
    const hasSet = Object.keys($set).length > 0;
    const hasUnset = Object.keys($unset).length > 0;
    if (hasSet || hasUnset) {
      await User.updateOne({ _id: req.session.userId }, { ...(hasSet ? { $set } : {}), ...(hasUnset ? { $unset } : {}) });
    }
    const u = await User.findById(req.session.userId).lean();
    res.json({ user: u ? serializeUser(u) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/me/addresses', mongoReady, requireAuth, async (req, res) => {
  try {
    const u = await User.findById(req.session.userId).lean();
    res.json({ addresses: Array.isArray(u?.addresses) ? u.addresses : [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load addresses' });
  }
});

app.get('/api/products/:id/reviews', mongoReady, async (req, res) => {
  try {
    const productId = String(req.params.id || '').trim();
    const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 5)));
    const cursor = req.query?.cursor ? String(req.query.cursor) : '';

    const q = { productId };
    let cursorDate = null;
    let cursorId = null;
    let cursorRaw = '';
    if (cursor) {
      // Backwards compatible cursor parsing:
      // - Old: ISO date string only
      // - New: "<ISO>|<reviewId>" (tie-breaker for same timestamps)
      const [datePart, idPart] = cursor.split('|');
      cursorRaw = String(datePart || cursor).trim();
      const d = new Date(cursorRaw);
      if (!Number.isNaN(d.getTime())) cursorDate = d;
      if (idPart && String(idPart).trim()) cursorId = String(idPart).trim();

      if (cursorDate) {
        // Use $expr + $toDate so pagination works whether `createdAt` was stored as
        // Date or as an ISO string (BSON $lt between Date and String often matches nothing).
        const dt = cursorDate;
        const id = cursorId;
        if (id) {
          q.$expr = {
            $or: [
              { $lt: [{ $toDate: '$createdAt' }, dt] },
              {
                $and: [{ $eq: [{ $toDate: '$createdAt' }, dt] }, { $lt: ['$_id', id] }],
              },
            ],
          };
        } else {
          q.$expr = { $lt: [{ $toDate: '$createdAt' }, dt] };
        }
      } else if (cursorRaw) {
        // If date parsing fails, fall back to lexicographic ISO string compare.
        q.createdAt = { $lt: cursorRaw };
      }
    }

    const docs = await Review.find(q).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? `${last.createdAt instanceof Date ? last.createdAt.toISOString() : String(last.createdAt)}|${String(last._id)}`
        : null;

    res.json({
      reviews: slice.map(r => serializeReview(r)),
      nextCursor,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

app.get('/api/products/:id', mongoReady, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Missing product id' });
      return;
    }
    const doc = await Product.findById(id).lean();
    if (!doc) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(serializeProductDoc(doc));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

app.post('/api/reviews', mongoReady, requireAuth, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const productId = String(req.body?.productId || '').trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim();
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    const media = Array.isArray(req.body?.media) ? req.body.media : [];

    if (!productId) {
      res.status(400).json({ error: 'Missing productId' });
      return;
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be 1 to 5' });
      return;
    }
    if (comment.length > 2000) {
      res.status(400).json({ error: 'Comment is too long' });
      return;
    }

    const eligibility = await canUserReviewProduct({ userId, productId });
    if (!eligibility.ok) {
      res.status(403).json({ error: eligibility.error || 'Not eligible to review' });
      return;
    }

    const user = await User.findById(userId).lean();
    const userName = String(user?.name || '').trim();
    const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const safeImages = images
      .slice(0, 3)
      .map((x) => ({
        url: String(x?.url || '').trim(),
        publicId: String(x?.publicId || '').trim(),
      }))
      .filter((x) => x.url.length > 0);

    const safeMedia = media
      .slice(0, 3)
      .map((x) => ({
        url: String(x?.url || '').trim(),
        publicId: String(x?.publicId || '').trim(),
        kind: String(x?.kind || 'image').trim().toLowerCase() === 'video' ? 'video' : 'image',
      }))
      .filter((x) => x.url.length > 0);

    const created = await Review.create({
      _id: id,
      productId,
      userId,
      userName: userName || 'Customer',
      rating,
      comment,
      images: safeImages,
      media: safeMedia,
    });

    res.status(201).json({ review: serializeReview(created) });
  } catch (e) {
    console.error(e);
    if (e && e.code === 11000) {
      res.status(409).json({ error: 'You already reviewed this product' });
      return;
    }
    res.status(500).json({ error: 'Failed to create review' });
  }
});

app.get('/api/review-invites/verify', mongoReady, async (req, res) => {
  try {
    const raw = String(req.query?.token || '').trim();
    if (!raw || raw.length < 20) {
      res.status(400).json({ error: 'Missing token' });
      return;
    }
    const tokenHash = hashReviewInviteTokenRaw(raw);
    const now = new Date();
    const inv = await ReviewInvite.findOne({ tokenHash }).lean();
    if (!inv) {
      res.status(404).json({ status: 'invalid' });
      return;
    }
    if (inv.revokedAt) {
      res.status(410).json({ status: 'revoked' });
      return;
    }
    if (inv.usedAt) {
      res.status(409).json({ status: 'used' });
      return;
    }
    if (inv.expiresAt && inv.expiresAt.getTime && inv.expiresAt.getTime() <= now.getTime()) {
      res.status(410).json({ status: 'expired', expiresAt: inv.expiresAt instanceof Date ? inv.expiresAt.toISOString() : inv.expiresAt });
      return;
    }
    const order = await Order.findById(String(inv.orderId)).lean();
    if (!order || String(order.status || '') !== 'delivered') {
      res.status(403).json({ status: 'not_eligible' });
      return;
    }
    const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
    if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) {
      res.status(403).json({ status: 'not_eligible' });
      return;
    }
    const deadline = deliveredAt.getTime() + REVIEW_INVITE_VALID_DAYS * 86400000;
    if (Date.now() > deadline) {
      res.status(410).json({ status: 'expired', expiresAt: new Date(deadline).toISOString() });
      return;
    }
    const it = (order.items || []).find((x) => String(x?.productId) === String(inv.productId));
    if (!it) {
      res.status(403).json({ status: 'not_eligible' });
      return;
    }
    const product = await Product.findById(String(inv.productId)).select({ _id: 1, name: 1, images: 1 }).lean();
    res.json({
      status: 'ok',
      product: product
        ? { id: String(product._id), name: String(product.name || ''), image: Array.isArray(product.images) ? product.images[0] : undefined }
        : { id: String(inv.productId), name: String(it?.name || 'Product') },
      orderId: String(inv.orderId),
      expiresAt: inv.expiresAt instanceof Date ? inv.expiresAt.toISOString() : inv.expiresAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

app.post('/api/review-invites/submit', mongoReady, async (req, res) => {
  try {
    const raw = String(req.body?.token || '').trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim();
    if (!raw || raw.length < 20) {
      res.status(400).json({ error: 'Missing token' });
      return;
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be 1 to 5' });
      return;
    }
    if (comment.length > 2000) {
      res.status(400).json({ error: 'Comment is too long' });
      return;
    }
    const tokenHash = hashReviewInviteTokenRaw(raw);
    const now = new Date();
    const inv = await ReviewInvite.findOne({ tokenHash }).lean();
    if (!inv) {
      res.status(404).json({ error: 'Invalid or expired link' });
      return;
    }
    if (inv.revokedAt) {
      res.status(410).json({ error: 'This link is no longer valid' });
      return;
    }
    if (inv.usedAt) {
      res.status(409).json({ error: 'This review link was already used' });
      return;
    }
    if (inv.expiresAt && inv.expiresAt.getTime && inv.expiresAt.getTime() <= now.getTime()) {
      res.status(410).json({ error: 'This review link has expired' });
      return;
    }

    const order = await Order.findById(String(inv.orderId)).lean();
    if (!order || String(order.status || '') !== 'delivered') {
      res.status(403).json({ error: 'You can review only after delivery' });
      return;
    }
    if (String(order.userId || '') !== String(inv.userId || '')) {
      res.status(403).json({ error: 'Not eligible to review' });
      return;
    }
    const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
    if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) {
      res.status(403).json({ error: 'Not eligible to review' });
      return;
    }
    const deadline = deliveredAt.getTime() + REVIEW_INVITE_VALID_DAYS * 86400000;
    if (Date.now() > deadline) {
      res.status(410).json({ error: 'This review link has expired' });
      return;
    }
    const hasItem = (order.items || []).some((x) => String(x?.productId) === String(inv.productId));
    if (!hasItem) {
      res.status(403).json({ error: 'Not eligible to review' });
      return;
    }

    const existing = await Review.findOne({ productId: String(inv.productId), userId: String(inv.userId) }).lean();
    if (existing) {
      await ReviewInvite.updateOne({ _id: inv._id, usedAt: { $exists: false } }, { $set: { usedAt: now } });
      res.status(409).json({ error: 'You already reviewed this product' });
      return;
    }

    const user = await User.findById(String(inv.userId)).lean();
    const userName = String(user?.name || '').trim() || 'Customer';
    const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const created = await Review.create({
      _id: id,
      productId: String(inv.productId),
      userId: String(inv.userId),
      userName,
      rating,
      comment,
      images: [],
      media: [],
    });

    await ReviewInvite.updateOne(
      { _id: inv._id, usedAt: { $exists: false } },
      { $set: { usedAt: now } }
    );

    res.status(201).json({ review: serializeReview(created) });
  } catch (e) {
    console.error(e);
    if (e && e.code === 11000) {
      res.status(409).json({ error: 'You already reviewed this product' });
      return;
    }
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

app.get('/api/me/review-prompts', mongoReady, requireAuth, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const now = Date.now();
    const reviewWindowMs = REVIEW_INVITE_VALID_DAYS * 24 * 60 * 60 * 1000;
    const minDeliveredAt = new Date(now - reviewWindowMs);

    const delivered = await Order.find({
      userId,
      status: 'delivered',
      deliveredAt: { $gte: minDeliveredAt },
    })
      .sort({ deliveredAt: -1 })
      .limit(30)
      .lean();

    const productIds = [];
    for (const o of delivered) {
      for (const it of o.items || []) productIds.push(String(it.productId));
    }
    const uniq = [...new Set(productIds)].filter(Boolean);
    if (uniq.length === 0) {
      res.json({ prompts: [] });
      return;
    }

    const existingReviews = await Review.find({ userId, productId: { $in: uniq } }).select({ productId: 1 }).lean();
    const reviewedSet = new Set(existingReviews.map(r => String(r.productId)));

    const dismissals = await ReviewPromptDismissal.find({ userId, productId: { $in: uniq } }).select({ productId: 1 }).lean();
    const dismissedSet = new Set(dismissals.map(d => String(d.productId)));

    const prompts = [];
    for (const o of delivered) {
      const deliveredAtIso = o.deliveredAt instanceof Date ? o.deliveredAt.toISOString() : (o.deliveredAt ? String(o.deliveredAt) : null);
      for (const it of o.items || []) {
        const pid = String(it.productId);
        if (!pid) continue;
        if (reviewedSet.has(pid)) continue;
        if (dismissedSet.has(pid)) continue;
        prompts.push({ productId: pid, orderId: o._id, deliveredAt: deliveredAtIso });
      }
    }

    res.json({ prompts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load review prompts' });
  }
});

app.post('/api/me/review-prompts/dismiss', mongoReady, requireAuth, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const productId = String(req.body?.productId || '').trim();
    if (!productId) {
      res.status(400).json({ error: 'Missing productId' });
      return;
    }
    await ReviewPromptDismissal.updateOne(
      { userId, productId },
      { $set: { dismissedAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to dismiss prompt' });
  }
});

app.post('/api/me/addresses', mongoReady, requireAuth, async (req, res) => {
  try {
    const label = String(req.body?.label || 'Home').trim();
    const recipientName = String(req.body?.recipientName || '').trim();
    const address = String(req.body?.address || '').trim();
    const city = String(req.body?.city || '').trim();
    const state = req.body?.state != null ? String(req.body.state).trim() : '';
    const pincode = String(req.body?.pincode || '').trim();
    const isDefault = !!req.body?.isDefault;
    if (!recipientName) {
      res.status(400).json({ error: 'Recipient name and phone are required' });
      return;
    }
    let recipientPhone;
    try {
      recipientPhone = normalizeIndianMobileOrThrow(req.body?.recipientPhone);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid phone number' });
      return;
    }
    if (!address || !city || !pincode) {
      res.status(400).json({ error: 'Address, city, and pincode are required' });
      return;
    }
    const id = `addr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const addr = {
      id,
      label,
      recipientName,
      recipientPhone,
      address,
      city,
      state: state || undefined,
      pincode,
      isDefault,
    };
    const u = await User.findById(req.session.userId).exec();
    if (!u) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (isDefault) {
      u.addresses = (u.addresses || []).map((a) => ({ ...a, isDefault: false }));
    }
    u.addresses = [...(u.addresses || []), addr];
    await u.save();
    res.status(201).json({ address: addr, addresses: u.addresses });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add address' });
  }
});

app.patch('/api/me/addresses/:id', mongoReady, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findById(req.session.userId).exec();
    if (!u) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const idx = (u.addresses || []).findIndex((a) => a.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }
    const cur = u.addresses[idx];
    let recipientPhone = cur.recipientPhone;
    if (req.body?.recipientPhone != null) {
      try {
        recipientPhone = normalizeIndianMobileOrThrow(req.body.recipientPhone);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid phone number' });
        return;
      }
    }
    const next = {
      ...cur,
      label: req.body?.label != null ? String(req.body.label).trim() : cur.label,
      recipientName:
        req.body?.recipientName != null ? String(req.body.recipientName).trim() : cur.recipientName,
      recipientPhone,
      address: req.body?.address != null ? String(req.body.address).trim() : cur.address,
      city: req.body?.city != null ? String(req.body.city).trim() : cur.city,
      state: req.body?.state != null ? String(req.body.state).trim() : cur.state,
      pincode: req.body?.pincode != null ? String(req.body.pincode).trim() : cur.pincode,
      isDefault: req.body?.isDefault != null ? !!req.body.isDefault : cur.isDefault,
    };
    if (next.isDefault) {
      u.addresses = (u.addresses || []).map((a) => ({ ...a, isDefault: a.id === id }));
      u.addresses[idx] = { ...u.addresses[idx], ...next, isDefault: true };
    } else {
      u.addresses[idx] = next;
    }
    await u.save();
    res.json({ address: u.addresses[idx], addresses: u.addresses });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

app.delete('/api/me/addresses/:id', mongoReady, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findById(req.session.userId).exec();
    if (!u) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    u.addresses = (u.addresses || []).filter((a) => a.id !== id);
    await u.save();
    res.json({ addresses: u.addresses });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

function hashPassword(password, salt) {
  // PBKDF2 is built-in (no extra deps). Use a high iteration count for better security.
  const iters = Number(process.env.PASSWORD_HASH_ITERS || 120000);
  return crypto.pbkdf2Sync(password, salt, iters, 64, 'sha512').toString('hex');
}

app.post('/api/auth/password/set', mongoReady, requireAuth, async (req, res) => {
  try {
    const password = String(req.body?.password || '').trim();
    if (!password || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }
    const user = await User.findById(req.session.userId).lean();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const hasExistingPassword = !!(user.passwordHash && user.passwordSalt);
    const currentPassword = String(req.body?.currentPassword || '').trim();
    if (hasExistingPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password is required' });
        return;
      }
      const computed = hashPassword(currentPassword, user.passwordSalt);
      if (computed !== user.passwordHash) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    await User.findByIdAndUpdate(req.session.userId, {
      passwordSalt: salt,
      passwordHash,
      mustResetPassword: false,
    });
    const u = await User.findById(req.session.userId).lean();
    res.json({ user: u ? serializeUser(u) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

app.post(
  '/api/auth/login',
  rateLimitByIp({ keyPrefix: 'auth_login', limit: SIGNUP_RATE_LIMIT_MAX, windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS }),
  requireTrustedBrowserOrigin,
  async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '').trim();
    if (!email || !password || !simpleEmailValid(email)) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    const user = await User.findOne({ email }).exec();
    if (!user || !user.passwordHash || !user.passwordSalt) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const computed = hashPassword(password, user.passwordSalt);
    if (computed !== user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (user.mustResetPassword) {
      res.status(403).json({ error: 'Password must be set before login' });
      return;
    }

    req.session.userId = user._id;
    await saveSession(req);

    const serialized = serializeUser(await User.findById(user._id).lean());
    let authToken;
    try {
      authToken = await issueClientAuthToken(user._id);
    } catch (err) {
      console.error(err);
    }

    res.set('Cache-Control', 'no-store');
    res.json(authToken ? { user: serialized, authToken } : { user: serialized });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/password/forgot', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email || !simpleEmailValid(email)) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }

    const otpLen = Number(process.env.OTP_CODE_LENGTH || 6);
    const otpTtlSec = Number(process.env.OTP_TTL_SECONDS || 10 * 60);
    const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);

    const user = await User.findOne({ email }).exec();
    if (!user) {
      // Avoid account enumeration. Still respond with a generic success.
      res.json({ ok: true });
      return;
    }

    const code = genNumericCode(otpLen);
    const codeSalt = crypto.randomBytes(16).toString('hex');
    const codeHash = sha256Hex(`${codeSalt}:${code}`);
    const challengeId = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + otpTtlSec * 1000);

    await OtpChallenge.create({
      challengeId,
      purpose: 'password_reset',
      userId: user._id,
      email,
      codeHash,
      codeSalt,
      expiresAt,
      attempts: 0,
      maxAttempts,
    });

    const sent = await sendOtpEmail({ to: email, code, purpose: 'password_reset' });
    if (!sent.ok) {
      res.status(503).json({ error: sent.error || 'Could not send OTP' });
      return;
    }

    res.json({ ok: true, challengeId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to request password reset' });
  }
});

app.post('/api/auth/password/reset', requireTrustedBrowserOrigin, async (req, res) => {
  try {
    const challengeId = String(req.body?.challengeId || '').trim();
    const code = String(req.body?.code || '').trim();
    const password = String(req.body?.password || '').trim();
    if (!challengeId || !code || !password) {
      res.status(400).json({ error: 'Missing challengeId, code, or password' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const challenge = await OtpChallenge.findOne({ challengeId, purpose: 'password_reset' }).exec();
    if (!challenge) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }
    if (!challenge.expiresAt || challenge.expiresAt.getTime() <= Date.now()) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    const candidateHash = sha256Hex(`${challenge.codeSalt}:${code}`);
    if (candidateHash !== challenge.codeHash) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    await User.findByIdAndUpdate(challenge.userId, {
      passwordSalt: salt,
      passwordHash,
      mustResetPassword: false,
    });

    await OtpChallenge.deleteOne({ _id: challenge._id });

    // Login after reset.
    req.session.userId = challenge.userId;
    await saveSession(req);
    const u = await User.findById(challenge.userId).lean();
    const serialized = u ? serializeUser(u) : null;
    let authToken;
    try {
      authToken = await issueClientAuthToken(challenge.userId);
    } catch (err) {
      console.error(err);
    }
    res.json(authToken ? { user: serialized, authToken } : { user: serialized });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/products', mongoReady, async (_req, res) => {
  try {
    const docs = await Product.find().sort({ category: 1, displayOrder: 1, _id: 1 }).lean();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(docs.map((d) => serializeProductDoc(d)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list products' });
  }
});

function xmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function seoClean(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productLongTailKeywordForSitemap(p) {
  const name = seoClean(p?.name);
  const category = seoClean(p?.category);
  const subcategory = seoClean(p?.subcategory);
  if (category === 'printed') {
    if (name.includes('cup') || name.includes('mug')) return 'custom printed cup online india';
    return 'printed t shirt online india';
  }
  if (subcategory.includes('belt') || name.includes('belt')) return 'men leather belt online india';
  if (category === 'fashion') return 'mens fashion accessories online india';
  if (category === 'home') return 'home essentials online india';
  if (category === 'electronics') return 'electronics accessories online india';
  return 'online shopping india';
}

function productSeoSlugForSitemap(p) {
  const raw = `${p?.name || ''} ${productLongTailKeywordForSitemap(p)} trendnest99`;
  const slug = seoClean(raw).split(' ').filter(Boolean).slice(0, 14).join('-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return slug || String(p?.id || p?._id || 'product').toLowerCase();
}

async function fetchProductsForSitemap(req) {
  const base =
    process.env.PUBLIC_API_BASE_URL && String(process.env.PUBLIC_API_BASE_URL).trim()
      ? String(process.env.PUBLIC_API_BASE_URL).trim().replace(/\/+$/, '')
      : `${req.protocol}://${req.get('host')}`;

  const url = `${base}/api/products`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Failed to fetch products for sitemap: ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

app.get('/sitemap.xml', async (req, res) => {
  try {
    const SITE = 'https://trendnest99.in';
    const nowIso = new Date().toISOString();
    const staticUrls = [
      { loc: `${SITE}/`, lastmod: nowIso },
      { loc: `${SITE}/best-deals`, lastmod: nowIso },
      { loc: `${SITE}/custom-print`, lastmod: nowIso },
      { loc: `${SITE}/category/home`, lastmod: nowIso },
      { loc: `${SITE}/category/printed`, lastmod: nowIso },
      { loc: `${SITE}/category/trending`, lastmod: nowIso },
      { loc: `${SITE}/category/fashion`, lastmod: nowIso },
      { loc: `${SITE}/category/electronics`, lastmod: nowIso },
      { loc: `${SITE}/contact`, lastmod: nowIso },
    ];

    const products = await fetchProductsForSitemap(req);
    const categoryUrls = Array.from(
      new Set(
        products
          .map((p) => String(p?.category || '').trim())
          .filter(Boolean)
          .map((category) => `${SITE}/category/${encodeURIComponent(category)}`)
      )
    ).map((loc) => ({ loc, lastmod: nowIso }));
    const productUrls = products
      .map((p) => {
        const id = String(p?.id || p?._id || '').trim();
        if (!id) return null;
        const rawLastmod = p?.updatedAt || p?.createdAt || '';
        const d = rawLastmod ? new Date(rawLastmod) : null;
        const lastmod = d && !Number.isNaN(d.getTime()) ? d.toISOString() : nowIso;
        return { loc: `${SITE}/product/${encodeURIComponent(productSeoSlugForSitemap(p))}`, lastmod };
      })
      .filter(Boolean);

    const urls = [...staticUrls, ...categoryUrls, ...productUrls];
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${xmlEscape(u.lastmod)}</lastmod></url>`)
        .join('\n') +
      `\n</urlset>\n`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.status(200).send(body);
  } catch (e) {
    console.error(e);
    res.status(500).type('text/plain').send('sitemap error');
  }
});

app.get('/robots.txt', (_req, res) => {
  const SITE = 'https://trendnest99.in';
  const body =
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /account\n` +
    `Disallow: /cart\n` +
    `Disallow: /checkout\n` +
    `Disallow: /api/\n\n` +
    `Sitemap: ${SITE}/sitemap.xml\n`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=900');
  res.status(200).send(body);
});

app.get('/api/reviews/summary', mongoReady, async (req, res) => {
  try {
    const raw = String(req.query?.productIds || '').trim();
    const productIds = raw
      ? raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 200)
      : [];

    const match = productIds.length ? { productId: { $in: productIds } } : {};
    const rows = await Review.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$productId',
          reviewCount: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        },
      },
    ]);

    const summary = {};
    for (const r of rows) {
      summary[String(r._id)] = {
        reviewCount: Number(r.reviewCount || 0),
        avgRating: Number(r.avgRating || 0),
      };
    }

    // Fill in missing IDs with zeros so UI always has deterministic values.
    for (const pid of productIds) {
      if (!summary[pid]) summary[pid] = { reviewCount: 0, avgRating: 0 };
    }

    res.json({ summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load rating summary' });
  }
});

function normalizeVariantOptionsFromBody(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((v) => ({
      name: (typeof v?.name === 'string' ? v.name : String(v?.name ?? '')).trim(),
      images: Array.isArray(v?.images)
        ? v.images.map((u) => String(u)).filter(Boolean)
        : [],
    }))
    .filter((v) => v.name.length > 0);
}

/** Product details rows: both label and value must be non-empty after trim. */
function normalizeSpecificationsFromBody(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      label: (typeof row?.label === 'string' ? row.label : String(row?.label ?? '')).trim(),
      value: (typeof row?.value === 'string' ? row.value : String(row?.value ?? '')).trim(),
    }))
    .filter((row) => row.label.length > 0 && row.value.length > 0);
}

function serializeProductDraft(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = o._id;
  delete o._id;
  const out = { draftId: id, ...o };
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString();
  if (out.updatedAt instanceof Date) out.updatedAt = out.updatedAt.toISOString();
  return out;
}

function clampImagePrimaryIndex(items, idx) {
  const n = Array.isArray(items) ? items.length : 0;
  if (!n) return 0;
  const i = Number(idx);
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(n - 1, Math.floor(i)));
}

function normalizeDraftPatch(patch) {
  const out = {};
  if (patch == null || typeof patch !== 'object') return out;
  if (patch.status !== undefined) out.status = patch.status === 'published' ? 'published' : 'draft';
  if (patch.categoryMain !== undefined) out.categoryMain = String(patch.categoryMain ?? '').trim();
  if (patch.subcategory !== undefined) out.subcategory = String(patch.subcategory ?? '').trim();
  if (patch.details !== undefined) out.details = patch.details && typeof patch.details === 'object' ? patch.details : {};
  if (patch.images !== undefined) {
    const items = Array.isArray(patch.images?.items) ? patch.images.items.map((u) => String(u)).filter(Boolean).slice(0, 8) : [];
    const primaryIndex = clampImagePrimaryIndex(items, patch.images?.primaryIndex);
    out.images = { items, primaryIndex };
  }
  if (patch.variants !== undefined) out.variants = patch.variants && typeof patch.variants === 'object' ? patch.variants : {};
  if (patch.shipping !== undefined) out.shipping = patch.shipping && typeof patch.shipping === 'object' ? patch.shipping : {};
  return out;
}

function normalizeSaleBannerStatus(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'live' || v === 'disabled' || v === 'draft') return v;
  return 'draft';
}

function normalizeSaleBannerTheme(raw) {
  const v = String(raw || '').trim().toLowerCase();
  return SALE_BANNER_THEMES.includes(v) ? v : 'default';
}

function normalizeSaleBannerPriority(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 100;
  return Math.max(-9_999, Math.min(9_999, n));
}

function normalizeHeroFirstSlideMode(raw) {
  const v = String(raw || '').trim().toLowerCase();
  return HERO_FIRST_SLIDE_MODES.includes(v) ? v : 'auto';
}

function parseDateInputOrThrow(raw, fieldName) {
  const d = raw instanceof Date ? raw : new Date(raw);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) throw new Error(`${fieldName} must be a valid date`);
  return new Date(ms);
}

function normalizeSaleBannerTargetProductIds(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const id = String(item ?? '').trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 100) break;
  }
  return out;
}

function normalizeHeroBannerSettingsPatch(body) {
  if (body == null || typeof body !== 'object') return {};
  const out = {};
  if (body.firstSlideMode !== undefined) out.firstSlideMode = normalizeHeroFirstSlideMode(body.firstSlideMode);
  if (body.firstBannerId !== undefined) out.firstBannerId = String(body.firstBannerId ?? '').trim();
  return out;
}

function normalizeSaleBannerCreateBodyOrThrow(body) {
  const title = String(body?.title ?? '').trim();
  const desktopImage = String(body?.desktopImage ?? '').trim();
  if (!title) throw new Error('title is required');
  if (!desktopImage) throw new Error('desktopImage is required');

  const startDate = parseDateInputOrThrow(body?.startDate, 'startDate');
  const endDate = parseDateInputOrThrow(body?.endDate, 'endDate');
  if (endDate.getTime() < startDate.getTime()) {
    throw new Error('endDate must be greater than or equal to startDate');
  }

  return {
    title,
    subtitle: String(body?.subtitle ?? '').trim(),
    desktopImage,
    mobileImage: String(body?.mobileImage ?? '').trim(),
    ctaText: String(body?.ctaText ?? '').trim(),
    ctaLink: String(body?.ctaLink ?? '').trim(),
    theme: normalizeSaleBannerTheme(body?.theme),
    startDate,
    endDate,
    status: normalizeSaleBannerStatus(body?.status),
    priority: normalizeSaleBannerPriority(body?.priority),
    targetCategory: String(body?.targetCategory ?? '').trim(),
    targetProductIds: normalizeSaleBannerTargetProductIds(body?.targetProductIds),
  };
}

function normalizeSaleBannerPatchBodyOrThrow(body) {
  if (body == null || typeof body !== 'object') return {};
  const out = {};

  if (body.title !== undefined) {
    const title = String(body.title ?? '').trim();
    if (!title) throw new Error('title cannot be empty');
    out.title = title;
  }
  if (body.subtitle !== undefined) out.subtitle = String(body.subtitle ?? '').trim();
  if (body.desktopImage !== undefined) {
    const desktopImage = String(body.desktopImage ?? '').trim();
    if (!desktopImage) throw new Error('desktopImage cannot be empty');
    out.desktopImage = desktopImage;
  }
  if (body.mobileImage !== undefined) out.mobileImage = String(body.mobileImage ?? '').trim();
  if (body.ctaText !== undefined) out.ctaText = String(body.ctaText ?? '').trim();
  if (body.ctaLink !== undefined) out.ctaLink = String(body.ctaLink ?? '').trim();
  if (body.theme !== undefined) out.theme = normalizeSaleBannerTheme(body.theme);
  if (body.status !== undefined) out.status = normalizeSaleBannerStatus(body.status);
  if (body.priority !== undefined) out.priority = normalizeSaleBannerPriority(body.priority);
  if (body.startDate !== undefined) out.startDate = parseDateInputOrThrow(body.startDate, 'startDate');
  if (body.endDate !== undefined) out.endDate = parseDateInputOrThrow(body.endDate, 'endDate');
  if (body.targetCategory !== undefined) out.targetCategory = String(body.targetCategory ?? '').trim();
  if (body.targetProductIds !== undefined) out.targetProductIds = normalizeSaleBannerTargetProductIds(body.targetProductIds);

  return out;
}

function isSaleBannerLive(doc, nowMs = Date.now()) {
  const status = String(doc?.status || '').trim().toLowerCase();
  if (status !== 'live') return false;
  const startMs = new Date(doc?.startDate).getTime();
  const endMs = new Date(doc?.endDate).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
  return startMs <= nowMs && nowMs <= endMs;
}

function serializeSaleBanner(doc, nowMs = Date.now()) {
  const o = serialize(doc);
  if (!o) return null;
  if (o.createdAt instanceof Date) o.createdAt = o.createdAt.toISOString();
  if (o.updatedAt instanceof Date) o.updatedAt = o.updatedAt.toISOString();
  if (o.startDate instanceof Date) o.startDate = o.startDate.toISOString();
  if (o.endDate instanceof Date) o.endDate = o.endDate.toISOString();
  o.isActive = isSaleBannerLive(o, nowMs);
  return o;
}

function serializeHeroBannerSettings(doc) {
  if (!doc) return { firstSlideMode: 'auto', firstBannerId: '' };
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const out = {
    firstSlideMode: normalizeHeroFirstSlideMode(o.firstSlideMode),
    firstBannerId: String(o.firstBannerId || '').trim(),
  };
  if (out.firstSlideMode !== 'banner') out.firstBannerId = '';
  if (o.updatedAt instanceof Date) out.updatedAt = o.updatedAt.toISOString();
  return out;
}

function requireUniqueSkus(rows) {
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const sku = String(rows[i]?.sku ?? '').trim();
    if (!sku) throw new Error(`Variant SKU is required (row ${i + 1})`);
    const key = sku.toLowerCase();
    if (seen.has(key)) throw new Error(`Variant SKU must be unique (duplicate: ${sku})`);
    seen.add(key);
  }
}

function draftToProductPayload(draft) {
  const d = draft?.details && typeof draft.details === 'object' ? draft.details : {};
  const ship = draft?.shipping && typeof draft.shipping === 'object' ? draft.shipping : {};
  const images = Array.isArray(draft?.images?.items) ? draft.images.items.map((u) => String(u)).filter(Boolean).slice(0, 8) : [];
  const primaryIndex = clampImagePrimaryIndex(images, draft?.images?.primaryIndex);
  const orderedImages = images.length
    ? [images[primaryIndex], ...images.filter((_, i) => i !== primaryIndex)]
    : [];

  // Variants payload is stored in draft. For now we map it into Product fields additively.
  const v = draft?.variants && typeof draft.variants === 'object' ? draft.variants : {};
  const hasVariants = !!v.hasVariants || (Array.isArray(v.items) && v.items.length > 0);

  const base = {
    name: String(d.name ?? '').trim(),
    description: sanitizeProductDescription(d.description ?? ''),
    originalPrice: d.originalPrice != null && d.originalPrice !== '' ? Number(d.originalPrice) : undefined,
    category: String(draft.categoryMain ?? '').trim(),
    subcategory: String(draft.subcategory ?? '').trim(),
    tags: Array.isArray(d.tags) ? d.tags.map((t) => String(t)).filter(Boolean) : [],
    specifications: normalizeSpecificationsFromBody(d.specifications),
    images: orderedImages.length ? orderedImages : undefined,
    isTrending: !!d.isTrending,
    isBestDeal: !!d.isBestDeal,
    isCustomPrint: !!d.isCustomPrint,
    shipWeightKg: ship?.weightKg != null && ship.weightKg !== '' ? Number(ship.weightKg) : undefined,
    shipLengthCm: ship?.lengthCm != null && ship.lengthCm !== '' ? Number(ship.lengthCm) : undefined,
    shipWidthCm: ship?.widthCm != null && ship.widthCm !== '' ? Number(ship.widthCm) : undefined,
    shipHeightCm: ship?.heightCm != null && ship.heightCm !== '' ? Number(ship.heightCm) : undefined,
  };

  // Validate/clamp shipping inputs when present (optional fields).
  const clampOpt = (v, { min, max }) => {
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    if (n <= 0) return undefined;
    return clampNum(n, { min, max });
  };
  base.shipWeightKg = clampOpt(base.shipWeightKg, { min: 0.05, max: 25 });
  base.shipLengthCm = clampOpt(base.shipLengthCm, { min: 1, max: 200 });
  base.shipWidthCm = clampOpt(base.shipWidthCm, { min: 1, max: 200 });
  base.shipHeightCm = clampOpt(base.shipHeightCm, { min: 1, max: 200 });

  if (!hasVariants) {
    const simple = v.simple && typeof v.simple === 'object' ? v.simple : {};
    const forcedCodPrice = Number(simple.price ?? d.price ?? 0);
    return {
      ...base,
      price: Number(simple.price ?? d.price ?? 0),
      stock: Number(simple.stock ?? d.stock ?? 0) || 0,
      sku: simple.sku != null ? String(simple.sku).trim() : undefined,
      onlinePrice: simple.onlinePrice != null ? Number(simple.onlinePrice) : undefined,
      codPrice: Number.isFinite(forcedCodPrice) ? forcedCodPrice : undefined,
      variantModel: undefined,
    };
  }

  let types = Array.isArray(v.types) ? v.types : [];
  const items = Array.isArray(v.items) ? v.items : [];
  requireUniqueSkus(items);

  // If types are missing, derive them from attrs keys (so variant selectors still render).
  if (!types.length && items.length) {
    const keys = new Set();
    for (const it of items) {
      const attrs = it?.attrs && typeof it.attrs === 'object' ? it.attrs : {};
      for (const k of Object.keys(attrs)) keys.add(String(k));
    }
    types = Array.from(keys).map((k) => ({
      name: k,
      values: Array.from(
        new Set(items.map((it) => String((it?.attrs && it.attrs[k] != null) ? it.attrs[k] : '')).filter(Boolean))
      ),
    }));
  }

  // Default PDP price/stock to the first item (storefront will use variantModel when present).
  const first = items[0] || {};
  const stockSum = items.reduce((acc, it) => acc + (Number(it?.stock) || 0), 0);
  const minPrice = items.reduce((acc, it) => {
    const n = Number(it?.price);
    if (!Number.isFinite(n) || n <= 0) return acc;
    return acc === null ? n : Math.min(acc, n);
  }, null);

  // Compatibility: also emit legacy `variantOptions` (used by older storefront helpers).
  // We derive it from the first variant dimension (usually "Color").
  const firstTypeName = String(types?.[0]?.name ?? '').trim();
  const legacyVariantOptions =
    firstTypeName && items.length
      ? Array.from(
          new Map(
            items
              .map((it) => {
                const attrs = it?.attrs && typeof it.attrs === 'object' ? it.attrs : {};
                const name = String(attrs?.[firstTypeName] ?? '').trim();
                const imgs = Array.isArray(it?.images) ? it.images.map((u) => String(u)).filter(Boolean).slice(0, 8) : [];
                const legacy = it?.image ? [String(it.image)] : [];
                const images = [...imgs, ...legacy].map((u) => String(u)).filter(Boolean);
                return name ? [name, { name, images }] : null;
              })
              .filter(Boolean)
          ).values()
        )
      : [];

  return {
    ...base,
    price: Number((minPrice ?? first.price) ?? d.price ?? 0),
    stock: stockSum || Number(first.stock ?? d.stock ?? 0) || 0,
    onlinePrice: first.onlinePrice != null ? Number(first.onlinePrice) : undefined,
    codPrice: Number.isFinite(Number(first.price)) ? Number(first.price) : undefined,
    variantOptions: legacyVariantOptions.length ? legacyVariantOptions : undefined,
    variantModel: {
      types: types.map((t) => ({
        name: String(t?.name ?? '').trim(),
        values: Array.isArray(t?.values) ? t.values.map((x) => String(x)).filter(Boolean) : [],
      })),
      items: items.map((it) => ({
        key: String(it?.key ?? '').trim(),
        attrs: it?.attrs && typeof it.attrs === 'object' ? it.attrs : {},
        isDefault: !!it?.isDefault,
        displayName: it?.displayName != null ? String(it.displayName).trim() || undefined : undefined,
        sku: String(it?.sku ?? '').trim(),
        price: Number(it?.price ?? 0),
        originalPrice: it?.originalPrice != null ? Number(it.originalPrice) : undefined,
        onlinePrice: it?.onlinePrice != null ? Number(it.onlinePrice) : undefined,
        codPrice: Number.isFinite(Number(it?.price)) ? Number(it.price) : undefined,
        stock: Number(it?.stock ?? 0) || 0,
        previewImage: it?.previewImage != null ? String(it.previewImage).trim() || undefined : undefined,
        image: it?.image ? String(it.image) : undefined,
        images: Array.isArray(it?.images) ? it.images.map((u) => String(u)).filter(Boolean).slice(0, 8) : undefined,
        sizes: Array.isArray(it?.sizes)
          ? it.sizes.map((s) => String(s).trim()).filter(Boolean)
          : undefined,
      })),
    },
  };
}

// Admin hero/sale banner endpoints
app.get('/api/admin/hero-banners', mongoReady, adminKeyRequired, async (_req, res) => {
  try {
    const nowMs = Date.now();
    const docs = await HeroSaleBanner.find().sort({ priority: 1, startDate: 1, createdAt: -1 }).lean();
    const settingsDoc = await HeroBannerSetting.findById(HERO_BANNER_SETTINGS_ID).lean();
    res.json({
      banners: docs.map((d) => serializeSaleBanner(d, nowMs)),
      settings: serializeHeroBannerSettings(settingsDoc),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list hero banners' });
  }
});

app.get('/api/admin/hero-banners/settings', mongoReady, adminKeyRequired, async (_req, res) => {
  try {
    const doc = await HeroBannerSetting.findById(HERO_BANNER_SETTINGS_ID).lean();
    res.json({ settings: serializeHeroBannerSettings(doc) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load hero banner settings' });
  }
});

app.patch('/api/admin/hero-banners/settings', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const patch = normalizeHeroBannerSettingsPatch(req.body || {});
    const existing = await HeroBannerSetting.findById(HERO_BANNER_SETTINGS_ID).lean();

    const nextMode = patch.firstSlideMode ?? normalizeHeroFirstSlideMode(existing?.firstSlideMode);
    const nextBannerId = String(patch.firstBannerId ?? existing?.firstBannerId ?? '').trim();

    if (nextMode === 'banner') {
      if (!nextBannerId) {
        res.status(400).json({ error: 'firstBannerId is required when firstSlideMode is banner' });
        return;
      }
      const exists = await HeroSaleBanner.exists({ _id: nextBannerId });
      if (!exists) {
        res.status(400).json({ error: 'Selected first banner was not found' });
        return;
      }
    } else {
      patch.firstBannerId = '';
    }

    await HeroBannerSetting.updateOne(
      { _id: HERO_BANNER_SETTINGS_ID },
      { $set: patch, $setOnInsert: { _id: HERO_BANNER_SETTINGS_ID } },
      { upsert: true }
    );
    const doc = await HeroBannerSetting.findById(HERO_BANNER_SETTINGS_ID).lean();
    res.json({ settings: serializeHeroBannerSettings(doc) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to update hero banner settings';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/admin/hero-banners', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const payload = normalizeSaleBannerCreateBodyOrThrow(req.body || {});
    const id = `banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const doc = await HeroSaleBanner.create({ _id: id, ...payload });
    res.status(201).json({ banner: serializeSaleBanner(doc) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create hero banner';
    res.status(400).json({ error: msg });
  }
});

app.patch('/api/admin/hero-banners/:bannerId', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const bannerId = String(req.params.bannerId || '').trim();
    const existing = await HeroSaleBanner.findById(bannerId).lean();
    if (!existing) {
      res.status(404).json({ error: 'Hero banner not found' });
      return;
    }

    const patch = normalizeSaleBannerPatchBodyOrThrow(req.body || {});
    const nextStart = patch.startDate ?? existing.startDate;
    const nextEnd = patch.endDate ?? existing.endDate;
    if (new Date(nextEnd).getTime() < new Date(nextStart).getTime()) {
      res.status(400).json({ error: 'endDate must be greater than or equal to startDate' });
      return;
    }

    if (Object.keys(patch).length > 0) {
      await HeroSaleBanner.updateOne({ _id: bannerId }, { $set: patch });
    }
    const next = await HeroSaleBanner.findById(bannerId).lean();
    res.json({ banner: serializeSaleBanner(next) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to update hero banner';
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/admin/hero-banners/:bannerId', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const bannerId = String(req.params.bannerId || '').trim();
    await HeroSaleBanner.deleteOne({ _id: bannerId });
    const settings = await HeroBannerSetting.findById(HERO_BANNER_SETTINGS_ID).lean();
    const selectedId = String(settings?.firstBannerId || '').trim();
    if (normalizeHeroFirstSlideMode(settings?.firstSlideMode) === 'banner' && selectedId === bannerId) {
      await HeroBannerSetting.updateOne(
        { _id: HERO_BANNER_SETTINGS_ID },
        { $set: { firstSlideMode: 'auto', firstBannerId: '' }, $setOnInsert: { _id: HERO_BANNER_SETTINGS_ID } },
        { upsert: true }
      );
    }
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete hero banner' });
  }
});

// Public storefront endpoint: only currently active/live hero banners.
app.get('/api/hero-banners/active', mongoReady, async (_req, res) => {
  try {
    const now = new Date();
    const docs = await HeroSaleBanner.find({
      status: 'live',
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ priority: 1, startDate: 1, createdAt: -1 })
      .limit(25)
      .lean();
    const settingsDoc = await HeroBannerSetting.findById(HERO_BANNER_SETTINGS_ID).lean();
    const nowMs = now.getTime();
    res.json({
      banners: docs.map((d) => serializeSaleBanner(d, nowMs)),
      settings: serializeHeroBannerSettings(settingsDoc),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list active hero banners' });
  }
});

// Admin draft endpoints (wizard autosave)
app.post('/api/admin/product-drafts', mongoReady, adminKeyRequired, async (_req, res) => {
  try {
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const doc = await ProductDraft.create({ _id: id, status: 'draft' });
    res.status(201).json({ draft: serializeProductDraft(doc) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

app.get('/api/admin/product-drafts', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const status = String(req.query?.status || 'draft');
    const q = status === 'published' ? { status: 'published' } : { status: 'draft' };
    const docs = await ProductDraft.find(q).sort({ updatedAt: -1 }).limit(200).lean();
    res.json({ drafts: docs.map((d) => serializeProductDraft(d)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list drafts' });
  }
});

app.get('/api/admin/product-drafts/:draftId', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { draftId } = req.params;
    const doc = await ProductDraft.findById(draftId).lean();
    if (!doc) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    res.json({ draft: serializeProductDraft(doc) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load draft' });
  }
});

app.patch('/api/admin/product-drafts/:draftId', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { draftId } = req.params;
    const existing = await ProductDraft.findById(draftId).lean();
    if (!existing) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    const patch = normalizeDraftPatch(req.body);
    const $set = { ...patch };

    const isPlainObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

    // Merge nested objects instead of replacing (prevents dropping fields like `variants.items[].images`).
    if (patch.details !== undefined && isPlainObject(existing.details) && isPlainObject(patch.details)) {
      $set.details = { ...(existing.details ?? {}), ...(patch.details ?? {}) };
    }
    if (patch.variants !== undefined && isPlainObject(existing.variants) && isPlainObject(patch.variants)) {
      $set.variants = { ...(existing.variants ?? {}), ...(patch.variants ?? {}) };
    }
    if (patch.shipping !== undefined && isPlainObject(existing.shipping) && isPlainObject(patch.shipping)) {
      $set.shipping = { ...(existing.shipping ?? {}), ...(patch.shipping ?? {}) };
    }

    await ProductDraft.updateOne({ _id: draftId }, { $set });
    const doc = await ProductDraft.findById(draftId).lean();
    res.json({ draft: serializeProductDraft(doc) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

app.delete('/api/admin/product-drafts/:draftId', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { draftId } = req.params;
    await ProductDraft.deleteOne({ _id: draftId });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

app.post('/api/admin/product-drafts/:draftId/publish', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { draftId } = req.params;
    const draft = await ProductDraft.findById(draftId).lean();
    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    const payload = draftToProductPayload(draft);
    if (!payload.name) {
      res.status(400).json({ error: 'Product name is required' });
      return;
    }
    if (!payload.category) {
      res.status(400).json({ error: 'Main category is required' });
      return;
    }
    if (!Number.isFinite(Number(payload.price)) || Number(payload.price) <= 0) {
      res.status(400).json({ error: 'Price must be greater than 0' });
      return;
    }

    const publishAs = String(req.body?.publishAs || '').toLowerCase(); // 'draft' | 'published'
    const status = publishAs === 'draft' ? 'draft' : 'published';

    const productId = draft.publishedProductId ? String(draft.publishedProductId) : `p${Date.now()}`;
    const docExists = await Product.exists({ _id: productId });
    if (docExists) {
      const $set = buildProductUpdateSet(payload);
      await Product.findByIdAndUpdate(productId, { $set }, { new: false });
    } else {
      const cat = String(payload.category || '').trim();
      const maxRow = cat
        ? await Product.find({ category: cat }).sort({ displayOrder: -1, _id: -1 }).select('displayOrder').limit(1).lean()
        : [];
      const maxVal = maxRow?.[0]?.displayOrder != null ? Number(maxRow[0].displayOrder) : 0;
      const nextOrder = Number.isFinite(maxVal) ? maxVal + 10 : 10;
      await Product.create({ _id: productId, ...payload, displayOrder: nextOrder });
    }

    await ProductDraft.updateOne({ _id: draftId }, { $set: { status, publishedProductId: productId } });
    const nextDraft = await ProductDraft.findById(draftId).lean();
    const product = await Product.findById(productId).lean();
    res.json({ draft: serializeProductDraft(nextDraft), product: serializeProductDoc(product) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to publish draft' });
  }
});

app.post('/api/products', mongoReady, async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || `p${Date.now()}`;
    const forcedCodPrice = Number(body.price);
    const cat = String(body.category || '').trim();
    const maxRow = cat
      ? await Product.find({ category: cat }).sort({ displayOrder: -1, _id: -1 }).select('displayOrder').limit(1).lean()
      : [];
    const maxVal = maxRow?.[0]?.displayOrder != null ? Number(maxRow[0].displayOrder) : 0;
    const nextOrder = Number.isFinite(maxVal) ? maxVal + 10 : 10;
    const doc = await Product.create({
      _id: id,
      name: body.name,
      description: sanitizeProductDescription(body.description ?? ''),
      sku: body.sku != null ? String(body.sku) : '',
      price: Number(body.price),
      onlinePrice: body.onlinePrice != null ? Number(body.onlinePrice) : undefined,
      codPrice: Number.isFinite(forcedCodPrice) ? forcedCodPrice : undefined,
      originalPrice: body.originalPrice != null ? Number(body.originalPrice) : undefined,
      images: Array.isArray(body.images) && body.images.length ? body.images : ['https://images.unsplash.com/photo-1553062407-98d43420e9e7?w=600'],
      category: body.category,
      subcategory: body.subcategory,
      displayOrder: nextOrder,
      sizes: body.sizes,
      variantOptions: normalizeVariantOptionsFromBody(body.variantOptions),
      variants: body.variants,
      variantModel: (() => {
        const vm = body.variantModel && typeof body.variantModel === 'object' ? body.variantModel : undefined;
        if (!vm || typeof vm !== 'object') return undefined;
        const items = Array.isArray(vm.items) ? vm.items : undefined;
        if (!items) return vm;
        return {
          ...vm,
          items: items.map((it) => {
            const price = Number(it?.price);
            return {
              ...it,
              codPrice: Number.isFinite(price) ? price : undefined,
              displayName: it?.displayName != null ? String(it.displayName).trim() || undefined : undefined,
              previewImage: it?.previewImage != null ? String(it.previewImage).trim() || undefined : undefined,
              image: it?.image != null ? String(it.image).trim() || undefined : undefined,
              images: Array.isArray(it?.images) ? it.images.map((u) => String(u).trim()).filter(Boolean) : undefined,
              sizes: Array.isArray(it?.sizes) ? it.sizes.map((s) => String(s).trim()).filter(Boolean) : undefined,
            };
          }),
        };
      })(),
      sleeveTypes: body.sleeveTypes,
      stock: Number(body.stock) || 0,
      rating: Number(body.rating) || 4,
      reviews: body.reviews || [],
      isCustomPrint: !!body.isCustomPrint,
      isTrending: !!body.isTrending,
      tags: body.tags,
      specifications: normalizeSpecificationsFromBody(body.specifications),
    });
    res.status(201).json(serializeProductDoc(doc));
  } catch (e) {
    console.error(e);
    if (e.code === 11000) {
      res.status(409).json({ error: 'Product id already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Admin: bulk reorder products within a category (manual displayOrder).
app.patch('/api/admin/products/reorder', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const body = req.body || {};
    const category = String(body?.category || '').trim();
    const orderedIdsRaw = Array.isArray(body?.orderedIds) ? body.orderedIds : [];
    const orderedIds = orderedIdsRaw.map((x) => String(x || '').trim()).filter(Boolean);

    if (!category) {
      res.status(400).json({ error: 'category is required' });
      return;
    }
    if (orderedIds.length < 2) {
      res.status(400).json({ error: 'orderedIds must include at least 2 product ids' });
      return;
    }
    if (orderedIds.length > 5000) {
      res.status(400).json({ error: 'orderedIds is too large' });
      return;
    }

    const unique = Array.from(new Set(orderedIds));
    if (unique.length !== orderedIds.length) {
      res.status(400).json({ error: 'orderedIds must be unique' });
      return;
    }

    const existing = await Product.find({ _id: { $in: orderedIds } }).select('_id category').lean();
    if (existing.length !== orderedIds.length) {
      res.status(400).json({ error: 'Some product ids were not found' });
      return;
    }
    const badCat = existing.find((p) => String(p?.category || '').trim() !== category);
    if (badCat) {
      res.status(400).json({ error: 'All products must belong to the provided category' });
      return;
    }

    const ops = orderedIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: id, category },
        update: { $set: { displayOrder: (idx + 1) * 10 } },
      },
    }));

    const r = await Product.bulkWrite(ops, { ordered: false });
    res.json({ ok: true, updated: Number(r?.modifiedCount || 0) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reorder products' });
  }
});

/**
 * Build a BSON-safe $set object. Uses the native collection for updates so nested
 * `variantOptions` and `images` persist reliably (Mongoose doc.save() often skips or fails them).
 */
function buildProductUpdateSet(src) {
  const out = {};
  if (src.name !== undefined) out.name = String(src.name);
  if (src.description !== undefined) out.description = sanitizeProductDescription(src.description ?? '');
  if (src.sku !== undefined) out.sku = String(src.sku ?? '');
  if (src.price !== undefined) {
    const n = Number(src.price);
    if (!Number.isFinite(n)) throw new Error('Invalid price');
    out.price = n;
    // Admin invariant: regular price == COD price
    out.codPrice = n;
  }
  if (src.onlinePrice !== undefined) {
    if (src.onlinePrice === null || src.onlinePrice === '') out.onlinePrice = undefined;
    else {
      const n = Number(src.onlinePrice);
      out.onlinePrice = Number.isFinite(n) ? n : undefined;
    }
  }
  // codPrice is derived from price; ignore external codPrice patches.
  if (src.originalPrice !== undefined) {
    if (src.originalPrice === null || src.originalPrice === '') {
      out.originalPrice = undefined;
    } else {
      const n = Number(src.originalPrice);
      out.originalPrice = Number.isFinite(n) ? n : undefined;
    }
  }
  if (src.images !== undefined) {
    if (!Array.isArray(src.images)) throw new Error('images must be an array');
    out.images = src.images.map((u) => String(u)).filter(Boolean);
  }
  if (src.category !== undefined) out.category = String(src.category);
  if (src.subcategory !== undefined) out.subcategory = src.subcategory != null ? String(src.subcategory) : '';
  if (src.sizes !== undefined) {
    out.sizes = Array.isArray(src.sizes) ? src.sizes.map((s) => String(s)) : [];
  }
  if (src.variants !== undefined) {
    out.variants = Array.isArray(src.variants) ? src.variants.map((s) => String(s)) : [];
  }
  if (src.variantOptions !== undefined) {
    if (!Array.isArray(src.variantOptions)) throw new Error('variantOptions must be an array');
    out.variantOptions = normalizeVariantOptionsFromBody(src.variantOptions) ?? [];
  }
  if (src.variantModel !== undefined) {
    if (src.variantModel && typeof src.variantModel === 'object') {
      const vm = src.variantModel;
      if (Array.isArray(vm.items)) {
        const normalizedItems = vm.items.map((it) => {
          const price = Number(it?.price);
          const images = Array.isArray(it?.images) ? it.images.map((u) => String(u).trim()).filter(Boolean) : undefined;
          const image = it?.image != null ? String(it.image).trim() : undefined;
          const previewImage = it?.previewImage != null ? String(it.previewImage).trim() : undefined;
          const displayName = it?.displayName != null ? String(it.displayName).trim() : undefined;
          const sizes = Array.isArray(it?.sizes) ? it.sizes.map((s) => String(s).trim()).filter(Boolean) : undefined;
          const stock = Math.max(0, Math.floor(Number(it?.stock) || 0));
          return {
            ...it,
            // Storefront compares keys as strings; coerce so admin/API JSON (number vs string) stays consistent.
            key: it?.key == null ? it?.key : String(it.key),
            stock,
            codPrice: Number.isFinite(price) ? price : undefined,
            images,
            image,
            previewImage: previewImage || undefined,
            displayName: displayName || undefined,
            sizes: sizes && sizes.length ? sizes : undefined,
          };
        });
        const stockSum = normalizedItems.reduce((acc, it) => acc + Math.max(0, Math.floor(Number(it?.stock) || 0)), 0);
        out.variantModel = {
          ...vm,
          items: normalizedItems,
        };
        // Keep persisted product stock aligned with variant sum.
        out.stock = stockSum;
      } else {
        out.variantModel = vm;
      }
    } else {
      out.variantModel = undefined;
    }
  }
  if (src.sleeveTypes !== undefined) {
    out.sleeveTypes = Array.isArray(src.sleeveTypes) ? src.sleeveTypes.map((s) => String(s)) : [];
  }
  if (src.stock !== undefined) {
    const n = Number(src.stock);
    out.stock = Number.isFinite(n) ? n : 0;
  }
  if (src.rating !== undefined) {
    const n = Number(src.rating);
    out.rating = Number.isFinite(n) ? n : 4;
  }
  if (src.reviews !== undefined) {
    out.reviews = Array.isArray(src.reviews) ? src.reviews : [];
  }
  if (src.isCustomPrint !== undefined) out.isCustomPrint = !!src.isCustomPrint;
  if (src.isTrending !== undefined) out.isTrending = !!src.isTrending;
  if (src.isBestDeal !== undefined) out.isBestDeal = !!src.isBestDeal;
  if (src.tags !== undefined) {
    out.tags = Array.isArray(src.tags) ? src.tags.map((t) => String(t)) : [];
  }
  if (src.specifications !== undefined) {
    out.specifications = normalizeSpecificationsFromBody(src.specifications);
  }
  if (src.shipWeightKg !== undefined) {
    const n = Number(src.shipWeightKg);
    out.shipWeightKg = Number.isFinite(n) && n > 0 ? clampNum(n, { min: 0.05, max: 25 }) : undefined;
  }
  if (src.shipLengthCm !== undefined) {
    const n = Number(src.shipLengthCm);
    out.shipLengthCm = Number.isFinite(n) && n > 0 ? clampNum(n, { min: 1, max: 200 }) : undefined;
  }
  if (src.shipWidthCm !== undefined) {
    const n = Number(src.shipWidthCm);
    out.shipWidthCm = Number.isFinite(n) && n > 0 ? clampNum(n, { min: 1, max: 200 }) : undefined;
  }
  if (src.shipHeightCm !== undefined) {
    const n = Number(src.shipHeightCm);
    out.shipHeightCm = Number.isFinite(n) && n > 0 ? clampNum(n, { min: 1, max: 200 }) : undefined;
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

app.put('/api/products/:id', mongoReady, async (req, res) => {
  try {
    const { id } = req.params;
    const src = { ...req.body };
    delete src.id;

    const existing = await Product.findById(id).lean();
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Prevent manual edits to derived stock when a variantModel exists.
    if (src.stock !== undefined && src.variantModel === undefined) {
      const hasVm = !!(existing.variantModel && typeof existing.variantModel === 'object' && Array.isArray(existing.variantModel.items));
      if (hasVm) {
        delete src.stock;
      }
    }

    const $set = buildProductUpdateSet(src);
    if (Object.keys($set).length > 0) {
      await Product.findByIdAndUpdate(id, { $set }, { new: false });
    }

    const doc = await Product.findById(id).lean();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(serializeProductDoc(doc));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to update product' });
  }
});

app.delete('/api/products/:id', mongoReady, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await Product.findByIdAndDelete(id);
    if (!r) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

function normalizeQty(n) {
  const q = Number(n);
  if (!Number.isFinite(q)) return 0;
  return Math.max(0, Math.floor(q));
}

/**
 * Atomically decrement inventory for each order line.
 * - Prevents negative stock (fails with 409 if insufficient).
 * - Supports variantModel by treating selectedVariant as a variantModel key.
 */
async function decrementInventoryForOrderLines(lines, paymentMethod) {
  const items = Array.isArray(lines) ? lines : [];
  if (!items.length) return;

  // Reduce duplicate product+variant lines into one decrement per key.
  const grouped = new Map(); // key -> { productId, variantKey, qty }
  for (const l of items) {
    const productId = String(l?.productId ?? '').trim();
    if (!productId) continue;
    const variantKey = l?.selectedVariant ? String(l.selectedVariant).trim() : '';
    const qty = normalizeQty(l?.quantity);
    if (!qty) continue;
    const k = `${productId}::${variantKey}`;
    const prev = grouped.get(k);
    grouped.set(k, prev ? { ...prev, qty: prev.qty + qty } : { productId, variantKey, qty });
  }

  const groups = Array.from(grouped.values());
  if (!groups.length) return;

  // Read current products to decide whether a variantKey belongs to variantModel.
  const ids = Array.from(new Set(groups.map((g) => g.productId)));
  const docs = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));

  // Perform conditional atomic updates; any failure aborts.
  for (const g of groups) {
    const p = byId.get(String(g.productId));
    if (!p) {
      const msg = `Product not found: ${g.productId}`;
      const err = new Error(msg);
      err.statusCode = 404;
      throw err;
    }

    const hasVm = !!(p.variantModel && typeof p.variantModel === 'object' && Array.isArray(p.variantModel.items));
    const wantsVm = hasVm && g.variantKey && p.variantModel.items.some((it) => String(it?.key) === String(g.variantKey));

    if (wantsVm) {
      const r = await Product.updateOne(
        {
          _id: g.productId,
          'variantModel.items': { $elemMatch: { key: g.variantKey, stock: { $gte: g.qty } } },
        },
        { $inc: { 'variantModel.items.$.stock': -g.qty } }
      );
      if (!r.matchedCount) {
        const err = new Error(`Out of stock: ${g.productId}`);
        err.statusCode = 409;
        throw err;
      }
    } else {
      // Simple product (or legacy variants without per-variant stock).
      const r = await Product.updateOne(
        { _id: g.productId, stock: { $gte: g.qty } },
        { $inc: { stock: -g.qty } }
      );
      if (!r.matchedCount) {
        const err = new Error(`Out of stock: ${g.productId}`);
        err.statusCode = 409;
        throw err;
      }
    }
  }
}

function availableStockForDoc(p, variantKey) {
  const base = Math.max(0, Number(p?.stock) || 0);
  const key = variantKey ? String(variantKey).trim() : '';
  const vm = p?.variantModel && typeof p.variantModel === 'object' ? p.variantModel : null;
  if (vm && Array.isArray(vm.items) && key) {
    const hit = vm.items.find((it) => String(it?.key) === key);
    if (hit) return Math.max(0, Number(hit?.stock) || 0);
  }
  return base;
}

function assertDeclaredMoneyMatches(label, bodyFieldNames, body, serverRupee) {
  for (const key of bodyFieldNames) {
    const raw = body?.[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const declaredPaise = Math.round(Number(raw) * 100);
    const serverPaise = Math.round(Number(serverRupee) * 100);
    if (!Number.isFinite(declaredPaise) || !Number.isFinite(serverPaise)) continue;
    if (declaredPaise !== serverPaise) {
      const err = new Error(
        `${label} mismatch. Please refresh checkout (server ₹${(serverPaise / 100).toFixed(2)}).`
      );
      err.statusCode = 400;
      err.serverTotal = serverPaise / 100;
      throw err;
    }
    return;
  }
}

/**
 * Blocks COD / prepaid checkout unless Shiprocket returned a serviceable quote with ETA,
 * unless ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE=true (dev / emergency).
 */
function assertShippingQuoteReadyForCheckout(ship) {
  if (ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE) return;
  if (!ship || ship.ok !== true) {
    const reason = ship?.reason;
    const msg =
      reason === 'not_serviceable'
        ? 'Delivery is not available for this pincode. Please check your postal code or contact support.'
        : reason === 'bad_pincode'
          ? 'Enter a valid 6-digit delivery pincode before placing your order.'
          : 'Shipping could not be calculated. Please try again in a moment.';
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
  const daysOk = ship.estimatedDeliveryDays != null && Number.isFinite(Number(ship.estimatedDeliveryDays));
  const dateOk =
    ship.estimatedDeliveryDate &&
    String(ship.estimatedDeliveryDate).trim() &&
    !Number.isNaN(new Date(ship.estimatedDeliveryDate).getTime());
  if (!daysOk && !dateOk) {
    const err = new Error('Shipping estimate is incomplete. Please refresh checkout and try again.');
    err.statusCode = 400;
    throw err;
  }
}

function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/** Block Shiprocket shipment until payment/shipping adjustments are resolved (strict fulfillment rule). */
function shipmentBlockedByPaymentOrQuote(orderLean) {
  const sh = orderLean?.shipping || {};
  if (sh.pricingPendingReview === true) {
    return { blocked: true, reason: 'pricing_pending_review' };
  }
  const bal = roundMoney2(Number(sh.balanceDueShipping) || 0);
  if (bal > 0.005) {
    return { blocked: true, reason: 'balance_due_shipping' };
  }
  const method = String(orderLean?.paymentMethod || '');
  const ps = String(orderLean?.paymentStatus || '');
  const due = roundMoney2(Number(orderLean?.amountDue) || 0);
  if (method === 'razorpay' && ps === 'paid' && due > 0.005) {
    return { blocked: true, reason: 'prepaid_payment_adjustment_unresolved' };
  }
  if (sh.estimated === true && sh.finalized !== true) {
    return { blocked: true, reason: 'shipping_quote_not_finalized' };
  }
  return { blocked: false, reason: null };
}

function computeAdminFlagsFromOrderLean(o) {
  if (!o) return { needsShippingReview: false, paymentPending: false };
  const sh = o.shipping || {};
  const balanceDueShip = roundMoney2(Number(sh.balanceDueShipping) || 0);
  const amountDue = roundMoney2(Number(o.amountDue) || 0);
  const pricingReview = !!sh.pricingPendingReview;
  const manual = !!sh.manualRequired;
  const attempts = Math.max(0, Math.floor(Number(sh.shipmentAttemptCount) || 0));
  const exhausted =
    attempts >= SHIPROCKET_SHIPMENT_MAX_ATTEMPTS && !sh.shipmentCreatedAt && !sh.shipmentId;
  const quotePending = sh.estimated === true && sh.finalized !== true;
  const quoteFailed = !!(sh.quoteRecalcError && quotePending);

  const needsShippingReview = manual || pricingReview || exhausted || quoteFailed || quotePending;

  /** True when money is still owed (COD, prepaid shipping adjustment, etc.). */
  const paymentPending = balanceDueShip > 0.005 || amountDue > 0.005;

  return { needsShippingReview, paymentPending };
}

async function syncOrderAdminFlags(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return;
  const o = await Order.findById(id).lean();
  if (!o) return;
  const f = computeAdminFlagsFromOrderLean(o);
  await Order.updateOne({ _id: id }, { $set: { needsShippingReview: f.needsShippingReview, paymentPending: f.paymentPending } });
}

const MIGRATION_FIX_PREPAID_AMOUNT_DUE_ID = 'fix_prepaid_amount_due_v1';
const MIGRATION_PRODUCT_DISPLAY_ORDER_ID = 'product_display_order_v1';

/**
 * Legacy bug: some Razorpay-paid orders stored amountDue === total (same as amountPaid).
 * Clear amountDue when the customer already paid at least the current order total; shipping
 * finalize will reintroduce a positive amountDue if the real total exceeds amountPaid.
 */
async function runOneTimeOrderMigrations() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const already = await AppMigration.findById(MIGRATION_FIX_PREPAID_AMOUNT_DUE_ID).lean();
    if (already) return;

    const filter = {
      $expr: {
        $and: [
          { $gte: [{ $ifNull: ['$amountPaid', 0] }, '$total'] },
          { $gt: ['$amountDue', 0.005] },
        ],
      },
    };

    const rows = await Order.find(filter).select('_id').lean();
    if (rows.length) {
      await Order.updateMany(filter, { $set: { amountDue: 0 } });
      logJson('info', 'migration.fix_prepaid_amount_due', { updated: rows.length });
      for (const row of rows) {
        await syncOrderAdminFlags(String(row._id));
      }
    }

    await AppMigration.create({ _id: MIGRATION_FIX_PREPAID_AMOUNT_DUE_ID, ranAt: new Date() });
    console.log(`Migration ${MIGRATION_FIX_PREPAID_AMOUNT_DUE_ID}: done (${rows.length} order(s) adjusted)`);
  } catch (e) {
    if (e && e.code === 11000) return;
    console.error('Order migration failed:', e);
  }
}

async function runOneTimeProductMigrations() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const already = await AppMigration.findById(MIGRATION_PRODUCT_DISPLAY_ORDER_ID).lean();
    if (already) return;

    const cats = await Product.distinct('category');
    const categories = (Array.isArray(cats) ? cats : []).map((c) => String(c || '').trim()).filter(Boolean);

    let updated = 0;
    let repaired = 0;

    for (const cat of categories) {
      const docs = await Product.find({ category: cat }).select('_id category displayOrder').lean();
      if (!docs.length) continue;

      const norm = docs.map((d) => {
        const v = d?.displayOrder;
        const n = v != null ? Number(v) : NaN;
        const ok = Number.isFinite(n);
        return { id: String(d._id), n: ok ? n : null };
      });

      const hasMissing = norm.some((x) => x.n == null);
      const seen = new Set();
      let hasDup = false;
      for (const x of norm) {
        if (x.n == null) continue;
        const k = String(x.n);
        if (seen.has(k)) {
          hasDup = true;
          break;
        }
        seen.add(k);
      }

      // Backfill only missing values, preserving existing order where possible.
      if (hasMissing && !hasDup) {
        const max = norm.reduce((m, x) => (x.n != null && x.n > m ? x.n : m), 0);
        let next = Number.isFinite(max) ? max + 10 : 10;
        const ops = [];
        for (const x of norm) {
          if (x.n != null) continue;
          ops.push({
            updateOne: {
              filter: { _id: x.id, $or: [{ displayOrder: { $exists: false } }, { displayOrder: null }] },
              update: { $set: { displayOrder: next } },
            },
          });
          next += 10;
        }
        if (ops.length) {
          const r = await Product.bulkWrite(ops, { ordered: false });
          updated += Number(r?.modifiedCount || 0);
        }
        continue;
      }

      // Repair: resequence the whole category deterministically.
      repaired += 1;
      const stable = docs
        .map((d) => {
          const n = d?.displayOrder != null ? Number(d.displayOrder) : NaN;
          return { id: String(d._id), n: Number.isFinite(n) ? n : null };
        })
        .sort((a, b) => {
          if (a.n != null && b.n != null && a.n !== b.n) return a.n - b.n;
          if (a.n != null && b.n == null) return -1;
          if (a.n == null && b.n != null) return 1;
          return a.id.localeCompare(b.id);
        });

      const ops = stable.map((x, idx) => ({
        updateOne: {
          filter: { _id: x.id },
          update: { $set: { displayOrder: (idx + 1) * 10 } },
        },
      }));
      if (ops.length) {
        const r = await Product.bulkWrite(ops, { ordered: false });
        updated += Number(r?.modifiedCount || 0);
      }
    }

    await AppMigration.create({ _id: MIGRATION_PRODUCT_DISPLAY_ORDER_ID, ranAt: new Date() });
    logJson('info', 'migration.product_display_order', { categories: categories.length, updated, repairedCategories: repaired });
    console.log(`Migration ${MIGRATION_PRODUCT_DISPLAY_ORDER_ID}: done (updated=${updated}, repaired=${repaired})`);
  } catch (e) {
    if (e && e.code === 11000) return;
    console.error('Product migration failed:', e);
  }
}

function logIntegrationNotifyPending(fields) {
  logJson('info', 'integration.order.notify_pending', {
    hook: 'sms_email_future',
    channel: 'order_ops',
    ...fields,
  });
}

function cloneShipForStorage(ship) {
  if (!ship || typeof ship !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(ship));
  } catch {
    return {};
  }
}

/**
 * Initial `order.shipping` from checkout: either finalized quote or relaxed placeholder (estimated, not finalized).
 */
function buildOrderShippingFromCheckout({ shippingPlaceholder, ship }) {
  const base = { provider: 'shiprocket' };
  if (shippingPlaceholder) {
    return {
      ...base,
      estimated: true,
      finalized: false,
      serviceability: {
        ok: false,
        relaxedCheckout: true,
        reason: ship?.reason || 'no_quote',
        error: ship?.error || undefined,
      },
    };
  }
  const s = ship && typeof ship === 'object' ? ship : {};
  const edd =
    s.estimatedDeliveryDate && !Number.isNaN(new Date(s.estimatedDeliveryDate).getTime())
      ? new Date(s.estimatedDeliveryDate)
      : undefined;
  const cheapest = Array.isArray(s.courierSuggestions) && s.courierSuggestions[0];
  return {
    ...base,
    estimated: false,
    finalized: true,
    serviceability: {
      ok: true,
      atCheckout: true,
      freeShippingApplied: !!s.freeShippingApplied,
      quoteId: s.quoteId,
      courierSuggestions: (s.courierSuggestions || []).slice(0, 5),
    },
    estimatedDeliveryDate: edd || undefined,
    courierName: cheapest?.courierName || undefined,
  };
}

/**
 * Background: replace provisional ₹0 shipping (relaxed mode) with Shiprocket quote; update totals and flags.
 */
async function finalizePendingOrderShipping(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return;
  try {
    const order = await Order.findById(id).lean();
    if (!order) return;
    const sh = order.shipping || {};
    if (sh.finalized === true) return;
    if (sh.estimated !== true) return;

    const pincode = order.customer?.pincode;
    const cod = order.paymentMethod === 'cod';
    const goodsAfterDiscount = roundMoney2(
      order.goodsTotal != null ? Number(order.goodsTotal) : Math.max(0, Number(order.subtotal || 0) - Number(order.discount || 0))
    );

    const ship = await resolveShippingChargeForPricing({
      pincode,
      cod,
      pricedLines: order.items || [],
      goodsAfterDiscount,
    });

    if (!ship.ok) {
      await Order.updateOne(
        { _id: id },
        {
          $set: {
            'shipping.quoteRecalcAt': new Date(),
            'shipping.quoteRecalcError': String(ship.error || ship.reason || 'unavailable'),
          },
        }
      );
      logJson('warn', 'order.shipping_recalc_failed', { orderId: id, reason: ship.reason });
      await syncOrderAdminFlags(id);
      return;
    }

    const actualCharge = roundMoney2(ship.actualShippingCharge ?? ship.shippingCharge);
    const oldActual = roundMoney2(order.actualShippingCharge || 0);

    const edd =
      ship.estimatedDeliveryDate && !Number.isNaN(new Date(ship.estimatedDeliveryDate).getTime())
        ? new Date(ship.estimatedDeliveryDate)
        : undefined;
    const cheapest = Array.isArray(ship.courierSuggestions) && ship.courierSuggestions[0];

    const $set = {
      // User-facing free delivery stays free; store real cost internally.
      shippingCharge: 0,
      actualShippingCharge: actualCharge,
      freeShippingApplied: true,
      total: roundMoney2(goodsAfterDiscount),
      'shipping.estimated': false,
      'shipping.finalized': true,
      'shipping.quoteRecalcAt': new Date(),
      'shipping.quoteRecalcError': null,
      'shipping.serviceability': {
        ok: true,
        recalculatedAt: new Date().toISOString(),
        freeShippingApplied: true,
        quoteId: ship.quoteId,
        courierSuggestions: (ship.courierSuggestions || []).slice(0, 5),
      },
      'shipping.estimatedDeliveryDate': edd || undefined,
      'shipping.courierName': cheapest?.courierName || undefined,
      // Free delivery model: no customer-facing pricing adjustments required.
      'shipping.pricingPendingReview': false,
    };

    if (String(order.paymentMethod || '') === 'cod' && String(order.paymentStatus || '') !== 'paid') {
      $set.amountDue = roundMoney2(goodsAfterDiscount);
    }

    if (String(order.paymentMethod || '') === 'razorpay' && String(order.paymentStatus || '') === 'paid') {
      $set.amountDue = 0;
    }

    const update = { $set };
    update.$unset = { 'shipping.balanceDueShipping': '' };
    await Order.updateOne({ _id: id }, update);

    await Order.updateOne(
      { _id: id },
      {
        $push: {
          'shipping.timeline': {
            at: new Date().toISOString(),
            kind: 'shipping_quote_finalized',
            source: 'system',
            status: 'Shipping quote finalized (free delivery)',
          },
        },
      }
    );

    logJson('info', 'order.shipping_finalized', {
      orderId: id,
      actualShippingCharge: actualCharge,
      oldActualShippingCharge: oldActual,
    });

    await syncOrderAdminFlags(id);
  } catch (e) {
    logJson('error', 'order.shipping_recalc_error', {
      orderId: id,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Single source of truth for checkout: line prices from DB, coupon from server rules,
 * shipping from Shiprocket rules, total = goodsAfterDiscount + shippingCharge.
 */
async function computeServerCheckoutPricing({ req, body, rawItems, paymentMethod, pincode, incrementCouponUsage }) {
  const ids = Array.from(new Set(rawItems.map((x) => String(x.productId)).filter(Boolean)));
  const docs = ids.length ? await Product.find({ _id: { $in: ids } }).lean() : [];
  const byId = new Map(docs.map((d) => [String(d._id), d]));

  const pricedItems = rawItems.map((line) => {
    const p = byId.get(String(line.productId));
    if (!p) {
      const err = new Error(`Product not found: ${String(line.productId)}`);
      err.statusCode = 404;
      throw err;
    }
    let unit = Number(p.price) || 0;
    let sku = String(p?.sku || '').trim();
    const selectedVariantKey = line.selectedVariant ? String(line.selectedVariant) : '';
    const vm = p.variantModel && typeof p.variantModel === 'object' ? p.variantModel : null;
    if (vm && Array.isArray(vm.items) && selectedVariantKey) {
      const hit = vm.items.find((it) => String(it?.key) === selectedVariantKey);
      if (hit) {
        const hitSku = String(hit?.sku || '').trim();
        if (hitSku) sku = hitSku;
        if (paymentMethod === 'razorpay' && hit.onlinePrice != null) unit = Number(hit.onlinePrice);
        else if (paymentMethod === 'cod' && hit.codPrice != null) unit = Number(hit.codPrice);
        else unit = Number(hit.price);
      }
    } else {
      if (paymentMethod === 'razorpay' && p.onlinePrice != null) unit = Number(p.onlinePrice);
      else if (paymentMethod === 'cod' && p.codPrice != null) unit = Number(p.codPrice);
      else unit = Number(p.price);
    }
    if (!Number.isFinite(unit) || unit < 0) unit = 0;
    return { ...line, sku, price: unit };
  });

  const subtotal = pricedItems.reduce((acc, l) => acc + (Number(l.price) || 0) * (Number(l.quantity) || 0), 0);

  let discount = 0;
  let couponCode = body.couponCode ? normalizeCouponCode(body.couponCode) : undefined;
  /** Set when a coupon applies; usage is incremented only after shipping quote succeeds. */
  let couponIdForUsage = null;

  if (couponCode) {
    const itemsForValidate = rawItems.map((l) => ({ productId: l.productId, quantity: l.quantity, selectedVariant: l.selectedVariant }));
    const sessionUserId = req.session?.userId ? String(req.session.userId) : undefined;
    const validation = await validateCouponForCart({
      code: couponCode,
      subtotal,
      items: itemsForValidate,
      userId: sessionUserId,
    });
    if (!validation.ok) {
      const err = new Error(validation.error || 'Invalid coupon');
      err.statusCode = 400;
      throw err;
    }
    const couponDoc = await Coupon.findById(validation.couponId).lean();
    if (!couponDoc) {
      const err = new Error('Invalid coupon');
      err.statusCode = 400;
      throw err;
    }
    const couponId = String(couponDoc._id);
    const userId = req.session?.userId ? String(req.session.userId) : undefined;
    if (!userId) {
      const err = new Error('Login is required to use coupons');
      err.statusCode = 400;
      throw err;
    }
    if (couponDoc.usageTotalLimit != null && Number.isFinite(Number(couponDoc.usageTotalLimit))) {
      const usedTotal = await CouponUsage.countDocuments({ couponId });
      if (usedTotal >= Number(couponDoc.usageTotalLimit)) {
        const err = new Error('Coupon usage limit reached');
        err.statusCode = 400;
        throw err;
      }
    }
    if (couponDoc.usagePerUserLimit != null && Number.isFinite(Number(couponDoc.usagePerUserLimit))) {
      const u = await CouponUsage.findOne({ couponId, userId }).lean();
      const usedByUser = u?.count ? Number(u.count) : 0;
      if (usedByUser >= Number(couponDoc.usagePerUserLimit)) {
        const err = new Error('You already used this coupon');
        err.statusCode = 400;
        throw err;
      }
    }
    discount = validation.discount;
    couponCode = validation.couponCode;
    couponIdForUsage = couponId;
  } else {
    discount = 0;
    couponCode = undefined;
  }

  const goodsAfterDiscount = Math.max(0, subtotal - discount);
  const cod = paymentMethod === 'cod';
  const ship = await resolveShippingChargeForPricing({
    pincode,
    cod,
    pricedLines: pricedItems,
    goodsAfterDiscount,
  });

  let shippingPlaceholder = false;
  if (!ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE) {
    assertShippingQuoteReadyForCheckout(ship);
    // Strict checkout: never charge shipping without a quote we trust end-to-end.
  } else if (!ship?.ok) {
    // Relaxed: only drop shipping when we truly have no serviceability quote (not merely a stale ETA field).
    shippingPlaceholder = true;
  }

  if (incrementCouponUsage && couponIdForUsage && req.session?.userId) {
    const uid = String(req.session.userId);
    await CouponUsage.findOneAndUpdate(
      { couponId: couponIdForUsage, userId: uid },
      { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
      { upsert: true, new: false }
    );
  }

  const actualShippingCharge = shippingPlaceholder ? 0 : roundMoney2(ship.actualShippingCharge ?? ship.shippingCharge);
  // User-facing free delivery: never charge shipping.
  const shippingCharge = 0;
  const freeShippingApplied = ship?.ok === true;
  const total = roundMoney2(goodsAfterDiscount);

  return {
    pricedItems,
    subtotal,
    discount,
    couponCode,
    goodsAfterDiscount,
    shippingCharge,
    actualShippingCharge,
    freeShippingApplied,
    total,
    shippingPlaceholder,
    ship,
  };
}

app.post('/api/orders', orderCreateRateLimit, requireTrustedBrowserOrigin, mongoReady, async (req, res) => {
  try {
    const body = req.body || {};
    const c = body.customer || {};
    const name = String(c.name || '').trim();
    const email = String(c.email || '').trim();
    const address = String(c.address || '').trim();
    const city = String(c.city || '').trim();
    const state = c.state != null ? String(c.state).trim() : '';
    const pincode = String(c.pincode || '').trim();
    if (!name || !email || !address || !city || !pincode) {
      res.status(400).json({ error: 'All customer fields including email are required.' });
      return;
    }
    if (!simpleEmailValid(email)) {
      res.status(400).json({ error: 'Invalid email address.' });
      return;
    }
    let phone;
    try {
      phone = normalizeIndianMobileOrThrow(c.phone);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid phone number' });
      return;
    }

    // Ensure authenticated user relation when email exists (needed for coupons + per-user limits).
    let sessionTouched = false;
    if (!req.session?.userId) {
      const u = await User.findOne({ email }).exec();
      if (u) {
        req.session.userId = u._id;
        sessionTouched = true;
      }
    }
    if (sessionTouched) {
      await saveSession(req);
    }

    let items;
    try {
      items = normalizeOrderItemsFromBody(body.items);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Invalid items' });
      return;
    }
    const paymentMethod = String(body.paymentMethod || '').toLowerCase() === 'razorpay' ? 'razorpay' : 'cod';
    if (paymentMethod === 'razorpay') {
      res.status(400).json({ error: 'Online payments use a payment session. Start checkout again.' });
      return;
    }

    const pricing = await computeServerCheckoutPricing({
      req,
      body,
      rawItems: items,
      paymentMethod: 'cod',
      pincode,
      incrementCouponUsage: true,
    });
    assertDeclaredMoneyMatches('Subtotal', ['declaredSubtotal', 'subtotal'], body, pricing.subtotal);
    assertDeclaredMoneyMatches('Payable total', ['declaredTotal', 'total'], body, pricing.total);

    const pricedItems = pricing.pricedItems;
    const { subtotal, discount, couponCode, goodsAfterDiscount, shippingCharge, actualShippingCharge, freeShippingApplied, total, shippingPlaceholder, ship } =
      pricing;

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Deduct inventory immediately for COD orders.
    await decrementInventoryForOrderLines(pricedItems, paymentMethod);

    if (shippingPlaceholder) {
      logJson('warn', 'checkout.order_relaxed_shipping', {
        channel: 'cod',
        orderId,
        pincode: normalizePincode(pincode),
      });
    }

    await Order.create({
      _id: orderId,
      customer: { name, email, phone, address, city, state: state || undefined, pincode },
      userId: req.session?.userId,
      items: pricedItems,
      subtotal,
      discount,
      couponCode,
      goodsTotal: goodsAfterDiscount,
      shippingCharge,
      actualShippingCharge,
      freeShippingApplied,
      total,
      shipping: buildOrderShippingFromCheckout({ shippingPlaceholder, ship }),
      paymentMethod,
      paymentStatus: 'unpaid',
      amountDue: total,
      amountPaid: 0,
      hasCustomPrint: !!body.hasCustomPrint,
      status: 'pending',
      stockDeductedAt: new Date(),
    });
    await syncOrderAdminFlags(orderId);
    const fresh = await Order.findById(orderId).lean();
    res.status(201).json(serializeOrderForClient(fresh));

    setImmediate(() => {
      void (async () => {
        try {
          await finalizePendingOrderShipping(orderId);
          const leanForMail = (await Order.findById(orderId).lean()) || {};
          await (async () => {
            await sendOrderEmails({ ...leanForMail, _id: orderId });
            await Order.updateOne({ _id: orderId }, { $set: { emailSentAt: new Date(), emailError: null } });
          })();
        } catch (mailErr) {
          const emailErr = mailErr instanceof Error ? mailErr.message : String(mailErr);
          console.error('Order email failed:', mailErr);
          await Order.updateOne({ _id: orderId }, { $set: { emailError: emailErr } });
        }
      })();
    });
  } catch (e) {
    console.error(e);
    const status = Number(e?.statusCode) || 500;
    if (status === 400) {
      res.status(400).json({
        error: e instanceof Error ? e.message : 'Bad request',
        serverTotal: e?.serverTotal,
      });
      return;
    }
    if (status === 409) {
      res.status(409).json({ error: e instanceof Error ? e.message : 'Out of stock' });
      return;
    }
    if (status === 404) {
      res.status(404).json({ error: e instanceof Error ? e.message : 'Product not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to create order' });
  }
});

function requireRazorpayConfigured(res) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    res.status(503).json({ error: 'Razorpay is not configured on the server (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET).' });
    return false;
  }
  return true;
}

function verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac('sha256', String(RAZORPAY_KEY_SECRET)).update(body).digest('hex');
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(razorpaySignature || ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isExpired(expiresAt) {
  if (!(expiresAt instanceof Date)) return true;
  return expiresAt.getTime() <= Date.now();
}

async function markExpiredPaymentSessionsOnce() {
  const now = new Date();
  await PaymentSession.updateMany(
    { status: 'pending', expiresAt: { $lte: now } },
    { $set: { status: 'expired', error: 'Timed out' } }
  );
}

// Best-effort background expiry; also enforced on read/verify.
setInterval(() => {
  void markExpiredPaymentSessionsOnce().catch(() => {});
}, 60_000).unref?.();

/** Create a pending Razorpay payment session (no Order is created here). */
app.post('/api/payments/razorpay/session', paymentCreateRateLimit, requireTrustedBrowserOrigin, mongoReady, async (req, res) => {
  try {
    if (!requireRazorpayConfigured(res)) return;
    const body = req.body || {};
    const c = body.customer || {};
    const name = String(c.name || '').trim();
    const email = String(c.email || '').trim();
    const address = String(c.address || '').trim();
    const city = String(c.city || '').trim();
    const state = c.state != null ? String(c.state).trim() : '';
    const pincode = String(c.pincode || '').trim();
    if (!name || !email || !address || !city || !pincode) {
      res.status(400).json({ error: 'All customer fields including email are required.' });
      return;
    }
    if (!simpleEmailValid(email)) {
      res.status(400).json({ error: 'Invalid email address.' });
      return;
    }
    let phone;
    try {
      phone = normalizeIndianMobileOrThrow(c.phone);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid phone number' });
      return;
    }

    // Attach session userId when email exists (same behavior as /api/orders).
    let sessionTouched = false;
    if (!req.session?.userId) {
      const u = await User.findOne({ email }).exec();
      if (u) {
        req.session.userId = u._id;
        sessionTouched = true;
      }
    }
    if (sessionTouched) await saveSession(req);

    let items;
    try {
      items = normalizeOrderItemsFromBody(body.items);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Invalid items' });
      return;
    }

    // Price enforcement (same as /api/orders).
    const ids = Array.from(new Set(items.map((x) => String(x.productId)).filter(Boolean)));
    const docs = ids.length ? await Product.find({ _id: { $in: ids } }).lean() : [];
    const byId = new Map(docs.map((d) => [String(d._id), d]));

    // Stock validation: block starting payment if any item is unavailable.
    for (const line of items) {
      const p = byId.get(String(line.productId));
      if (!p) {
        res.status(404).json({ error: `Product not found: ${String(line.productId)}` });
        return;
      }
      const want = Math.max(1, Math.floor(Number(line.quantity) || 1));
      const have = availableStockForDoc(p, line.selectedVariant);
      if (have <= 0) {
        res.status(409).json({ error: `Out of stock: ${String(line.productId)}` });
        return;
      }
      if (want > have) {
        res.status(409).json({ error: `Only ${have} left for ${String(line.productId)}` });
        return;
      }
    }
    const pricing = await computeServerCheckoutPricing({
      req,
      body,
      rawItems: items,
      paymentMethod: 'razorpay',
      pincode,
      incrementCouponUsage: true,
    });
    try {
      assertDeclaredMoneyMatches('Subtotal', ['declaredSubtotal', 'subtotal'], body, pricing.subtotal);
      assertDeclaredMoneyMatches('Payable total', ['declaredTotal', 'total'], body, pricing.total);
    } catch (e) {
      const status = Number(e?.statusCode) || 400;
      res.status(status).json({
        error: e instanceof Error ? e.message : 'Bad request',
        serverTotal: e?.serverTotal,
      });
      return;
    }

    const {
      pricedItems,
      subtotal,
      discount,
      couponCode,
      goodsAfterDiscount,
      shippingCharge,
      actualShippingCharge,
      freeShippingApplied,
      total,
      shippingPlaceholder,
      ship,
    } = pricing;

    const sessionId = `PS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const razorpay = new Razorpay({ key_id: String(RAZORPAY_KEY_ID), key_secret: String(RAZORPAY_KEY_SECRET) });
    const rpOrder = await razorpay.orders.create({
      amount: Math.round(Number(total) * 100),
      currency: 'INR',
      receipt: String(sessionId),
      notes: { sessionId: String(sessionId) },
    });

    await PaymentSession.create({
      _id: sessionId,
      status: 'pending',
      expiresAt,
      userId: req.session?.userId,
      customer: { name, email, phone, address, city, state: state || undefined, pincode },
      items: pricedItems,
      subtotal,
      discount,
      couponCode,
      goodsTotal: goodsAfterDiscount,
      shippingCharge,
      actualShippingCharge,
      freeShippingApplied,
      total,
      hasCustomPrint: !!body.hasCustomPrint,
      razorpayOrderId: String(rpOrder.id),
      shippingPlaceholder: !!shippingPlaceholder,
      shippingQuoteSnapshot: shippingPlaceholder ? undefined : cloneShipForStorage(ship),
    });

    res.status(201).json({
      session: serializePaymentSessionForClient(await PaymentSession.findById(sessionId).lean()),
      keyId: String(RAZORPAY_KEY_ID),
      razorpayOrderId: String(rpOrder.id),
      amount: Number(rpOrder.amount),
      currency: String(rpOrder.currency || 'INR'),
    });
  } catch (e) {
    const status = Number(e?.statusCode) || 500;
    if (status === 400) {
      res.status(400).json({
        error: e instanceof Error ? e.message : 'Bad request',
        serverTotal: e?.serverTotal,
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to start payment session' });
  }
});

app.post('/api/payments/razorpay/cancel', orderCancelRateLimit, requireTrustedBrowserOrigin, mongoReady, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }
    const s = await PaymentSession.findById(sessionId).lean();
    if (!s) {
      res.status(404).json({ error: 'Payment session not found' });
      return;
    }
    if (String(s.status) === 'paid') {
      res.json({ ok: true, session: serializePaymentSessionForClient(s) });
      return;
    }
    if (isExpired(s.expiresAt)) {
      await PaymentSession.updateOne({ _id: sessionId }, { $set: { status: 'expired', error: 'Timed out' } });
      const fresh = await PaymentSession.findById(sessionId).lean();
      res.json({ ok: true, session: serializePaymentSessionForClient(fresh) });
      return;
    }
    await PaymentSession.updateOne({ _id: sessionId }, { $set: { status: 'cancelled', error: null } });
    const fresh = await PaymentSession.findById(sessionId).lean();
    res.json({ ok: true, session: serializePaymentSessionForClient(fresh) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to cancel payment session' });
  }
});

app.post('/api/payments/razorpay/order', mongoReady, async (req, res) => {
  try {
    res.status(410).json({ error: 'Deprecated endpoint. Use /api/payments/razorpay/session.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
});

app.post('/api/payments/razorpay/verify', paymentVerifyRateLimit, requireTrustedBrowserOrigin, mongoReady, async (req, res) => {
  try {
    if (!requireRazorpayConfigured(res)) return;
    const sessionId = String(req.body?.sessionId || '').trim();
    const razorpayOrderId = String(req.body?.razorpayOrderId || '').trim();
    const razorpayPaymentId = String(req.body?.razorpayPaymentId || '').trim();
    const razorpaySignature = String(req.body?.razorpaySignature || '').trim();
    if (!sessionId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({ error: 'Missing payment verification fields' });
      return;
    }
    const session = await PaymentSession.findById(sessionId).lean();
    if (!session) {
      res.status(404).json({ error: 'Payment session not found' });
      return;
    }
    if (String(session.status) === 'paid' && session.orderId) {
      const existingOrder = await Order.findById(String(session.orderId)).lean();
      res.json({ ok: true, order: serializeOrder(existingOrder) });
      return;
    }
    if (isExpired(session.expiresAt)) {
      await PaymentSession.updateOne({ _id: sessionId }, { $set: { status: 'expired', error: 'Timed out' } });
      res.status(410).json({ error: 'Payment session expired. Please try again.' });
      return;
    }
    if (String(session.razorpayOrderId || '') !== razorpayOrderId) {
      res.status(400).json({ error: 'Razorpay order id mismatch' });
      return;
    }

    const ok = verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    if (!ok) {
      await PaymentSession.updateOne(
        { _id: sessionId },
        { $set: { status: 'failed', error: 'Invalid Razorpay signature' } }
      );
      res.status(400).json({ error: 'Payment verification failed' });
      return;
    }

    // Server-side payment validation (do not trust frontend callback):
    // confirm payment is captured and amounts match.
    const razorpay = new Razorpay({ key_id: String(RAZORPAY_KEY_ID), key_secret: String(RAZORPAY_KEY_SECRET) });
    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    const payStatus = String(payment?.status || '').toLowerCase(); // 'captured' when successful
    const payAmount = Number(payment?.amount || 0); // paise
    const expectedAmount = Math.round(Number(session.total || 0) * 100);
    if (payStatus !== 'captured') {
      await PaymentSession.updateOne(
        { _id: sessionId },
        { $set: { status: 'failed', error: `Payment not captured (${payStatus || 'unknown'})` } }
      );
      res.status(400).json({ error: 'Payment is not captured. Order will not be confirmed.' });
      return;
    }
    if (!Number.isFinite(payAmount) || payAmount !== expectedAmount) {
      await PaymentSession.updateOne(
        { _id: sessionId },
        { $set: { status: 'failed', error: 'Amount mismatch' } }
      );
      res.status(400).json({ error: 'Payment amount mismatch. Order will not be confirmed.' });
      return;
    }

    // Deduct inventory only after payment is captured.
    try {
      await decrementInventoryForOrderLines(session.items, 'razorpay');
    } catch (invErr) {
      const status = Number(invErr?.statusCode) || 500;
      if (status === 409) {
        await PaymentSession.updateOne(
          { _id: sessionId },
          { $set: { status: 'failed', error: 'Out of stock' } }
        );
        res.status(409).json({ error: 'Out of stock. Payment cannot be confirmed for this cart.' });
        return;
      }
      throw invErr;
    }

    // Create the actual Order now (confirmed/paid).
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const orderTotal = roundMoney2(Number(session.total ?? 0));
    /** Use captured gateway amount (rupees); must match orderTotal after checks above. */
    const amountPaid = roundMoney2(payAmount / 100);
    /** Prepaid full capture: never mirror total into amountDue (that falsely triggers admin / shipment gates). */
    const amountDue = 0;
    const ph = !!session.shippingPlaceholder;
    if (ph) {
      logJson('warn', 'checkout.order_relaxed_shipping', {
        channel: 'razorpay',
        orderId,
        pincode: normalizePincode(session.customer?.pincode),
      });
    }
    const shippingDoc = ph
      ? buildOrderShippingFromCheckout({ shippingPlaceholder: true, ship: { reason: 'relaxed_checkout' } })
      : buildOrderShippingFromCheckout({
          shippingPlaceholder: false,
          ship: session.shippingQuoteSnapshot || {},
        });
    await Order.create({
      _id: orderId,
      customer: session.customer || {},
      userId: session.userId,
      items: session.items || [],
      subtotal: Number(session.subtotal ?? 0),
      discount: Number(session.discount ?? 0),
      couponCode: session.couponCode,
      goodsTotal: session.goodsTotal != null ? Number(session.goodsTotal) : Math.max(0, Number(session.subtotal ?? 0) - Number(session.discount ?? 0)),
      shippingCharge: Number(session.shippingCharge ?? 0),
      freeShippingApplied: !!session.freeShippingApplied,
      total: orderTotal,
      shipping: shippingDoc,
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      amountDue,
      amountPaid,
      paidAt: new Date(),
      paymentFailureReason: null,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      hasCustomPrint: !!session.hasCustomPrint,
      status: 'pending',
      stockDeductedAt: new Date(),
    });
    await syncOrderAdminFlags(orderId);

    await PaymentSession.updateOne(
      { _id: sessionId },
      {
        $set: {
          status: 'paid',
          razorpayPaymentId,
          razorpaySignature,
          paidAt: new Date(),
          orderId,
          error: null,
        },
      }
    );

    const fresh = await Order.findById(orderId).lean();
    res.json({ ok: true, order: serializeOrder(fresh) });

    setImmediate(() => {
      void (async () => {
        try {
          await finalizePendingOrderShipping(orderId);
          const leanForMail = (await Order.findById(orderId).lean()) || {};
          await (async () => {
            await sendOrderEmails({ ...leanForMail, _id: orderId });
            await Order.updateOne({ _id: orderId }, { $set: { emailSentAt: new Date(), emailError: null } });
          })();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await Order.updateOne({ _id: orderId }, { $set: { emailError: msg } });
        }
      })();
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

app.get('/api/orders', mongoReady, adminKeyRequired, (req, res) => {
  res.set('Cache-Control', 'no-store');
  Order.find()
    .sort({ createdAt: -1 })
    .lean()
    .then((docs) => {
      res.json((docs || []).map((d) => serializeOrder(d)));
    })
    .catch((e) => {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to list orders' });
    });
});

app.get('/api/admin/orders', mongoReady, adminKeyRequired, async (_req, res) => {
  try {
    logJson('info', 'admin.orders_handler_enter', { headersSent: res.headersSent, statusCode: res.statusCode });
    res.status(200);
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/json; charset=utf-8');
    // Workaround: in this environment something finalizes requests with 404
    // while async handlers are in-flight. Flushing headers early prevents the 404.
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    const docs = await Order.find().sort({ createdAt: -1 }).lean();
    logJson('info', 'admin.orders_handler_before_send', { headersSent: res.headersSent, statusCode: res.statusCode });
    if (!res.writableEnded) res.end(JSON.stringify((docs || []).map((d) => serializeOrder(d))));
  } catch (e) {
    console.error(e);
    if (!res.writableEnded) res.end(JSON.stringify({ error: 'Failed to list orders' }));
  }
});

app.get('/api/orders/:id/invoice.pdf', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).lean();
    if (!order) {
      res.status(404).type('json').json({ error: 'Order not found' });
      return;
    }
    streamInvoicePdf(order, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).end();
  }
});

app.get('/api/orders/:id', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const { id } = req.params;
    const order = await Order.findById(id).lean();
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(serializeOrder(order));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load order' });
  }
});

app.patch('/api/orders/:id', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.body?.status;
    if (!ORDER_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const before = await Order.findById(id).lean();
    if (!before) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const $set = { status };
    const now = new Date();
    if (status === 'shipped' && !before.shippedAt) $set.shippedAt = now;
    if (status === 'delivered' && !before.deliveredAt) $set.deliveredAt = now;

    const r = await Order.findByIdAndUpdate(id, { $set }, { new: true }).lean();
    if (!r) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    await syncOrderAdminFlags(id);

    // Manual fulfillment trigger: create Shiprocket shipment only when admin marks Packed.
    // Best-effort; never block the status update response.
    if (status === 'packed' && before.status !== 'packed') {
      setImmediate(() => {
        void (async () => {
          try {
            logJson('info', 'shiprocket.packed_trigger', { orderId: id, from: String(before.status), to: 'packed' });
            await finalizePendingOrderShipping(id);
            await ensureShiprocketShipmentForOrderId(id, 'admin-packed');
          } catch (e) {
            logJson('warn', 'shiprocket.packed_trigger_failed', {
              orderId: id,
              message: e instanceof Error ? e.message : String(e),
            });
          }
        })();
      });
    }

    // Send post-order notifications (idempotent)
    try {
      if (before.status !== 'shipped' && status === 'shipped' && !before.shippedEmailSentAt) {
        await sendOrderStatusEmail({ orderLean: { ...r, _id: r._id || id }, kind: 'shipped' });
        await Order.updateOne({ _id: id }, { $set: { shippedEmailSentAt: new Date() } });
      }
      if (before.status !== 'delivered' && status === 'delivered' && !before.deliveredEmailSentAt) {
        await sendOrderStatusEmail({ orderLean: { ...r, _id: r._id || id }, kind: 'delivered' });
        await Order.updateOne({ _id: id }, { $set: { deliveredEmailSentAt: new Date() } });
      }
    } catch (mailErr) {
      console.error('Status email failed:', mailErr);
    }

    res.json(serializeOrder(r));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.get('/api/admin/returns', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const want = String(req.query?.status || '').trim().toLowerCase();
    const docs = await Order.find({
      returnRequests: { $exists: true, $ne: [] },
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    const rows = [];
    for (const o of docs) {
      for (const r of o.returnRequests || []) {
        if (want && String(r.status) !== want) continue;
        rows.push({
          orderId: String(o._id),
          customer: o.customer,
          paymentMethod: o.paymentMethod,
          order: serializeOrder(o),
          returnRequest: serializeReturnRequest(r),
        });
      }
    }
    res.json({ returns: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list returns' });
  }
});

app.post('/api/admin/returns/:orderId/:returnId/approve', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const returnId = String(req.params.returnId || '').trim();
    const adminNotes = String(req.body?.adminNotes || '').trim().slice(0, 2000);
    const r = await Order.findOneAndUpdate(
      { _id: orderId, returnRequests: { $elemMatch: { returnId, status: 'requested' } } },
      {
        $set: {
          'returnRequests.$[r].status': 'approved',
          'returnRequests.$[r].approvedAt': new Date(),
          'returnRequests.$[r].adminNotes': adminNotes || undefined,
        },
        $push: {
          'returnRequests.$[r].timeline': {
            at: new Date(),
            action: 'approved',
            actor: 'admin',
            note: adminNotes,
          },
        },
      },
      { arrayFilters: [{ 'r.returnId': returnId }], new: true }
    ).lean();
    if (!r) {
      res.status(404).json({ error: 'Return not found or not in requested state' });
      return;
    }
    res.json({ order: serializeOrder(r) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to approve return' });
  }
});

app.post('/api/admin/returns/:orderId/:returnId/reject', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const returnId = String(req.params.returnId || '').trim();
    const rejectionReason = String(req.body?.rejectionReason || '').trim().slice(0, 2000);
    if (!rejectionReason) {
      res.status(400).json({ error: 'rejectionReason is required' });
      return;
    }
    const r = await Order.findOneAndUpdate(
      { _id: orderId, returnRequests: { $elemMatch: { returnId, status: 'requested' } } },
      {
        $set: {
          'returnRequests.$[r].status': 'rejected',
          'returnRequests.$[r].rejectedAt': new Date(),
          'returnRequests.$[r].rejectionReason': rejectionReason,
        },
        $push: {
          'returnRequests.$[r].timeline': {
            at: new Date(),
            action: 'rejected',
            actor: 'admin',
            note: rejectionReason,
          },
        },
      },
      { arrayFilters: [{ 'r.returnId': returnId }], new: true }
    ).lean();
    if (!r) {
      res.status(404).json({ error: 'Return not found or not in requested state' });
      return;
    }
    res.json({ order: serializeOrder(r) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reject return' });
  }
});

app.post('/api/admin/returns/:orderId/:returnId/reverse-shipment', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const returnId = String(req.params.returnId || '').trim();
    const awb = String(req.body?.awb || '').trim();
    const courierName = String(req.body?.courierName || '').trim();
    const source = String(req.body?.source || 'manual').toLowerCase() === 'shiprocket' ? 'shiprocket' : 'manual';
    if (!awb) {
      res.status(400).json({ error: 'awb is required' });
      return;
    }
    const order = await Order.findOne({ _id: orderId, 'returnRequests.returnId': returnId }).lean();
    if (!order) {
      res.status(404).json({ error: 'Order or return not found' });
      return;
    }
    const ret = (order.returnRequests || []).find((x) => String(x.returnId) === returnId);
    if (!ret || !['approved', 'picked_up', 'received'].includes(String(ret.status))) {
      res.status(400).json({ error: 'Return must be approved before adding reverse shipment details' });
      return;
    }
    const r = await Order.findOneAndUpdate(
      { _id: orderId, 'returnRequests.returnId': returnId },
      {
        $set: {
          'returnRequests.$[r].reverseShipment': {
            source,
            awb,
            courierName: courierName || undefined,
            timeline: Array.isArray(ret.reverseShipment?.timeline) ? ret.reverseShipment.timeline : [],
            webhookDedupeKeys: Array.isArray(ret.reverseShipment?.webhookDedupeKeys)
              ? ret.reverseShipment.webhookDedupeKeys
              : [],
          },
        },
        $push: {
          'returnRequests.$[r].timeline': {
            at: new Date(),
            action: 'reverse_shipment_set',
            actor: 'admin',
            note: `AWB ${awb}${courierName ? ` · ${courierName}` : ''}`,
          },
        },
      },
      { arrayFilters: [{ 'r.returnId': returnId }], new: true }
    ).lean();
    res.json({ order: serializeOrder(r) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save reverse shipment' });
  }
});

app.post('/api/admin/returns/:orderId/:returnId/mark-picked-up', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const returnId = String(req.params.returnId || '').trim();
    const r = await Order.findOneAndUpdate(
      { _id: orderId, returnRequests: { $elemMatch: { returnId, status: 'approved' } } },
      {
        $set: {
          'returnRequests.$[r].status': 'picked_up',
          'returnRequests.$[r].pickedUpAt': new Date(),
        },
        $push: {
          'returnRequests.$[r].timeline': { at: new Date(), action: 'picked_up', actor: 'admin', note: '' },
        },
      },
      { arrayFilters: [{ 'r.returnId': returnId }], new: true }
    ).lean();
    if (!r) {
      res.status(404).json({ error: 'Return not found or not approved' });
      return;
    }
    res.json({ order: serializeOrder(r) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update return' });
  }
});

app.post('/api/admin/returns/:orderId/:returnId/mark-received', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const returnId = String(req.params.returnId || '').trim();
    const r = await Order.findOneAndUpdate(
      {
        _id: orderId,
        returnRequests: { $elemMatch: { returnId, status: { $in: ['approved', 'picked_up'] } } },
      },
      {
        $set: {
          'returnRequests.$[r].status': 'received',
          'returnRequests.$[r].receivedAt': new Date(),
        },
        $push: {
          'returnRequests.$[r].timeline': { at: new Date(), action: 'received', actor: 'admin', note: '' },
        },
      },
      { arrayFilters: [{ 'r.returnId': returnId }], new: true }
    ).lean();
    if (!r) {
      res.status(404).json({ error: 'Return not found or invalid state for received' });
      return;
    }
    res.json({ order: serializeOrder(r) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update return' });
  }
});

app.post('/api/admin/returns/:orderId/:returnId/refund', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const returnId = String(req.params.returnId || '').trim();
    const order = await Order.findById(orderId).lean();
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const ret = (order.returnRequests || []).find((x) => String(x.returnId) === returnId);
    if (!ret) {
      res.status(404).json({ error: 'Return not found' });
      return;
    }
    if (String(ret.status) === 'refunded') {
      res.status(409).json({ error: 'Return already refunded' });
      return;
    }
    if (String(ret.refund?.status) === 'completed') {
      res.status(409).json({ error: 'Refund already completed' });
      return;
    }

    const isPrepaid =
      String(order.paymentMethod || '') === 'razorpay' && String(order.paymentStatus || '') === 'paid';
    const kindBody = String(req.body?.kind || '').toLowerCase();
    const goodsRefund = computeReturnGoodsRefund(order, ret.lines || []);

    if (String(order.paymentMethod || '') === 'razorpay' && !isPrepaid) {
      res.status(400).json({ error: 'This order is not paid online; use manual refund only after coordination.' });
      return;
    }

    if (isPrepaid) {
      if (String(ret.status) !== 'received') {
        res.status(400).json({ error: 'Mark the return as received before refunding prepaid orders' });
        return;
      }
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        res.status(503).json({ error: 'Razorpay is not configured' });
        return;
      }
      const paymentId = String(order.razorpayPaymentId || '').trim();
      if (!paymentId) {
        res.status(400).json({ error: 'Order has no Razorpay payment id' });
        return;
      }
      const cap = Math.max(0, Number(order.amountPaid) || Number(order.total) || 0);
      const refundRupees = Math.min(goodsRefund, cap);
      const amountPaise = Math.round(refundRupees * 100);
      if (amountPaise <= 0) {
        res.status(400).json({ error: 'Refund amount is zero' });
        return;
      }

      const razorpay = new Razorpay({ key_id: String(RAZORPAY_KEY_ID), key_secret: String(RAZORPAY_KEY_SECRET) });
      let rf;
      try {
        rf = await razorpay.payments.refund(paymentId, { amount: amountPaise, speed: 'normal' });
      } catch (err) {
        logJson('error', 'return.refund_razorpay_failed', {
          orderId,
          returnId,
          message: err instanceof Error ? err.message : String(err),
        });
        await Order.updateOne(
          { _id: orderId },
          {
            $set: {
              'returnRequests.$[r].refund': {
                kind: 'razorpay',
                status: 'failed',
                amount: refundRupees,
                razorpayPaymentId: paymentId,
                error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
              },
            },
            $push: {
              'returnRequests.$[r].timeline': {
                at: new Date(),
                action: 'refund_failed',
                actor: 'admin',
                note: 'Razorpay refund failed',
              },
            },
          },
          { arrayFilters: [{ 'r.returnId': returnId }] }
        );
        res.status(502).json({ error: err instanceof Error ? err.message : 'Razorpay refund failed' });
        return;
      }

      const rid = rf?.id ? String(rf.id) : '';
      const r2 = await Order.findOneAndUpdate(
        { _id: orderId, 'returnRequests.returnId': returnId },
        {
          $set: {
            'returnRequests.$[r].status': 'refunded',
            'returnRequests.$[r].refundedAt': new Date(),
            'returnRequests.$[r].refund': {
              kind: 'razorpay',
              status: 'completed',
              amount: refundRupees,
              currency: 'INR',
              razorpayRefundId: rid,
              razorpayPaymentId: paymentId,
              processedAt: new Date(),
            },
          },
          $push: {
            'returnRequests.$[r].timeline': {
              at: new Date(),
              action: 'refunded',
              actor: 'admin',
              note: `Razorpay refund ₹${refundRupees}${rid ? ` (${rid})` : ''}`,
            },
          },
        },
        { arrayFilters: [{ 'r.returnId': returnId }], new: true }
      ).lean();
      res.json({ order: serializeOrder(r2) });
      return;
    }

    const kind = kindBody === 'store_credit' ? 'store_credit' : 'manual';
    if (!['approved', 'picked_up', 'received'].includes(String(ret.status))) {
      res.status(400).json({ error: 'Return must be approved before recording a COD refund' });
      return;
    }

    const r2 = await Order.findOneAndUpdate(
      { _id: orderId, 'returnRequests.returnId': returnId },
      {
        $set: {
          'returnRequests.$[r].status': 'refunded',
          'returnRequests.$[r].refundedAt': new Date(),
          'returnRequests.$[r].refund': {
            kind,
            status: 'completed',
            amount: goodsRefund,
            currency: 'INR',
            processedAt: new Date(),
          },
        },
        $push: {
          'returnRequests.$[r].timeline': {
            at: new Date(),
            action: 'refunded',
            actor: 'admin',
            note: `${kind === 'store_credit' ? 'Store credit' : 'Manual refund'} recorded · ₹${goodsRefund}`,
          },
        },
      },
      { arrayFilters: [{ 'r.returnId': returnId }], new: true }
    ).lean();
    if (!r2) {
      res.status(404).json({ error: 'Return not found' });
      return;
    }
    res.json({ order: serializeOrder(r2) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Admin: retry Shiprocket shipment creation (idempotent).
app.post('/api/admin/orders/:id/shipping/retry', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const before = await Order.findById(id).lean();
    if (!before) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (before?.shipping?.shipmentCreatedAt || before?.shipping?.shipmentId) {
      res.status(409).json({ error: 'Shipment already exists for this order' });
      return;
    }

    const block = shipmentBlockedByPaymentOrQuote(before);
    if (block.blocked) {
      logJson('warn', 'admin.shipment_retry_blocked', { orderId: id, reason: block.reason });
      res.status(409).json({
        error: `Cannot create shipment while blocked: ${block.reason}. Resolve payment or shipping quote first.`,
      });
      return;
    }

    // Admin-triggered Shiprocket action: move pending → confirmed.
    await Order.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'confirmed' } });

    await Order.updateOne(
      { _id: id },
      {
        $unset: {
          'shipping.shipmentRequestedAt': 1,
          'shipping.error': 1,
          'shipping.manualReason': 1,
        },
        $set: {
          'shipping.manualRequired': false,
          'shipping.shipmentAttemptCount': 0,
          'shipping.lastUpdatedAt': new Date(),
        },
        $push: {
          'shipping.timeline': { at: new Date().toISOString(), kind: 'shipment_retry_requested', source: 'admin' },
        },
      }
    );
    await syncOrderAdminFlags(id);

    setImmediate(() => {
      void ensureShiprocketShipmentForOrderId(id, 'admin-retry');
    });

    const fresh = await Order.findById(id).lean();
    res.json({ ok: true, order: serializeOrder(fresh) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to retry shipment' });
  }
});

// Admin: backfill Shiprocket AWB/courier fields for existing orders.
app.post('/api/admin/shipping/sync-awb', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    if (!shiprocketConfigured()) {
      res.status(503).json({ ok: false, error: 'Shiprocket is not configured on the server' });
      return;
    }

    const body = req.body || {};
    const orderId = String(body?.orderId || '').trim();
    const shipmentIdIn = body?.shipmentId ?? body?.shipment_id ?? null;
    const shipmentIdNum = shipmentIdIn != null ? Number(shipmentIdIn) : null;
    const shipmentId = Number.isFinite(shipmentIdNum) && shipmentIdNum > 0 ? shipmentIdNum : null;

    if (!orderId && !shipmentId) {
      res.status(400).json({ ok: false, error: 'Provide orderId or shipmentId' });
      return;
    }

    const order =
      orderId ? await Order.findById(orderId).lean() : await Order.findOne({ 'shipping.shipmentId': shipmentId }).lean();
    if (!order) {
      res.status(404).json({ ok: false, error: 'Order not found' });
      return;
    }

    const effectiveShipmentId = shipmentId || (order?.shipping?.shipmentId != null ? Number(order.shipping.shipmentId) : null);
    const shiprocketOrderId = String(order?.shipping?.shiprocketOrderId || '').trim() || null;
    const courierIdExisting = order?.shipping?.courierId != null ? Number(order.shipping.courierId) : null;

    logJson('info', 'shiprocket.sync_awb_start', {
      orderId: String(order._id),
      effectiveShipmentId,
      shiprocketOrderId,
      hasAwb: Boolean(order?.shipping?.awb),
      hasCourierName: Boolean(order?.shipping?.courierName),
    });

    let extracted = {
      awb: '',
      courierName: '',
      courierId: null,
      shipmentId: effectiveShipmentId,
    };

    // Prefer reading details first (order show).
    if (shiprocketOrderId) {
      const { res: showRes, data: showData } = await shiprocketFetch(`/orders/show/${encodeURIComponent(shiprocketOrderId)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      logJson('info', 'shiprocket.sync_awb_response', {
        orderId: String(order._id),
        kind: 'order_show',
        ok: showRes.ok,
        status: showRes.status,
        responseKeys: showData && typeof showData === 'object' ? Object.keys(showData) : typeof showData,
      });

      if (showRes.ok) {
        const d = showData?.data ?? showData?.payload ?? showData;
        const shipments =
          Array.isArray(d?.shipments) ? d.shipments
          : Array.isArray(d?.data?.shipments) ? d.data.shipments
          : Array.isArray(d?.order?.shipments) ? d.order.shipments
          : [];
        const first = shipments?.[0] || d?.shipment || d?.data?.shipment || null;
        const awbFromShow = String(first?.awb_code ?? first?.awb ?? first?.tracking_number ?? d?.awb_code ?? d?.awb ?? '').trim();
        const courierNameFromShow = String(
          first?.courier_name ??
            first?.courier_company_name ??
            first?.courierCompanyName ??
            d?.courier_name ??
            d?.courier_company_name ??
            ''
        ).trim();
        const courierIdFromShowRaw =
          first?.courier_company_id ?? first?.courier_id ?? first?.courierId ?? d?.courier_company_id ?? d?.courier_id ?? null;
        const courierIdFromShow = courierIdFromShowRaw != null ? Number(courierIdFromShowRaw) : null;

        extracted.awb = awbFromShow || extracted.awb;
        extracted.courierName = courierNameFromShow || extracted.courierName;
        extracted.courierId = Number.isFinite(courierIdFromShow) && courierIdFromShow > 0 ? courierIdFromShow : extracted.courierId;
        const shipmentFromShow = extractShipmentIdFromOrderShow(showData);
        if (shipmentFromShow) extracted.shipmentId = shipmentFromShow;
      }
    }

    // Fallback: if still no AWB, try assign/awb again (best-effort).
    const courierIdForAssign = extracted.courierId || (Number.isFinite(courierIdExisting) && courierIdExisting > 0 ? courierIdExisting : null);
    if (!extracted.awb && extracted.shipmentId && courierIdForAssign) {
      const assignBody = { shipment_id: extracted.shipmentId, courier_id: courierIdForAssign };
      const { res: awbRes, data: awbData } = await shiprocketFetch('/courier/assign/awb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignBody),
      });
      logJson('info', 'shiprocket.sync_awb_response', {
        orderId: String(order._id),
        kind: 'assign_awb_fallback',
        ok: awbRes.ok,
        status: awbRes.status,
        responseKeys: awbData && typeof awbData === 'object' ? Object.keys(awbData) : typeof awbData,
      });

      if (awbRes.ok) {
        extracted.awb = String(
          awbData?.awb_code ??
            awbData?.data?.awb_code ??
            awbData?.data?.response?.awb_code ??
            awbData?.payload?.awb_code ??
            awbData?.payload?.data?.awb_code ??
            awbData?.awb ??
            awbData?.data?.awb ??
            ''
        ).trim();
        extracted.courierName =
          String(
            awbData?.courier_name ??
              awbData?.data?.courier_name ??
              awbData?.data?.response?.courier_name ??
              awbData?.payload?.courier_name ??
              awbData?.payload?.data?.courier_name ??
              extracted.courierName ??
              ''
          ).trim() || extracted.courierName;
      }
    }

    const $set = {};
    // Never overwrite existing good fields with empty.
    if (!order?.shipping?.awb && extracted.awb) $set['shipping.awb'] = extracted.awb;
    if (!order?.shipping?.courierName && extracted.courierName) $set['shipping.courierName'] = extracted.courierName;
    if (!order?.shipping?.courierId && courierIdForAssign) $set['shipping.courierId'] = courierIdForAssign;
    if (!order?.shipping?.shipmentId && extracted.shipmentId) $set['shipping.shipmentId'] = extracted.shipmentId;
    if (!order?.shipping?.shiprocketOrderId && shiprocketOrderId) $set['shipping.shiprocketOrderId'] = shiprocketOrderId;
    if (Object.keys($set).length > 0) $set['shipping.lastUpdatedAt'] = new Date();

    const updateRes =
      Object.keys($set).length > 0 ? await Order.updateOne({ _id: String(order._id) }, { $set }) : { matchedCount: 1, modifiedCount: 0 };

    logJson('info', 'shiprocket.sync_awb_saved', {
      orderId: String(order._id),
      matched: updateRes?.matchedCount,
      modified: updateRes?.modifiedCount,
      savedAwb: Boolean($set['shipping.awb']),
      awbPrefix: extracted.awb ? extracted.awb.slice(0, 6) : undefined,
      savedCourierName: Boolean($set['shipping.courierName']),
    });

    const fresh = await Order.findById(String(order._id)).lean();
    res.json({ ok: true, shipping: fresh?.shipping || {} });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to sync AWB' });
  }
});

// Admin: manual fallback to sync latest tracking status from Shiprocket (useful when webhooks are missed).
app.post('/api/admin/orders/:id/sync-shipping-status', mongoReady, adminKeyRequired, async (req, res) => {
  try {
    if (!shiprocketConfigured()) {
      res.status(503).json({ ok: false, error: 'Shiprocket is not configured on the server' });
      return;
    }

    const id = String(req.params?.id || '').trim();
    if (!id) {
      res.status(400).json({ ok: false, error: 'Missing order id' });
      return;
    }

    const order = await Order.findById(id).lean();
    if (!order) {
      res.status(404).json({ ok: false, error: 'Order not found' });
      return;
    }

    const awb = String(order?.shipping?.awb || '').trim();
    const shipmentIdRaw = order?.shipping?.shipmentId ?? null;
    const shipmentIdNum = shipmentIdRaw != null ? Number(shipmentIdRaw) : null;
    const shipmentId = Number.isFinite(shipmentIdNum) && shipmentIdNum > 0 ? shipmentIdNum : null;
    const shiprocketOrderId = String(order?.shipping?.shiprocketOrderId || '').trim();

    if (!awb && !shipmentId && !shiprocketOrderId) {
      res.status(400).json({ ok: false, error: 'Order has no Shiprocket identifiers (AWB / shipmentId / shiprocketOrderId)' });
      return;
    }

    logJson('info', 'shiprocket.admin_sync_start', {
      orderId: String(order._id),
      hasAwb: Boolean(awb),
      awbPrefix: awb ? awb.slice(0, 6) : undefined,
      shipmentId: shipmentId || undefined,
      shiprocketOrderId: shiprocketOrderId || undefined,
    });

    // Prefer tracking by AWB, then shipmentId. Order show is a fallback to refresh identifiers.
    let trackingRes = null;
    let trackingData = null;
    let trackingSource = '';

    if (awb) {
      const out = await shiprocketFetch(`/courier/track/awb/${encodeURIComponent(awb)}`, { method: 'GET' });
      trackingRes = out.res;
      trackingData = out.data;
      trackingSource = 'track_awb';
    } else if (shipmentId) {
      const out = await shiprocketFetch(`/courier/track/shipment/${encodeURIComponent(String(shipmentId))}`, { method: 'GET' });
      trackingRes = out.res;
      trackingData = out.data;
      trackingSource = 'track_shipment';
    }

    // If tracking failed and we have a Shiprocket order id, try order show to backfill AWB and retry once.
    if ((!trackingRes || !trackingRes.ok) && shiprocketOrderId) {
      const { res: showRes, data: showData } = await shiprocketFetch(`/orders/show/${encodeURIComponent(shiprocketOrderId)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      logJson('info', 'shiprocket.admin_sync_order_show', {
        orderId: String(order._id),
        ok: showRes.ok,
        status: showRes.status,
      });
      if (showRes.ok) {
        const d = showData?.data ?? showData?.payload ?? showData;
        const shipments =
          Array.isArray(d?.shipments) ? d.shipments
          : Array.isArray(d?.data?.shipments) ? d.data.shipments
          : Array.isArray(d?.order?.shipments) ? d.order.shipments
          : [];
        const first = shipments?.[0] || d?.shipment || d?.data?.shipment || null;
        const awbFromShow = String(first?.awb_code ?? first?.awb ?? first?.tracking_number ?? d?.awb_code ?? d?.awb ?? '').trim();
        const shipmentFromShow = extractShipmentIdFromOrderShow(showData);

        const setFields = {};
        if (!awb && awbFromShow) setFields['shipping.awb'] = awbFromShow;
        if (!shipmentId && shipmentFromShow) setFields['shipping.shipmentId'] = shipmentFromShow;
        if (Object.keys(setFields).length > 0) {
          setFields['shipping.lastUpdatedAt'] = new Date();
          await Order.updateOne({ _id: String(order._id) }, { $set: setFields });
        }

        const awbRetry = awb || awbFromShow;
        const shipRetry = shipmentId || shipmentFromShow;
        if (awbRetry) {
          const out = await shiprocketFetch(`/courier/track/awb/${encodeURIComponent(awbRetry)}`, { method: 'GET' });
          trackingRes = out.res;
          trackingData = out.data;
          trackingSource = 'track_awb_retry';
        } else if (shipRetry) {
          const out = await shiprocketFetch(`/courier/track/shipment/${encodeURIComponent(String(shipRetry))}`, { method: 'GET' });
          trackingRes = out.res;
          trackingData = out.data;
          trackingSource = 'track_shipment_retry';
        }
      }
    }

    logJson('info', 'shiprocket.admin_sync_tracking_response', {
      orderId: String(order._id),
      source: trackingSource || undefined,
      ok: Boolean(trackingRes?.ok),
      status: trackingRes?.status,
      responseKeys: trackingData && typeof trackingData === 'object' ? Object.keys(trackingData).slice(0, 40) : typeof trackingData,
    });

    if (!trackingRes || !trackingRes.ok) {
      const msg =
        typeof trackingData?.message === 'string'
          ? trackingData.message
          : typeof trackingData?.error === 'string'
            ? trackingData.error
            : 'Failed to fetch tracking status from Shiprocket';
      res.status(502).json({ ok: false, error: msg });
      return;
    }

    // Extract status + event time from Shiprocket tracking response (robust across variants).
    const td = trackingData?.data ?? trackingData?.payload ?? trackingData;
    const track = td?.tracking_data ?? td?.trackingData ?? td;
    const shipmentTrack = Array.isArray(track?.shipment_track) ? track.shipment_track : Array.isArray(track?.shipmentTrack) ? track.shipmentTrack : [];
    const first = shipmentTrack?.[0] || {};

    const statusRaw =
      shiprocketFirstString(
        first?.current_status,
        first?.currentStatus,
        track?.current_status,
        track?.currentStatus,
        td?.current_status,
        td?.status,
        td?.shipment_status
      ) || '';

    const timestampRaw = shiprocketFirstString(
      first?.current_timestamp,
      first?.currentTimestamp,
      track?.current_timestamp,
      td?.current_timestamp,
      td?.timestamp
    );

    if (!statusRaw) {
      res.status(502).json({ ok: false, error: 'Shiprocket tracking response did not include a status' });
      return;
    }

    const statusLower = statusRaw.toLowerCase();
    let nextStatus = shiprocketMapStatus(statusRaw);
    if (statusLower.includes('rto')) nextStatus = null;
    if (statusLower.includes('cancel') || statusLower.includes('cancelled') || statusLower.includes('canceled')) nextStatus = null;
    if (statusLower.includes('undelivered') || statusLower.includes('delivery failed') || statusLower.includes('failed')) nextStatus = null;

    const eventAtPayloadIso = shiprocketParseEventTimeIso(timestampRaw);
    const eventAt = eventAtPayloadIso || new Date().toISOString();
    const eventAtKey = eventAtPayloadIso || '';
    const eventKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ src: 'admin_sync', awb, shipmentId, shiprocketOrderId, status: statusLower, at: eventAtKey }))
      .digest('hex')
      .slice(0, 32);

    const timelineEvent = {
      at: eventAt,
      kind: 'admin_tracking_sync',
      status: statusRaw,
      awb: awb || undefined,
      shipmentId: shipmentId || undefined,
      key: eventKey,
      source: 'shiprocket-admin-sync',
    };

    const $set = {
      'shipping.provider': 'shiprocket',
      'shipping.trackingStatus': statusRaw || undefined,
      'shipping.lastUpdatedAt': new Date(),
    };

    if (statusLower.includes('rto')) {
      $set['shipping.rto'] = { status: statusRaw || 'RTO', updatedAt: eventAt };
    }

    const currentStatus = String(order?.status || 'pending');
    if (nextStatus && orderStatusRank(nextStatus) >= orderStatusRank(currentStatus)) {
      $set.status = nextStatus;
      const now = new Date();
      if (nextStatus === 'shipped' && !order.shippedAt) $set.shippedAt = now;
      if (nextStatus === 'delivered' && !order.deliveredAt) $set.deliveredAt = now;
    }

    const updateRes = await Order.updateOne(
      { _id: String(order._id), 'shipping.webhookDedupeKeys': { $ne: eventKey } },
      {
        $set,
        $push: {
          'shipping.timeline': timelineEvent,
          'shipping.webhookDedupeKeys': { $each: [eventKey], $slice: -25 },
        },
      }
    );

    logJson('info', 'shiprocket.admin_sync_saved', {
      orderId: String(order._id),
      matched: updateRes?.matchedCount,
      modified: updateRes?.modifiedCount,
      status: statusRaw,
      nextStatus: nextStatus || undefined,
    });

    const fresh = await Order.findById(String(order._id)).lean();
    res.json({ ok: true, order: serializeOrder(fresh) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to sync shipping status' });
  }
});

app.post('/api/upload/image', uploadRateLimit, mongoReady, requireUploadAuth, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Upload error' });
      return;
    }
    next();
  });
}, (req, res) => {
  if (!cloudName || !cloudKey || !cloudSecret) {
    res.status(503).json({ error: 'Cloudinary is not configured on the server (.env)' });
    return;
  }
  if (!req.file?.buffer) {
    res.status(400).json({ error: 'Missing image file (field name: image)' });
    return;
  }

  const stream = cloudinary.uploader.upload_stream(
    { folder: 'trendnest/products', resource_type: 'image' },
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Cloudinary upload failed' });
        return;
      }
      res.json({ url: result.secure_url });
    }
  );
  stream.end(req.file.buffer);
});

app.post('/api/upload/design', uploadRateLimit, mongoReady, requireUploadAuth, (req, res, next) => {
  uploadDesign.single('design')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Upload error' });
      return;
    }
    next();
  });
}, (req, res) => {
  if (!cloudName || !cloudKey || !cloudSecret) {
    res.status(503).json({ error: 'Cloudinary is not configured on the server (.env)' });
    return;
  }
  if (!req.file?.buffer) {
    res.status(400).json({ error: 'Missing design file (field name: design)' });
    return;
  }

  const isPdf = req.file.mimetype === 'application/pdf';
  const opts = {
    folder: 'trendnest/custom-prints',
    resource_type: isPdf ? 'raw' : 'image',
  };

  const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Cloudinary upload failed' });
      return;
    }
    res.json({ url: result.secure_url });
  });
  stream.end(req.file.buffer);
});

app.post('/api/upload/review-image', uploadRateLimit, mongoReady, requireAuth, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Upload error' });
      return;
    }
    next();
  });
}, (req, res) => {
  if (!cloudName || !cloudKey || !cloudSecret) {
    res.status(503).json({ error: 'Cloudinary is not configured on the server (.env)' });
    return;
  }
  if (!req.file?.buffer) {
    res.status(400).json({ error: 'Missing image file (field name: image)' });
    return;
  }

  const stream = cloudinary.uploader.upload_stream(
    { folder: 'trendnest/reviews', resource_type: 'image' },
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Cloudinary upload failed' });
        return;
      }
      res.json({ url: result.secure_url, publicId: result.public_id });
    }
  );
  stream.end(req.file.buffer);
});

app.post('/api/upload/review-media', uploadRateLimit, mongoReady, requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Upload error' });
      return;
    }
    next();
  });
}, (req, res) => {
  if (!cloudName || !cloudKey || !cloudSecret) {
    res.status(503).json({ error: 'Cloudinary is not configured on the server (.env)' });
    return;
  }
  if (!req.file?.buffer) {
    res.status(400).json({ error: 'Missing file (field name: file)' });
    return;
  }

  const mime = String(req.file.mimetype || '');
  const isVideo = mime.startsWith('video/');
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'trendnest/reviews', resource_type: isVideo ? 'video' : 'image' },
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Cloudinary upload failed' });
        return;
      }
      res.json({ url: result.secure_url, publicId: result.public_id, kind: isVideo ? 'video' : 'image' });
    }
  );
  stream.end(req.file.buffer);
});

app.post('/api/upload/return-image', uploadRateLimit, mongoReady, requireAuth, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Upload error' });
      return;
    }
    next();
  });
}, (req, res) => {
  if (!cloudName || !cloudKey || !cloudSecret) {
    res.status(503).json({ error: 'Cloudinary is not configured on the server (.env)' });
    return;
  }
  if (!req.file?.buffer) {
    res.status(400).json({ error: 'Missing image file (field name: image)' });
    return;
  }

  const stream = cloudinary.uploader.upload_stream(
    { folder: 'trendnest/returns', resource_type: 'image' },
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Cloudinary upload failed' });
        return;
      }
      res.json({ url: result.secure_url, publicId: result.public_id });
    }
  );
  stream.end(req.file.buffer);
});

function mongoReady(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: 'MongoDB is not connected. Set MONGODB_URI in .env and restart the API server.' });
    return;
  }
  next();
}

async function seedIfEmpty() {
  const count = await Product.countDocuments();
  if (count > 0) return;
  const raw = readFileSync(join(__dirname, 'seed.json'), 'utf8');
  const items = JSON.parse(raw);
  await Product.insertMany(
    items.map((p) => ({
      _id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      originalPrice: p.originalPrice,
      images: p.images,
      category: p.category,
      subcategory: p.subcategory,
      sizes: p.sizes,
      variantOptions: p.variantOptions,
      variants: p.variants,
      sleeveTypes: p.sleeveTypes,
      stock: p.stock,
      rating: p.rating,
      reviews: p.reviews || [],
      isCustomPrint: p.isCustomPrint,
      isTrending: p.isTrending,
      tags: p.tags,
    }))
  );
  console.log('Seeded products collection from server/seed.json');
}

async function seedDisposableDomainsIfEmpty() {
  const count = await DisposableDomain.countDocuments();
  if (count > 0) return;
  const raw = readFileSync(join(__dirname, 'disposable-domain-blacklist.json'), 'utf8');
  const domains = JSON.parse(raw);
  const list = (Array.isArray(domains) ? domains : [])
    .map((d) => String(d || '').trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return;
  await DisposableDomain.insertMany(
    list.map((domain) => ({ _id: domain, enabled: true, source: 'seed', reason: 'seed_blacklist' })),
    { ordered: false }
  ).catch((e) => {
    // Ignore dup keys for partial seeds.
    if (!(e && e.code === 11000)) throw e;
  });
  console.log(`Seeded disposable domain blocklist (${list.length} domains)`);
  invalidateDisposableDomainCache();
}

// IMPORTANT: Do not let the framework's default final handler immediately return a 404.
// In some environments, requests can be "finalized" with a 404 while async route handlers are still in-flight.
// This middleware delays the 404 slightly, giving async handlers time to send their real response.
app.use((req, res) => {
  if (res.headersSent || res.writableEnded) return;
  const t = setTimeout(() => {
    if (res.headersSent || res.writableEnded) return;
    res.status(404).type('text/plain').send('Not Found');
  }, 1500);
  res.on('finish', () => clearTimeout(t));
  res.on('close', () => clearTimeout(t));
});

async function main() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('MongoDB connected');
      await seedIfEmpty();
      await seedDisposableDomainsIfEmpty();
      await runOneTimeOrderMigrations();
      await runOneTimeProductMigrations();
    } catch (e) {
      console.error('MongoDB connection failed:', e.message);
    }
  } else {
    console.warn('MONGODB_URI is not set — product APIs return 503 until configured.');
  }

  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    logJson('warn', 'shiprocket.credentials_missing', {
      message:
        'SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD not set — live rates and shipments are unavailable. Configure credentials via environment variables only. Checkout can use ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE for fallback.',
    });
  } else if (!SHIPROCKET_PICKUP_LOCATION_NAME || !SHIPROCKET_PICKUP_PINCODE) {
    logJson('warn', 'shiprocket.pickup_incomplete', {
      message:
        'SHIPROCKET_PICKUP_LOCATION_NAME and SHIPROCKET_PICKUP_PINCODE are required for Shiprocket order creation. Serviceability may still fail until pickup is configured.',
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
