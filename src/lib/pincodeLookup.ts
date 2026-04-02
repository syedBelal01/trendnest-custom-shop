type PincodeLookupResult = {
  city: string;
  state?: string;
};

const cache = new Map<string, PincodeLookupResult | null>();

function normalizePincode(p: string): string {
  return p.replace(/[^\d]/g, '').slice(0, 6);
}

export async function lookupIndianPincode(pincodeRaw: string): Promise<PincodeLookupResult | null> {
  const pincode = normalizePincode(pincodeRaw);
  if (pincode.length !== 6) return null;
  if (cache.has(pincode)) return cache.get(pincode) ?? null;

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
      cache.set(pincode, null);
      return null;
    }
    const out = { city, state: state || undefined };
    cache.set(pincode, out);
    return out;
  } catch {
    cache.set(pincode, null);
    return null;
  }
}

