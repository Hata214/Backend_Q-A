const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

// GET all questions
router.get('/', questionController.getQuestions);

// GET a single question
router.get('/:id', questionController.getQuestionById);

// POST a new question
router.post('/', questionController.createQuestion);

// PUT (answer) a question
router.put('/:id/answer', questionController.answerQuestion);

// DELETE a question
router.delete('/:id', questionController.deleteQuestion);

module.exports = router; 