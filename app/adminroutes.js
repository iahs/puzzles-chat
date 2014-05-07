var Quiz = require('../app/models/quiz.js'),
    Question = require('../app/models/question.js'),
    Group = require('../app/models/group.js');

module.exports = function(app) {
    /**
     * List a users quizzes, profile, and recently answered questions
     * Only available for users that are signed in
     */
    app.get('/admin', isLoggedIn, function(req, res) {
        Quiz.find({ owner: req.user._id }, function (err, quizzes) {
            res.render('admin/index', { user: req.user, quizzes: quizzes, message: req.flash('message') });
        });
    });

    app.get('/admin/groups', isLoggedIn, function(req, res) {
        Group.find({ owner: req.user._id }, function (err, groups) {
            res.render('admin/groups', { user: req.user, groups: groups });
        });
    });

    /**
     * Manage a quiz
     */
    app.get('/admin/quiz/:permalink', isLoggedIn, function (req, res) {
        Quiz.findOne({permalink: req.params.permalink}, function(err, quiz) {
           if (quiz) {
               // Authentication is handled via sockets
               res.render('admin/show');
           } else {
               res.render('admin/new', { permalink: req.params.permalink });
           }
        });
    });
    app.get('/admin/quiz/:permalink/details', isLoggedIn, function (req, res) {
        Quiz.findOne({permalink: req.params.permalink})
            .populate('questions.alternatives.answers.owner')
            .exec(function(err, quiz) {
            if (quiz && quiz.owner.equals(req.user._id) ) {
                quiz.questions.forEach(function (q) {
                    q.answers = [];
                    q.alternatives.forEach(function (alt) {
                        alt.answers.forEach(function (ans) {
                            ans.isCorrect = alt.isCorrect;
                            ans.answer = alt.name;
                            q.answers.push(ans);
                        });
                    });
                    q.answers.sort(function (a,b) {
                        return a<b;
                    });
                });
                res.render('admin/details', {quiz: quiz});
            } else {
                req.flash('message', "You are not allowed to view details for this quiz");
                res.redirect('/admin');
            };
        });
    });

    /**
     * Create a new quiz
     */
    app.post('/admin/quiz/:permalink', isLoggedIn, function (req, res) {
        Quiz.findOne({permalink: req.params.permalink}, function (err, oquiz) {
            if (oquiz) {
                // The permalink is already taken
                req.flash('message', 'This permalink is already taken');
                res.redirect('/admin');
            } else  {
                var quiz = new Quiz();
                quiz.name = req.body.name;
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
            }
        })
    });

    /**
     * Delete a quiz
     */
    app.post('/admin/quiz/:permalink/delete', isLoggedIn, function (req, res) {
        Quiz.findOneAndRemove({permalink: req.params.permalink}, function (err) {
            res.redirect('/admin');
        });
    });

    app.get('/admin/group/:permalink', isLoggedIn, function (req, res) {
        Group.findOne({permalink: req.params.permalink}, function(err, group) {
            if (group) {
                if (group.owner.equals(req.user._id)) {
                    res.render('admin/group');
                } else {
                    req.flash('message', 'You are not allowed to edit the group ' + group.permalink);
                    res.redirect('/admin');
                }
            } else {
                res.render('admin/newGroup', { permalink: req.params.permalink });
            };
        });
    });

    /**
     * Create a new group
     */
    app.post('/admin/group/:permalink', isLoggedIn, function (req, res) {
        Group.findOne({permalink: req.params.permalink}, function (err, ogroup) {
            if (ogroup) {
                req.flash('message', 'The permalink ' + group.permalink + ' is already taken for groups');
                res.redirect('/admin');
            } else  {
                var group = new Group();
                group.name = req.body.name;
                group.description = req.body.description;
                group.permalink = req.params.permalink;
                group.owner = req.user._id;
                group.members = [];

                group.save(function (err) {
                    if (err)
                        throw err;
                    res.redirect('/admin/group/' + req.params.permalink);
                });
            }
        })
    });

    /**
     * Delete a group
     */
    app.post('/admin/group/:permalink/delete', isLoggedIn, function (req, res) {
        Group.findOneAndRemove({permalink: req.params.permalink}, function (err) {
            res.redirect('/admin/groups');
        });
    });

    // Editing and updating is done over sockets
};

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    req.flash('message', 'Please sign in to create or manage quizzes');
    res.redirect('/login ');
}
