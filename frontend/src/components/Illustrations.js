import React from 'react';
import { Bike, Briefcase, Camera, Code, Coffee, GraduationCap, Headset, Keyboard, Languages, Megaphone, Mic, Palette, ShoppingBag } from 'lucide-react';
import { PANEL_BG } from '../utils/format';

// Nhân vật hoạt hình nét mảnh #343433, tô màu nhấn phẳng (DESIGN: Hero Illustration Cluster)
const S = { stroke: '#343433', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
const Eyes = ({ x, y, gap = 14 }) => (
  <>
    <circle cx={x} cy={y} r="3" fill="#343433" />
    <circle cx={x + gap} cy={y} r="3" fill="#343433" />
  </>
);
const Smile = ({ x, y, w = 14 }) => <path d={`M${x} ${y} q${w / 2} ${w / 2.2} ${w} 0`} fill="none" {...S} />;

const Star = ({ x, y, c = '#ffcd6c', s = 1 }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -12 L3.5 -3.5 L12 -3 L5.5 3 L7.5 12 L0 7 L-7.5 12 L-5.5 3 L-12 -3 L-3.5 -3.5 Z" fill={c} {...S} strokeWidth={2} />
);
const Heart = ({ x, y, c = '#ff58ae' }) => (
  <path transform={`translate(${x} ${y})`} d="M0 8 C-14 -2 -8 -14 0 -6 C8 -14 14 -2 0 8 Z" fill={c} {...S} strokeWidth={2} />
);
const Coin = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r="11" fill="#ffcd6c" {...S} strokeWidth={2} />
    <path d="M0 -5 V5" {...S} strokeWidth={2} />
  </g>
);
const Leaf = ({ x, y, c = '#00c978', r = 0 }) => (
  <path transform={`translate(${x} ${y}) rotate(${r})`} d="M0 12 C-10 2 -6 -10 0 -14 C6 -10 10 2 0 12 Z M0 12 V-8" fill={c} {...S} strokeWidth={2} />
);

export const HeroIllustrationLeft = (props) => (
  <svg viewBox="0 0 240 300" role="img" aria-label="" {...props}>
    {/* Hoa mặt vuông */}
    <g transform="translate(96 110)">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx="0" cy="-44" rx="22" ry="30" fill="#64c6ff" transform={`rotate(${a})`} {...S} />
      ))}
      <rect x="-30" y="-30" width="60" height="60" rx="14" fill="#ffcd6c" {...S} />
      <Eyes x={-9} y={-6} gap={18} />
      <Smile x={-8} y={8} w={16} />
      <path d="M0 74 V150" {...S} strokeWidth={3} />
      <path d="M0 120 C-24 110 -34 96 -36 86 C-20 88 -6 100 0 116" fill="#00c978" {...S} />
    </g>
    <Star x={200} y={40} />
    <Heart x={28} y={32} />
    <Coin x={210} y={150} />
    <Leaf x={30} y={210} r={-30} />
    <Star x={190} y={250} c="#ff3e00" s={0.7} />
  </svg>
);

export const HeroIllustrationRight = (props) => (
  <svg viewBox="0 0 240 300" role="img" aria-label="" {...props}>
    {/* Cục tròn xanh lá */}
    <g transform="translate(130 200)">
      <path d="M-62 40 C-80 -10 -50 -62 0 -62 C52 -62 80 -14 64 38 C54 64 -52 66 -62 40 Z" fill="#00c978" {...S} />
      <Eyes x={-16} y={-14} gap={24} />
      <Smile x={-12} y={4} w={24} />
      <path d="M-40 54 V76 M36 54 V76" {...S} strokeWidth={3} />
    </g>
    {/* Tam giác vàng */}
    <g transform="translate(70 76)">
      <path d="M0 -50 L46 34 L-46 34 Z" fill="#ffcd6c" {...S} />
      <Eyes x={-9} y={6} gap={18} />
      <Smile x={-6} y={16} w={12} />
    </g>
    {/* Đám mây cam */}
    <g transform="translate(190 60)">
      <path d="M-34 14 C-46 14 -46 -6 -32 -6 C-32 -24 -8 -26 -2 -12 C6 -24 30 -18 26 0 C40 0 40 14 28 14 Z" fill="#ff3e00" {...S} />
    </g>
    <Star x={24} y={176} c="#64c6ff" />
    <Heart x={214} y={140} c="#ff58ae" />
    <Coin x={20} y={270} />
  </svg>
);

// Nhân vật nhỏ dùng làm điểm nhấn trong card / trạng thái trống
export const Mascot = ({ kind = 'blob', size = 72, ...rest }) => {
  const shapes = {
    blob: <path d="M-30 20 C-40 -6 -24 -32 0 -32 C26 -32 40 -8 32 18 C26 32 -24 34 -30 20 Z" fill="#00c978" {...S} />,
    triangle: <path d="M0 -32 L32 26 L-32 26 Z" fill="#ffcd6c" {...S} />,
    cloud: <path d="M-30 18 C-44 18 -44 -4 -28 -4 C-28 -26 -2 -28 4 -12 C12 -26 38 -18 32 2 C46 2 46 18 32 18 Z" fill="#64c6ff" {...S} />,
    flower: <rect x="-26" y="-26" width="52" height="52" rx="14" fill="#ff58ae" {...S} />,
  };
  return (
    <svg width={size} height={size} viewBox="-48 -40 96 80" aria-hidden="true" {...rest}>
      {shapes[kind]}
      <Eyes x={-8} y={-2} gap={16} />
      <Smile x={-6} y={8} w={12} />
    </svg>
  );
};

// Biểu tượng theo ngành, đoán từ tên danh mục (danh mục nằm trong DB nên không cố định thứ tự)
const CATEGORY_ICONS = [
  [/bán hàng|thu ngân/i, ShoppingBag], [/chăm sóc|khách hàng/i, Headset], [/chụp|quay|video/i, Camera],
  [/dịch thuật|nội dung|viết/i, Languages], [/gia sư|trợ giảng/i, GraduationCap], [/giao hàng|kho/i, Bike],
  [/lập trình|it\b/i, Code], [/marketing|mạng xã hội/i, Megaphone], [/nhập liệu|văn phòng/i, Keyboard],
  [/phục vụ|cà phê|nhà hàng|pha chế/i, Coffee], [/sự kiện|pg/i, Mic], [/thiết kế|đồ họa/i, Palette],
];
export const categoryIcon = (name = '') => CATEGORY_ICONS.find(([re]) => re.test(name))?.[1] || Briefcase;

// Số ngẫu nhiên có hạt giống: cùng id → cùng hình mỗi lần tải
const seeded = (key = '') => {
  let h = 2166136261;
  for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 10000) / 10000;
};
const KINDS = ['blob', 'triangle', 'cloud', 'flower'];
const BITS = [(x, y, k) => <Star key={k} x={x} y={y} s={0.7} />, (x, y, k) => <Coin key={k} x={x} y={y} />,
  (x, y, k) => <Heart key={k} x={x} y={y} />, (x, y, k) => <Leaf key={k} x={x} y={y} r={x % 60} />,
  (x, y, k) => <Star key={k} x={x} y={y} c="#ffffff" s={0.55} />];

// Minh họa tự sinh cho thẻ việc/ngành: nền màu, mảng blob nhạt, icon ngành lớn, mascot, confetti
export const Scene = ({ seed, category, className }) => {
  const r = seeded(seed);
  const bg = PANEL_BG[Math.floor(r() * PANEL_BG.length)];
  const Icon = categoryIcon(category);
  const left = r() < 0.5;
  const bits = Array.from({ length: 5 + Math.floor(r() * 4) }, (_, i) => {
    const x = 18 + r() * 284, y = 18 + r() * 204;
    // chừa giữa (icon ngành) và hai góc trên (nhãn Nổi bật, logo công ty)
    const blocked = (Math.abs(x - 160) < 70 && Math.abs(y - 120) < 70) || (y < 64 && (x < 130 || x > 250));
    return blocked ? null : BITS[Math.floor(r() * BITS.length)](x, y, i);
  });
  return (
    <svg className={className} viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="240" fill={bg} />
      <path transform={`translate(160 128) rotate(${Math.floor(r() * 360)})`} d="M-96 10 C-104 -60 -30 -100 30 -86 C96 -72 112 -10 92 44 C72 98 -10 104 -50 84 C-86 66 -92 40 -96 10 Z" fill="#ffffff" opacity=".45" />
      <Icon x="112" y="72" width="96" height="96" strokeWidth={1.4} color="#343433" />
      <Mascot kind={KINDS[Math.floor(r() * KINDS.length)]} size={86} x={left ? 22 : 212} y={140} />
      {bits}
    </svg>
  );
};
