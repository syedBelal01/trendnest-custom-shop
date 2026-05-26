import { apiUrl } from '@/lib/api';

type PincodeLookupResult = {
  city: string;
  state?: string;
};

const cache = new Map<string, { value: PincodeLookupResult; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60_000;

function normalizePincode(p: string): string {
  return p.replace(/[^\d]/g, '').slice(0, 6);
}

export async function lookupIndianPincode(pincodeRaw: string): Promise<PincodeLookupResult | null> {
  const pincode = normalizePincode(pincodeRaw);
  if (pincode.length !== 6) return null;
  const cached = cache.get(pincode);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const fromApi = await lookupViaAppApi(pincode);
  if (fromApi) return remember(pincode, fromApi);

  return lookupViaPostalApi(pincode);
}

function remember(pincode: string, value: PincodeLookupResult): PincodeLookupResult {
  cache.set(pincode, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function normalizeLookupResult(data: any): PincodeLookupResult | null {
  const city = String(data?.city || '').trim();
  const state = String(data?.state || '').trim();
  if (!city) return null;
  return { city, state: state || undefined };
}

async function lookupViaAppApi(pincode: string): Promise<PincodeLookupResult | null> {
  try {
    const res = await fetch(apiUrl(`/api/pincode/${encodeURIComponent(pincode)}`), {
      method: 'GET',
      cache: 'force-cache',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return normalizeLookupResult(data);
  } catch {
    return null;
  }
}

async function lookupViaPostalApi(pincode: string): Promise<PincodeLookupResult | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`, {
      method: 'GET',
    });
    const data = (await res.json().catch(() => null)) as any;
    const first = Array.isArray(data) ? data[0] : null;
    const offices = first?.PostOffice;
    const po = Array.isArray(offices) ? offices[0] : null;
    const city = String(po?.District || po?.Block || '').trim();
    const state = String(po?.State || '').trim();
    if (!city) {
      return null;
    }
    return remember(pincode, { city, state: state || undefined });
  } catch {
    return null;
  }
}

