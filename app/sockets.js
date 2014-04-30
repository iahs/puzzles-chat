var Quiz = require('./models/quiz'),
    Question = require('./models/question'),
    passport = require('passport') || 'ERROR';

// Distinguish between chat rooms
var admin_prefix    = 'admin:',
    chat_prefix     = 'chat';

// Store the entire log in memory, and only write to database
// One instance shared across requests
var rooms = {};

// TODO: will cause error if quiz is created after chat initialized
Quiz.find({ }, function (err, quizzes) {
    quizzes.forEach(function(quiz){
        rooms[quiz.permalink]=quiz.topics;
    });
    console.log('Rooms initialized'+ JSON.stringify(rooms));
});

module.exports = function (io) {
    io.sockets.on('connection', function(socket) {

        // Each connection is for a specific quiz identified by permalink
        // and a specific user
        // (closure vars)
        var permalink,
            currentUser;

        // Decrypt session cookie into the user variable
        passport.deserializeUser(socket.handshake.session.passport.user, function(err, user){
            if(err || !user.local)
                return;
            currentUser = user.local.username || user.local.email
        });

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
                socket.leave(permalink);
                socket.leave(admin_prefix + permalink);
                socket.leave(chat_prefix + permalink);
            };

            // set the new permalink
            permalink = room.name;

            // Separate room for admin commands
            if (room.admin === true) {
                socket.join(admin_prefix+permalink);
            };

            // Join the room
            socket.join(permalink);
            // Join chats
        });


        /***************************
         * Chat
         ***************************/
        socket.on('chat:init', function () {
            socket.join(chat_prefix+permalink);
            socket.emit('chat:roomStatus',rooms[permalink]);
        });

        socket.on('chatclient:message', function(data) {
            if(currentUser)
                data.sender = currentUser;
            socket.in(chat_prefix+permalink).emit('chat:message', data);
            socket.emit('chat:message', data); // Send message to sender
            rooms[permalink][data.topic].messages.push(data);
        });

        socket.on('chatclient:topic', function(data) {
            data.index = rooms[permalink].length; // This line causes a lot of errors. Should add some error handling
            data.messages = [];
            if(currentUser)
                data.sender = currentUser;
            socket.broadcast.to(chat_prefix+permalink).emit('chat:topic', data);
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
            io.sockets.to(permalink).emit('chart:series', data);
         });


        /***************************
         * Admin interface
         ***************************/
        socket.on('admin:init', function () {
            if (!permalink) return;
            quizQuery(permalink).exec(function (err, quiz) {
                socket.emit( 'admin:initdata', quiz );
            });
        });

        socket.on('admin:activateQuestion', function () {
            if (!permalink) return;
           // Activate the requested question, dectivate the current.
        });

        socket.on('admin:addQuestion', function (question) {
            if (!permalink)
                return;

            // TODO: format the question properly before pushing it into the database
            quizQuery(permalink).exec(function (err, quiz) {
                quiz.questions.push(question);
                quiz.save(function () {
                    socket.in(admin_prefix+permalink).emit('admin:questionChange', quiz.questions[quiz.questions.length-1]);
                });
            });
        });

        socket.on('admin:removeQuestion', function () {

        });

        socket.on('admin:setChatStatus', function (status) {
            // Activate or deactivate stat
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
                    socket.in(admin_prefix+permalink).emit('admin:questionChange', updatedQuestion);
                });
            });
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
