// Link to app
var app = angular.module('nodePuzzles');

// Client Controller
app.controller('ClientDashboardController', function ($scope, $window, socket, $timeout) {

    // Get the room name from url
    var roomName = $window.location.pathname.substring($window.location.pathname.lastIndexOf('/')+1);

    // Connect to the corresponding room.
    socket.emit('join_room', { name: roomName });

    // A reference to the question the user is currently viewing
    $scope.question = null;

    // receive the question
    socket.on('client:initdata', function (name, question) {
        $scope.question = question;
        $scope.quizName = name;
        $timeout(function () {$(':radio').radio();}); // Bootstrap hack
    });

    socket.on('client:questionActivated', function (question) {
        $scope.submitAnswer(); // Send answer if selected but not submitted to prevent data loss
        $scope.question = question;
        $timeout(function () {$(':radio').radio();});
        $(".well").animateHighlight("#52854C", 1000);
    });
    socket.on('client:questionDeactivated', function () {
        $scope.submitAnswer();
        $scope.question = {};
        $(".well").animateHighlight("#A51C30", 1000);
    });

    $scope.chooseAnswer = function (id) { // This should be in a directive, but that's overkill
        $scope.question.selectedAnswer = id;
    }

    $scope.submitAnswer = function () {
        if (!$scope.question.selectedAnswer) return;
        socket.emit('client:answer', $scope.question);
        $scope.question.submitted = true;
    };

});
