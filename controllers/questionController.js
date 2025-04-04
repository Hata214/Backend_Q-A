const Question = require('../models/Question');
const telegramService = require('../services/telegramService');

// Get all questions
exports.getQuestions = async (req, res) => {
    try {
        const questions = await Question.find().sort({ createdAt: -1 });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a single question by ID
exports.getQuestionById = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }
        res.json(question);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new question
exports.createQuestion = async (req, res) => {
    try {
        const { content, name } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Nội dung câu hỏi là bắt buộc' });
        }

        // Kiểm tra tên tiếng Việt nếu có
        if (name && name.trim() !== '' && name !== 'Ẩn danh') {
            // Regex kiểm tra tên tiếng Việt có dấu
            const vietnameseNameRegex = /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]*(?: [A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]*)+$/;

            if (!vietnameseNameRegex.test(name.trim())) {
                return res.status(400).json({
                    message: 'Họ tên không hợp lệ. Vui lòng nhập họ và tên đầy đủ bằng tiếng Việt có dấu.',
                    field: 'name'
                });
            }
        }

        // Tạo câu hỏi mới
        const newQuestion = new Question({
            content,
            name: name && name.trim() !== '' ? name.trim() : 'Ẩn danh'
        });

        const savedQuestion = await newQuestion.save();

        // Gửi thông báo qua Telegram
        await telegramService.sendNewQuestionNotification(savedQuestion);

        res.status(201).json(savedQuestion);
    } catch (error) {
        // Xử lý lỗi validation từ Mongoose
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: error.message,
                field: Object.keys(error.errors)[0]
            });
        }
        res.status(500).json({ message: error.message });
    }
};

// Answer a question
exports.answerQuestion = async (req, res) => {
    try {
        const { answer } = req.body;

        if (!answer) {
            return res.status(400).json({ message: 'Answer content is required' });
        }

        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }

        question.answer = answer;
        question.isAnswered = true;

        const updatedQuestion = await question.save();

        // Gửi thông báo trả lời qua Telegram
        await telegramService.sendNewAnswerNotification(updatedQuestion);

        res.json(updatedQuestion);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a question
exports.deleteQuestion = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }

        await Question.findByIdAndDelete(req.params.id);
        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 