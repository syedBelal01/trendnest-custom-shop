import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { existsSync, readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// vite-plugin-prerender's ESM entry uses require internally; load the CJS entry instead.
const vitePrerender: typeof import("vite-plugin-prerender").default = require("vite-plugin-prerender");
const modernPuppeteer: typeof import("puppeteer") = require("puppeteer");

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const CANONICAL_BASE = "https://trendnest99.in";
  const isVercel = !!process.env.VERCEL;
  const isCi = isVercel || !!process.env.CI;
  const useSparticuzChromium = isVercel && process.platform !== "win32";

  // Vercel's build environment often can't launch Puppeteer's bundled Chromium.
  // Use a serverless-compatible Chromium + puppeteer-core when building on Vercel.
  const chromium = useSparticuzChromium ? (require("@sparticuz/chromium") as any) : null;
  const puppeteerForRenderer = useSparticuzChromium ? (require("puppeteer-core") as any) : modernPuppeteer;

  function xmlEscape(s: string) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function escapeAttr(s: string) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function seoClean(input: unknown) {
    return String(input || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function productLongTailKeyword(p: { name?: string; category?: string; subcategory?: string }) {
    const name = seoClean(p.name);
    const category = seoClean(p.category);
    const subcategory = seoClean(p.subcategory);
    if (category === "printed") {
      if (name.includes("cup") || name.includes("mug")) return "custom printed cup online india";
      return "printed t shirt online india";
    }
    if (subcategory.includes("belt") || name.includes("belt")) return "men leather belt online india";
    if (category === "fashion") return "mens fashion accessories online india";
    if (category === "home") return "home essentials online india";
    if (category === "electronics") return "electronics accessories online india";
    return "online shopping india";
  }

  function productSeoSlug(p: { name?: string; category?: string; subcategory?: string }) {
    const raw = `${p.name || ""} ${productLongTailKeyword(p)} trendnest99`;
    const slug = seoClean(raw)
      .split(" ")
      .filter(Boolean)
      .slice(0, 14)
      .join("-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "product";
  }

  function ensureMetaDescription(v: string, max = 160, min = 120) {
    let cleaned = String(v || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) {
      cleaned =
        "Shop printed t-shirts, graphic tees, and custom prints online in India. TrendNest99 offers fashion, home essentials, and daily deals with fast delivery.";
    }
    if (cleaned.length < min) {
      cleaned = `${cleaned} Shop online in India with TrendNest99.`.trim();
    }
    if (cleaned.length <= max) return cleaned;
    return `${cleaned.slice(0, max - 1).trimEnd()}...`;
  }

  type PrerenderProduct = {
    id: string;
    name?: string;
    description?: string;
    images?: string[];
    price?: number;
    originalPrice?: number;
    category?: string;
    subcategory?: string;
    rating?: number;
    reviewCount?: number;
    slug?: string;
  };

  async function getPrerenderData(): Promise<{
    routes: string[];
    productById: Record<string, PrerenderProduct>;
    productBySlug: Record<string, PrerenderProduct>;
  }> {
    const baseStaticRoutes = [
      "/",
      "/best-deals",
      "/custom-print",
      "/category/new-arrivals",
      "/category/summer",
      "/category/deal-of-the-day",
      "/category/kitchen",
      "/category/car-motorbike",
      "/category/gardening",
      "/category/jewellery",
      "/category/gifts",
      "/category/electronics",
      "/category/home",
      "/category/kids-baby",
      "/category/health-beauty",
      "/category/printed",
      "/category/trending",
      "/category/fashion",
    ];

    const apiBase =
      (process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || "").replace(/\/+$/, "") ||
      "http://127.0.0.1:5050";

    const buildFromList = (list: Array<any>) => {
      const productById: Record<string, PrerenderProduct> = {};
      const productBySlug: Record<string, PrerenderProduct> = {};
      const categories = new Set<string>();
      for (const p of list || []) {
        const id = String(p?.id || "").trim();
        if (!id) continue;
        const row: PrerenderProduct = {
          id,
          name: typeof p?.name === "string" ? p.name : undefined,
          description: typeof p?.description === "string" ? p.description : undefined,
          images: Array.isArray(p?.images) ? p.images.map((u: any) => String(u)).filter(Boolean) : undefined,
          price: p?.price != null ? Number(p.price) : undefined,
          originalPrice: p?.originalPrice != null ? Number(p.originalPrice) : undefined,
          category: typeof p?.category === "string" ? p.category : undefined,
          subcategory: typeof p?.subcategory === "string" ? p.subcategory : undefined,
          rating: p?.rating != null ? Number(p.rating) : undefined,
          reviewCount:
            p?.reviewCount != null
              ? Number(p.reviewCount)
              : Array.isArray(p?.reviews)
                ? p.reviews.length
                : undefined,
        };
        row.slug = productSeoSlug(row);
        productById[id] = row;
        if (row.slug) productBySlug[row.slug] = row;
          if (row.category) categories.add(String(row.category));
          if (Array.isArray(p?.categories)) {
            for (const category of p.categories) {
              const c = String(category || "").trim();
              if (c) categories.add(c);
            }
          }
      }
      const categoryRoutes = Array.from(categories).map((c) => `/category/${encodeURIComponent(c)}`);
      const productRoutes = Array.from(new Set(Object.values(productById).map((p) => `/product/${encodeURIComponent(String(p.slug || p.id))}`)));
      const routes = Array.from(new Set([...baseStaticRoutes, ...categoryRoutes, ...productRoutes]));
      return { routes, productById, productBySlug };
    };

    try {
      const res = await fetch(`${apiBase}/api/products`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = (await res.json().catch(() => [])) as Array<any>;
      return buildFromList(list);
    } catch {
      // Fallback dataset: server/seed.json contains stable ids for builds when API isn't reachable.
      try {
        const raw = readFileSync(path.join(__dirname, "server", "seed.json"), "utf8");
        const seed = JSON.parse(raw) as Array<any>;
        return buildFromList(seed);
      } catch {
        return { routes: baseStaticRoutes, productById: {}, productBySlug: {} };
      }
    }
  }

  const prerenderData = mode === "production" ? await getPrerenderData() : { routes: [], productById: {}, productBySlug: {} };
  const prerenderRoutes = prerenderData.routes;

  const prerenderProxyTarget =
    mode === "production"
      ? ((process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || "https://trendnest-custom-shop.onrender.com") as string).replace(
          /\/+$/,
          ""
        )
      : "http://127.0.0.1:5050";

  function injectSeoHead(html: string, route: string): string {
    let canonicalUrl = route === "/" ? `${CANONICAL_BASE}/` : `${CANONICAL_BASE}${route}`;
    const stripHtml = (v: string) => String(v || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    // Defaults
    let title = "Printed Tees & Custom Prints | TrendNest99";
    let desc =
      "Shop printed t-shirts, graphic tees, and custom prints online in India. TrendNest99 offers fashion, home essentials, and daily deals with fast delivery.";
    let ogType = "website";
    let ogImage: string | undefined = `${CANONICAL_BASE}/og-share.jpg`;
    let keywords = "printed t shirt, printed shirt, graphic t shirt, custom print t shirt, trendnest99";
    const extraJsonLd: Record<string, unknown>[] = [];

    const clampTitle = (t: string, max = 60) => {
      const cleaned = String(t || "").replace(/\s+/g, " ").trim();
      if (!cleaned || cleaned.length <= max) return cleaned || "TrendNest99";
      const truncated = cleaned.slice(0, max - 1).trimEnd();
      const lastSpace = truncated.lastIndexOf(" ");
      const base = lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated;
      return `${base}…`;
    };

    const orgJsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "TrendNest99",
      url: CANONICAL_BASE,
      contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: "support@trendnest99.in" }],
    };
    const websiteJsonLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "TrendNest99",
      url: CANONICAL_BASE,
      potentialAction: {
        "@type": "SearchAction",
        target: `${CANONICAL_BASE}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    };

    const categoryMeta: Record<string, { name: string; description: string; keywords?: string }> = {
      "new-arrivals": { name: "New Arrivals", description: "Shop freshly added products and latest arrivals at TrendNest99." },
      summer: { name: "Summer", description: "Shop the Summer collection 2026 with seasonal essentials and fresh picks." },
      "deal-of-the-day": { name: "Deal of the Day", description: "Shop deal of the day bestsellers and limited-time offers." },
      kitchen: { name: "Kitchen", description: "Shop kitchen essentials, tools, storage, and everyday cooking accessories." },
      "car-motorbike": { name: "Car & Motorbike", description: "Shop car and motorbike accessories for everyday care and utility." },
      gardening: { name: "Gardening", description: "Shop gardening tools and outdoor essentials online." },
      jewellery: { name: "Jewellery", description: "Shop jewellery and everyday accessories online." },
      gifts: { name: "Gifts", description: "Shop useful gifts and thoughtful picks for every occasion." },
      home: { name: "Home Essentials", description: "Shop home essentials for your kitchen, bath, and everyday living." },
      "kids-baby": { name: "Kids & Baby", description: "Shop kids and baby essentials for daily care and comfort." },
      "health-beauty": { name: "Health & Beauty", description: "Shop health and beauty essentials for everyday personal care." },
      printed: {
        name: "Printed T-Shirts & Graphic Shirts",
        description:
          "Shop printed T-shirts, printed shirts, and men's oversized graphic streetwear tees including back-print styles.",
        keywords:
          "printed t shirt, printed shirt, men's oversized graphic t-shirt, streetwear tee, broken rules back print",
      },
      trending: { name: "Trending", description: "Explore trending products picked by TrendNest99 customers." },
      fashion: { name: "Fashion", description: "Shop fashion products and accessories online." },
      electronics: { name: "Electronics", description: "Browse electronics and useful accessories online." },
    };

    const mCat = route.match(/^\/category\/([^/]+)$/);
    if (mCat) {
      const cid = decodeURIComponent(mCat[1]);
      const cm = categoryMeta[cid];
      title = clampTitle(cm ? `${cm.name} | TrendNest99` : "Products | TrendNest99");
      desc = ensureMetaDescription(cm ? `${cm.description}` : "Browse products online in India at TrendNest99 with secure checkout and fast delivery.");
      keywords = cm?.keywords || `${cid}, products online, trendnest99`;
      ogType = "website";
      extraJsonLd.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${CANONICAL_BASE}/` },
          { "@type": "ListItem", position: 2, name: cm?.name || cid, item: canonicalUrl },
        ],
      });
      extraJsonLd.push({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: cm?.name || "Products",
        description: desc,
        url: canonicalUrl,
        isPartOf: { "@type": "WebSite", name: "TrendNest99", url: `${CANONICAL_BASE}/` },
      });
    }

    const mProd = route.match(/^\/product\/([^/]+)$/);
    if (mProd) {
      const rawProductParam = decodeURIComponent(mProd[1]).trim();
      const productParam = rawProductParam.toLowerCase();
      const p =
        prerenderData.productBySlug[productParam] ||
        prerenderData.productById[rawProductParam] ||
        prerenderData.productById[productParam];
      if (p?.slug) {
        canonicalUrl = `${CANONICAL_BASE}/product/${encodeURIComponent(String(p.slug))}`;
      }
      const longTailKeyword = p ? productLongTailKeyword(p) : "online shopping india";
      title = clampTitle(p?.name ? `${p.name} | TrendNest99` : "Product | TrendNest99");
      const plain = p?.description ? stripHtml(String(p.description)) : "";
      desc = ensureMetaDescription(
        plain
          ? `${plain} Buy ${p?.name || "this product"} online in India from TrendNest99.`
          : `Buy ${longTailKeyword} products online in India from TrendNest99.`
      );
      ogType = "product";
      ogImage = p?.images?.[0] || ogImage;
      keywords = [p?.name, p?.category, longTailKeyword, "trendnest99"]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .join(", ");

      if (p?.name) {
        extraJsonLd.push({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          description: p.description || desc,
          image: p.images || [],
          brand: { "@type": "Brand", name: "TrendNest99" },
          category: p.category,
          ...(p.rating != null && p.reviewCount != null && Number(p.reviewCount) > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: Number(p.rating).toFixed(1),
                  reviewCount: String(p.reviewCount),
                },
              }
            : {}),
          offers: {
            "@type": "Offer",
            url: canonicalUrl,
            priceCurrency: "INR",
            price: p.price != null ? String(p.price) : undefined,
            availability: "https://schema.org/InStock",
          },
        });
        extraJsonLd.push({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${CANONICAL_BASE}/` },
            ...(p.category
              ? [
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: categoryMeta[p.category]?.name || p.category,
                    item: `${CANONICAL_BASE}/category/${encodeURIComponent(p.category)}`,
                  },
                  { "@type": "ListItem", position: 3, name: p.name, item: canonicalUrl },
                ]
              : [{ "@type": "ListItem", position: 2, name: p.name, item: canonicalUrl }]),
          ],
        });
      }
    }

    const tags = [
      `<title>${xmlEscape(title)}</title>`,
      `<meta name="description" content="${escapeAttr(desc)}">`,
      `<link rel="canonical" href="${escapeAttr(canonicalUrl)}">`,
      `<meta name="keywords" content="${escapeAttr(keywords)}">`,
      `<meta name="robots" content="index,follow,max-image-preview:large">`,
      `<meta property="og:type" content="${escapeAttr(ogType)}">`,
      `<meta property="og:site_name" content="TrendNest99">`,
      `<meta property="og:title" content="${escapeAttr(title)}">`,
      `<meta property="og:description" content="${escapeAttr(desc)}">`,
      `<meta property="og:url" content="${escapeAttr(canonicalUrl)}">`,
      ogImage ? `<meta property="og:image" content="${escapeAttr(String(ogImage))}">` : "",
      ogImage === `${CANONICAL_BASE}/og-share.jpg`
        ? `<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="TrendNest99 — printed tees and custom prints. Shop now.">`
        : ogImage
          ? `<meta property="og:image:alt" content="${escapeAttr(title)}">`
          : "",
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escapeAttr(title)}">`,
      `<meta name="twitter:description" content="${escapeAttr(desc)}">`,
      ogImage ? `<meta name="twitter:image" content="${escapeAttr(String(ogImage))}">` : "",
      `<script type="application/ld+json">${JSON.stringify(orgJsonLd)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(websiteJsonLd)}</script>`,
      ...extraJsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`),
    ]
      .filter(Boolean)
      .join("");

    // Replace existing title/description if present, then inject our canonical/OG/JSON-LD.
    let out = html;
    out = out.replace(/<title>[\s\S]*?<\/title>/gi, "");
    out = out.replace(/<meta name="description"[^>]*>/gi, "");
    out = out.replace(/<link rel="canonical"[^>]*>/gi, "");
    out = out.replace(/<meta name="keywords"[^>]*>/gi, "");
    out = out.replace(/<meta name="robots"[^>]*>/gi, "");
    out = out.replace(/<meta property="og:type"[^>]*>/gi, "");
    out = out.replace(/<meta property="og:site_name"[^>]*>/gi, "");
    out = out.replace(/<meta property="og:title"[^>]*>/gi, "");
    out = out.replace(/<meta property="og:description"[^>]*>/gi, "");
    out = out.replace(/<meta property="og:url"[^>]*>/gi, "");
    out = out.replace(/<meta property="og:image(?::[a-z_]+)?"[^>]*>/gi, "");
    out = out.replace(/<meta name="twitter:card"[^>]*>/gi, "");
    out = out.replace(/<meta name="twitter:title"[^>]*>/gi, "");
    out = out.replace(/<meta name="twitter:description"[^>]*>/gi, "");
    out = out.replace(/<meta name="twitter:image(?::alt)?"[^>]*>/gi, "");
    // Insert the rest right before </head>
    out = out.replace(/<\/head>/i, `${tags}</head>`);
    return out;
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: prerenderProxyTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode === "production" &&
        vitePrerender({
          staticDir: path.join(__dirname, "dist"),
          routes: prerenderRoutes,
          postProcess: (context: any) => {
            try {
              context.html = injectSeoHead(context.html, context.route);
            } catch {}
            return context;
          },
          // vite-plugin-prerender v1.x does not read a `rendererOptions` field; pass a renderer instance.
          renderer: new (vitePrerender as any).PuppeteerRenderer({
            headless: chromium?.headless ?? true,
            // Force a Chrome binary that exists in the environment.
            executablePath: await (async () => {
              try {
                if (useSparticuzChromium && chromium?.executablePath) {
                  const p = await chromium.executablePath();
                  return p ? String(p) : undefined;
                }
              } catch {
                // ignore
              }
              // Local dev/CI fallback: Puppeteer's downloaded Chrome.
              try {
                const p = puppeteerForRenderer?.executablePath?.();
                return p && existsSync(p) ? p : undefined;
              } catch {
                return undefined;
              }
            })(),
            // Vercel/CI environments need no-sandbox flags.
            args: useSparticuzChromium
              ? (chromium?.args ?? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
              : isCi
                ? ["--no-sandbox", "--disable-setuid-sandbox"]
                : undefined,
            // Wait for actual app content to exist in the DOM.
            renderAfterElementExists: "main",
            // Small buffer after the selector appears.
            renderAfterTime: 2500,
            maxConcurrentRoutes: isVercel ? 2 : 4,
            // Prefer load event; networkidle0 can hang on long-polling/analytics.
            navigationOptions: { waitUntil: "load", timeout: 120_000 },
            consoleHandler: (route: string, msg: any) => {
              try {
                const text = typeof msg?.text === "function" ? msg.text() : String(msg);
                const type = typeof msg?.type === "function" ? msg.type() : "";
                if (type === "error" || type === "warning") {
                  console.log(`[prerender:${route}] ${type}: ${text}`);
                }
              } catch {}
            },
            // Ensure renderer uses the right puppeteer implementation (core vs full).
            // renderer-puppeteer supports a `puppeteer` option; if ignored, it's still safe.
            puppeteer: puppeteerForRenderer,
          }),
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
