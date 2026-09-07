import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';
import { getAdminApiKey } from '@/lib/ordersApi';

export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type Vendor = {
  id: string;
  userId: string;
  storeName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan?: string;
  bankAccountHolder: string;
  bankAccountNumberMasked?: string;
  bankAccountNumber?: string;
  bankIfsc: string;
  bankName: string;
  status: VendorStatus;
  commissionPercent: number;
  rejectionReason?: string;
  adminNotes?: string;
  reviewedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type VendorApplyPayload = {
  storeName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
};

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
}

export async function fetchMyVendorApi(): Promise<Vendor | null> {
  const res = await fetch(apiUrl('/api/me/vendor'), {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return (data?.vendor as Vendor) ?? null;
}

export async function applyVendorApi(payload: VendorApplyPayload): Promise<Vendor> {
  const res = await fetch(apiUrl('/api/vendors/apply'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to submit application');
  if (!data?.vendor?.id) throw new Error('Invalid vendor response');
  return data.vendor as Vendor;
}

function adminHeaders(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = getAdminApiKey();
  if (key) h['X-Admin-Key'] = key;
  return h;
}

export async function fetchAdminVendorsApi(status?: VendorStatus | ''): Promise<Vendor[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(apiUrl(`/api/admin/vendors${q}`), {
    method: 'GET',
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data?.vendors) ? (data.vendors as Vendor[]) : [];
}

export async function patchAdminVendorApi(
  vendorId: string,
  patch: { status?: VendorStatus; commissionPercent?: number; rejectionReason?: string; adminNotes?: string }
): Promise<Vendor> {
  const res = await fetch(apiUrl(`/api/admin/vendors/${encodeURIComponent(vendorId)}`), {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update vendor');
  if (!data?.vendor?.id) throw new Error('Invalid vendor response');
  return data.vendor as Vendor;
}
