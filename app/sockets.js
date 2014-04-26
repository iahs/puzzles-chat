var Quiz = require('./models/quiz'),
    Question = require('./models/question'),
    passport = require('passport');
/**
 * Socket.io configuration
 */
module.exports = function (io) {
    var rooms = {main: []};
    io.sockets.on('connection', function(socket) {
        socket.data = {};
        passport.deserializeUser(socket.handshake.session.passport.user, function(err, user){if(err || !user.local)return; socket.data.user = user.local.username || user.local.email });
        var currentRoom = {name: "main"};
        socket.join(currentRoom.name);
        socket.emit('server:roomStatus',rooms[currentRoom.name]);

        /***************************
         * Chat
         ***************************/
        socket.on('chatclient:message', function(data) {
            console.log('message received ' + data.title);
            if(socket.data.user) data.sender = socket.data.user;
            socket.broadcast.to(currentRoom.name).emit('server:message', data);
            socket.emit('server:message', data); // Send message to sender
            rooms[currentRoom.name][data.topic].messages.push(data);
        });

        socket.on('chatclient:topic', function(data) {
            console.log('topic received ' + data.title);
            data.index = rooms[currentRoom.name].length;
            data.messages = [];
            if(socket.data.user) data.sender = socket.data.user;
            socket.broadcast.to(currentRoom.name).emit('server:topic', data);
            rooms[currentRoom.name].push(data);
            // Send topic to sender
            data.isOwn = true;
            socket.emit('server:topic', data);
        });

        /***************************
         * Charts
         ***************************/
        // TODO: remove this. Just for demo purposes
        socket.on('chartclient:series', function(data) {
            io.sockets.to(currentRoom.name).emit('chart:series', data);
        });

        /***************************
         * Admin interface
         ***************************/
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
                        socket.emit('admin:questionChange', question);
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
