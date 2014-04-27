var mongoose = require('mongoose') || "ERROR", // hack for my IDE auto-completion
    Question = require('./question') || "ERROR",
    User = require('./user');

var quizSchema = mongoose.Schema({

    name: String,
    permalink: { type: String, unique: true },
    description: String,
    questions: [Question.schema],
    chatIsActive: Boolean,
    activeQuestionId: { type: mongoose.Schema.Types.ObjectId },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // TODO: allow for multiple admins

});

module.exports = mongoose.model('Quiz', quizSchema);
