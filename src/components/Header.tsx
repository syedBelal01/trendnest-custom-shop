import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Menu, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

const navLinks = [
  { label: 'Home', to: '/category/home' },
  { label: 'Prints', to: '/category/printed' },
  { label: 'Trending', to: '/category/trending' },
  { label: '🎨 Custom Print', to: '/custom-print' },
];

export default function Header() {
  const { itemCount } = useCart();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
      setSearch('');
      setMobileOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
        <Link to="/" className="font-bold text-lg sm:text-xl tracking-tight shrink-0" style={{ fontFamily: 'Space Grotesk' }}>
          Trend<span className="text-primary">Nest</span>99
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent">
              {l.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-sm ml-auto">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-9 h-9" />
          </div>
        </form>

        <Link to="/cart" className="relative ml-auto sm:ml-0">
          <Button variant="ghost" size="icon" className="relative h-10 w-10">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-semibold">{itemCount}</span>
            )}
          </Button>
        </Link>

        <Link to={user ? '/account' : '/login'} className="ml-1 sm:ml-2">
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={user ? 'Account' : 'Login'}>
            <User className="h-5 w-5" />
          </Button>
        </Link>

        <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          {/* Tap anywhere outside to close */}
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 z-40 cursor-default bg-black/20"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="md:hidden relative z-50 border-t bg-background px-3 py-3 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSearch} className="sm:hidden mb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-10" />
              </div>
            </form>
            {navLinks.map(l => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium rounded-md hover:bg-accent active:bg-accent/80"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </header>
  );
}
