// app/routes.js
Quiz = require('./models/quiz');
module.exports = function(app, passport) {
    app.get('/', function (req, res) {

        Quiz.where('activeQuestionId').ne(null)
            .where('isPrivate').equals(false)
            .exec(function (err, quizzes) {
                res.render('index', { quizzes: quizzes, isLoggedIn: req.isAuthenticated()});
            });
    });

    app.get('/login', function(req, res) {
        res.render('login', { message: req.flash('message') });
    });

    app.post('/login', passport.authenticate('local-login', {
        successRedirect : '/admin',
        failureRedirect : '/login',
        failureFlash : true // allow flash messages
    }));

    app.get('/signup', function(req, res) {
        res.render('signup', { message: req.flash('message') });
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

    app.get('/quiz/:permalink', isLoggedIn, function (req, res) {
        Quiz.findOne({permalink: req.params.permalink}, function(err, quiz) {
           if (quiz) {
               res.render('client');
           } else {
               res.render('admin/new', { permalink: req.params.permalink });
           }
        });
    });
};

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    req.flash('message', 'Please sign in to take quizzes');
    res.redirect('/login ');
}
