// Gửi email qua Resend REST API (https://resend.com/docs/api-reference/emails/send-email)
export const sendMail = async ({ to, subject, html }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gửi email thất bại: ${data.message}`);
  return data;
};

const layout = (title, body, link, label) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#fafdff;border-radius:24px;color:#0a0d12">
    <h2 style="font-weight:500">${title}</h2>
    <p style="color:#535862">${body}</p>
    <p><a href="${link}" style="display:inline-block;background:#181d27;color:#fff;padding:12px 32px;border-radius:32px;text-decoration:none">${label}</a></p>
    <p style="color:#93979f;font-size:12px">Nếu nút không bấm được, mở link: ${link}</p>
  </div>`;

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
  return trySend(to, 'Xác thực email', layout('Xác thực email của bạn', 'Link có hiệu lực trong 24 giờ.', link, 'Xác thực email'), link);
};

export const sendResetEmail = (to, token) => {
  const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  return trySend(to, 'Đặt lại mật khẩu', layout('Đặt lại mật khẩu', 'Link có hiệu lực trong 30 phút và chỉ dùng được một lần.', link, 'Đặt lại mật khẩu'), link);
};
