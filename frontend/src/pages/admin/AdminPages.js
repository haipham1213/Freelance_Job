import React, { Component } from 'react';
import { api } from '../../api';
import { Spinner, Alert } from '../../components/ui';

// Tiêu đề trang quản trị: gọn, tiêu đề + mô tả một dòng + hành động bên phải
const Head = ({ title, sub, children }) => (
  <div className="adm-head">
    <div style={{ flex: 1, minWidth: 0 }}>
      <span className="eyebrow eyebrow-dot">Quản trị</span>
      <h1 className="adm-title">{title}</h1>
      {sub && <p className="muted adm-sub">{sub}</p>}
    </div>
    {children}
  </div>
);

// SCR-A06 / FR-ADM-04
export class CategoriesPage extends Component {
  state = { items: null, name: '', edit: null, msg: '', error: '' };
  componentDidMount() { this.load(); }
  load = async () => this.setState({ items: (await api.get('/admin/categories')).data });
  act = async (fn, msg) => {
    this.setState({ msg: '', error: '' });
    try {
      await fn();
      this.setState({ msg, name: '', edit: null });
      this.load();
    } catch (e) {
      this.setState({ error: e.message });
    }
  };
  uploadImage = async (c, e) => {
    const file = e.target.files[0];
    if (file) await this.act(() => api.post(`/admin/categories/${c._id}/image`, file), 'Đã cập nhật ảnh');
  };
  render() {
    const { items, name, edit, msg, error } = this.state;
    return (
      <div>
        <Head title="Danh mục" sub="Ngành nghề hiển thị trên trang chủ và bộ lọc tìm việc." />
        <form className="search-bar adm-add" onSubmit={(e) => { e.preventDefault(); this.act(() => api.post('/admin/categories', { name }), 'Đã thêm danh mục'); }}>
          <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Tên danh mục mới" maxLength={60} value={name} onChange={(e) => this.setState({ name: e.target.value })} required />
          <button className="btn">+ Thêm danh mục</button>
        </form>
        <div className="stack" style={{ marginBottom: 16 }}><Alert type="ok">{msg}</Alert><Alert>{error}</Alert></div>
        {!items ? <Spinner /> : (
          <div className="card adm-table-card table-wrap">
            <table className="table">
              <thead><tr><th>Ảnh</th><th>Tên</th><th>Số tin</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <label style={{ cursor: 'pointer' }} title="Đổi ảnh">
                        {c.imageUrl ? <img src={c.imageUrl} alt="" className="adm-cat-img" /> : <span className="chip">+ ảnh</span>}
                        <input type="file" accept="image/jpeg,image/png" hidden onChange={(e) => this.uploadImage(c, e)} />
                      </label>
                    </td>
                    <td>
                      {edit?._id === c._id ? (
                        <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); this.act(() => api.put(`/admin/categories/${c._id}`, { name: edit.name }), 'Đã đổi tên'); }}>
                          <input className="input" value={edit.name} onChange={(e) => this.setState({ edit: { ...edit, name: e.target.value } })} autoFocus />
                          <button className="btn btn-sm">Lưu</button>
                        </form>
                      ) : c.name}
                    </td>
                    <td>{c.jobCount}</td>
                    <td>{c.isActive ? <span className="chip chip-green">Đang dùng</span> : <span className="chip">Đã ẩn</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => this.setState({ edit: { _id: c._id, name: c.name } })}>Sửa</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => this.act(() => api.put(`/admin/categories/${c._id}`, { isActive: !c.isActive }), c.isActive ? 'Đã ẩn danh mục' : 'Đã hiện danh mục')}>{c.isActive ? 'Ẩn' : 'Hiện'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="fog small" style={{ marginTop: 12 }}>Danh mục đang có tin chỉ ẩn được, không xóa (BR-40). Danh mục ẩn không dùng được cho tin mới.</p>
      </div>
    );
  }
}
