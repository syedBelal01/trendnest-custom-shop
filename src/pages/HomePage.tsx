import React from "react";
import { Link } from "react-router-dom";
import HeroCarousel from "@/components/HeroCarousel";
import { categories as mockCategories } from "@/data/mockData";
import { useProducts } from "@/contexts/ProductsContext";
import { useCart } from "@/contexts/CartContext";
import { productPrimaryImage } from "@/lib/productImages";
import { productVariantNames } from "@/lib/productVariants";
import { type RatingSummary } from "@/lib/reviewsSummaryApi";
import type { Product } from "@/types";
import { Helmet } from "react-helmet-async";

const Icon = ({ children, className = "", size = 20 }) => (
  <span
    className={`inline-flex items-center justify-center ${className}`}
    style={{ width: size, height: size, fontSize: size }}
  >
    {children}
  </span>
);

const icons = {
  search: "⌕",
  cart: "🛒",
  user: "👤",
  heart: "♡",
  star: "★",
  truck: "🚚",
  shield: "🛡️",
  headset: "🎧",
  return: "↻",
  home: "🏠",
  shirt: "👕",
  flame: "🔥",
  gift: "🎁",
  send: "➤",
  instagram: "◎",
  facebook: "f",
  youtube: "▶",
  whatsapp: "☘",
  package: "📦",
  percent: "%",
  tag: "🏷️",
  phone: "📱",
};

const CANONICAL_BASE = "https://trendnest99.in";
const HOME_OG_IMAGE = `${CANONICAL_BASE}/img3.jpeg`;
const HOME_TITLE = "Printed T-Shirts, Graphic Tees & Custom Print Store | TrendNest99";
const HOME_DESC =
  "Shop printed t-shirts, men's oversized graphic tees, custom print products, trending fashion, and home essentials online in India at TrendNest99.";
const HOME_KEYWORDS = [
  "printed t shirt",
  "printed shirt",
  "men's oversized graphic t-shirt",
  "graphic streetwear tee",
  "custom print t shirt",
  "trendnest99",
].join(", ");

function discountPercent(product: Product) {
  const mrp = product.originalPrice;
  if (!mrp || mrp <= 0) return 0;
  if (mrp <= product.price) return 0;
  return Math.round(((mrp - product.price) / mrp) * 100);
}

function ProductCard({ product, ratingSummary }: { product: Product; ratingSummary: Record<string, RatingSummary> }) {
  const { addItem } = useCart();
  const summary = ratingSummary?.[product.id];
  const avg = summary?.avgRating ?? product.rating ?? 0;
  const reviewCount = summary?.reviewCount ?? product.reviews?.length ?? 0;
  const dp = discountPercent(product);
  const filledStars = Math.max(0, Math.min(5, Math.round(Number(avg) || 0)));

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <Link to={`/product/${product.id}`} className="block relative aspect-square overflow-hidden rounded-t-2xl bg-slate-100">
        <img
          src={productPrimaryImage(product)}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {dp > 0 && (
          <span className="absolute left-3 top-3 rounded-md bg-orange-600 px-2.5 py-1 text-xs font-bold text-white">{dp}% OFF</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-700 shadow-sm transition hover:text-orange-600"
        >
          <Icon size={18}>{icons.heart}</Icon>
        </button>
      </Link>
      <div className="p-4">
        <Link to={`/product/${product.id}`} className="block">
          <h3 className="line-clamp-1 text-sm font-bold text-slate-900 transition-colors hover:text-orange-600">{product.name}</h3>
        </Link>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-lg font-extrabold text-slate-900">₹{product.price}</span>
          {product.originalPrice ? <span className="text-xs text-slate-400 line-through">₹{product.originalPrice}</span> : null}
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <div className="flex text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Icon key={i} size={12} className={i < filledStars ? "text-amber-400" : "text-slate-200"}>
                {i < filledStars ? icons.star : "☆"}
              </Icon>
            ))}
          </div>
          <span>{avg.toFixed(1)} ({reviewCount} reviews)</span>
        </div>
        <button
          type="button"
          onClick={() => addItem({
            product,
            quantity: 1,
            selectedSize: product.sizes?.[0],
            selectedVariant: product.variantModel?.items?.[0]?.key ?? productVariantNames(product)[0],
            selectedSleeve: product.sleeveTypes?.[0],
          })}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 text-sm font-bold text-white transition hover:bg-orange-700 active:scale-[0.98]"
        >
          <Icon size={15}>{icons.cart}</Icon> Add to Cart
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, linkTo }: { icon: string; title: string; linkTo?: string }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-2"><Icon className="text-orange-600" size={24}>{icon}</Icon><h2 className="text-xl font-extrabold tracking-tight text-slate-950 md:text-2xl">{title}</h2></div>
      {linkTo ? (
        <Link
          to={linkTo}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-orange-600 transition hover:bg-orange-50 sm:text-sm"
        >
          View All <span aria-hidden>→</span>
        </Link>
      ) : (
        <button
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-orange-600 transition hover:bg-orange-50 sm:text-sm"
          type="button"
        >
          View All <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}

export default function HomePage() {
  const { products, ratingSummary } = useProducts();
  const trendingNow = products.filter(p => p.isTrending).slice(0, 4);
  const bestDeals = products.filter(p => p.isBestDeal).slice(0, 4);
  const dealsFallback = products.slice(0, 4);
  const deals = bestDeals.length ? bestDeals : dealsFallback;

  return (
    <>
      <Helmet>
        <title>{HOME_TITLE}</title>
        <meta name="description" content={HOME_DESC} />
        <meta name="keywords" content={HOME_KEYWORDS} />
        <meta name="robots" content="index,follow,max-image-preview:large" />
        <link rel="canonical" href={`${CANONICAL_BASE}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={HOME_TITLE} />
        <meta property="og:description" content={HOME_DESC} />
        <meta property="og:url" content={`${CANONICAL_BASE}/`} />
        <meta property="og:image" content={HOME_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={HOME_TITLE} />
        <meta name="twitter:description" content={HOME_DESC} />
        <meta name="twitter:image" content={HOME_OG_IMAGE} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "TrendNest99",
            url: `${CANONICAL_BASE}/`,
            potentialAction: {
              "@type": "SearchAction",
              target: `${CANONICAL_BASE}/search?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          })}
        </script>
      </Helmet>
      <div className="bg-white font-sans text-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-orange-100 p-6 shadow-sm md:p-14">
          <div className="absolute right-12 top-8 h-28 w-28 rounded-full bg-orange-200/40 blur-2xl" />
          <div className="absolute bottom-8 left-1/3 h-20 w-20 rounded-full bg-orange-300/20 blur-2xl" />
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="relative z-10"><span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-600 shadow-sm"><Icon size={15}>{icons.flame}</Icon> New Arrivals</span><h1 className="mt-6 max-w-xl text-5xl font-black leading-[0.95] tracking-tight text-slate-950 md:text-7xl">Style Meets <span className="text-orange-600">Affordability</span></h1><p className="mt-5 max-w-md text-base leading-7 text-slate-600">Discover trending fashion, home essentials and custom prints — all at unbeatable prices.</p><div className="mt-8 flex flex-wrap gap-3"><Link to="/category/trending" className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700">Shop Trending →</Link><Link to="/category/home" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50">Shop Style</Link></div></div>
            <div className="relative z-10 flex justify-center"><div className="relative flex aspect-square w-full max-w-md items-stretch justify-center rounded-full bg-gradient-to-br from-orange-200 to-orange-100 shadow-2xl shadow-orange-200/50"><div className="absolute bottom-8 h-20 w-64 rounded-[50%] bg-slate-900/10 blur-xl" /><div className="relative z-10 w-full h-full"><HeroCarousel /></div></div></div>
          </div>
        </section>

        <section className="mx-auto -mt-1 grid max-w-6xl grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-xl shadow-slate-200/70 md:-mt-2 md:grid-cols-4 md:p-5">
          {[[icons.truck, "Free Delivery", "Free delivery on all orders"], [icons.shield, "Secure Payments", "100% safe & secure"], [icons.headset, "24/7 Support", "We're here to help"], [icons.return, "Easy Returns", "Hassle-free returns"]].map(([icon, title, sub]) => <div key={title} className="flex items-center gap-3 border-slate-100 md:border-r last:md:border-r-0"><Icon size={28} className="shrink-0 text-orange-600">{icon}</Icon><div><p className="text-sm font-extrabold">{title}</p><p className="text-xs text-slate-500">{sub}</p></div></div>)}
        </section>

        <section className="mt-12"><SectionHeader icon={icons.flame} title="Trending Now" linkTo="/category/trending" /><div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{trendingNow.map((product) => <ProductCard key={product.id} product={product} ratingSummary={ratingSummary} />)}</div></section>

        <section className="mt-12"><SectionHeader icon={icons.tag} title="Shop by Category" /><div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">{mockCategories.map(({ id, name, description, image, icon }) => <Link key={id} to={`/category/${id}`} className="group relative h-44 overflow-hidden rounded-2xl shadow-sm"><img src={image} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" /><div className="absolute bottom-4 left-4 right-4 text-white"><Icon size={22} className="mb-2">{icon}</Icon><h3 className="font-extrabold">{name}</h3><p className="text-xs text-white/80">{description}</p></div></Link>)}</div></section>

        <section className="mt-12 rounded-3xl bg-orange-50/70 p-5 md:p-8"><SectionHeader icon={icons.gift} title="Best Deals" linkTo="/best-deals" /><div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{deals.map((product) => <ProductCard key={`deal-${product.id}`} product={product} ratingSummary={ratingSummary} />)}</div></section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2"><div className="relative overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-8 shadow-sm"><div className="flex items-center gap-5"><div className="grid h-24 w-24 place-items-center rounded-3xl bg-white shadow-lg"><Icon size={46} className="text-orange-600">{icons.shirt}</Icon></div><div><h3 className="text-2xl font-black">Upload Your Own Design</h3><p className="mt-2 text-sm leading-6 text-slate-600">Get your custom design printed on T-shirts & cups — starting at ₹499!</p><Link to="/custom-print" className="mt-4 inline-flex items-center justify-center w-fit rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white">Start Designing <span className="ml-1">→</span></Link></div></div></div><div className="relative overflow-hidden rounded-3xl bg-orange-600 p-8 text-white shadow-xl shadow-orange-500/20"><div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" /><div className="flex items-center gap-5"><div className="grid h-24 w-24 place-items-center rounded-3xl bg-white/15"><Icon size={48}>{icons.percent}</Icon></div><div><h3 className="text-2xl font-black">Use Code WELCOME10</h3><p className="mt-2 text-sm text-white/85">Get 10% off on your first order!</p><Link to="/category/trending" className="mt-4 inline-flex items-center justify-center w-fit rounded-xl bg-white px-5 py-3 text-sm font-bold text-orange-600">Shop Now <span className="ml-1">→</span></Link></div></div></div></section>
        </div>
      </div>
    </>
  );
}
