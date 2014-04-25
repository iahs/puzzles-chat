/**
 * A wrapper for socket.io in Angular
 * This ensures that socket.io events are
 * included in the Angular digest loop
 * and views updated accordingly
 */
app.factory('socket', function ($rootScope) {
    var socket = io.connect('http://localhost:3000'); // TODO: move to config file?
    return {
        init: function () {
          // Prevent memory leaks in the (unlikely) case of multiple instantiations
          socket.removeAllListeners();
        },
        on: function (eventName, callback) {
            socket.on(eventName, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            })
        }
    };
});