import { Component, ReactNode, SVGProps } from 'react';

export { MemoryRouter, BrowserRouter } from 'react-router-dom';

/** Vòng xoay tải dữ liệu, căn giữa, màu nhấn cam. */
export declare const Spinner: () => JSX.Element;

export interface EmptyProps {
  /** Nhân vật minh họa hiển thị phía trên tiêu đề */
  mascot?: 'cloud' | 'blob' | 'triangle' | 'flower';
  /** Tiêu đề trạng thái trống, ví dụ "Chưa có đơn nào" */
  title: ReactNode;
  /** Mô tả hoặc link hành động bên dưới */
  children?: ReactNode;
}
/** Trạng thái trống cho danh sách: nhân vật minh họa + tiêu đề + gợi ý hành động. Thường đặt trong `.card`. */
export declare const Empty: (props: EmptyProps) => JSX.Element;

export interface AlertProps {
  /** Màu và vai trò: error (đỏ), ok (xanh lá), info (xanh dương), warn (vàng) */
  type?: 'error' | 'ok' | 'info' | 'warn';
  /** Nội dung; không có children thì không render gì */
  children?: ReactNode;
}
/** Hộp thông báo nền màu nhạt bo 10px, dùng cho lỗi form, xác nhận thành công, nhắc nhở. */
export declare const Alert: (props: AlertProps) => JSX.Element | null;

export interface JobBadgeProps {
  /** Trạng thái tin tuyển dụng */
  status: 'OPEN' | 'FILLED' | 'CLOSED' | 'COMPLETED' | 'HIDDEN' | 'EXPIRED';
}
/** Nhãn pill trạng thái tin tuyển dụng (Đang tuyển, Đã đủ người, Hết hạn…). */
export declare const JobBadge: (props: JobBadgeProps) => JSX.Element;

export interface AppBadgeProps {
  /** Trạng thái đơn ứng tuyển */
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'COMPLETED' | 'NOT_COMPLETED';
}
/** Nhãn pill trạng thái đơn ứng tuyển (Đang chờ, Được nhận, Bị từ chối…). */
export declare const AppBadge: (props: AppBadgeProps) => JSX.Element;

export interface PayBadgeProps {
  /** Trạng thái giao dịch Premium */
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
}
/** Nhãn pill trạng thái thanh toán (Đang xử lý, Thành công, Thất bại, Hết hạn). */
export declare const PayBadge: (props: PayBadgeProps) => JSX.Element;

export interface StarsProps {
  /** Điểm trung bình 0–5 */
  value?: number;
  /** Số lượt đánh giá; truyền vào để hiện "4.0 (12)" hoặc "Chưa có đánh giá" */
  count?: number;
}
/** Hiển thị điểm đánh giá 5 sao màu vàng mật ong, kèm số lượt khi có `count`. */
export declare const Stars: (props: StarsProps) => JSX.Element;

export interface AvatarProps {
  /** URL ảnh; không có thì hiện chữ cái đầu của `name` */
  src?: string;
  /** Họ tên, dùng cho chữ cái đầu */
  name?: string;
  /** 'lg' = 72px, mặc định 40px */
  size?: 'lg';
}
/** Ảnh đại diện tròn của sinh viên/người dùng, tự rơi về chữ cái đầu khi thiếu ảnh. */
export declare const Avatar: (props: AvatarProps) => JSX.Element;

export interface CompanyLogoProps {
  /** URL logo công ty; không có thì hiện biểu tượng tòa nhà */
  src?: string;
  /** Tên công ty (alt text) */
  name?: string;
}
/** Ô logo công ty 52px bo 10px, nền cát có viền mảnh. */
export declare const CompanyLogo: (props: CompanyLogoProps) => JSX.Element;

export interface FieldProps {
  /** Nhãn phía trên ô nhập */
  label: ReactNode;
  /** Thông báo lỗi màu đỏ bên dưới */
  error?: ReactNode;
  /** Ô nhập: `<input className="input">`, `<select className="select">` hoặc `<textarea className="textarea">` */
  children: ReactNode;
}
/** Bọc một ô nhập form với nhãn và lỗi. Con bên trong dùng class `input` / `select` / `textarea`. */
export declare const Field: (props: FieldProps) => JSX.Element;

export interface PaginationProps {
  /** Meta phân trang từ API: { page, limit, total }. Ẩn khi total <= limit */
  meta?: { page: number; limit: number; total: number } | null;
  /** Gọi khi chọn trang */
  onPage: (page: number) => void;
}
/** Thanh phân trang dạng pill: Trước · số trang · Sau. */
export declare const Pagination: (props: PaginationProps) => JSX.Element | null;

export interface TabsProps {
  /** Danh sách [giá trị, nhãn] */
  items: Array<[string, ReactNode]>;
  /** Giá trị đang chọn */
  value: string;
  /** Gọi khi đổi tab */
  onChange: (value: string) => void;
}
/** Bộ lọc dạng tab pill trong rãnh nền đá; tab đang chọn nổi trắng. Dùng để lọc theo trạng thái. */
export declare const Tabs: (props: TabsProps) => JSX.Element;

export interface ModalProps {
  /** Tiêu đề hộp thoại */
  title: ReactNode;
  /** Đóng khi bấm nền, nút × hoặc phím Esc */
  onClose: () => void;
  children?: ReactNode;
}
/** Hộp thoại trắng bo 16px giữa màn hình trên nền mờ tối. */
export declare class Modal extends Component<ModalProps> {}

export interface ReasonModalProps {
  /** Tiêu đề hộp thoại, ví dụ "Khóa tài khoản" */
  title: ReactNode;
  /** Nhãn ô lý do (mặc định "Lý do") */
  label?: ReactNode;
  /** Chữ trên nút xác nhận (mặc định "Xác nhận") */
  confirm?: ReactNode;
  /** Nút xác nhận màu đỏ cho thao tác nguy hiểm */
  danger?: boolean;
  /** Bắt buộc nhập lý do */
  required?: boolean;
  /** Nhận lý do đã trim; trả Promise, lỗi ném ra sẽ hiện trong hộp thoại */
  onSubmit: (reason: string) => Promise<unknown> | void;
  onClose: () => void;
  /** Nội dung giải thích thêm phía trên ô lý do */
  children?: ReactNode;
}
/** Hộp thoại nhập lý do cho thao tác như từ chối đơn, ẩn tin, khóa tài khoản. */
export declare class ReasonModal extends Component<ReasonModalProps> {}

export interface BackLinkProps {
  /** Đường dẫn quay lại */
  to: string;
  children?: ReactNode;
}
/** Link "← Quay lại" nhỏ màu xám đặt trên tiêu đề trang. Cần nằm trong Router. */
export declare const BackLink: (props: BackLinkProps) => JSX.Element;

export interface JobCardJob {
  _id: string;
  title: string;
  companySnapshot?: { name?: string; logoUrl?: string; city?: string };
  salaryType: 'HOURLY' | 'DAILY' | 'PROJECT';
  salaryMin: number;
  salaryMax: number;
  city: string;
  district?: string;
  schedule?: string;
  createdAt: string;
  /** Tin Nổi bật (Premium): hiện nhãn cam "★ Nổi bật" */
  isFeatured?: boolean;
  featuredUntil?: string;
}
export interface JobCardProps {
  /** Dữ liệu tin tuyển dụng */
  job: JobCardJob;
  /** Tên danh mục hiển thị trong dòng meta */
  category?: string;
  /** Nội dung phụ bên phải dòng lương, ví dụ nhãn hoặc nút */
  extra?: ReactNode;
}
/** Thẻ tin tuyển dụng trắng viền mảnh: logo, tiêu đề, công ty, lương, địa điểm, ca làm. Bấm mở /jobs/:id. Cần nằm trong Router. */
export declare const JobCard: (props: JobCardProps) => JSX.Element;

/** Chân trang 4 cột với logo UniShift và các link. Cần nằm trong Router. */
export declare const Footer: () => JSX.Element;

/** Cụm minh họa trái của hero: hoa mặt vuông, sao, tim, đồng xu. Đặt absolute hai bên tiêu đề, class `hero-illo left`. */
export declare const HeroIllustrationLeft: (props: SVGProps<SVGSVGElement>) => JSX.Element;
/** Cụm minh họa phải của hero: cục tròn xanh lá, tam giác vàng, đám mây cam. Class `hero-illo right`. */
export declare const HeroIllustrationRight: (props: SVGProps<SVGSVGElement>) => JSX.Element;

export interface MascotProps {
  /** Nhân vật: cục tròn xanh lá, tam giác vàng, mây xanh, hoa hồng */
  kind?: 'blob' | 'triangle' | 'cloud' | 'flower';
  /** Kích thước px (mặc định 72) */
  size?: number;
}
/** Nhân vật hoạt hình nhỏ nét #343433 tô màu nhấn phẳng: điểm nhấn trong card, trạng thái trống, trang lỗi. */
export declare const Mascot: (props: MascotProps) => JSX.Element;
