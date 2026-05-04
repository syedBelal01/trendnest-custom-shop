import { useMemo, type CSSProperties } from 'react';
import { useSaleBanners } from '@/contexts/SaleBannersContext';

const FAR_PARTICLE_COUNT = 16;
const NEAR_PARTICLE_COUNT = 10;

type ParticleStyle = CSSProperties & {
  ['--sale-x']?: string;
  ['--sale-delay']?: string;
  ['--sale-duration']?: string;
  ['--sale-size']?: string;
};

export default function GlobalSaleThemeLayer() {
  const { activeTheme } = useSaleBanners();

  const farParticles = useMemo(() => {
    return Array.from({ length: FAR_PARTICLE_COUNT }, (_, i) => {
      const x = ((i * 83) % 100) + 1;
      const size = 3 + (i % 4) * 1.75;
      const delay = (i % 7) * 0.9;
      const duration = 12 + (i % 6) * 1.7;
      const style: ParticleStyle = {
        '--sale-x': `${x}%`,
        '--sale-size': `${size}px`,
        '--sale-delay': `${delay}s`,
        '--sale-duration': `${duration}s`,
      };
      return style;
    });
  }, []);

  const nearParticles = useMemo(() => {
    return Array.from({ length: NEAR_PARTICLE_COUNT }, (_, i) => {
      const x = ((i * 61 + 17) % 100) + 1;
      const size = 7 + (i % 4) * 2.5;
      const delay = (i % 5) * 0.65;
      const duration = 7 + (i % 4) * 1.2;
      const style: ParticleStyle = {
        '--sale-x': `${x}%`,
        '--sale-size': `${size}px`,
        '--sale-delay': `${delay}s`,
        '--sale-duration': `${duration}s`,
      };
      return style;
    });
  }, []);

  if (!activeTheme) return null;

  return (
    <div aria-hidden className={`sale-theme-layer sale-theme-${activeTheme}`}>
      <div className="sale-theme-gradient" />
      <div className="sale-theme-aurora" />
      <div className="sale-theme-ribbons">
        <span className="sale-theme-ribbon sale-theme-ribbon-a" />
        <span className="sale-theme-ribbon sale-theme-ribbon-b" />
      </div>
      <div className="sale-theme-particles sale-theme-particles-far">
        {farParticles.map((style, i) => (
          <span key={`far-${i}`} className="sale-theme-particle sale-theme-particle-far" style={style} />
        ))}
      </div>
      <div className="sale-theme-particles sale-theme-particles-near">
        {nearParticles.map((style, i) => (
          <span key={`near-${i}`} className="sale-theme-particle sale-theme-particle-near" style={style} />
        ))}
      </div>
    </div>
  );
}
