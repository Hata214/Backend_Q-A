const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: 'Ẩn danh',
        validate: {
            validator: function (v) {
                // Nếu để trống hoặc là "Ẩn danh" thì hợp lệ
                if (!v || v === 'Ẩn danh') return true;

                // Kiểm tra tên tiếng Việt có dấu
                // Regex này kiểm tra:
                // - Tên phải có ít nhất 2 từ (họ và tên)
                // - Mỗi từ phải bắt đầu bằng chữ cái hoa
                // - Chứa các ký tự Unicode tiếng Việt (có dấu)
                // - Không chứa số hoặc ký tự đặc biệt
                const vietnameseNameRegex = /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]*(?: [A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]*)+$/;

                return vietnameseNameRegex.test(v);
            },
            message: props => `${props.value} không phải là họ tên tiếng Việt hợp lệ. Vui lòng nhập họ và tên đầy đủ có dấu.`
        }
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    answer: {
        type: String,
        trim: true,
        default: ''
    },
    isAnswered: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Question', QuestionSchema); 