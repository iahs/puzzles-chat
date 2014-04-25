var Quiz = require('./models/quiz'),
    Question = require('./models/question');
/**
 * Socket.io configuration
 */
module.exports = function (io) {
    var rooms = {main: []};
    io.sockets.on('connection', function(socket) {
        // Connect to the default room. By default, sockets join the room "" on connection
        var currentRoom = {name: "main"};
        socket.join(currentRoom.name);
        socket.emit('server:roomStatus',rooms[currentRoom.name]);

        socket.on('join_room', function (room) {
            // TODO: Verify that user is authenticated and has access to room
            // Leave the current room, so that users only get messages from one room at the time
            if (currentRoom) {
                socket.leave(currentRoom.name);
            };

            // Join the new room
            socket.join(room.name);
            currentRoom = room;

            console.log("CLIENT JOINED ROOM: " + currentRoom);

            socket.emit('server:message', {title: "You have joined " + room.name, sender: "RoomManager"});
        });

        socket.on('chatclient:message', function(data) {
            console.log('message received ' + data['title']);
            socket.broadcast.to(currentRoom.name).emit('server:message', data);
            rooms[currentRoom.name][data.topic].messages.push(data);
        });

        socket.on('chatclient:topic', function(data) {
            console.log('topic received ' + data['title']);
            socket.broadcast.to(currentRoom.name).emit('server:topic', data);
            rooms[currentRoom.name].push(data);
        });

        // TODO: remove this. Just for demo purposes
        socket.on('chartclient:series', function(data) {
            io.sockets.to(currentRoom.name).emit('chart:series', data);
        });

        /**
         * Admin interface and commands
         */
        socket.on('admin:init', function () {
            Quiz.findOne( { permalink: "ogga" })
                .exec(function (err, quiz) {
                    if (err) socket.emit("ERROR");
                    socket.emit( 'admin:initdata', quiz );
                });
        });

        socket.on('admin:activateQuestion', function () {
           // Activate the requested question, dectivate the current.
        });

        socket.on('admin:addQuestion', function (question) {
            // TODO: format the question properly before pushing it into the database
            Quiz.findOne( {permalink: "ogga" })
                .exec(function (err, quiz) {
                    quiz.questions.push(question);
                    quiz.save(function () {
                        socket.emit('admin:questionAdded', quiz.questions[quiz.questions.length - 1]);
                    });
                });
        });

        socket.on('admin:removeQuestion', function () {

        });

        socket.on('admin:setChatStatus', function (status) {
            // Activate or deactivate stat
        });

        socket.on('admin:addAlternative', function (question, alternative) {
            // Add a new alternative to the question
        });
        
    });
};

