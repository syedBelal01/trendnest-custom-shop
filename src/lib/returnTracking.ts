import type { OrderReturnReverseShipment } from '@/types';

/**
 * Public tracking URL for a return reverse shipment (AWB).
 * Shiprocket-originated returns use Shiprocket’s tracker; other AWBs use 17TRACK as a generic fallback.
 */
export function returnShipmentTrackingUrl(rs?: OrderReturnReverseShipment | null): string | null {
  const awb = rs?.awb?.trim();
  if (!awb) return null;
  const blob = [rs?.provider, rs?.source].map(s => String(s || '').toLowerCase()).join(' ');
  if (blob.includes('shiprocket')) {
    return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
  }
  return `https://www.17track.net/en/track?nums=${encodeURIComponent(awb)}`;
}

export function returnHasPostApprovalTracking(ret: { status: string; reverseShipment?: OrderReturnReverseShipment | null }): boolean {
  return ['approved', 'picked_up', 'received', 'refunded'].includes(ret.status);
}
