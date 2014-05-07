var mongoose = require('mongoose') || "Error",
    bcrypt   = require('bcrypt-nodejs');

// Define database schema
var userSchema = mongoose.Schema({
    local            : {
        username     : String,
        email        : String,
        password     : String
    },
});

// Hash function for passwords
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// Check if a password is valid
userSchema.methods.isValidPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

module.exports = mongoose.model('User', userSchema);
