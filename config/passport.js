var LocalStrategy = require('passport-local').Strategy,
    User = require('../app/models/user');

module.exports = function (passport) {

    // Serialize user for passport (required)
    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    // Unserialize user for passport (required)
    passport.deserializeUser(function (id, done) {
        User.findById(id, function (err, user) {
            done(err, user);
        });
    });


    /*
     * Passport strategy for local signup
     */
    passport.use('local-signup', new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true // allows us to pass back the entire request to the callback
        },
        function (req, email, password, done) {

            // asynchronous
            // User.findOne will only fire if data is sent back
            process.nextTick(function () {
                User.findOne({ 'local.email': email }, function (err, user) {
                    if (err)
                        return done(err);

                    // make sure the email is unique
                    if (user) {
                        return done(null, false, req.flash('message', 'That email is already taken.'));
                    } else {

                        var newUser = new User();

                        newUser.local.email = email;
                        newUser.local.password = newUser.generateHash(password);

                        newUser.save(function (err) {
                            if (err)
                                throw err;
                            return done(null, newUser);
                        });
                    }

                });

            });
        }
    ));

    /*
     * Passport strategy for local login
     */
    passport.use('local-login', new LocalStrategy({
            usernameField: 'email', // username by default
            passwordField: 'password',
            passReqToCallback: true // allows us to pass back the entire request to the callback
        },
        function (req, email, password, done) {
            User.findOne({ 'local.email': email }, function (err, user) {
                if (err)
                    return done(err);

                if (!user)
                    return done(null, false, req.flash('info', 'No user found.')); // req.flash is part of connect-flash middleware

                if (!user.isValidPassword(password))
                    return done(null, false, req.flash('info', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata

                // Successful login
                return done(null, user);
            });

        }));
};
