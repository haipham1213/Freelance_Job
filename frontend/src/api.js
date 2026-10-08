// Gọi API: access token chỉ giữ trong bộ nhớ (không localStorage); gặp 401 thì refresh 1 lần rồi gửi lại
let accessToken = null;
let onSessionLost = () => {};
let refreshing = null;

export const setAccessToken = (t) => { accessToken = t; };
export const setSessionLostHandler = (fn) => { onSessionLost = fn; };

export const refreshSession = () => {
  refreshing ||= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((j) => {
      accessToken = j?.data?.accessToken || null;
      return j?.data || null;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
};

const request = async (method, path, body, retry = true) => {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload;
  if (body instanceof Blob) {
    payload = body;
    headers['Content-Type'] = body.type || 'application/octet-stream';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(`/api/v1${path}`, { method, headers, body: payload, credentials: 'include' });
  } catch {
    throw Object.assign(new Error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.'), { code: 'NETWORK' });
  }
  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const session = await refreshSession();
    if (session) return request(method, path, body, false);
    onSessionLost();
  }
  if (res.status === 204) return {};
  const json = await res.json().catch(() => null);
  if (!json?.success) {
    const e = new Error(json?.error?.message || (res.status >= 500 ? 'Máy chủ đang gặp sự cố, thử lại sau' : 'Có lỗi xảy ra'));
    Object.assign(e, { code: json?.error?.code, status: res.status, details: json?.error?.details });
    throw e;
  }
  return json;
};

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};

export const qs = (o) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const s = p.toString();
  return s ? `?${s}` : '';
};

// Lỗi theo từng trường từ backend (VALIDATION_ERROR) → { field: message }
export const fieldErrors = (e) => Object.fromEntries((e.details || []).filter((d) => d.field).map((d) => [d.field, d.message]));
