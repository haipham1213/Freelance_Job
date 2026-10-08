import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  // Không có phiên: /auth/refresh trả 401, các API khác trả danh sách rỗng
  global.fetch = jest.fn((url) =>
    Promise.resolve({
      ok: !String(url).includes('/auth/refresh'),
      status: String(url).includes('/auth/refresh') ? 401 : 200,
      json: () => Promise.resolve({ success: true, data: [], meta: { page: 1, limit: 10, total: 0 } }),
    }),
  );
});

test('route guard: chưa đăng nhập vào /admin → trang đăng nhập', async () => {
  window.history.pushState({}, '', '/admin');
  render(<App />);
  expect(await screen.findByText('Chào mừng trở lại')).toBeInTheDocument();
});

test('trang chủ hiển thị ô tìm kiếm cho khách', async () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(await screen.findByRole('search')).toBeInTheDocument();
});
