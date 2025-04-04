# Hệ thống Câu hỏi Ẩn danh (Backend)

Backend API cho ứng dụng đặt câu hỏi ẩn danh và nhận câu trả lời.

## Cài đặt

```bash
# Cài đặt dependencies
npm install

# Chạy server trong chế độ development
npm run dev

# Chạy server trong chế độ production
npm start
```

## Cấu hình môi trường (.env)

Tạo file `.env` trong thư mục root với các biến sau:

```
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

## Cài đặt Bot Telegram

### 1. Tạo Bot Telegram mới

1. Mở Telegram và tìm `@BotFather`
2. Gửi lệnh `/newbot` để tạo bot mới
3. Đặt tên cho bot (VD: "Q&A Notification Bot")
4. Đặt username cho bot (phải kết thúc bằng 'bot', VD: "qa_notification_bot")
5. BotFather sẽ gửi cho bạn một token API (Ví dụ: `123456789:ABCdefGhIJKlmnOPQrstUVwxyZ`)
6. Sao chép token này vào biến `TELEGRAM_BOT_TOKEN` trong file `.env`

### 2. Lấy Chat ID của bạn

1. Mở Telegram và tìm `@userinfobot`
2. Nhắn bất kỳ tin nhắn nào cho bot
3. Bot sẽ trả về thông tin của bạn, bao gồm ID (VD: `Id: 123456789`)
4. Sao chép ID này vào biến `TELEGRAM_CHAT_ID` trong file `.env`

### 3. Kích hoạt bot

1. Tìm bot của bạn trên Telegram bằng username đã đặt (VD: "@qa_notification_bot")
2. Gửi lệnh `/start` hoặc bất kỳ tin nhắn nào cho bot
3. Khởi động lại server backend

### 4. Kiểm tra kết nối

- Khi khởi động server, hệ thống sẽ tự động kiểm tra kết nối với bot Telegram
- Nếu kết nối thành công, bạn sẽ nhận được thông báo từ bot

## API Endpoints

### Câu hỏi

- `GET /api/questions` - Lấy danh sách tất cả câu hỏi
- `GET /api/questions/:id` - Lấy chi tiết một câu hỏi
- `POST /api/questions` - Tạo câu hỏi mới
- `PUT /api/questions/:id/answer` - Trả lời câu hỏi
- `DELETE /api/questions/:id` - Xóa câu hỏi

### Theo dõi IP

- `POST /api/log-ip` - Ghi nhận IP người dùng truy cập
- `GET /api/ip-logs` - Lấy danh sách IP đã ghi nhận (chỉ dùng trong nội bộ)

## Thông báo Telegram

Hệ thống sẽ gửi thông báo qua Telegram trong các trường hợp sau:

1. Khi khởi động server
2. Khi có câu hỏi mới được tạo
3. Khi có câu trả lời mới cho câu hỏi
4. Khi có người truy cập vào website

## Tính năng Theo dõi IP

Trang web tự động ghi nhận thông tin người dùng truy cập và gửi về Telegram:

- Địa chỉ IP của người dùng
- Thời gian truy cập
- Đường dẫn truy cập
- Thông tin trình duyệt (user agent)

Thông tin được lưu vào cơ sở dữ liệu MongoDB và gửi thông báo qua Telegram để theo dõi truy cập. 