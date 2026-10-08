---
category: Content
---

# JobCard

Thẻ tin tuyển dụng: logo công ty, tiêu đề, tên công ty, mức lương (font display), địa điểm, ca làm, danh mục, thời gian đăng. Tin Premium có nhãn cam "★ Nổi bật". Cả thẻ là link tới /jobs/:id nên cần nằm trong Router. Xếp trong `.grid-3` (trang chủ) hoặc `.stack` (trang tìm việc).

```jsx
<div className="grid-3">
  {jobs.map(j => <JobCard key={j._id} job={j} category={catName[j.categoryId]} />)}
</div>
```
