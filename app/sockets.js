var Quiz = require('./models/quiz'),
    Question = require('./models/question'),
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
        socket.on('chat:init', function () {
            socket.join(roomName(permalink, 'chat'));
            socket.emit('chat:roomStatus',rooms[permalink]);
        });

        socket.on('chatclient:message', function(data) {
            if(currentUser)
                data.sender = currentUser;
            Quiz.findOneAndUpdate( {permalink: permalink, "topics.index": data.topic}, {$push: {"topics.$.messages": data}}, function(err, result){ });
            socket.broadcast.to(roomName(permalink, 'chat')).emit('chat:message', data);
            socket.emit('chat:message', data); // Send message to sender
            rooms[permalink][data.topic].messages.push(data);
        });

        socket.on('chatclient:topic', function(data) {
            data.index = rooms[permalink].length;
            data.messages = [];
            if(currentUser)
                data.sender = currentUser;
            Quiz.findOneAndUpdate( {permalink: permalink }, {$push: {topics: data}}, function(err, result){ });
            socket.broadcast.to(roomName(permalink, 'chat')).emit('chat:topic', data);
            rooms[permalink].push(data);

            // Send topic to sender
            data.isOwn = true;
            socket.emit('chat:topic', data);
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
                io.sockets.in(roomName(permalink, 'admin')).emit('admin:chatStatusUpdated', isActive);
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

        socket.on('admin:removeQuestion', function () {

        });

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

        socket.on('test:newanswer', function (id) {
            io.sockets.in(roomName(permalink, 'admin')).emit('admin:newanswer', id);
        });

        socket.on('studentclient:question', function(data) {
            socket.broadcast.to(roomName(permalink, 'client')).emit('server:question', data);
        });
    });
};

/**
 * Query that get one quiz by current permalink
 * @returns {*}
 */
function quizQuery(permalink) {
    return Quiz.findOne({ permalink: permalink });
};

