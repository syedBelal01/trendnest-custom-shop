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

const ReviewSchema = new mongoose.Schema(
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
    reviews: { type: [ReviewSchema], default: [] },
    isCustomPrint: Boolean,
    isTrending: Boolean,
    tags: [String],
  },
  { versionKey: false }
);

const Product = mongoose.model('Product', ProductSchema);

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
      pincode: { type: String, required: true },
    },
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '16mb' }));

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

app.get('/api/products', mongoReady, async (_req, res) => {
  try {
    const docs = await Product.find().lean();
    res.json(docs.map((d) => serialize(d)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list products' });
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
    const pincode = String(c.pincode || '').trim();
    if (!name || !email || !phone || !address || !city || !pincode) {
      res.status(400).json({ error: 'All customer fields including email are required.' });
      return;
    }
    if (!simpleEmailValid(email)) {
      res.status(400).json({ error: 'Invalid email address.' });
      return;
    }
    let items;
    try {
      items = normalizeOrderItemsFromBody(body.items);
    } catch (e) {
      res.status(400).json({ error: e.message || 'Invalid items' });
      return;
    }
    const subtotal = Number(body.subtotal);
    const discount = Number(body.discount) || 0;
    const total = Number(body.total);
    if (!Number.isFinite(subtotal) || !Number.isFinite(total)) {
      res.status(400).json({ error: 'Invalid totals' });
      return;
    }
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await Order.create({
      _id: orderId,
      customer: { name, email, phone, address, city, pincode },
      items,
      subtotal,
      discount,
      couponCode: body.couponCode ? String(body.couponCode) : undefined,
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
    const r = await Order.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean();
    if (!r) {
      res.status(404).json({ error: 'Order not found' });
      return;
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
