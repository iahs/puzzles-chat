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

        socket.on('studentclient:question', function(data) {
            socket.broadcast.to(currentRoom.name).emit('server:question' data);

        }
    
        // XXX: add adminclient:question here
        // socket.on('adminclient:question', function (data) {
        //      socket.broadcast.to(currentRoom.name).emit('server:question',
        //      data)
        // }
        socket.on('chartclient:series', function(data) {
            io.sockets.to(currentRoom.name).emit('chart:series', data);
        });

        socket.on('debug', function(data) {
            console.log('debug: ' + data);
        });

    });
};

