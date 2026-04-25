import { apiUrl } from '@/lib/api';
import type { Order, User } from '@/types';

const CLIENT_AUTH_STORAGE_KEY = 'tn_client_auth';

export function getStoredClientAuthToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(CLIENT_AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredClientAuthToken(token: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (token) sessionStorage.setItem(CLIENT_AUTH_STORAGE_KEY, token);
    else sessionStorage.removeItem(CLIENT_AUTH_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

/** Merge optional headers with `Authorization: Bearer` when a client token is stored (mobile / WebView cookie fallback). */
export function withAuthHeaders(init?: HeadersInit): HeadersInit {
  const token = getStoredClientAuthToken();
  if (!token) return init ?? {};
  const base = new Headers(init ?? undefined);
  if (!base.has('Authorization')) base.set('Authorization', `Bearer ${token}`);
  return base;
}

export async function emailExistsApi(email: string): Promise<boolean> {
  const u = email.trim();
  const res = await fetch(`${apiUrl('/api/auth/email-exists')}?email=${encodeURIComponent(u)}`, {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to check email');
  }
  return !!data.exists;
}

export async function requestCheckoutOtpApi(params: { email: string; name?: string; phone?: string }): Promise<{ challengeId: string }> {
  const res = await fetch(apiUrl('/api/auth/otp/request'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: params.email, purpose: 'checkout', name: params.name, phone: params.phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'OTP request failed');
  }
  return { challengeId: String(data.challengeId) };
}

export async function requestAuthOtpApi(params: { email: string; name?: string; phone?: string }): Promise<{ challengeId: string }> {
  const res = await fetch(apiUrl('/api/auth/otp/request'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: params.email, purpose: 'auth', name: params.name, phone: params.phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'OTP request failed');
  }
  return { challengeId: String(data.challengeId) };
}

export async function verifyOtpApi(params: {
  challengeId: string;
  code: string;
  name?: string;
  phone?: string;
}): Promise<{ user: User | null }> {
  const res = await fetch(apiUrl('/api/auth/otp/verify'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      challengeId: params.challengeId,
      code: params.code,
      name: params.name,
      phone: params.phone,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'OTP verification failed');
  }
  if (typeof data.authToken === 'string' && data.authToken) {
    setStoredClientAuthToken(data.authToken);
  }
  return { user: (data.user ?? null) as User | null };
}

export async function fetchMeApi(): Promise<User | null> {
  const res = await fetch(apiUrl('/api/auth/me'), {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    return null;
  }
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load auth user');
  }
  return (data.user ?? null) as User | null;
}

export async function logoutApi(): Promise<void> {
  const res = await fetch(apiUrl('/api/auth/logout'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Logout failed');
  }
  setStoredClientAuthToken(null);
}

export async function fetchMyOrdersApi(): Promise<Order[]> {
  const res = await fetch(apiUrl('/api/me/orders'), {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load orders');
  }
  return data as Order[];
}

export async function fetchMyOrderByIdApi(orderId: string): Promise<Order> {
  const res = await fetch(apiUrl(`/api/me/orders/${encodeURIComponent(orderId)}`), {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load order');
  }
  return data as Order;
}

export async function cancelMyOrderApi(orderId: string, reason: string): Promise<{ order: Order; message?: string }> {
  const res = await fetch(apiUrl(`/api/me/orders/${encodeURIComponent(orderId)}/cancel`), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to cancel order');
  return { order: (data.order ?? null) as Order, message: typeof data.message === 'string' ? data.message : undefined };
}

export type Address = NonNullable<import('@/types').User['addresses']>[number];

export async function fetchMyAddressesApi(): Promise<Address[]> {
  const res = await fetch(apiUrl('/api/me/addresses'), { credentials: 'include', headers: withAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load addresses');
  return (data.addresses ?? []) as Address[];
}

export async function addAddressApi(payload: Omit<Address, 'id'>): Promise<Address[]> {
  const res = await fetch(apiUrl('/api/me/addresses'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to add address');
  return (data.addresses ?? []) as Address[];
}

export async function updateAddressApi(id: string, payload: Partial<Omit<Address, 'id'>>): Promise<Address[]> {
  const res = await fetch(apiUrl(`/api/me/addresses/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update address');
  return (data.addresses ?? []) as Address[];
}

export async function deleteAddressApi(id: string): Promise<Address[]> {
  const res = await fetch(apiUrl(`/api/me/addresses/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete address');
  return (data.addresses ?? []) as Address[];
}

export async function setPasswordApi(params: {
  password: string;
  /** Required when the account already has a password (e.g. Settings). Omit for first-time set (OTP checkout / mustReset). */
  currentPassword?: string;
}): Promise<User | null> {
  const body: { password: string; currentPassword?: string } = { password: params.password };
  if (params.currentPassword !== undefined && params.currentPassword !== '') {
    body.currentPassword = params.currentPassword;
  }
  const res = await fetch(apiUrl('/api/auth/password/set'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to set password');
  }
  return (data.user ?? null) as User | null;
}

export async function loginApi(params: { email: string; password: string }): Promise<User | null> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Login failed');
  }
  if (typeof data.authToken === 'string' && data.authToken) {
    setStoredClientAuthToken(data.authToken);
  }
  return (data.user ?? null) as User | null;
}

export async function forgotPasswordOtpApi(params: { email: string }): Promise<{ challengeId: string | null }> {
  const res = await fetch(apiUrl('/api/auth/password/forgot'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email: params.email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to request OTP');
  }
  return { challengeId: data.challengeId ? String(data.challengeId) : null };
}

export async function resetPasswordApi(params: { challengeId: string; code: string; password: string }): Promise<User | null> {
  const res = await fetch(apiUrl('/api/auth/password/reset'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ challengeId: params.challengeId, code: params.code, password: params.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Password reset failed');
  }
  if (typeof data.authToken === 'string' && data.authToken) {
    setStoredClientAuthToken(data.authToken);
  }
  return (data.user ?? null) as User | null;
}
