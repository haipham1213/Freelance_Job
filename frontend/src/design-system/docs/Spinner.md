---
category: Feedback
---

# Spinner

Vòng xoay tải dữ liệu màu cam, tự căn giữa với khoảng trống 48px trên dưới. Hiện trong lúc chờ API.

```jsx
{!jobs ? <Spinner /> : jobs.map(j => <JobCard key={j._id} job={j} />)}
```
