var Quiz = require('../app/models/quiz.js'),
    Question = require('../app/models/question.js');

module.exports = function(app) {
    /**
     * List a users quizzes, profile, and recently answered questions
     */
    app.get('/admin', isLoggedIn, function(req, res) {

        Quiz.find({ owner: req.user._id })
            .exec()
            .then(function (quizzes) {
                res.render('admin/index', { user: req.user, quizzes: quizzes });
            });
    });

    /**
     * Manage a quiz
     */
    app.get('/admin/quiz/:permalink', function (req, res) {
        Quiz.findOne({permalink: req.params.permalink}).exec(function(err, quiz) {
           if (quiz) {
               // TODO: add authentication here to check that user is admin for quiz
               res.render('admin/show');
           } else {
               res.render('admin/new', {permalink: req.params.permalink });
           };
        });
    });

    /**
     * Form to edit an existing quiz
     */
    app.get('/admin/quiz/:permalink/edit', function (req, res) {
        Quiz.findOne({permalink: req.params.permalink}, function(err, quiz) {
            if (quiz) {
                // TODO: add authentication here to check that user is admin for quiz
                res.render('admin/edit', {quiz: quiz});
            } else {
                res.redirect('admin/quiz/' + req.params.permalink);
            };
        });
    });

    /**
     * Create a new quiz
     */
    app.post('/admin/quiz/:permalink', function (req, res) {
        // Add authentication, and creator id
        var quiz = new Quiz();

        quiz.name = req.body.title;
        quiz.description = req.body.description;
        quiz.permalink = req.params.permalink;
        quiz.owner = req.user._id;
        quiz.topics = [];

        quiz.save(function (err) {
            if (err)
                throw err;
            res.redirect('/admin/quiz/' + req.params.permalink);
        });
    });

    /**
     * Update an existing quiz
     * TODO: move to sockets
     */
    app.put('/admin/quiz/:permalink', function (req, res) {
        console.log("PUT", req.body.name);
        // Add authentication, and creator id
        Quiz.findOne({permalink: req.params.permalink}, function(err, quiz) {
            if (quiz) {
                quiz.name = "NAME";
                quiz.save(function (err) {
                    if (err)
                        res.send(err);
                    res.redirect('/admin/quiz/' + req.params.permalink);
                });
            } else {
                res.send("Error");
            };

        });
    })

};

// TODO: refactor and merge with method
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    req.flash('message', 'Please sign in to create or manage quizzes');
    res.redirect('/login ');
}
