// app/routes.js
module.exports = function(app, passport) {
    app.get('/', function (req, res) {
        res.render('index');
    });

    app.get('/login', function(req, res) {
        res.render('login', { message: req.flash('info') });
    });

    app.post('/login', passport.authenticate('local-login', {
        successRedirect : '/admin',
        failureRedirect : '/login',
        failureFlash : true // allow flash messages
    }));

    app.get('/signup', function(req, res) {
        res.render('signup');
    });

    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect : '/admin',
        failureRedirect : '/signup',
        failureFlash : true // allow flash messages
    }));

    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });
};
