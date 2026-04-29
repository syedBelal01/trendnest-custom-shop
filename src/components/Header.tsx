import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

const HeaderEmojiIcon = ({
  emoji,
  size = 18,
  className = '',
}: {
  emoji: string;
  size?: number;
  className?: string;
}) => (
  <span
    aria-hidden
    className={`inline-flex items-center justify-center ${className}`}
    style={{ width: size, height: size, fontSize: size }}
  >
    {emoji}
  </span>
);

export default function Header() {
  const { itemCount } = useCart();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
    `relative px-2 py-1 rounded-md transition-colors ${
      isActive ? 'text-orange-600 font-extrabold' : 'text-slate-700 hover:text-orange-600'
    }`;

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 text-sm font-medium rounded-md transition ${
      isActive ? 'bg-orange-50 text-orange-700 font-bold' : 'hover:bg-slate-100'
    }`;

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setSearch('');
    setMobileOpen(false);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-8">
        <Link to="/" className="text-xl font-extrabold tracking-tight">
          Trend<span className="text-orange-600">Nest</span>99
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium text-slate-700 md:flex">
          <NavLink to="/category/home" className={desktopNavClass}>
            {({ isActive }) => (
              <>
                Home
                {isActive ? <span className="absolute -bottom-2 left-2 right-2 h-0.5 rounded-full bg-orange-600" /> : null}
              </>
            )}
          </NavLink>
          <NavLink to="/category/printed" className={desktopNavClass}>
            {({ isActive }) => (
              <>
                Prints
                {isActive ? <span className="absolute -bottom-2 left-2 right-2 h-0.5 rounded-full bg-orange-600" /> : null}
              </>
            )}
          </NavLink>
          <NavLink to="/category/trending" className={desktopNavClass}>
            {({ isActive }) => (
              <>
                Trending
                {isActive ? <span className="absolute -bottom-2 left-2 right-2 h-0.5 rounded-full bg-orange-600" /> : null}
              </>
            )}
          </NavLink>
          <NavLink
            to="/custom-print"
            className={({ isActive }) =>
              `relative flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                isActive ? 'text-orange-700 font-extrabold bg-orange-50' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50/60'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span aria-hidden className="inline-flex items-center justify-center">
                  🔥
                </span>
                Custom Print
                {isActive ? <span className="absolute -bottom-2 left-2 right-2 h-0.5 rounded-full bg-orange-600" /> : null}
              </>
            )}
          </NavLink>
        </nav>

        <form
          onSubmit={onSearchSubmit}
          className="hidden w-80 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm md:flex"
        >
          <HeaderEmojiIcon emoji="⌕" size={17} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Search products..."
          />
        </form>

        <Link to="/cart" className="relative ml-auto grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 md:ml-0">
          <HeaderEmojiIcon emoji="🛒" size={20} className="text-slate-800" />
          {itemCount > 0 && (
            <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-orange-600 text-xs font-bold text-white">
              {itemCount}
            </span>
          )}
        </Link>

        <Link
          to={user ? '/account' : '/login'}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100"
          aria-label={user ? 'Account' : 'Login'}
        >
          <HeaderEmojiIcon emoji="👤" size={20} className="text-slate-800" />
        </Link>

        {/* Mobile menu button */}
        <button
          type="button"
          className="md:hidden grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100 ml-1"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <HeaderEmojiIcon emoji="☰" size={20} className="text-slate-800" />
        </button>
      </div>

      {/* Mobile menu - full overlay so taps anywhere outside close it */}
      <div
        className={`md:hidden fixed inset-0 z-[60] transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 w-full h-full cursor-default bg-black/40"
          onClick={() => setMobileOpen(false)}
        />

        <div
          className="absolute top-0 inset-x-0 bg-white border-b shadow-lg transition-transform duration-200 ease-out"
          style={{ transform: mobileOpen ? 'translateY(0)' : 'translateY(-100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-14 flex items-center justify-between px-3 border-b">
            <span className="font-extrabold text-lg">
              Trend<span className="text-orange-600">Nest</span>99
            </span>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <HeaderEmojiIcon emoji="✕" size={18} className="text-slate-800" />
            </button>
          </div>

          <div className="px-3 py-3 space-y-3">
            <form
              onSubmit={onSearchSubmit}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm"
            >
              <HeaderEmojiIcon emoji="⌕" size={17} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search products..."
              />
            </form>

            <div className="space-y-1">
              <NavLink
                to="/category/home"
                onClick={() => setMobileOpen(false)}
                className={mobileNavClass}
              >
                Home
              </NavLink>
              <NavLink
                to="/category/printed"
                onClick={() => setMobileOpen(false)}
                className={mobileNavClass}
              >
                Prints
              </NavLink>
              <NavLink
                to="/category/trending"
                onClick={() => setMobileOpen(false)}
                className={mobileNavClass}
              >
                Trending
              </NavLink>
              <NavLink
                to="/custom-print"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition ${
                    isActive ? 'bg-orange-50 text-orange-700 font-bold' : 'hover:bg-slate-100 text-orange-600'
                  }`
                }
              >
                <span aria-hidden className="inline-flex items-center justify-center">🔥</span> Custom Print
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
