var Quiz = require('./models/quiz'),
    Question = require('./models/question');
/**
 * Socket.io configuration
 */
var rooms = {main: []};
var currentRoom = 'main';

/**
 * Get the permalink to the quiz that matches the socket connection
 * Used to access the quiz data from mongo
 * @returns {string}
 */
function getPermalink() {
    if (currentRoom.substring(0,6)==='admin:') {
        return currentRoom.substring(6)
    } else {
        return currentRoom;
    };
};

/**
 * Query that get one quiz by current permalink
 * @returns {*}
 */
function quizQuery() {
    return Quiz.findOne({ permalink: getPermalink() });
};

module.exports = function (io) {

    io.sockets.on('connection', function(socket) {

        // No socket activity before client requests to join room
       socket.join(currentRoom);
       socket.emit('server:roomStatus',rooms[currentRoom]);

        socket.on('join_room', function (room) {
            // TODO: Verify that user is authenticated and has access to room
            // Leave the current room, so that users only get messages from one room at the time
            if (currentRoom) {
                socket.leave(currentRoom);
            };

            // Separate room for admin commands
            var roomName = room.name;
            if (room.admin === true) {
                roomName = 'admin:' + roomName;
            };
            // Join the new room
            socket.join(roomName);
            currentRoom = roomName;

            socket.emit('server:info', 'You have joined the room: ' + currentRoom);
        });

        socket.on('chatclient:message', function(data) {
            console.log('message received ' + data['title']);
            socket.broadcast.to(currentRoom).emit('server:message', data);
            rooms[currentRoom][data.topic].messages.push(data);
        });

        socket.on('chatclient:topic', function(data) {
            console.log('topic received ' + data['title']);
            socket.broadcast.to(currentRoom).emit('server:topic', data);
            rooms[currentRoom].push(data);
        });

        // TODO: remove this. Just for demo purposes
        socket.on('chartclient:series', function(data) {
            io.sockets.to(currentRoom).emit('chart:series', data);
        });

        /**
         * Admin interface and commands
         */
        socket.on('admin:init', function () {
            quizQuery().exec(function (err, quiz) {
                socket.emit( 'admin:initdata', quiz );
            });
        });

        socket.on('admin:activateQuestion', function () {
           // Activate the requested question, dectivate the current.
        });

        socket.on('admin:addQuestion', function (question) {
            // TODO: format the question properly before pushing it into the database
            quizQuery().exec(function (err, quiz) {
                quiz.questions.push(question);
                quiz.save(function () {
                    socket.in(currentRoom).emit('admin:questionChange', quiz.questions[quiz.questions.length-1]);
                });
            });
        });

        socket.on('admin:removeQuestion', function () {

        });

        socket.on('admin:setChatStatus', function (status) {
            // Activate or deactivate stat
        });

        socket.on('admin:addAlternative', function (question, alternative) {
            quizQuery().exec(function (err, quiz) {
                var updatedQuestion;
                for (var i=0; i<quiz.questions.length; i++) {
                    var q = quiz.questions[i]
                    if (q._id === question._id) {
                        q.alternatives.push(alternative);
                        updatedQuestion = q;
                    };
                };
                quiz.save(function (err) {
                    socket.in(currentRoom).emit('admin:questionChange', updatedQuestion);
                });
            });
        });
        
    });
};

