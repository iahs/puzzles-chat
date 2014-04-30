var mongoose = require('mongoose') || "ERROR", // hack for my IDE auto-completion
    User = require('./user');

var answerSchema = mongoose.Schema({
    // Ref to user here
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    created: { type : Date, default: Date.now }
});

var alternativeSchema = mongoose.Schema({
    name: String,
    isCorrect: Boolean,
    answers: [answerSchema]
});

var questionSchema = mongoose.Schema({
    name: String,
    question: String,
    alternatives: [alternativeSchema]
});

module.exports = mongoose.model('Question', questionSchema);


