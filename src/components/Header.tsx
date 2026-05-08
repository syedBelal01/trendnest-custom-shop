import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { categories as storefrontCategories } from '@/data/mockData';
import { useSaleBanners } from '@/contexts/SaleBannersContext';

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

function saleSlugify(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function countdownTo(endDateIso: string, nowMs: number) {
  const endMs = new Date(endDateIso).getTime();
  if (!Number.isFinite(endMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const diff = Math.max(0, endMs - nowMs);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export default function Header() {
  const { itemCount } = useCart();
  const { user } = useAuth();
  const { activeBanners } = useSaleBanners();
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const navigate = useNavigate();

  const mobileCategories = useMemo(() => {
    const seen = new Set<string>();
    return storefrontCategories.filter((category) => {
      const id = String(category.id || '').trim().toLowerCase();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, []);

  const closeMobileMenu = () => {
    setMobileOpen(false);
    setMobileCategoriesOpen(false);
  };

  const liveSale = activeBanners[0] || null;
  const liveSaleSlug = useMemo(() => {
    if (!liveSale) return '';
    return saleSlugify(liveSale.slug || liveSale.title || liveSale.id || '');
  }, [liveSale]);
  const liveSaleLink = liveSaleSlug ? `/sale/${liveSaleSlug}` : '/';
  const saleCountdown = useMemo(
    () => (liveSale ? countdownTo(String(liveSale.endDate || ''), nowMs) : null),
    [liveSale, nowMs]
  );

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
    closeMobileMenu();
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setMobileCategoriesOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      setMobileCategoriesOpen(false);
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!liveSale) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [liveSale]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
      {liveSale ? (
        <div
          className={`border-b px-2 py-2.5 sm:px-4 sm:py-3 ${
            liveSale.theme === 'summer'
              ? 'bg-gradient-to-r from-amber-200 via-yellow-100 to-orange-100 border-amber-200'
              : 'bg-orange-50 border-orange-100'
          }`}
        >
          <div className="mx-auto max-w-7xl text-sm sm:text-base">
            <div className="flex flex-nowrap items-center justify-between gap-2">
              <div className="min-w-0 truncate whitespace-nowrap text-xs font-semibold text-slate-900 sm:text-base">
                <span className={liveSale.theme === 'summer' ? 'animate-pulse' : ''} aria-hidden>
                  {liveSale.theme === 'summer' ? '☀️' : '🔥'}
                </span>{' '}
                {liveSale.bannerText?.trim() || `${liveSale.title} is Live!`}{' '}
                {liveSale.discountText?.trim() ? <span className="font-bold">{liveSale.discountText}</span> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {saleCountdown ? (
                  <div className="hidden items-center gap-1.5 text-xs font-semibold text-slate-700 lg:flex">
                    <span className="mr-1 hidden text-slate-800 sm:inline">Ends in:</span>
                    <span className="hidden rounded bg-white/90 px-2 py-0.5 sm:inline">
                      {String(saleCountdown.days).padStart(2, '0')}d
                    </span>
                    <span className="hidden rounded bg-white/90 px-2 py-0.5 sm:inline">
                      {String(saleCountdown.hours).padStart(2, '0')}h
                    </span>
                    <span className="rounded bg-white/90 px-2 py-0.5">{String(saleCountdown.minutes).padStart(2, '0')}m</span>
                    <span className="rounded bg-white/90 px-2 py-0.5">{String(saleCountdown.seconds).padStart(2, '0')}s</span>
                  </div>
                ) : null}
                <Link
                  to={liveSaleLink}
                  className="whitespace-nowrap rounded-md bg-orange-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-orange-700 sm:px-4 sm:py-2 sm:text-sm"
                >
                  {liveSale.ctaText?.trim() || 'Shop Now'}
                </Link>
              </div>
            </div>
            {saleCountdown ? (
              <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-700 lg:hidden">
                <span className="mr-1 text-slate-800">Ends in:</span>
                <span className="rounded bg-white/90 px-1.5 py-0.5">{String(saleCountdown.days).padStart(2, '0')}d</span>
                <span className="rounded bg-white/90 px-1.5 py-0.5">{String(saleCountdown.hours).padStart(2, '0')}h</span>
                <span className="rounded bg-white/90 px-1.5 py-0.5">{String(saleCountdown.minutes).padStart(2, '0')}m</span>
                <span className="rounded bg-white/90 px-1.5 py-0.5">{String(saleCountdown.seconds).padStart(2, '0')}s</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-8">
        <Link to="/" className="text-xl font-extrabold tracking-tight">
          Trend<span className="text-orange-600">Nest</span>99
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium text-slate-700 md:flex">
          <NavLink to="/category/home" className={desktopNavClass}>
            {({ isActive }) => (
              <>
                Home & Kitchen
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
          onClick={closeMobileMenu}
        />

        <div
          className="absolute top-0 inset-x-0 max-h-[100dvh] overflow-y-auto bg-white border-b shadow-lg transition-transform duration-200 ease-out"
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
              onClick={closeMobileMenu}
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
                to="/"
                end
                onClick={closeMobileMenu}
                className={mobileNavClass}
              >
                Home
              </NavLink>
              <button
                type="button"
                aria-expanded={mobileCategoriesOpen}
                onClick={() => setMobileCategoriesOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition hover:bg-slate-100"
              >
                <span>Categories</span>
                <span
                  aria-hidden
                  className={`inline-block text-xs text-slate-500 transition-transform duration-200 ${
                    mobileCategoriesOpen ? 'rotate-90' : 'rotate-0'
                  }`}
                >
                  &gt;
                </span>
              </button>
              <div
                className={`grid transition-all duration-200 ease-out ${
                  mobileCategoriesOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-80'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="mb-1 ml-2 space-y-1 border-l border-slate-200 pl-2">
                    {mobileCategories.map((category) => (
                      <NavLink
                        key={category.id}
                        to={`/category/${category.id}`}
                        onClick={closeMobileMenu}
                        className={({ isActive }) =>
                          `block rounded-md px-3 py-2 text-sm transition ${
                            isActive ? 'bg-orange-50 font-bold text-orange-700' : 'text-slate-700 hover:bg-slate-100'
                          }`
                        }
                      >
                        {category.name}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
              <NavLink
                to="/custom-print"
                onClick={closeMobileMenu}
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
