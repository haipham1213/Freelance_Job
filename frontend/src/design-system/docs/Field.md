---
category: Forms
---

# Field

Bọc một ô nhập với nhãn phía trên và lỗi màu đỏ phía dưới. Ô bên trong dùng class `input`, `select` hoặc `textarea` (nền trắng, viền mảnh, bo 10px).

```jsx
<Field label="Email" error={errors.email}>
  <input className="input" type="email" />
</Field>
```
