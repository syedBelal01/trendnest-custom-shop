import { Link } from 'react-router-dom';
import { products, categories } from '@/data/mockData';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { ArrowRight, Truck, Shield, Headphones } from 'lucide-react';

export default function HomePage() {
  const trending = products.filter(p => p.isTrending).slice(0, 4);
  const deals = products.filter(p => p.originalPrice).slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 space-y-6">
            <span className="inline-block bg-primary/10 text-primary text-sm font-semibold px-4 py-1.5 rounded-full">🔥 New Arrivals</span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">Style Meets <br /><span className="text-primary">Affordability</span></h1>
            <p className="text-muted-foreground text-lg max-w-md">Discover trending fashion, home essentials & custom prints — all at unbeatable prices.</p>
            <div className="flex gap-3">
              <Link to="/category/trending"><Button size="lg" className="gap-2">Shop Trending <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/category/fashion"><Button size="lg" variant="outline">Explore Fashion</Button></Link>
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="aspect-square max-w-md mx-auto rounded-2xl overflow-hidden shadow-2xl">
              <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600" alt="TrendNest99 Hero" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Features bar */}
      <section className="border-y bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Truck, label: 'Free Delivery', desc: 'Orders above ₹499' },
            { icon: Shield, label: 'Secure Payments', desc: 'Cash on Delivery' },
            { icon: Headphones, label: '24/7 Support', desc: 'WhatsApp support' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3 justify-center">
              <f.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Shop by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map(c => (
            <Link key={c.id} to={`/category/${c.id}`} className="group relative aspect-[4/3] rounded-xl overflow-hidden border">
              <img src={c.image} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
              <div className="absolute bottom-3 left-3 text-background">
                <p className="text-lg font-bold">{c.icon} {c.name}</p>
                <p className="text-xs opacity-80">{c.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">🔥 Trending Now</h2>
          <Link to="/category/trending" className="text-primary text-sm font-medium hover:underline">View All →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {trending.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Deals */}
      <section className="bg-primary/5 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">💰 Best Deals</h2>
            <Link to="/category/fashion" className="text-primary text-sm font-medium hover:underline">View All →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {deals.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* Custom Print CTA */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="border-2 border-dashed border-primary/30 rounded-2xl p-8 md:p-12 text-center bg-primary/5">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">🎨 Upload Your Own Design</h2>
          <p className="text-muted-foreground text-lg mb-4">Get your custom design printed on T-shirts & mugs — starting at ₹499!</p>
          <Link to="/custom-print"><Button size="lg" className="gap-2">Start Designing <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </section>

      {/* Offer Banner */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-primary rounded-2xl p-8 md:p-12 text-primary-foreground text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Use Code WELCOME10</h2>
          <p className="text-lg opacity-90 mb-4">Get 10% off on your first order!</p>
          <Link to="/category/trending"><Button variant="secondary" size="lg">Shop Now</Button></Link>
        </div>
      </section>
    </div>
  );
}
