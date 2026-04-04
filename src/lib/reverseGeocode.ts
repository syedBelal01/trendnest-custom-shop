/**
 * Reverse geocode via OpenStreetMap Nominatim (browser).
 * Respect usage policy: no bulk calls; for checkout single lookups only.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
export type GeocodedAddress = {
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export async function reverseGeocodeLatLng(lat: number, lon: number): Promise<GeocodedAddress | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  const a = data.address || {};
  const parts = [a.house_number, a.road, a.neighbourhood, a.suburb].filter(Boolean);
  const line = parts.join(', ').trim();
  const city = (a.city || a.town || a.village || a.county || '').trim();
  const state = (a.state || '').trim();
  const rawPost = (a.postcode || '').replace(/\D/g, '').slice(0, 6);

  const address =
    line ||
    (data.display_name ? data.display_name.split(',').slice(0, 3).join(', ').trim() : '');

  if (!address && !city) return null;

  return {
    address,
    city,
    state,
    pincode: rawPost,
  };
}
