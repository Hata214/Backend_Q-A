const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const geoip = require('geoip-lite');
require('dotenv').config();

// Bộ đệm để theo dõi IP đã được thông báo
// { ip: timestamp } - lưu thời gian IP cuối cùng được gửi thông báo
const notificationCache = {};

// Thời gian tối thiểu giữa 2 lần gửi thông báo cho cùng 1 IP (30 giây)
const MIN_NOTIFICATION_INTERVAL = 30000; // 30 giây

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
        // Kiểm tra cache để đảm bảo không gửi thông báo quá nhanh cho cùng một IP
        const currentTime = Date.now();
        const lastNotificationTime = notificationCache[ip] || 0;

        if (currentTime - lastNotificationTime < MIN_NOTIFICATION_INTERVAL) {
            console.log(`Bỏ qua thông báo cho IP ${ip} (đã gửi gần đây)`);
            return false; // Không gửi thông báo nếu đã gửi gần đây
        }

        // Cập nhật cache với thời gian hiện tại
        notificationCache[ip] = currentTime;

        // Dọn dẹp cache định kỳ (xóa các mục quá cũ)
        cleanupNotificationCache(currentTime);

        // Định dạng lại thời gian để hiển thị chính xác
        let timeDisplay = time;

        // Nếu time là chuỗi Date object, định dạng lại theo múi giờ Việt Nam
        if (time instanceof Date) {
            // Định dạng thời gian theo múi giờ Việt Nam (UTC+7)
            timeDisplay = new Intl.DateTimeFormat('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Ho_Chi_Minh'
            }).format(time);
        }

        // Lấy thông tin vị trí từ IP sử dụng geoip-lite (nhanh và offline)
        let locationInfo = '';
        try {
            // Ưu tiên sử dụng tọa độ từ các thông tin bổ sung của client
            const hasClientLocation = extraInfo.includes('Tọa độ:');

            // Chỉ sử dụng lookup IP để định vị nếu không có thông tin từ client
            if (!hasClientLocation) {
                // Làm sạch IP nếu cần (một số IP có thể có port hoặc thông tin khác)
                const cleanIP = ip.split(":")[0].split(",")[0].trim();

                // Mảng kết quả từ các dịch vụ định vị
                let locationResults = [];

                // 1. Đầu tiên thử với geoip-lite (nhanh và không cần request mạng)
                try {
                    const geo = geoip.lookup(cleanIP);
                    if (geo && geo.ll && geo.ll.length === 2) {
                        locationResults.push({
                            source: 'geoip-lite',
                            city: geo.city || 'N/A',
                            country: geo.country || 'N/A',
                            region: geo.region || 'N/A',
                            latitude: geo.ll[0],
                            longitude: geo.ll[1],
                            accuracy: 'low' // Độ chính xác thấp
                        });
                    }
                } catch (err) {
                    // Bỏ qua lỗi
                }

                // Chỉ sử dụng một dịch vụ API nếu geoip-lite không có kết quả
                if (locationResults.length === 0) {
                    // Ưu tiên sử dụng ipapi.co
                    try {
                        const ipInfo = await axios.get(`https://ipapi.co/${cleanIP}/json/`, {
                            timeout: 3000
                        });

                        if (ipInfo.data && ipInfo.data.latitude && ipInfo.data.longitude) {
                            locationResults.push({
                                source: 'ipapi.co',
                                city: ipInfo.data.city || 'N/A',
                                country: ipInfo.data.country_name || 'N/A',
                                region: ipInfo.data.region || 'N/A',
                                latitude: ipInfo.data.latitude,
                                longitude: ipInfo.data.longitude,
                                isp: ipInfo.data.org || 'N/A',
                                accuracy: 'medium' // Độ chính xác trung bình
                            });
                        }
                    } catch (err) {
                        // Bỏ qua lỗi và không thử các dịch vụ khác
                    }
                }

                // Chọn kết quả có độ chính xác cao nhất
                let bestLocation = null;
                const priorityOrder = ['high', 'medium-high', 'medium', 'low'];

                for (const priority of priorityOrder) {
                    const found = locationResults.find(loc => loc.accuracy === priority);
                    if (found) {
                        bestLocation = found;
                        break;
                    }
                }

                // Nếu không tìm thấy theo độ ưu tiên, lấy kết quả đầu tiên có
                if (!bestLocation && locationResults.length > 0) {
                    bestLocation = locationResults[0];
                }

                if (bestLocation) {
                    const latitude = bestLocation.latitude;
                    const longitude = bestLocation.longitude;
                    const locationLink = isValidCoords(latitude, longitude) ?
                        `<a href="https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}">Xem bản đồ</a>` : '';

                    // Thêm nguồn dữ liệu vào thông tin
                    const sourceInfo = bestLocation.source ? `(${bestLocation.source})` : '';

                    locationInfo = `
📍 <b>Vị trí:</b> ${bestLocation.city || 'N/A'}, ${bestLocation.country || 'N/A'} ${sourceInfo}
🌍 <b>Khu vực:</b> ${bestLocation.region || 'N/A'}
🧭 <b>Tọa độ:</b> ${latitude}, ${longitude} ${locationLink}`;

                    if (bestLocation.isp) {
                        locationInfo += `\n🌐 <b>ISP:</b> ${bestLocation.isp}`;
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
⏰ <b>Thời gian:</b> ${timeDisplay}
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
 * Dọn dẹp cache thông báo, xóa các mục quá cũ
 * @param {Number} currentTime - Thời gian hiện tại
 */
function cleanupNotificationCache(currentTime) {
    // Xóa các mục cũ hơn 1 giờ (để tránh rò rỉ bộ nhớ)
    const ONE_HOUR = 3600000;
    for (const ip in notificationCache) {
        if (currentTime - notificationCache[ip] > ONE_HOUR) {
            delete notificationCache[ip];
        }
    }
}

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
    return extraInfo && (
        extraInfo.includes('Địa chỉ:') ||
        extraInfo.includes('Chi tiết:') ||
        extraInfo.includes('Vị trí từ IP') ||
        extraInfo.includes('Tọa độ')
    );
}

/**
 * Tạo liên kết đến Google Maps dựa trên tọa độ hoặc địa chỉ
 * @param {String} extraInfo - Thông tin bổ sung
 * @returns {String} - HTML chứa liên kết đến Google Maps
 */
function getMapsLink(extraInfo) {
    // Ưu tiên tìm tọa độ chính xác từ extraInfo
    const coordsMatch = extraInfo.match(/📍 Tọa độ[^:]*: ([0-9.-]+), ([0-9.-]+)/);
    if (coordsMatch && coordsMatch.length >= 3) {
        const lat = coordsMatch[1];
        const lng = coordsMatch[2];
        if (isValidCoords(lat, lng)) {
            return `<a href="https://www.google.com/maps?q=${lat},${lng}">🗺️ Xem vị trí chính xác trên Google Maps</a>`;
        }
    }

    // Nếu không tìm thấy tọa độ chính xác, tìm tọa độ từ IP
    const ipCoordsMatch = extraInfo.match(/📌 Vị trí từ IP[^:]*: ([0-9.-]+), ([0-9.-]+)/);
    if (ipCoordsMatch && ipCoordsMatch.length >= 3) {
        const lat = ipCoordsMatch[1];
        const lng = ipCoordsMatch[2];
        if (isValidCoords(lat, lng)) {
            return `<a href="https://www.google.com/maps?q=${lat},${lng}">🗺️ Xem vị trí IP trên Google Maps</a>`;
        }
    }

    // Nếu có địa điểm IP
    const ipLocationMatch = extraInfo.match(/🏙️ Địa điểm IP: ([^,]+), ([^,\n]+)/);
    if (ipLocationMatch && ipLocationMatch.length >= 3) {
        const city = encodeURIComponent(ipLocationMatch[1]);
        const country = encodeURIComponent(ipLocationMatch[2]);
        return `<a href="https://www.google.com/maps/search/?api=1&query=${city}+${country}">🗺️ Xem thành phố trên Google Maps</a>`;
    }

    // Nếu không có tọa độ nhưng có địa chỉ, tìm địa chỉ
    const addressMatch = extraInfo.match(/🏡 Địa chỉ: (.*?)(?:\n|$)/);
    if (addressMatch && addressMatch.length >= 2) {
        const address = encodeURIComponent(addressMatch[1]);
        return `<a href="https://www.google.com/maps/search/?api=1&query=${address}">🗺️ Xem địa chỉ trên Google Maps</a>`;
    }

    // Nếu có thông tin chi tiết địa chỉ
    const detailMatch = extraInfo.match(/📮 Chi tiết: (.*?)(?:\n|$)/);
    if (detailMatch && detailMatch.length >= 2) {
        const detail = encodeURIComponent(detailMatch[1]);
        return `<a href="https://www.google.com/maps/search/?api=1&query=${detail}">🗺️ Xem địa điểm trên Google Maps</a>`;
    }

    // Nếu có vùng ước tính
    const regionMatch = extraInfo.match(/🌎 Vùng ước tính: ([^,]+), ([^,\n]+)/);
    if (regionMatch && regionMatch.length >= 3) {
        const continent = encodeURIComponent(regionMatch[1]);
        const city = encodeURIComponent(regionMatch[2]);
        return `<a href="https://www.google.com/maps/search/?api=1&query=${city}+${continent}">🗺️ Xem vùng ước tính trên Google Maps</a>`;
    }

    return '';
}

module.exports = sendIPNotification; 