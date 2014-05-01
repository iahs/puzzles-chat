var Quiz = require('../app/models/quiz.js'),
    Question = require('../app/models/question.js');

module.exports = function(app) {
    /**
     * List a users quizzes, profile, and recently answered questions
     * Only available for users that are signed in
     */
    app.get('/admin', isLoggedIn, function(req, res) {
        Quiz.find({ owner: req.user._id }, function (err, quizzes) {
            res.render('admin/index', { user: req.user, quizzes: quizzes });
        });
    });

    /**
     * Manage a quiz
     */
    app.get('/admin/quiz/:permalink', isLoggedIn, function (req, res) {
        Quiz.findOne({permalink: req.params.permalink}, function(err, quiz) {
           if (quiz) {
               // TODO: add authentication here to check that user is admin for quiz
               res.render('admin/show');
           } else {
               res.render('admin/new', { permalink: req.params.permalink });
           };
        });
    });
    app.get('/admin/quiz/:permalink/details', function (req, res) {
        Quiz.findOne({permalink: req.params.permalink}, function(err, quiz) {
            if (quiz) {
                quiz.questions.forEach(function (q) {
                    q.answerCount = 0;
                    q.alternatives.forEach(function (a) {
                        q.answerCount += a.answers.length;
                    });
                });

                // TODO: add authentication here to check that user is admin for quiz
                res.render('admin/details', {quiz: quiz});
            } else {
                res.send("Not found");
            };
        });
    });

    /**
     * Create a new quiz
     */
    app.post('/admin/quiz/:permalink', isLoggedIn, function (req, res) {
        // Add authentication, and creator id
        var quiz = new Quiz();

        quiz.name = req.body.title;
        quiz.description = req.body.description;
        quiz.permalink = req.params.permalink;
        quiz.owner = req.user._id;
        quiz.topics = [];
        quiz.chatIsActive = 1;

        quiz.save(function (err) {
            if (err)
                throw err;
            res.redirect('/admin/quiz/' + req.params.permalink);
        });
    });





    // Editing and updating is done over sockets
};

// TODO: refactor and merge with method
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    req.flash('message', 'Please sign in to create or manage quizzes');
    res.redirect('/login ');
}
