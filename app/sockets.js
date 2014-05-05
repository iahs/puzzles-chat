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
                    return;
                };

                quiz.chatIsActive = isActive;
                quiz.save();
                io.sockets.in(roomName(permalink, 'chat')).emit('admin:chatStatusUpdated', isActive);
                // TODO: send some message to the chat directive
            });
        });

        socket.on('admin:activateQuestion', function (question) {

            // Mongo update does not work
            quizQuery(permalink).exec(function (err, quiz) {
                quiz.activeQuestionId = mongoose.Types.ObjectId(question._id);
                quiz.save();
                io.sockets.in(admin_prefix+permalink).emit('admin:questionActivated', question);
                io.sockets.in(roomName(permalink, 'admin')).emit('admin:questionActivated', question);

                // Send simple version to client
                var alternatives = getClientActiveQuestion(quiz);

                io.sockets.in(permalink).emit('client:questionActivated', alternatives);

            });

            // TODO: send some message to the chat directive

            
        });

        socket.on('admin:deactivateQuestion', function () {
            // There can only be one active
            quizQuery(permalink).exec(function (err, quiz) {
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
                quiz.questions.push(question);
                quiz.save(function () {
                    io.sockets.in(roomName(permalink, 'admin')).emit('admin:questionChange', quiz.questions[quiz.questions.length-1]);
                });
            });
        });

        /**
         * TODO: not implemented
         */
        socket.on('admin:removeQuestion', function (questionId) {


        });

        /**
         * TODO: not implemented
         * alternative has the property questionId
         */
        socket.on('admin:addAlternative', function (alternative) {
            quizQuery(permalink).exec(function (err, quiz) {
                if (!quiz) return;
                var updatedQuestion;
                for (var i=0; i<quiz.questions.length; i++) {
                    if (quiz.questions[i]._id.equals(alternative.questionId)) {
                        console.log("FOUND MATCH")
                        quiz.questions[i].alternatives.push(alternative);
                        updatedQuestion = quiz.questions[i];
                        break;
                    };
                };
                quiz.save(function (err) {
                    console.log("updated question");
                    console.log(updatedQuestion);
                    io.sockets.in(roomName(permalink, 'admin')).emit('admin:questionChange', updatedQuestion);
                });
            });
        });

        socket.on('admin:addGroup', function (groupPermalink) {

            Group.findOne({permalink:groupPermalink}, function (err, group) {
                if (!group) return;
                quizQuery(permalink).exec(function (err, quiz) {
                    quiz.groups.push(group._id);
                    quiz.save(function (err) {
                        // Notify client
                    })
                })
            })
        })

        socket.on('test:newanswer', function (id) {
            io.sockets.in(roomName(permalink, 'admin')).emit('admin:newanswer', id);
        });

        socket.on('studentclient:question', function(data) {
            socket.broadcast.to(roomName(permalink, 'client')).emit('server:question', data);
        });


        /***************************
         * Classes (group of users)
         * Uses admin namespace for messages
         ***************************/
        socket.on('admin:group:addMembers', function (groupData) {
            if (! groupData || !groupData.emailString) return;
            Group.findOne({ permalink: groupData.permalink }, function (err, group) {
                if (!group) return;
                console.log('got data to add')

                // Extract email addresses from a comma-separated string
                var emails = groupData.emailString.replace(/\s+/g, '').split(',');
                console.log(emails);

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

    console.log(">>>> Getting Client question");

    if (!quiz.activeQuestionId) {
        console.log(">>>> NO active question!!!");
        return {};
    }

    // find the active question
    for (var i = 0; i < quiz.questions.length; ++i) {
        var question = quiz.questions[i];
        if ((question._id).toString() === (quiz.activeQuestionId).toString()) {

            // Send simple version to client
            var q = { question:question.question, alternatives:[], questionId: question._id, selectedAnswer: "" };

            question.alternatives.forEach(function (d) {
                console.log(">>>>>>" + d.name);
                q.alternatives.push({name: d.name});
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
    return quiz.owner.equals(userId);
}
