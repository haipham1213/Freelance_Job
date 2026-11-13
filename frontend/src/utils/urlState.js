// Tab / trang / bộ lọc nằm trên URL (class component nhận searchParams từ withRouter)
export const param = (props, key, fallback = '') => props.searchParams.get(key) || fallback;
export const intParam = (props, key, fallback = 1) => Math.max(1, parseInt(props.searchParams.get(key), 10) || fallback);

// patch: { tab: 'PENDING', page: 1 } — giá trị rỗng/null thì xóa khỏi URL; mặc định replace để nút Back không bị đầy
export const setParams = (props, patch, replace = true) => {
  const p = new URLSearchParams(props.searchParams);
  Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? p.delete(k) : p.set(k, String(v))));
  props.setSearchParams(p, { replace });
};
