const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Khởi tạo bot với token từ biến môi trường
let bot = null;
try {
    // Chỉ khởi tạo bot nếu có token
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
        bot = new TelegramBot(token, { polling: false });
    }
} catch (error) {
    console.error('Lỗi khởi tạo Telegram Bot:', error.message);
}

/**
 * Kiểm tra kết nối Telegram Bot
 * @returns {Promise<Boolean>} - True nếu kết nối thành công
 */
const checkTelegramConnection = async () => {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!token || !chatId || !bot) {
            console.log('Telegram Bot chưa được cấu hình.');
            return false;
        }

        // Gửi thông báo khởi động server đến Telegram
        await bot.sendMessage(chatId,
            `✅ Server đã khởi động\n🕒 Thời gian: ${new Date().toLocaleString('vi-VN')}`
        );
        console.log('Đã kết nối với Telegram Bot thành công.');
        return true;
    } catch (error) {
        console.error('Lỗi kết nối Telegram Bot:', error.message);
        return false;
    }
};

/**
 * Gửi thông báo câu hỏi mới
 * @param {Object} question - Câu hỏi mới
 * @returns {Promise<Boolean>} - True nếu gửi thành công
 */
const sendNewQuestionNotification = async (question) => {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!token || !chatId || !bot) {
            return false;
        }

        const message = `
🔔 <b>Có câu hỏi mới!</b>

👤 <b>Người hỏi:</b> ${question.name || 'Ẩn danh'}
📝 <b>Nội dung:</b> ${question.content}
⏰ <b>Thời gian:</b> ${new Date(question.createdAt).toLocaleString('vi-VN')}
        `;

        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        return true;
    } catch (error) {
        console.error('Lỗi gửi thông báo câu hỏi mới:', error.message);
        return false;
    }
};

/**
 * Gửi thông báo câu trả lời mới
 * @param {Object} question - Câu hỏi đã được trả lời
 * @returns {Promise<Boolean>} - True nếu gửi thành công
 */
const sendNewAnswerNotification = async (question) => {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!token || !chatId || !bot) {
            return false;
        }

        const message = `
📣 <b>Đã trả lời câu hỏi!</b>

👤 <b>Người hỏi:</b> ${question.name || 'Ẩn danh'}
📝 <b>Câu hỏi:</b> ${question.content}
✅ <b>Trả lời:</b> ${question.answer}
⏰ <b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}
        `;

        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        return true;
    } catch (error) {
        console.error('Lỗi gửi thông báo câu trả lời mới:', error.message);
        return false;
    }
};

module.exports = {
    checkTelegramConnection,
    sendNewQuestionNotification,
    sendNewAnswerNotification
}; 