import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Điều khoản và quyền riêng tư: viết theo đúng những gì hệ thống đang làm (business rule ở backend), không phải văn mẫu
const Legal = ({ title, updated, sections }) => {
  const { hash } = useLocation();
  // Link từ footer kiểu /dieu-khoan#bao-cao: cuộn tới mục sau khi trang hiện ra
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(); }, [hash]);
  return (
    <div className="container page lg-page">
      <h1 className="display">{title}</h1>
      <p className="muted">Cập nhật lần cuối: {updated}</p>
      {sections.map(([id, h, items]) => (
        <section key={id} id={id} className="lg-sec">
          <h2 className="h-md">{h}</h2>
          <ul>{items.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      ))}
      <p className="muted small">Có câu hỏi? Xem <Link to="/#hoi-dap" className="accent">Hỏi đáp</Link> ở trang chủ.</p>
    </div>
  );
};

export const TermsPage = () => (
  <Legal title="Điều khoản sử dụng" updated="21/10/2026" sections={[
    ['tai-khoan', 'Tài khoản', [
      'Mỗi email chỉ đăng ký được một tài khoản, với vai trò sinh viên hoặc nhà tuyển dụng.',
      'Bạn cần xác thực email trước khi ứng tuyển, đăng tin hoặc thanh toán.',
      'Bạn chịu trách nhiệm giữ mật khẩu. Tài khoản vi phạm nghiêm trọng có thể bị khóa.',
    ]],
    ['sinh-vien', 'Với sinh viên', [
      'Tìm việc, ứng tuyển và lưu tin hoàn toàn miễn phí.',
      'Thông tin trong hồ sơ và CV phải là của bạn và đúng sự thật.',
      'Sau khi đơn hoàn thành hoặc không hoàn thành, mỗi bên được đánh giá nhau một lần trong 14 ngày.',
    ]],
    ['nha-tuyen-dung', 'Với nhà tuyển dụng', [
      'Tin tuyển dụng phải ghi rõ mức lương, địa điểm và ca làm thật.',
      'Không được thu bất kỳ khoản phí, tiền cọc hay tiền đồng phục nào từ sinh viên.',
      'Gói Premium thanh toán qua cổng VNPay và không hoàn tiền trong hệ thống.',
    ]],
    ['bao-cao', 'Báo cáo lừa đảo và vi phạm', [
      'Gặp tin đòi đặt cọc, thu phí hoặc thông tin sai: bấm "Báo cáo tin này" ở trang chi tiết việc, chọn lý do phù hợp.',
      'Quản trị viên xử lý báo cáo theo 3 bậc: cảnh cáo, ẩn tin, hoặc khóa tài khoản.',
      'Đừng chuyển tiền cho bất kỳ ai trước khi đi làm.',
    ]],
  ]} />
);

export const PrivacyPage = () => (
  <Legal title="Quyền riêng tư" updated="21/10/2026" sections={[
    ['thu-thap', 'Thông tin chúng tôi lưu', [
      'Họ tên, email, số điện thoại và mật khẩu (chỉ lưu bản băm, không lưu mật khẩu gốc).',
      'Với sinh viên: trường, ngành, kỹ năng, CV và lịch học bạn tự tô.',
      'Với nhà tuyển dụng: tên, địa chỉ, số điện thoại và logo công ty.',
    ]],
    ['hien-thi', 'Ai thấy thông tin của bạn', [
      'Số điện thoại và email của hai bên chỉ hiện khi đơn ứng tuyển đã được nhận.',
      'Nhà tuyển dụng thấy hồ sơ và CV của sinh viên đã ứng tuyển vào tin của họ.',
      'Khi chưa đăng nhập, lịch học chỉ lưu trên trình duyệt của bạn.',
    ]],
    ['email', 'Email thông báo', [
      'Nếu đăng ký nhận việc mới, chúng tôi lưu email và lịch học bạn đã tô để lọc tin phù hợp.',
      'Mỗi email đều có link hủy nhận. Hủy xong, đăng ký của bạn bị xóa.',
    ]],
    ['thanh-toan', 'Thanh toán', [
      'Thanh toán Premium được xử lý tại cổng VNPay. JobSV không nhận và không lưu thông tin thẻ.',
    ]],
  ]} />
);
