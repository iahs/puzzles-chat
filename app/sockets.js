var Quiz = require('./models/quiz'),
    Question = require('./models/question'),
    passport = require('passport') || 'ERROR',
    mongoose = require('mongoose') || 'ERROR';

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
            socket.join(permalink);
            // Join chats
        });

        socket.on('test:newanswer', function (id) {
            io.sockets.in(admin_prefix+permalink).emit('admin:newanswer', id);
        })


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
            Quiz.findOneAndUpdate( {permalink: permalink, "topics.index": data.topic}, {$push: {"topics.$.messages": data}}, function(err, result){ });
            socket.broadcast.to(chat_prefix+permalink).emit('chat:message', data);
            socket.emit('chat:message', data); // Send message to sender
            rooms[permalink][data.topic].messages.push(data);
        });

        socket.on('chatclient:topic', function(data) {
            data.index = rooms[permalink].length; // This line causes a lot of errors. Should add some error handling
            data.messages = [];
            if(currentUser)
                data.sender = currentUser;
            Quiz.findOneAndUpdate( {permalink: permalink }, {$push: {topics: data}}, function(err, result){ });
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


        socket.on('admin:setChatStatus', function (status) {
            var isActive = !!status;

            // Mongo update does not work
            quizQuery(permalink).exec(function (err, quiz) {
                quiz.chatIsActive = isActive;
                quiz.save();
                io.sockets.in(admin_prefix+permalink).emit('admin:chatStatusUpdated', isActive);
                // TODO: send some message to the chat directive
            });
        });

        socket.on('admin:activateQuestion', function (question) {
            console.log('Activating question', question);
            // Mongo update does not work
            quizQuery(permalink).exec(function (err, quiz) {
                quiz.activeQuestionId = mongoose.Types.ObjectId(question._id);
                quiz.save();
                io.sockets.in(admin_prefix+permalink).emit('admin:questionActivated', question);

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
                io.sockets.in(admin_prefix+permalink).emit('admin:questionDeactivated');
            });
        });

        socket.on('admin:addQuestion', function (question) {
            if (!permalink)
                return;

            // TODO: format the question properly before pushing it into the database
            quizQuery(permalink).exec(function (err, quiz) {
                quiz.questions.push(question);
                quiz.save(function () {
                    io.sockets.in(admin_prefix+permalink).emit('admin:questionChange', quiz.questions[quiz.questions.length-1]);
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
                    io.sockets.in(admin_prefix+permalink).emit('admin:questionChange', updatedQuestion);
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


