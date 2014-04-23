var mongoose = require('mongoose') || "ERROR", // hack for my IDE auto-completion
    User = require('./user');

var answerSchema = mongoose.Schema({
    // Ref to user here
    answer: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

});
var Answer = mongoose.model('Answer', answerSchema);

// Define database schema
var questionSchema = mongoose.Schema({

    question: String,
    alternatives: [String],
    answers: [answerSchema]

});



module.exports = mongoose.model('Question', questionSchema);


