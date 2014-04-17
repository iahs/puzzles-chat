/**
 * Simple directive to display a chatroom. For now, one global chatroom
 * that all clients connect to.
 * usage: add <chatroom></chatroom> in the html file
 */
angular.module('nodePuzzles').directive('chatroom', function () {
    return {
        restrict: 'E',
        templateUrl: 'templates/chatroom.html',
        scope: {},
        controller: function ($scope, $element, $attrs, socket) {
            $scope.messages = [];
            $scope.newMessage = {sender: "Anonymous"};

            // Send a new message
            $scope.sendMessage = function() {
                if ($scope.newMessage.title != "") {
                    socket.emit('chatclient:message', $scope.newMessage);
                    var newMsg = angular.copy($scope.newMessage);
                    newMsg.class = "list-group-item-success";
                    $scope.messages.push(newMsg);
                    $scope.newMessage.title = "";
                }
            };

            // Receive a message
            socket.on('server:message', function(message) {
                $scope.messages.push(message);
            });

            $scope.joinRoom = function() {
                socket.emit('join_room', $scope.room );
            };

        }
    }
});