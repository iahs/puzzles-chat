var mongoose = require('mongoose') || "ERROR", // hack for my IDE auto-completion
    User = require('./user') || 'ERROR';

var groupSchema = mongoose.Schema({
    name: String,
    permalink: { type: String, unique: true },
    description: String,
    members: [String], // list of email addresses
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Group', groupSchema);

