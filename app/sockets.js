var Quiz = require('./models/quiz'),
    Question = require('./models/question'),
    Group = require('./models/group'),
    User = require('./models/user'),
    passport = require('passport') || 'ERROR',
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
            currentUserId = socket.handshake.user._id;

        /**
         * Join a room for a specific quiz
         * Will be added to chat and client,
         * and admin if flag is set to true
         * room = { name: 'string', admin: boolean }
         */
        socket.on('join_room', function (room) {
            // TODO: Verify that user is authenticated and has access to room
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
            }

            // Separate room for admin commands
            if (room.admin === true) {
                socket.join(roomName(permalink, 'admin'));
                // Send admin init data
                quizQuery(permalink).exec(function (err, quiz) {
                    socket.emit( 'admin:initdata', quiz );
                });
            } else {

                // for a student client, should join room and then 
                // send over the active question from the DB
                socket.join(permalink);

                quizQuery(permalink).exec(function (err, quiz) {
                    socket.emit( 'client:initdata', getClientActiveQuestion(quiz));
                });
                
            };

            // Join the room
            socket.join(roomName(permalink, 'client'));
        });

        /***************************
         * Chat
         ***************************/
        socket.on('chatclient:init', function () {
            socket.join(roomName(permalink, 'chat'));
            socket.emit('chatserver:roomStatus',rooms[permalink]);
            quizQuery(permalink).exec(function (err, quiz) {
                if(quiz) socket.emit('admin:chatStatusUpdated', quiz.chatIsActive);
            });
        });

        socket.on('chatclient:message', function(data) {
            if(currentUser)
                data.sender = currentUser;
            rooms[permalink][data.topic].messages.push(data);
            Quiz.findOneAndUpdate( {permalink: permalink, "topics.index": data.topic}, {$push: {"topics.$.messages": data}}, function(err, result){ });
            io.sockets.in(roomName(permalink, 'chat')).emit('chatserver:message', data);
        });

        socket.on('chatclient:topic', function(data) {
            data.index = rooms[permalink].length;
            data.messages = [];
            if(currentUser)
                data.sender = currentUser;
            rooms[permalink].push(data);
            Quiz.findOneAndUpdate( {permalink: permalink }, {$push: {topics: data}}, function(err, result){ });
            io.sockets.in(roomName(permalink, 'chat')).emit('chatserver:topic', data);
            socket.emit('chatserver:selectTopic', data.index); // Make sender select new topic
        });
        
        /***************************
         * Charts
         ***************************/
         // TODO: remove this. Just for demo purposes
         socket.on('chartclient:series', function(data) {
            socket.broadcast.to(roomName(permalink, 'client')).emit('chart:series', data);
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
                var alternatives = getClientActiveQuestion(quiz);
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
            });
        });

        socket.on('admin:addQuestion', function (question) {
            if (!permalink)
                return;

            // TODO: format the question properly before pushing it into the database
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
                if (!quiz) {
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

        socket.on('test:newanswer', function (id) {
            io.sockets.in(roomName(permalink, 'admin')).emit('admin:newanswer', id);
        });

        socket.on('studentclient:question', function(data) {
            socket.broadcast.to(roomName(permalink, 'client')).emit('server:question', data);
        });


        socket.on('client:answer', function (data) {
            // update the answer and send it to the admin
            console.log(JSON.stringify(data));
            console.log(data.selectedAnswer);
            quizQuery(permalink).exec(function (err, quiz) {
                
                console.log(JSON.stringify(quiz));

                // if question is no longer the active question, do not update
                if (!(data.questionId == quiz.activeQuestionId)) {
                    console.log("It is not equal"); 
                    return;
                }
                else {

                    var question = null;
                    // find the active question
                    for (var i = 0; i < quiz.questions.length; ++i) {
                        if (quiz.questions[i]._id.equals(quiz.activeQuestionId)) {
                            question = quiz.questions[i];
                        }
                    };

                    if (!question) {
                        // XXX: Debug, question does not exist
                        return;
                    }

                    // loop through the alternatives to update the selected answer
                    // loop does two things:
                    //     1) save the new answer
                    //     2) remove the previously saved answer
                    for (var i = 0; i < question.alternatives.length; ++i) {

                        // loop through the answers and remove the answer if it
                        // already exists
                        for (var j = 0; j < question.alternatives[i].answers.length; ++j) {

                            // remove it if the answer already exists
                            if (question.alternatives[i].answers[j] == currentUser) {
                                question.alternatives[i].answers.splice(j, 1);
                            }
                        }
                        
                        // input the new answer
                        if (question.alternatives[i]._id.equals(data.selectedAnswer)) {
                            question.alternatives[i].answers.push(currentUser);
                        }

                    }

                    quiz.save(function (err) {
                        
                    });
                }
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
              var index = group.members.indexOf(data.email);
              group.members.splice(index, 1);
              group.save(function (err) {
                  socket.emit('admin:groupData', group)
              });
          });
        });

        socket.on('admin:manage_group', function (permalink) {
            // Todo: check group owner vs user id for access
            Group.findOne({ permalink: permalink }, function (err, group) {
                socket.emit('admin:groupData', group)
            });
        });
    });
};

/**
 * Query that get one quiz by current permalink
 * @returns {*}
 */
function quizQuery(permalink) {
    // Todo: move populate to where we need it
    return Quiz.findOne({ permalink: permalink }).populate('groups');
};


/* * * * * * * * * *
* @brief: get active question for client from a quiz
*
* @param[in]: quiz
*
* @return active question object
* * * * * * * * * */
function getClientActiveQuestion(quiz) {

    if (!quiz.activeQuestionId) {
        console.log(">>>> NO active question!!!");
        return {};
    }

    // find the active question
    for (var i = 0; i < quiz.questions.length; ++i) {
        var question = quiz.questions[i];
        if (question._id.equals(quiz.activeQuestionId)) {

            // Send simple version to client
            var q = { question:question.question, alternatives:[], questionId: question._id, selectedAnswer: "" };

            question.alternatives.forEach(function (d) {
                console.log(">>>>>>" + d.name);
                q.alternatives.push({name: d.name, id: d.id});
            });

            return q;
        
        }
    };
        
    console.log(">>>> Could not find active question!!!: " +
    quiz.activeQuestionId);

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
