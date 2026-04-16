import { Link } from 'react-router-dom';
import { categories } from '@/data/mockData';
import { useProducts } from '@/contexts/ProductsContext';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { ArrowRight, Truck, Shield, Headphones } from 'lucide-react';
import HeroCarousel from '@/components/HeroCarousel';
import { Helmet } from 'react-helmet-async';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/api';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';

const CANONICAL_BASE = 'https://trendnest99.in';

export default function HomePage() {
  const { products, loading } = useProducts();
  const showSkeleton = useDelayedFlag(loading, 250);
  const trending = products.filter(p => p.isTrending).slice(0, 4);
  const deals = products.filter(p => p.originalPrice).slice(0, 4);
  const fashion = products.filter(p => p.category === 'fashion');

  return (
    <div>
      <Helmet>
        <title>TrendNest99 | Trendy Fashion, Home Essentials & Custom Prints</title>
        <meta
          name="description"
          content="Shop trending fashion, home essentials, and custom print products at great prices. Cash on delivery available across India."
        />
        <link rel="canonical" href={`${CANONICAL_BASE}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="TrendNest99 | Trendy Fashion, Home Essentials & Custom Prints" />
        <meta
          property="og:description"
          content="Shop trending fashion, home essentials, and custom print products at great prices. Cash on delivery available across India."
        />
        <meta property="og:url" content={`${CANONICAL_BASE}/`} />
        <meta property="og:image" content={`${CANONICAL_BASE}/img3.jpeg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${CANONICAL_BASE}/img3.jpeg`} />
      </Helmet>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-16 md:py-24 flex flex-col md:flex-row items-center gap-6 sm:gap-8">
          <div className="flex-1 space-y-4 sm:space-y-6 text-center md:text-left">
            <span className="inline-block bg-primary/10 text-primary text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full">🔥 New Arrivals</span>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight">Style Meets <br /><span className="text-primary">Affordability</span></h1>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-md mx-auto md:mx-0">Discover trending fashion, home essentials & custom prints — all at unbeatable prices.</p>
            <div className="flex gap-3 justify-center md:justify-start">
              <Link to="/category/trending"><Button size="lg" className="gap-2 h-10 sm:h-11 text-sm sm:text-base px-4 sm:px-6">Shop Trending <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="#fashion-picks"><Button size="lg" variant="outline" className="h-10 sm:h-11 text-sm sm:text-base px-4 sm:px-6">Shop Style</Button></Link>
            </div>
          </div>
          <div className="flex-1 relative w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto">
            <HeroCarousel />
          </div>
        </div>
      </section>

      {/* Features bar */}
      <section className="border-y bg-card">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            { icon: Truck, label: 'Free Delivery', desc: 'Orders above ₹499' },
            { icon: Shield, label: 'Secure Payments', desc: 'Cash on Delivery' },
            { icon: Headphones, label: '24/7 Support', desc: 'WhatsApp support' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3 justify-center">
              <f.icon className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fashion */}
      <section id="fashion-picks" className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12 scroll-mt-20">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">👔 Style & Apparel</h2>
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">Curated on your home page</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {showSkeleton
            ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={`fashion-skel-${i}`} />)
            : fashion.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Shop by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 max-w-5xl">
          {categories.map(c => (
            <Link key={c.id} to={`/category/${c.id}`} className="group relative aspect-[4/3] rounded-xl overflow-hidden border">
              <img
                src={c.image}
                alt={c.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  img.src = DEFAULT_PRODUCT_IMAGE;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
              <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 text-background">
                <p className="text-sm sm:text-lg font-bold">{c.icon} {c.name}</p>
                <p className="text-[10px] sm:text-xs opacity-80 line-clamp-1">{c.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">🔥 Trending Now</h2>
          <Link to="/category/trending" className="text-primary text-xs sm:text-sm font-medium hover:underline">View All →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {showSkeleton
            ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={`trending-skel-${i}`} />)
            : trending.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Deals */}
      <section className="bg-primary/5 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold">💰 Best Deals</h2>
            <Link to="/category/trending" className="text-primary text-xs sm:text-sm font-medium hover:underline">View All →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {showSkeleton
              ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={`deals-skel-${i}`} />)
              : deals.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* Custom Print CTA */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="border-2 border-dashed border-primary/30 rounded-2xl p-5 sm:p-8 md:p-12 text-center bg-primary/5">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">🎨 Upload Your Own Design</h2>
          <p className="text-muted-foreground text-sm sm:text-lg mb-4">Get your custom design printed on T-shirts & cups — starting at ₹499!</p>
          <Link to="/custom-print"><Button size="lg" className="gap-2 h-10 sm:h-11 text-sm sm:text-base">Start Designing <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </section>

      {/* Offer Banner */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="bg-primary rounded-2xl p-5 sm:p-8 md:p-12 text-primary-foreground text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Use Code WELCOME10</h2>
          <p className="text-sm sm:text-lg opacity-90 mb-4">Get 10% off on your first order!</p>
          <Link to="/category/trending"><Button variant="secondary" size="lg" className="h-10 sm:h-11 text-sm sm:text-base">Shop Now</Button></Link>
        </div>
      </section>
    </div>
  );
}
