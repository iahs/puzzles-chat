var Quiz = require('./models/quiz'),
    Question = require('./models/question'),
    Group = require('./models/group'),
    User = require('./models/user'),
    mongoose = require('mongoose') || 'ERROR';

// Distinguish between chat rooms
var roomName = function (permalink, type) {
    var separator = ':';
    switch (type) {
        case 'chat':
            return 'chat' + separator + permalink;
        case 'admin':
            return 'admin' + separator + permalink;
        case 'client':
            return 'client' + separator + permalink;
        default:
            throw new Error('Unknown room type');
    }
};

// Store the entire log in memory, and only write to database
// One instance shared across requests
var rooms = {};
Quiz.find({ }, function (err, quizzes) {
    quizzes.forEach(function(quiz){
        rooms[quiz.permalink]=quiz.topics;
    });
});

module.exports = function (io) {
    io.sockets.on('connection', function(socket) {
        var permalink,
            currentUser = socket.handshake.user.local.username || socket.handshake.user.local.email,
            currentUserId = socket.handshake.user._id,
            currentUserEmail = socket.handshake.user.local.email;

        /**
         * Join a room for a specific quiz
         * Will be added to chat and client,
         * and admin if flag is set to true
         * room = { name: 'string', admin: boolean }
         */
        socket.on('join_room', function (room) {
            // Can only be connected to one permalink
            if (permalink) {
                socket.leave(roomName(permalink, 'chat'));
                socket.leave(roomName(permalink, 'admin'));
                socket.leave(roomName(permalink, 'client'));
            };

            // set the new permalink
            permalink = room.name;

            // initialize room if not already in use
            if (rooms[permalink] === undefined) {
                rooms[permalink] = [];
            };

            // Get the quiz object for authorization of users
            quizQuery(permalink).exec(function (err, quiz) {
                if (!quiz || err) {
                    socket.emit('flash:message', {type: 'warning', message: "Could not find quiz " + permalink});
                    return;
                };
                if (room.admin === true) {
                    // The user requested admin rights
                    if (quiz.owner.equals(currentUserId)) {
                        socket.join(roomName(permalink, 'admin'));
                        // send admin init data
                        socket.emit( 'admin:initdata', quiz );
                        socket.emit( 'chatserver:isAdmin', true );
                    } else {
                        socket.emit('flash:message', {type: 'danger', message: "You do not have admin permissions for this quiz"});
                    }
                } else if (quiz && quiz.isPrivate) {
                    // The user tried to join a private quiz as a client
                    var hasAccess = false;
                    for (var i=0; i<quiz.groups.length; i++) {
                        if (quiz.groups[i].members.indexOf(currentUserEmail) > 0) {
                            hasAccess = true;
                            break;
                        };
                    }
                    if (hasAccess) {
                        socket.join(roomName(permalink, 'client'));
                        socket.emit( 'client:initdata', quiz.name, getClientActiveQuestion(quiz, currentUserId));
                    } else {
                        socket.emit('flash:message', {type: 'danger', message:" This is a private quiz. Please contact the owner for access"});
                    }
                } else {
                    // Quiz is public. Everyone can join
                    socket.join(roomName(permalink, 'client'));
                    socket.emit( 'client:initdata', quiz.name, getClientActiveQuestion(quiz, currentUserId));
                };
            })
        });

        /***************************
         * Chat
         ***************************/
        socket.on('chatclient:init', function () {
            socket.join(roomName(permalink, 'chat'));
            socket.emit('chatserver:roomStatus',rooms[permalink]);
            quizQuery(permalink).exec(function (err, quiz) {
                if (!quiz || err) {
                    socket.emit('flash:message', {type: 'warning', message: "Could not find quiz " + permalink});
                    return;
                };
                if(quiz) socket.emit('admin:chatStatusUpdated', quiz.chatIsActive);
            });
        });

        socket.on('chatclient:message', function(data) {
            if(currentUser)
                data.sender = currentUser;
            rooms[permalink][data.topic].messages.push(data);
            Quiz.findOneAndUpdate( {permalink: permalink, "topics.index": data.topic}, {$push: {"topics.$.messages": data}}).exec();
            io.sockets.in(roomName(permalink, 'chat')).emit('chatserver:message', data);
        });

        socket.on('chatclient:topic', function(data) {
            data.index = rooms[permalink].length;
            data.messages = [];
            if(currentUser)
                data.sender = currentUser;
            rooms[permalink].push(data);
            Quiz.findOneAndUpdate( {permalink: permalink }, {$push: {topics: data}}).exec();
            io.sockets.in(roomName(permalink, 'chat')).emit('chatserver:topic', data);
            socket.emit('chatserver:selectTopic', data.index); // Make sender select new topic
        });

        socket.on('admin:setChatStatus', function (status) {
            var isActive = !!status;

            // Mongo update does not work
            quizQuery(permalink).exec(function (err, quiz) {
                if (!canEditQuiz(currentUserId, quiz)) {
                    socket.emit('flash:message', {type: 'danger', message: 'You are not allowed to edit this quiz'});
                    return;
                };

                quiz.chatIsActive = isActive;
                quiz.save();
                io.sockets.in(roomName(permalink, 'chat')).emit('admin:chatStatusUpdated', isActive);
            });
        });

        socket.on('admin:setQuizPrivacy', function (status) {

            quizQuery(permalink).exec(function (err, quiz) {
                if (!canEditQuiz(currentUserId, quiz)) {
                    socket.emit('flash:message', {type: 'danger', message: 'You are not allowed to edit this quiz'});
                    return;
                };

                quiz.isPrivate = !quiz.isPrivate;
                quiz.save();
                io.sockets.in(roomName(permalink,
                'chat')).emit('admin:privacyStatusUpdated', quiz.isPrivate);
            });
        });

        socket.on('admin:activateQuestion', function (question) {
            // Mongo update does not work
            quizQuery(permalink).exec(function (err, quiz) {
                if (!canEditQuiz(currentUserId, quiz)) {
                    socket.emit('flash:message', {type: 'danger', message: 'You are not allowed to edit this quiz'});
                    return;
                };

                quiz.activeQuestionId = mongoose.Types.ObjectId(question._id);
                quiz.save();
                io.sockets.in(roomName(permalink, 'admin')).emit('admin:questionActivated', question);

                // Send simple version to client
                var alternatives = getClientActiveQuestion(quiz, currentUserId);
                io.sockets.in(roomName(permalink, 'client')).emit('client:questionActivated', alternatives);
            });
        });

        socket.on('admin:deactivateQuestion', function () {
            // There can only be one active
            quizQuery(permalink).exec(function (err, quiz) {
                if (!canEditQuiz(currentUserId, quiz)) {
                    socket.emit('flash:message', {type: 'danger', message: 'You are not allowed to edit this quiz'});
                    return;
                };
                quiz.activeQuestionId = null;
                quiz.save();
                io.sockets.in(roomName(permalink, 'admin')).emit('admin:questionDeactivated');
                io.sockets.in(roomName(permalink, 'client')).emit('client:questionDeactivated');
            });
        });

        socket.on('admin:addQuestion', function (question) {
            quizQuery(permalink).exec(function (err, quiz) {
                if (!canEditQuiz(currentUserId, quiz)) {
                    socket.emit('flash:message', {type: 'danger', message: 'You are not allowed to edit this quiz'});
                    return;
                };
                quiz.questions.push(question);
                quiz.save(function () {
                    io.sockets.in(roomName(permalink, 'admin')).emit('admin:questionChange', quiz.questions[quiz.questions.length-1]);
                    socket.emit('flash:message', {type: 'success', message: 'Question added'});
                });
            });
        });

        /**
         * We have decided that questions can't be deleted from quizzes.
         * This is just a reference in case we change our minds later
         */
        socket.on('admin:removeQuestion', function (questionId) { });

        /**
         * Add a new alternative to an existing question
         * The alternative argument has the property questionId
         */
        socket.on('admin:addAlternative', function (alternative) {
            console.log("Alternative added!")
            console.log(alternative);
            quizQuery(permalink).exec(function (err, quiz) {
                if (!quiz || err) {
                    socket.emit('flash:message', {type: 'warning', message: "Could not find quiz " + permalink});
                    return;
                };
                var updatedQuestion;
                for (var i=0; i<quiz.questions.length; i++) {
                    if (quiz.questions[i]._id.equals(alternative.questionId)) {
                        quiz.questions[i].alternatives.push(alternative);
                        updatedQuestion = quiz.questions[i];
                        break;
                    };
                };
                quiz.save(function (err) {
                    io.sockets.in(roomName(permalink, 'admin')).emit('admin:questionChange', updatedQuestion);

                    // send the updated alternatives to the client
                    var alternatives = getClientActiveQuestion(quiz, currentUserId);
                    io.sockets.in(roomName(permalink, 'client')).emit('client:questionActivated', alternatives);
                });
            });
        });

        socket.on('admin:addGroup', function (groupPermalink) {

            Group.findOne({permalink:groupPermalink}, function (err, group) {
                if (!group) {
                    socket.emit('flash:message', {type: 'warning', message: "Could not find group " + groupPermalink});
                };
                quizQuery(permalink).exec(function (err, quiz) {
                    var alreadyAdded = false;
                    for (var i=0; i<quiz.groups.length; i++) {
                        if (quiz.groups[i]._id.equals(group._id)) {
                            alreadyAdded = true;
                            break;
                        }
                    }
                    if (!alreadyAdded) {
                        quiz.groups.push(group._id);
                        quiz.save(function (err) {
                            io.sockets.in(roomName(permalink, 'admin')).emit('admin:groupChange', group);
                            socket.emit('flash:message', {type: 'success', message: "Group added"});
                        });
                    } else {
                        socket.emit('flash:message', {type: 'info', message: "Group has already been added to quiz"});
                    };
                });
            });
        });

        socket.on('client:answer', function (data) {
            // update the answer and send it to the admin
            quizQuery(permalink).exec(function (err, quiz) {
                if (!quiz || err) {
                    socket.emit('flash:message', {type: 'warning', message: "Could not find quiz " + permalink});
                    return;
                };

                var question = null;
                // find the active question
                for (var qid = 0; qid < quiz.questions.length; qid++) {
                    if (quiz.questions[qid]._id.equals(data.questionId)) {
                        question = quiz.questions[qid];
                        break;
                    }
                };

                if (!question) {
                    socket.emit('flash:message', { type: 'warning', message: 'Question does not exist'});
                    return;
                }

                var queryObj = {permalink: permalink},
                updateObj = {$push: {}};
                queryObj["questions." + qid + ".alternatives._id"] = data.selectedAnswer;
                updateObj.$push["questions." + qid + ".alternatives.$.answers"] = {owner: currentUserId};


                Quiz.update(queryObj, updateObj, function (err) {
                    io.sockets.in(roomName(permalink, 'admin')).emit('admin:answer', question._id, data.selectedAnswer, {created: new Date(), owner: currentUserId})
                    socket.emit('flash:message', {type: 'success', message: "Answer received"})
                });
            });
        });


        /***************************
         * Classes (group of users)
         * Uses admin namespace for messages
         ***************************/
        socket.on('admin:group:addMembers', function (groupData) {
            if (! groupData || !groupData.emailString) return;
            Group.findOne({ permalink: groupData.permalink }, function (err, group) {
                if (!group) {
                    socket.emit('flash:message', {type: 'danger', message: "Could not find group"});
                };

                // Extract email addresses from a comma-separated string
                var emails = groupData.emailString.replace(/\s+/g, '').split(',');

                emails.forEach(function (email) {
                    if (group.members.indexOf(email)<0 && validateEmail(email)) {
                        group.members.push(email);
                    }
                });
                group.save(function (err) {
                    socket.emit('admin:groupData', group)
                });

            });
        });

        socket.on('admin:group:removeMember', function (data) {
          Group.findOne({permalink: data.permalink}, function (err, group) {
              if (!group) {
                  socket.emit('flash:message', {type: 'danger', message: "Could not find group"});
              };
              var index = group.members.indexOf(data.email);
              group.members.splice(index, 1);
              group.save(function (err) {
                  socket.emit('admin:groupData', group)
              });
          });
        });

        socket.on('admin:manage_group', function (permalink) {
            Group.findOne({ permalink: permalink }, function (err, group) {
                if (!group) {
                    socket.emit('flash:message', {type: 'danger', message: "Could not find group"});
                };
                if (group.owner.equals(currentUserId)) {
                    socket.emit('admin:groupData', group)
                } else {
                    socket.emit('flash:message', { type: 'danger', message: 'You are not allowed to manage this group'})
                }
            });
        });
    });
};

/**
 * Query that get one quiz by current permalink
 * @returns {*}
 */
function quizQuery(permalink) {
    return Quiz.findOne({ permalink: permalink }).populate('groups');
};


/* * * * * * * * * *
* @brief: get active question for client from a quiz
* @return active question object
* * * * * * * * * */
function getClientActiveQuestion(quiz, currentUserId) {

    if (!quiz.activeQuestionId) {
        return {};
    }

    // find the active question
    for (var i = 0; i < quiz.questions.length; ++i) {
        var question = quiz.questions[i];
        if (question._id.equals(quiz.activeQuestionId)) {

            // Send simple version to client
            var q = { question:question.question, alternatives:[], questionId: question._id, selectedAnswer: "", name:question.name };

            question.alternatives.forEach(function (d) {
                q.alternatives.push({name: d.name, id: d.id});
                d.answers.forEach(function (a) {
                    if(a.owner.equals(currentUserId)) {
                        q.submitted = 1;
                    }
                });
            });
            return q;
        }
    };
    return {};
}


/**
 * Super simple check too see if
 * a string resembles an email
 * @param email
 * @returns {*|boolean}
 */
function validateEmail(email) {
    return  /(.+)@(.+){1,}\.(.+){1,}/.test(email);
}

/**
 *
 * @param String userId
 * @param Quiz quiz
 * @returns {Boolean|Bool|boolean|Query|*}
 */
function canEditQuiz(userId, quiz) {
    return quiz && quiz.owner && quiz.owner.equals(userId);
}
