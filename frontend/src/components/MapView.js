import React, { Component } from 'react';

// Bản đồ OpenStreetMap bằng Leaflet (FR-SRC-05). Thư viện + CSS chỉ tải khi component này xuất hiện, không nằm trong bundle chính.
// props:
//   center [vĩ độ, kinh độ], zoom      tâm ban đầu (khi không có gì để tự căn)
//   markers [{ id, lat, lng, title, featured }], selectedId, onSelect(id)   ghim việc làm; bấm ghim → onSelect
//   origin { lat, lng, label }, radiusKm   điểm xuất phát (trường / vị trí người xem) và vòng bán kính đang lọc
//   pick { lat, lng } | null, onPick({ lat, lng })   chế độ đặt ghim (form đăng tin): bấm bản đồ để đặt, kéo ghim để chỉnh
//   locked   không cho đặt / dời ghim;   label   tên vùng bản đồ cho trình đọc màn hình;   className   lớp chiều cao (mp-sm, mp-lg)
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
const round = (n) => Math.round(n * 1e6) / 1e6;

class MapView extends Component {
  state = { failed: false };
  el = React.createRef();

  // StrictMode (dev) gắn → gỡ → gắn lại cùng một instance: phải bỏ cờ gone của lần gỡ trước, không thì init thoát sớm và bản đồ trống
  componentDidMount() { this.gone = false; this.init(); }

  componentDidUpdate(prev) {
    if (!this.map) return;
    const p = this.props;
    if (prev.markers !== p.markers || prev.selectedId !== p.selectedId || prev.origin !== p.origin || prev.radiusKm !== p.radiusKm || prev.pick !== p.pick || prev.locked !== p.locked) this.draw();
    // Căn lại khung nhìn khi dữ liệu đổi (không căn lại khi chỉ đổi ghim đang chọn, để bản đồ không giật)
    if (prev.markers !== p.markers || prev.origin !== p.origin || prev.radiusKm !== p.radiusKm) this.fit();
    // Ghim vừa được đặt lần đầu, hoặc được đặt từ ngoài (tìm theo địa chỉ) ở chỗ đang khuất → đưa ghim vào giữa và phóng gần để chỉnh cho chuẩn
    else if (p.pick && p.pick !== prev.pick && (!prev.pick || !this.map.getBounds().contains([p.pick.lat, p.pick.lng]))) this.map.setView([p.pick.lat, p.pick.lng], Math.max(this.map.getZoom(), 16));
    else if (!p.pick && !p.markers && prev.center !== p.center && p.center) this.map.setView(p.center, p.zoom || 13);
  }

  componentWillUnmount() {
    this.gone = true;
    this.observer?.disconnect();
    this.map?.remove();
    this.map = undefined;
  }

  init = async () => {
    this.setState({ failed: false });
    let L;
    try {
      [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
    } catch {
      if (!this.gone) this.setState({ failed: true });
      return;
    }
    if (this.gone || !this.el.current || this.map) return;
    this.L = L;
    const { center = [10.7769, 106.7009], zoom = 13, pick } = this.props;
    // Con lăn chuột không zoom bản đồ (để cuộn trang bình thường); zoom bằng nút +/−, chụm ngón tay hoặc bấm đúp
    this.map = L.map(this.el.current, { scrollWheelZoom: false, attributionControl: true }).setView(pick ? [pick.lat, pick.lng] : center, pick ? 16 : zoom);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    this.map.on('click', (e) => { if (this.props.onPick && !this.props.locked) this.props.onPick({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }); });
    // Khung bản đồ đổi kích thước (mở cột lọc, xoay máy) thì Leaflet phải đo lại
    if (window.ResizeObserver) { this.observer = new ResizeObserver(() => this.map?.invalidateSize()); this.observer.observe(this.el.current); }
    this.draw();
    this.fit();
  };

  icon = (cls, size) => this.L.divIcon({ className: `mp-pin ${cls}`, html: '<span></span>', iconSize: [size, size], iconAnchor: [size / 2, size] });

  draw = () => {
    const { L, layer } = this;
    const { markers = [], selectedId, onSelect, origin, radiusKm, pick, onPick, locked } = this.props;
    layer.clearLayers();
    if (origin) {
      if (radiusKm) L.circle([origin.lat, origin.lng], { radius: radiusKm * 1000, className: 'mp-radius', interactive: false }).addTo(layer);
      L.marker([origin.lat, origin.lng], { icon: L.divIcon({ className: 'mp-origin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), title: `Điểm xuất phát: ${origin.label}`, alt: `Điểm xuất phát: ${origin.label}`, keyboard: false, zIndexOffset: 500 }).addTo(layer);
    }
    for (const m of markers) {
      const on = m.id === selectedId;
      const marker = L.marker([m.lat, m.lng], { icon: this.icon(`${m.featured ? 'gold' : ''} ${on ? 'on' : ''}`, on ? 40 : 30), title: m.title, alt: m.title, zIndexOffset: on ? 1000 : m.featured ? 100 : 0 }).addTo(layer);
      if (onSelect) marker.on('click', () => onSelect(m.id));
    }
    if (pick) {
      const marker = L.marker([pick.lat, pick.lng], { icon: this.icon('on', 40), draggable: !!onPick && !locked, title: 'Vị trí làm việc', alt: 'Vị trí làm việc', zIndexOffset: 1000 }).addTo(layer);
      if (onPick) marker.on('dragend', () => { const p = marker.getLatLng(); onPick({ lat: round(p.lat), lng: round(p.lng) }); });
    }
  };

  // Khung nhìn vừa đủ mọi ghim + điểm xuất phát (vòng bán kính nếu có)
  fit = () => {
    const { markers, origin, radiusKm } = this.props;
    if (!markers && !origin) return;
    const pts = (markers || []).map((m) => [m.lat, m.lng]);
    let bounds = pts.length ? this.L.latLngBounds(pts) : null;
    if (origin) {
      const o = this.L.latLng(origin.lat, origin.lng);
      const area = radiusKm ? o.toBounds(radiusKm * 2000) : this.L.latLngBounds([o, o]);
      bounds = bounds ? bounds.extend(area) : area;
    }
    if (bounds) this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  render() {
    const { className = '', label = 'Bản đồ' } = this.props;
    if (this.state.failed)
      return <div className={`mp mp-failed ${className}`} role="alert">Không tải được bản đồ. <button type="button" className="btn-link" onClick={this.init}>Thử lại</button></div>;
    return <div className={`mp ${className}`} ref={this.el} role="region" aria-label={label} />;
  }
}

export default MapView;
