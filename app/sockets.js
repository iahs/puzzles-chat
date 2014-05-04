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
        currentUser = socket.handshake.user.local.username || socket.handshake.user.local.email;

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
                quiz.chatIsActive = isActive;
                quiz.save();
                io.sockets.in(roomName(permalink, 'chat')).emit('admin:chatStatusUpdated', isActive);
                // TODO: send some message to the chat directive
            });
        });

        socket.on('admin:activateQuestion', function (question) {
            console.log('Activating question', question);
            // Mongo update does not work
            quizQuery(permalink).exec(function (err, quiz) {
                quiz.activeQuestionId = mongoose.Types.ObjectId(question._id);
                quiz.save();
                io.sockets.in(roomName(permalink, 'admin')).emit('admin:questionActivated', question);
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
         */
        socket.on('admin:addAlternative', function (question, alternative) {
            if (!permalink) return;
            quizQuery(permalink).exec(function (err, quiz) {
                var updatedQuestion;
                for (var i=0; i<quiz.questions.length; i++) {
                    var q = quiz.questions[i]
                    if (q._id === question._id) {
                        q.alternatives.push(alternative);
                        updatedQuestion = q;
                    };
                };
                quiz.save(function (err) {
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

/**
 * Super simple check too see if
 * a string resembles an email
 * @param email
 * @returns {*|boolean}
 */
function validateEmail(email) {
    return  /(.+)@(.+){1,}\.(.+){1,}/.test(email);
}