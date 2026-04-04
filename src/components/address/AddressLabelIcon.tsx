import { Building2, Home, MapPin } from 'lucide-react';

export function AddressLabelIcon({ label, className }: { label: string; className?: string }) {
  const l = label.trim().toLowerCase();
  if (l === 'home') return <Home className={className} />;
  if (l === 'work') return <Building2 className={className} />;
  return <MapPin className={className} />;
}
