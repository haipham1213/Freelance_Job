import nodemailer from 'nodemailer';
import { waitUntil } from '@vercel/functions';

// Gửi nền sau khi đã trả phản hồi: trên Vercel function bị đóng băng ngay khi phản hồi xong nên phải waitUntil, local thì promise tự chạy tiếp
export const inBackground = (promise, tag = 'mail') => waitUntil(promise.catch((e) => console.warn(`[${tag}] ${e.message}`)));

// Có SMTP_USER/SMTP_PASS (Gmail + App Password) thì gửi qua Gmail SMTP, gửi được tới mọi địa chỉ khi chưa có tên miền;
// không có thì dùng Resend REST API (https://resend.com/docs/api-reference/emails/send-email)
const smtp = process.env.SMTP_USER && process.env.SMTP_PASS
  && nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS.replace(/\s/g, '') } });

export const sendMail = async ({ to, subject, html }) => {
  if (smtp) return smtp.sendMail({ from: `UniShift <${process.env.SMTP_USER}>`, to, subject, html });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gửi email thất bại: ${data.message}`);
  return data;
};

// Email không tải được font tự host; Poppins của Google Fonts thiếu dấu tiếng Việt nên dùng Be Vietnam Pro (đủ dấu)
const FONT = "Inter,'Be Vietnam Pro',Arial,Helvetica,sans-serif";
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Khung email theo nhận diện UniShift (token index.css): nền --page-bg, thẻ trắng viền --line, nút --primary.
// Dùng bảng + style inline vì Gmail/Outlook bỏ <style> và flex. Logo dạng chữ để không phụ thuộc ảnh bị chặn
const layout = ({ preheader, title, body, link, label, note, extra = '' }) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&display=swap" rel="stylesheet"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f8fc">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fc">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT}">
      <tr><td style="padding:0 8px 20px">
        <a href="${process.env.CLIENT_URL}" style="text-decoration:none;font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#191919">Uni<span style="color:#1f9d4a">Shift</span></a>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #dde4ec;border-radius:20px;padding:36px 32px">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:700;color:#191919">${title}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3b4250">${body}</p>
        ${extra}
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#0b4fa8">
          <a href="${link}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${label}</a>
        </td></tr></table>
        ${note ? `<p style="margin:24px 0 0;padding:12px 16px;background:#e8f1fb;border-radius:10px;font-size:13px;line-height:1.5;color:#3b4250">${note}</p>` : ''}
        <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #dde4ec;font-size:12px;line-height:1.5;color:#5a6270">
          Nút không bấm được? Sao chép link này vào trình duyệt:<br><a href="${link}" style="color:#0b4fa8;word-break:break-all">${link}</a>
        </p>
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:#6b768c">
        UniShift — việc part-time vừa với lịch học của sinh viên.<br>Đây là email tự động, vui lòng không trả lời.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

const SALARY_UNIT = { HOURLY: '/giờ', DAILY: '/ngày', PROJECT: '/dự án' };
const money = (n) => `${Number(n).toLocaleString('vi-VN')}đ`;
// Ô thông tin tin tuyển dụng cho email việc mới
const jobInfo = (job) => {
  const rows = [
    ['Công ty', esc(job.companySnapshot?.name)],
    ['Mức lương', job.salaryMin != null && `${money(job.salaryMin)}${job.salaryMax > job.salaryMin ? ` – ${money(job.salaryMax)}` : ''}${SALARY_UNIT[job.salaryType] || ''}`],
    ['Địa điểm', esc([job.district, job.city].filter(Boolean).join(', '))],
    ['Lịch làm', esc(job.schedule)],
  ].filter(([, v]) => v);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f5f8fc;border-radius:12px">
    ${rows.map(([k, v], i) => `<tr><td style="padding:${i ? 0 : 14}px 16px 10px;width:96px;font-size:13px;color:#5a6270;vertical-align:top">${k}</td><td style="padding:${i ? 0 : 14}px 16px 10px 0;font-size:14px;font-weight:600;color:${k === 'Mức lương' ? '#05683a' : '#191919'}">${v}</td></tr>`).join('')}
  </table>`;
};

// Email lỗi không làm hỏng luồng chính (FR-AUTH-01 bước 5a); in link ra log để dev vẫn thử được
const trySend = async (to, subject, html, link) => {
  if (process.env.NODE_ENV === 'test') return;
  if (process.env.NODE_ENV !== 'production') console.log(`[mail] ${subject} → ${to}: ${link}`);
  try {
    await sendMail({ to, subject, html });
  } catch (e) {
    console.warn(`[mail] ${e.message}`);
  }
};

export const sendVerifyEmail = (to, token) => {
  const link = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  return trySend(to, 'Xác thực email tài khoản UniShift', layout({
    preheader: 'Bấm nút trong email để kích hoạt tài khoản UniShift của bạn.',
    title: 'Chào mừng bạn đến với UniShift!',
    body: 'Chỉ còn một bước nữa: xác thực địa chỉ email để bắt đầu tìm việc hoặc đăng tin tuyển dụng.',
    link, label: 'Xác thực email',
    note: 'Link có hiệu lực trong <b>24 giờ</b>. Nếu bạn không tạo tài khoản UniShift, hãy bỏ qua email này.',
  }), link);
};

export const sendJobAlert = (to, job, token) => {
  const link = `${process.env.CLIENT_URL}/jobs/${job._id}`;
  const off = `${process.env.API_URL}/api/v1/job-alerts/unsubscribe?token=${token}`;
  return trySend(to, `Việc mới hợp lịch học: ${job.title}`, layout({
    preheader: `${job.companySnapshot?.name || 'Nhà tuyển dụng'} vừa đăng tin có ca làm không trùng lịch học của bạn.`,
    title: esc(job.title),
    body: 'Có tin tuyển dụng mới với ca làm <b>không trùng lịch học</b> của bạn. Ứng tuyển sớm để có cơ hội cao hơn.',
    extra: jobInfo(job),
    link, label: 'Xem và ứng tuyển',
    note: `Bạn nhận email này vì đã đăng ký thông báo việc mới. <a href="${off}" style="color:#5a6270">Hủy nhận thông báo</a>`,
  }), link);
};

export const sendAlertConfirm = (to, token) => {
  const link = `${process.env.API_URL}/api/v1/job-alerts/confirm?token=${token}`;
  return trySend(to, 'Xác nhận nhận email việc mới từ UniShift', layout({
    preheader: 'Xác nhận để nhận email khi có việc hợp lịch học của bạn.',
    title: 'Xác nhận nhận thông báo việc mới',
    body: 'Bấm nút bên dưới để bắt đầu nhận email mỗi khi có việc part-time với ca làm không trùng lịch học của bạn.',
    link, label: 'Xác nhận đăng ký',
    note: 'Nếu bạn không đăng ký, hãy bỏ qua email này — bạn sẽ không nhận thêm email nào.',
  }), link);
};

export const sendResetEmail = (to, token) => {
  const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  return trySend(to, 'Đặt lại mật khẩu UniShift', layout({
    preheader: 'Yêu cầu đặt lại mật khẩu cho tài khoản UniShift của bạn.',
    title: 'Đặt lại mật khẩu',
    body: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút bên dưới để tạo mật khẩu mới.',
    link, label: 'Đặt lại mật khẩu',
    note: 'Link có hiệu lực trong <b>30 phút</b> và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn vẫn giữ nguyên.',
  }), link);
};
