const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const questionRoutes = require('./routes/questionRoutes');
const logRoutes = require('./routes/logRoutes');
const telegramService = require('./services/telegramService');
require('dotenv').config();

// Initialize Express
const app = express();

// Connect to MongoDB
connectDB();

// Lấy danh sách origins được phép từ biến môi trường
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'https://frontend-k3i60whce-hata214s-projects.vercel.app',
        'https://frontend-dgz6ytr5-hata214s-projects.vercel.app',
        'https://frontend-rust-two-28.vercel.app',
        'http://localhost:8000'
    ];

// Middleware
app.use(cors({
    // Cho phép các origins được liệt kê trong biến môi trường
    origin: function (origin, callback) {
        // Cho phép requests không có origin (like mobile apps hoặc curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('CORS policy violation'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Ẩn header X-Powered-By để không lộ thông tin server
    hideOptionsRoute: true,
    optionsSuccessStatus: 204
}));

// Sử dụng custom middleware cho routes log IP để ẩn
app.use(bodyParser.json());

// Middleware ẩn header "X-Powered-By"
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    next();
});

// Routes
app.use('/api/questions', questionRoutes);
// Api logs được đặt ở đường dẫn trung tính để không dễ nhận biết
app.use('/api/analytics', logRoutes);

// Home route
app.get('/', (req, res) => {
    res.send('Anonymous Questions API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Không log lỗi ra console để tránh lộ thông tin
    res.status(500).send('Something broke!');
});

// Khởi động server và các dịch vụ
const startServer = async () => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}`);

        // Kiểm tra kết nối Telegram Bot
        await telegramService.checkTelegramConnection();
    });
};

// Khởi động server
startServer(); 