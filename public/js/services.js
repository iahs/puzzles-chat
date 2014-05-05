/**
 * A wrapper for socket.io in Angular
 * This ensures that socket.io events are
 * included in the Angular digest loop
 * and views updated accordingly
 */
app.factory('socket', function ($rootScope, $window) {
    var socket = io.connect($window.location.protocol+"//"+$window.location.host);
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
