// Link to app
var app = angular.module('nodePuzzles');

// Client Controller
app.controller('ClientDashboardController', function ($scope, $window, socket) {

    // Get the room name from url
    var roomName = $window.location.pathname.substring($window.location.pathname.lastIndexOf('/')+1);

    // Connect to the corresponding room. 
    socket.emit('join_room', { name: roomName });

    // A reference to the question the user is currently viewing
    $scope.question = "";

    // receive the question
    socket.on('client:initdata', function (question) {
        $scope.question = question;
        console.log(question);
    })
    
    $scope.submitAnswer = function () {
        if (!$scope.question.selectedAnswer) return;

        // send the selectedAnswer back
        socket.emit('client:answer', $scope.question);

    };

});


