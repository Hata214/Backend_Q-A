const mongoose = require('mongoose');

const ipLogSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        default: ''
    },
    time: {
        type: Date,
        default: Date.now
    },
    path: {
        type: String,
        default: '/'
    },
    referrer: {
        type: String,
        default: ''
    },
    language: {
        type: String,
        default: ''
    },
    screenSize: {
        width: Number,
        height: Number
    },
    timeZone: {
        type: String,
        default: ''
    },
    location: {
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        altitude: Number,
        altitudeAccuracy: Number,
        heading: Number,
        speed: Number,
        address: String,
        addressDetails: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    clientInfo: {
        // Lưu trữ các thông tin bổ sung dưới dạng đối tượng
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

module.exports = mongoose.model('IPLog', ipLogSchema); 