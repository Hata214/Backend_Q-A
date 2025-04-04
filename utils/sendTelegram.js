const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const geoip = require('geoip-lite');
require('dotenv').config();

/**
 * Gửi thông báo về IP đã truy cập website qua Telegram
 * @param {String} ip - Địa chỉ IP người dùng
 * @param {String} time - Thời gian truy cập
 * @param {String} userAgent - Thông tin trình duyệt
 * @param {String} path - Đường dẫn truy cập
 * @param {String} extraInfo - Thông tin bổ sung từ client
 * @returns {Promise<Boolean>} - True nếu gửi thành công
 */
const sendIPNotification = async (ip, time, userAgent = '', path = '/', extraInfo = '') => {
    // Lấy token và chat id từ biến môi trường
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Nếu chưa có token hoặc chat id thì không gửi
    if (!token || !chatId) {
        return false;
    }

    try {
        // Lấy thông tin vị trí từ IP sử dụng geoip-lite (nhanh và offline)
        let locationInfo = '';
        try {
            // Ưu tiên sử dụng tọa độ từ các thông tin bổ sung của client
            const hasClientLocation = extraInfo.includes('Tọa độ:');

            // Chỉ sử dụng lookup IP để định vị nếu không có thông tin từ client
            if (!hasClientLocation) {
                // Làm sạch IP nếu cần (một số IP có thể có port hoặc thông tin khác)
                const cleanIP = ip.split(":")[0].split(",")[0].trim();

                // Sử dụng geoip-lite để truy vấn thông tin địa lý
                const geo = geoip.lookup(cleanIP);

                if (geo) {
                    // Định dạng lại tọa độ để có thể click vào mở Google Maps
                    const latitude = geo.ll?.[0] || 'N/A';
                    const longitude = geo.ll?.[1] || 'N/A';
                    const locationLink = isValidCoords(latitude, longitude) ?
                        `<a href="https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}">Xem bản đồ</a>` : '';

                    locationInfo = `
📍 <b>Vị trí:</b> ${geo.city || 'N/A'}, ${geo.country || 'N/A'}
🌍 <b>Khu vực:</b> ${geo.region || 'N/A'}
🧭 <b>Tọa độ:</b> ${latitude}, ${longitude} ${locationLink}`;
                } else {
                    // Nếu không tìm thấy thông tin từ geoip, thử dùng API bên ngoài
                    try {
                        const ipInfo = await axios.get(`https://ipapi.co/${cleanIP}/json/`, {
                            timeout: 3000
                        });

                        if (ipInfo.data && ipInfo.data.country_name) {
                            const lat = ipInfo.data.latitude;
                            const lng = ipInfo.data.longitude;
                            const locationLink = isValidCoords(lat, lng) ?
                                `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}">Xem bản đồ</a>` : '';

                            locationInfo = `
📍 <b>Vị trí:</b> ${ipInfo.data.city || 'N/A'}, ${ipInfo.data.country_name || 'N/A'}
🌐 <b>ISP:</b> ${ipInfo.data.org || 'N/A'}
🧭 <b>Tọa độ:</b> ${lat || 'N/A'}, ${lng || 'N/A'} ${locationLink}`;
                        }
                    } catch {
                        // Bỏ qua nếu không thể lấy thông tin
                    }
                }
            }
        } catch {
            // Bỏ qua lỗi khi lấy thông tin vị trí
        }

        // Phân tích User Agent để xác định thiết bị
        let device = 'Không xác định';
        let browserInfo = '';

        // Phân tích thông tin trình duyệt chi tiết hơn
        if (userAgent) {
            // Xác định loại thiết bị
            if (userAgent.includes('Android')) {
                device = 'Android';
                browserInfo = userAgent.match(/Android [0-9\.]+/)?.[0] || '';
            } else if (userAgent.includes('iPhone')) {
                device = 'iPhone';
                browserInfo = userAgent.match(/iPhone OS [0-9_]+/)?.[0]?.replace(/_/g, '.') || '';
            } else if (userAgent.includes('iPad')) {
                device = 'iPad';
                browserInfo = userAgent.match(/iPad.*OS [0-9_]+/)?.[0]?.replace(/_/g, '.') || '';
            } else if (userAgent.includes('Windows')) {
                device = 'Windows';
                browserInfo = userAgent.match(/Windows NT [0-9\.]+/)?.[0] || '';
            } else if (userAgent.includes('Mac')) {
                device = 'Mac OS';
                browserInfo = userAgent.match(/Mac OS X [0-9_]+/)?.[0]?.replace(/_/g, '.') || '';
            } else if (userAgent.includes('Linux')) {
                device = 'Linux';
            }

            // Thêm thông tin trình duyệt
            const browsers = [
                { name: 'Chrome', pattern: /Chrome\/([0-9\.]+)/ },
                { name: 'Firefox', pattern: /Firefox\/([0-9\.]+)/ },
                { name: 'Safari', pattern: /Safari\/([0-9\.]+)/ },
                { name: 'Edge', pattern: /Edg(e)?\/([0-9\.]+)/ },
                { name: 'Opera', pattern: /OPR\/([0-9\.]+)/ },
            ];

            for (const browser of browsers) {
                const match = userAgent.match(browser.pattern);
                if (match) {
                    browserInfo += ` ${browser.name} ${match[1] || match[2] || ''}`;
                    break;
                }
            }
        }

        // Cập nhật extraInfo để bao gồm liên kết bản đồ cho tọa độ nếu có
        if (extraInfo) {
            // Tìm và cập nhật dòng tọa độ nếu có
            const coordsMatch = extraInfo.match(/📍 Tọa độ: ([0-9.-]+), ([0-9.-]+)/);
            if (coordsMatch && coordsMatch.length >= 3) {
                const lat = coordsMatch[1];
                const lng = coordsMatch[2];
                if (isValidCoords(lat, lng)) {
                    extraInfo = extraInfo.replace(
                        coordsMatch[0],
                        `📍 Tọa độ: ${lat}, ${lng} - <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}">Xem bản đồ</a>`
                    );
                }
            }
        }

        // Khởi tạo bot với token
        const bot = new TelegramBot(token, { polling: false });

        // Format nội dung thông báo với thông tin chi tiết hơn
        const message = `
🚨 <b>Có người truy cập website!</b>

📱 <b>IP:</b> ${ip}
⏰ <b>Thời gian:</b> ${time}
🌐 <b>Đường dẫn:</b> ${path}
🖥️ <b>Thiết bị:</b> ${device} ${browserInfo}
${locationInfo}

${extraInfo ? `<b>Thông tin bổ sung:</b>\n${extraInfo}` : ''}

${hasAddressInfo(extraInfo) ? getMapsLink(extraInfo) : ''}`;

        // Gửi thông báo qua Telegram
        await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        return true;
    } catch {
        // Bỏ qua tất cả lỗi, không log ra console
        return false;
    }
};

/**
 * Kiểm tra xem tọa độ có hợp lệ không
 * @param {any} lat - Vĩ độ
 * @param {any} lng - Kinh độ
 * @returns {boolean} - True nếu tọa độ hợp lệ
 */
function isValidCoords(lat, lng) {
    lat = parseFloat(lat);
    lng = parseFloat(lng);
    return !isNaN(lat) && !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;
}

/**
 * Kiểm tra xem có thông tin địa chỉ trong extraInfo không
 * @param {String} extraInfo - Thông tin bổ sung
 * @returns {Boolean} - True nếu có thông tin địa chỉ
 */
function hasAddressInfo(extraInfo) {
    return extraInfo && (extraInfo.includes('Địa chỉ:') || extraInfo.includes('Chi tiết:'));
}

/**
 * Tạo liên kết đến Google Maps dựa trên tọa độ hoặc địa chỉ
 * @param {String} extraInfo - Thông tin bổ sung
 * @returns {String} - HTML chứa liên kết đến Google Maps
 */
function getMapsLink(extraInfo) {
    // Tìm tọa độ từ extraInfo
    const coordsMatch = extraInfo.match(/📍 Tọa độ: ([0-9.-]+), ([0-9.-]+)/);
    if (coordsMatch && coordsMatch.length >= 3) {
        const lat = coordsMatch[1];
        const lng = coordsMatch[2];
        if (isValidCoords(lat, lng)) {
            return `<a href="https://www.google.com/maps?q=${lat},${lng}">🗺️ Xem trên Google Maps</a>`;
        }
    }

    // Nếu không có tọa độ nhưng có địa chỉ, tìm địa chỉ
    const addressMatch = extraInfo.match(/🏡 Địa chỉ: (.*?)(?:\n|$)/);
    if (addressMatch && addressMatch.length >= 2) {
        const address = encodeURIComponent(addressMatch[1]);
        return `<a href="https://www.google.com/maps/search/?api=1&query=${address}">🗺️ Xem trên Google Maps</a>`;
    }

    return '';
}

module.exports = sendIPNotification; 