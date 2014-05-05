var mongoose = require('mongoose') || "ERROR", // hack for my IDE auto-completion
    Question = require('./question') || "ERROR",
    Topic = require('./topic') || "ERROR",
    User = require('./user'),
    Group = require('./group') || "Error";

var quizSchema = mongoose.Schema({
    name: String,
    permalink: { type: String, unique: true },
    description: String,
    questions: [Question.schema],
    chatIsActive: Boolean,
    activeQuestionId: { type: mongoose.Schema.Types.ObjectId },
    topics: [Topic.schema],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isPrivate: {type: Boolean, default: false},
    groups: [{type: mongoose.Schema.Types.ObjectId, ref: 'Group'}]
});

module.exports = mongoose.model('Quiz', quizSchema);

