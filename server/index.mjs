import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import session from 'express-session';
import MongoStore from 'connect-mongo';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Always load .env from project root (folder above server/), not only from process.cwd()
dotenv.config({ path: join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

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

const ProductSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    originalPrice: Number,
    images: { type: [String], default: [] },
    category: { type: String, required: true },
    subcategory: String,
    sizes: [String],
    variantOptions: { type: [VariantOptionSchema], default: undefined },
    variants: [String],
    sleeveTypes: [String],
    stock: { type: Number, default: 0 },
    rating: { type: Number, default: 4 },
    reviews: { type: [ProductEmbeddedReviewSchema], default: [] },
    isCustomPrint: Boolean,
    isTrending: Boolean,
    tags: [String],
  },
  { versionKey: false }
);

const Product = mongoose.model('Product', ProductSchema);

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

const User = mongoose.model('User', UserSchema);
const OtpChallenge = mongoose.model('OtpChallenge', OtpChallengeSchema);

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
  },
  { versionKey: false, timestamps: true }
);

ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

const Review = mongoose.model('Review', ReviewSchema);

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
const ORDER_STATUSES = ['pending', 'packed', 'shipped', 'delivered'];

const OrderLineSchema = new mongoose.Schema(
  {
    lineId: String,
    productId: { type: String, required: true },
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
    total: { type: Number, required: true },
    hasCustomPrint: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
    },
    shippedAt: Date,
    deliveredAt: Date,
    shippedEmailSentAt: Date,
    deliveredEmailSentAt: Date,
    emailSentAt: Date,
    emailError: String,
  },
  { versionKey: false, timestamps: true }
);

const Order = mongoose.model('Order', OrderSchema);

function serialize(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = o._id;
  delete o._id;
  return { id, ...o };
}

function serializeOrder(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = o._id;
  delete o._id;
  const out = { id, ...o };
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString();
  if (out.updatedAt instanceof Date) out.updatedAt = out.updatedAt.toISOString();
  return out;
}

function adminKeyRequired(req, res, next) {
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
}

function simpleEmailValid(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
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

function getMailTransport() {
  const user = process.env.SMTP_USER || process.env.ORDER_FROM_EMAIL;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

async function sendOrderEmails(orderLean) {
  const from = process.env.ORDER_FROM_EMAIL || process.env.SMTP_USER || 'trendnest099@gmail.com';
  const adminTo = process.env.ORDER_ADMIN_EMAIL || from;
  const transport = getMailTransport();
  if (!transport) {
    console.warn('Order emails skipped: SMTP_USER/SMTP_PASS (or ORDER_FROM_EMAIL) not set.');
    return { ok: false, error: 'SMTP not configured' };
  }
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

  await transport.sendMail({
    from: `"TrendNest" <${from}>`,
    to: customer.email.trim(),
    subject: customerSubject,
    text: customerText,
    html: customerHtml,
  });
  await transport.sendMail({
    from: `"TrendNest" <${from}>`,
    to: adminTo,
    subject: adminSubject,
    text: adminText,
  });
  return { ok: true };
}

async function sendOrderStatusEmail({ orderLean, kind }) {
  const from = process.env.ORDER_FROM_EMAIL || process.env.SMTP_USER || 'trendnest099@gmail.com';
  const transport = getMailTransport();
  if (!transport) {
    console.warn('Status email skipped: SMTP_USER/SMTP_PASS (or ORDER_FROM_EMAIL) not set.');
    return { ok: false, error: 'SMTP not configured' };
  }
  const id = orderLean._id || orderLean.id;
  const { customer } = orderLean;

  if (kind === 'shipped') {
    const subject = `Your order is shipped — ${id} — TrendNest`;
    const text = `Hi ${customer.name},\n\nGood news! Your order has been shipped.\n\nOrder ID: ${id}\n\nWe will notify you when it is delivered.\n\n— TrendNest`;
    const html = `<p>Hi ${escapeHtml(customer.name)},</p><p><strong>Good news!</strong> Your order has been shipped.</p><p><strong>Order ID:</strong> ${escapeHtml(id)}</p><p>We will notify you when it is delivered.</p><p>— TrendNest</p>`;
    await transport.sendMail({
      from: `"TrendNest" <${from}>`,
      to: customer.email.trim(),
      subject,
      text,
      html,
    });
    return { ok: true };
  }

  if (kind === 'delivered') {
    const subject = `Delivered — Thank you for shopping — ${id} — TrendNest`;
    const text = `Hi ${customer.name},\n\nThank you for shopping with TrendNest99.\n\nYour order has been delivered.\nOrder ID: ${id}\n\nWe would love your feedback. If you liked the product, please leave a review.\n\n— TrendNest`;
    const html = `<p>Hi ${escapeHtml(customer.name)},</p><p>Thank you for shopping with TrendNest99.</p><p><strong>Your order has been delivered.</strong></p><p><strong>Order ID:</strong> ${escapeHtml(id)}</p><p>We would love your feedback. If you liked the product, please leave a review.</p><p>— TrendNest</p>`;
    await transport.sendMail({
      from: `"TrendNest" <${from}>`,
      to: customer.email.trim(),
      subject,
      text,
      html,
    });
    return { ok: true };
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
  const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
  const minDeliveredAt = new Date(now - fifteenDaysMs);

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
    return { ok: false, error: 'You can review only after delivery (within 15 days)' };
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
  doc.text('Description', 48, y, { width: 220 });
  doc.text('Qty', 280, y, { width: 40 });
  doc.text('Price', 330, y, { width: 60 });
  doc.text('Amount', 400, y, { width: 80 });
  doc.moveDown(0.5);
  doc.moveTo(48, doc.y).lineTo(548, doc.y).stroke();
  doc.moveDown(0.25);
  for (const l of order.items || []) {
    const amt = l.price * l.quantity;
    const opts = [l.selectedSize, l.selectedVariant, l.selectedSleeve].filter(Boolean).join(', ');
    const desc = opts ? `${l.name} (${opts})` : l.name;
    y = doc.y;
    doc.text(desc, 48, y, { width: 220 });
    doc.text(String(l.quantity), 280, y, { width: 40 });
    doc.text(`₹${l.price}`, 330, y, { width: 60 });
    doc.text(`₹${amt}`, 400, y, { width: 80 });
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
  limits: { fileSize: 8 * 1024 * 1024 },
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
  limits: { fileSize: 8 * 1024 * 1024 },
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
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || '').trim();
app.use(
  cors({
    origin: FRONTEND_ORIGIN ? [FRONTEND_ORIGIN] : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '16mb' }));

// Cookie-session auth for logged-in customers.
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
const COOKIE_SECURE = (process.env.COOKIE_SECURE || '').trim().toLowerCase();
const isProd = process.env.NODE_ENV === 'production';
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
    secret: SESSION_SECRET || 'dev-insecure-session-secret',
    resave: false,
    saveUninitialized: false,
    store: MONGODB_URI
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
      maxAge: SESSION_TTL_MS,
    },
  })
);

app.get('/', (_req, res) => {
  res.type('text/plain').send('Backend is running 🚀');
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1,
    cloudinary: !!(cloudName && cloudKey && cloudSecret),
  });
});

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function serializeUser(userDoc) {
  if (!userDoc) return null;
  return {
    id: userDoc._id,
    email: userDoc.email,
    phone: userDoc.phone,
    name: userDoc.name,
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

function genNumericCode(length) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
}

async function sendOtpEmail({ to, code, purpose }) {
  const transport = getMailTransport();
  if (!transport) {
    return { ok: false, error: 'SMTP not configured on server (.env)' };
  }
  const from = process.env.ORDER_FROM_EMAIL || process.env.SMTP_USER || 'trendnest099@gmail.com';
  const subject = purpose === 'password_reset' ? 'TrendNest99 password reset OTP' : 'TrendNest99 OTP verification';
  const text = `Your OTP code is: ${code}\n\nThis code will expire soon. If you did not request it, ignore this email.`;

  await transport.sendMail({
    from,
    to,
    subject,
    text,
  });
  return { ok: true };
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

app.post('/api/auth/logout', (req, res) => {
  if (!req.session) {
    res.json({ ok: true });
    return;
  }
  req.session.destroy(() => {
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

app.post('/api/auth/otp/request', async (req, res) => {
  try {
    const email = String(req.body?.email || req.body?.identifier || '').trim();
    const purpose = String(req.body?.purpose || 'checkout');
    if (!email || !simpleEmailValid(email)) {
      res.status(400).json({ error: 'Invalid email' });
      return;
    }

    if (!['checkout', 'auth', 'password_reset'].includes(purpose)) {
      res.status(400).json({ error: 'Invalid OTP purpose' });
      return;
    }

    const existingUser = await User.findOne({ email }).exec();
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
      email,
      codeHash,
      codeSalt,
      expiresAt,
      attempts: 0,
      maxAttempts,
    });

    const sent = await sendOtpEmail({ to: email, code, purpose });
    if (!sent.ok) {
      res.status(503).json({ error: sent.error || 'Could not send OTP' });
      return;
    }

    res.json({ challengeId, masked: maskEmail(email) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to request OTP' });
  }
});

app.post('/api/auth/otp/verify', async (req, res) => {
  try {
    const challengeId = String(req.body?.challengeId || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!challengeId || !code) {
      res.status(400).json({ error: 'Missing challengeId or code' });
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

    let userId = challenge.userId ? String(challenge.userId) : '';
    if (!userId && challenge.purpose !== 'password_reset') {
      const email = String(challenge.email || '').trim();
      const existing = email ? await User.findOne({ email }).exec() : null;
      if (existing) {
        userId = existing._id;
      } else {
        const newId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const created = await User.create({
          _id: newId,
          email,
          name: String(req.body?.name || '').trim() || '',
          phone: String(req.body?.phone || '').trim() || undefined,
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
      const phoneRaw = String(req.body?.phone || '').trim();
      const phone = phoneRaw || undefined;
      if (name || phone) {
        const existingUser = await User.findById(userId).lean();
        if (existingUser) {
          const $set = {};
          if (name && !String(existingUser.name || '').trim()) $set.name = name;
          if (phone && !String(existingUser.phone || '').trim()) $set.phone = phone;
          if (Object.keys($set).length > 0) {
            await User.updateOne({ _id: userId }, { $set });
          }
        }
      }
    }

    const user = userId ? await User.findById(userId).lean() : null;
    res.json({ user: user ? serializeUser(user) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

app.get('/api/me/orders', mongoReady, requireAuth, async (req, res) => {
  try {
    const docs = await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 }).lean();
    res.json(docs.map((d) => serializeOrder(d)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load your orders' });
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
    const phone = req.body?.phone != null ? String(req.body.phone).trim() : undefined;
    const $set = {};
    if (name !== undefined) $set.name = name;
    if (phone !== undefined) $set.phone = phone || undefined;
    if (Object.keys($set).length > 0) {
      await User.updateOne({ _id: req.session.userId }, { $set });
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
    if (cursor) {
      const d = new Date(cursor);
      if (!Number.isNaN(d.getTime())) q.createdAt = { $lt: d };
    }

    const docs = await Review.find(q).sort({ createdAt: -1 }).limit(limit + 1).lean();
    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? (last.createdAt instanceof Date ? last.createdAt.toISOString() : String(last.createdAt))
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

app.post('/api/reviews', mongoReady, requireAuth, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const productId = String(req.body?.productId || '').trim();
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim();
    const images = Array.isArray(req.body?.images) ? req.body.images : [];

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

    const created = await Review.create({
      _id: id,
      productId,
      userId,
      userName: userName || 'Customer',
      rating,
      comment,
      images: safeImages,
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

app.get('/api/me/review-prompts', mongoReady, requireAuth, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const now = Date.now();
    const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
    const minDeliveredAt = new Date(now - fifteenDaysMs);

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
    const address = String(req.body?.address || '').trim();
    const city = String(req.body?.city || '').trim();
    const state = req.body?.state != null ? String(req.body.state).trim() : '';
    const pincode = String(req.body?.pincode || '').trim();
    const isDefault = !!req.body?.isDefault;
    if (!address || !city || !pincode) {
      res.status(400).json({ error: 'Address, city, and pincode are required' });
      return;
    }
    const id = `addr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const addr = { id, label, address, city, state: state || undefined, pincode, isDefault };
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
    const next = {
      ...cur,
      label: req.body?.label != null ? String(req.body.label).trim() : cur.label,
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

app.post('/api/auth/login', async (req, res) => {
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
    res.json({ user: serializeUser(await User.findById(user._id).lean()) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
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

app.post('/api/auth/password/reset', async (req, res) => {
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
    const u = await User.findById(challenge.userId).lean();
    res.json({ user: u ? serializeUser(u) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/products', mongoReady, async (_req, res) => {
  try {
    const docs = await Product.find().lean();
    res.json(docs.map((d) => serialize(d)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list products' });
  }
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

app.post('/api/products', mongoReady, async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || `p${Date.now()}`;
    const doc = await Product.create({
      _id: id,
      name: body.name,
      description: body.description ?? '',
      price: Number(body.price),
      originalPrice: body.originalPrice != null ? Number(body.originalPrice) : undefined,
      images: Array.isArray(body.images) && body.images.length ? body.images : ['https://images.unsplash.com/photo-1553062407-98d43420e9e7?w=600'],
      category: body.category,
      subcategory: body.subcategory,
      sizes: body.sizes,
      variantOptions: normalizeVariantOptionsFromBody(body.variantOptions),
      variants: body.variants,
      sleeveTypes: body.sleeveTypes,
      stock: Number(body.stock) || 0,
      rating: Number(body.rating) || 4,
      reviews: body.reviews || [],
      isCustomPrint: !!body.isCustomPrint,
      isTrending: !!body.isTrending,
      tags: body.tags,
    });
    res.status(201).json(serialize(doc));
  } catch (e) {
    console.error(e);
    if (e.code === 11000) {
      res.status(409).json({ error: 'Product id already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * Build a BSON-safe $set object. Uses the native collection for updates so nested
 * `variantOptions` and `images` persist reliably (Mongoose doc.save() often skips or fails them).
 */
function buildProductUpdateSet(src) {
  const out = {};
  if (src.name !== undefined) out.name = String(src.name);
  if (src.description !== undefined) out.description = String(src.description ?? '');
  if (src.price !== undefined) {
    const n = Number(src.price);
    if (!Number.isFinite(n)) throw new Error('Invalid price');
    out.price = n;
  }
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
  if (src.tags !== undefined) {
    out.tags = Array.isArray(src.tags) ? src.tags.map((t) => String(t)) : [];
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

app.put('/api/products/:id', mongoReady, async (req, res) => {
  try {
    const { id } = req.params;
    const src = { ...req.body };
    delete src.id;

    const exists = await Product.exists({ _id: id });
    if (!exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const $set = buildProductUpdateSet(src);
    if (Object.keys($set).length > 0) {
      await Product.collection.updateOne({ _id: id }, { $set });
    }

    const doc = await Product.findById(id).lean();
    res.json(serialize(doc));
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

app.post('/api/orders', mongoReady, async (req, res) => {
  try {
    const body = req.body || {};
    const c = body.customer || {};
    const name = String(c.name || '').trim();
    const email = String(c.email || '').trim();
    const phone = String(c.phone || '').trim();
    const address = String(c.address || '').trim();
    const city = String(c.city || '').trim();
    const state = c.state != null ? String(c.state).trim() : '';
    const pincode = String(c.pincode || '').trim();
    if (!name || !email || !phone || !address || !city || !pincode) {
      res.status(400).json({ error: 'All customer fields including email are required.' });
      return;
    }
    if (!simpleEmailValid(email)) {
      res.status(400).json({ error: 'Invalid email address.' });
      return;
    }

    // Ensure authenticated user relation when email exists (needed for coupons + per-user limits).
    if (!req.session?.userId) {
      const u = await User.findOne({ email }).exec();
      if (u) req.session.userId = u._id;
    }

    let items;
    try {
      items = normalizeOrderItemsFromBody(body.items);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Invalid items' });
      return;
    }
    const subtotal = Number(body.subtotal);
    if (!Number.isFinite(subtotal)) {
      res.status(400).json({ error: 'Invalid totals' });
      return;
    }

    // Coupon enforcement (server-side): compute discount and total again to prevent tampering.
    let discount = Number(body.discount) || 0;
    let couponCode = body.couponCode ? normalizeCouponCode(body.couponCode) : undefined;
    let total = Number(body.total);
    if (!Number.isFinite(total)) {
      res.status(400).json({ error: 'Invalid totals' });
      return;
    }

    if (couponCode) {
      const itemsForValidate = items.map(l => ({ productId: l.productId, quantity: l.quantity }));
      const sessionUserId = req.session?.userId ? String(req.session.userId) : undefined;
      const validation = await validateCouponForCart({
        code: couponCode,
        subtotal,
        items: itemsForValidate,
        userId: sessionUserId,
      });
      if (!validation.ok) {
        res.status(400).json({ error: validation.error || 'Invalid coupon' });
        return;
      }

      // Enforce usage limits again only when we have userId (required for usage accounting).
      const couponDoc = await Coupon.findById(validation.couponId).lean();
      if (!couponDoc) {
        res.status(400).json({ error: 'Invalid coupon' });
        return;
      }
      const couponId = String(couponDoc._id);
      const userId = req.session?.userId ? String(req.session.userId) : undefined;
      if (!userId) {
        res.status(400).json({ error: 'Login is required to use coupons' });
        return;
      }

      if (couponDoc.usageTotalLimit != null && Number.isFinite(Number(couponDoc.usageTotalLimit))) {
        const usedTotal = await CouponUsage.countDocuments({ couponId });
        if (usedTotal >= Number(couponDoc.usageTotalLimit)) {
          res.status(400).json({ error: 'Coupon usage limit reached' });
          return;
        }
      }
      if (couponDoc.usagePerUserLimit != null && Number.isFinite(Number(couponDoc.usagePerUserLimit))) {
        const u = await CouponUsage.findOne({ couponId, userId }).lean();
        const usedByUser = u?.count ? Number(u.count) : 0;
        if (usedByUser >= Number(couponDoc.usagePerUserLimit)) {
          res.status(400).json({ error: 'You already used this coupon' });
          return;
        }
      }

      discount = validation.discount;
      couponCode = validation.couponCode;
      total = Math.max(0, subtotal - discount);

      await CouponUsage.findOneAndUpdate(
        { couponId, userId },
        { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
        { upsert: true, new: false }
      );
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await Order.create({
      _id: orderId,
      customer: { name, email, phone, address, city, state: state || undefined, pincode },
      userId: req.session?.userId,
      items,
      subtotal,
      discount,
      couponCode,
      total,
      hasCustomPrint: !!body.hasCustomPrint,
      status: 'pending',
    });
    const leanForMail = (await Order.findById(orderId).lean()) || {};
    try {
      await sendOrderEmails({ ...leanForMail, _id: orderId });
      await Order.updateOne({ _id: orderId }, { $set: { emailSentAt: new Date(), emailError: null } });
    } catch (mailErr) {
      const emailErr = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error('Order email failed:', mailErr);
      await Order.updateOne({ _id: orderId }, { $set: { emailError: emailErr } });
    }
    const fresh = await Order.findById(orderId).lean();
    res.status(201).json(serializeOrder(fresh));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/api/orders', mongoReady, adminKeyRequired, async (_req, res) => {
  try {
    const docs = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(docs.map((d) => serializeOrder(d)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list orders' });
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

app.post('/api/upload/image', (req, res, next) => {
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

app.post('/api/upload/design', (req, res, next) => {
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

app.post('/api/upload/review-image', mongoReady, requireAuth, (req, res, next) => {
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

async function main() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('MongoDB connected');
      await seedIfEmpty();
    } catch (e) {
      console.error('MongoDB connection failed:', e.message);
    }
  } else {
    console.warn('MONGODB_URI is not set — product APIs return 503 until configured.');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
