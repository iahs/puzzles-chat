/**
 * Socket.io configuration
 */
module.exports = function (io) {
    io.sockets.on('connection', function(socket) {
        // Connect to the default room. By default, sockets join the room "" on connection
        var currentRoom = {name: ""};

        socket.on('join_room', function (room) {
            // TODO: Verify that user is authenticated and has access to room
            // Leave the current room, so that users only get messages from one room at the time
            if (currentRoom) {
                socket.leave(currentRoom.name);
            };

            // Join the new room
            socket.join(room.name);
            currentRoom = room;
            socket.rooms

            socket.emit('server:message', {title: "You have joined " + room.name, sender: "RoomManager"});
        });

        socket.on('chatclient:message', function(data) {
            console.log('message received ' + data['title']);
            socket.broadcast.to(currentRoom.name).emit('server:message', data);
        });

        socket.on('chartclient:series', function(data) {
            io.sockets.to(currentRoom.name).emit('chart:series', data);
        });
    });
};

