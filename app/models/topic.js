var mongoose = require('mongoose') || "ERROR", // hack for my IDE auto-completion
    User = require('./user');

var messageSchema = mongoose.Schema({
    topic: Number,
    title: String,
    sender: String,
    created: { type : Date, default: Date.now }
});

var topicSchema = mongoose.Schema({
    title: String,
    messages: [messageSchema],
    index: Number,
    sender: String,
    created: { type : Date, default: Date.now }
});

module.exports = mongoose.model('Topic', topicSchema);
