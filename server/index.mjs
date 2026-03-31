import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Always load .env from project root (folder above server/), not only from process.cwd()
dotenv.config({ path: join(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT) || 5050;
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

function serialize(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ flattenMaps: true, versionKey: false }) : { ...doc };
  const id = o._id;
  delete o._id;
  return { id, ...o };
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
    console.log(`API http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
