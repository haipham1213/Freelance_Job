import Notification from '../models/Notification.js';

// FR-NOT-01: một chỗ tạo thông báo cho mọi module
export const notify = (userId, type, title, message, link, session) =>
  Notification.create([{ userId, type, title, message: message.slice(0, 300), link }], { session });
