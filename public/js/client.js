// Link to app
var app = angular.module('nodePuzzles');

// Client Controller
app.controller('ClientDashboardController', function ($scope, $window, socket) {

    // Get the room name from url
    var roomName = $window.location.pathname.substring($window.location.pathname.lastIndexOf('/')+1);

    // Connect to the corresponding room.
    socket.emit('join_room', { name: roomName });

    // A reference to the question the user is currently viewing
    $scope.question = {};

    // receive the question
    socket.on('client:initdata', function (name, question) {
        $scope.question = question;
        $scope.quizName = name;
    });

    socket.on('client:questionActivated', function (question) {
        $scope.question = question;
    });
    socket.on('client:questionDeactivated', function () {
        $scope.submitAnswer(); // Send answer if selected but not submitted to prevent data loss
        $scope.question = {};
    });

    $scope.submitAnswer = function () {
        if (!$scope.question.selectedAnswer) return;

        // send the selectedAnswer back
        socket.emit('client:answer', $scope.question);
    };
});
