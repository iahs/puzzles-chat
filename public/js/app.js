// Define the AngularJS application
var app = angular.module('nodePuzzles', ['highcharts-ng']);



// TODO: remove plotcontroller, only for demo purposes
app.controller('PlotController', function ($scope, socket) {

    // Graphing system
    var chartSeries = [];

    socket.on('chart:series', function(data) {
        chartSeries.push(data);
    });

    $scope.chartTypes = [
        {"id": "line", "title": "Line"},
        {"id": "spline", "title": "Smooth line"},
        {"id": "area", "title": "Area"},
        {"id": "areaspline", "title": "Smooth area"},
        {"id": "column", "title": "Column"},
        {"id": "bar", "title": "Bar"},
        {"id": "pie", "title": "Pie"},
        {"id": "scatter", "title": "Scatter"}
    ];

    $scope.addSeries = function (type) {
        type = type ? type : "line"
        var data = []
        for(var i=0; i<20; i++) {
            data.push(10*Math.random())
        };
        socket.emit('chartclient:series', {
            "name": Math.floor(100*Math.random()),
            "data": data,
            "type": type
        });
    }

    $scope.chartConfig = {
        options: {
            chart: {
                type: 'areaspline'
            },
            plotOptions: {
                series: {
                    stacking: ''
                }
            }
        },
        series: chartSeries,
        title: {
            text: 'Highcharts demo'
        },
        loading: false,
        size: {}
    };
});

app.controller('AdminPanelController', function ($scope, $window, socket) {
    // Get the room name from url
    var roomName = $window.location.pathname.substring($window.location.pathname.lastIndexOf('/')+1);

    // Connect to the corresponding room
    socket.emit('join_room', { name: roomName, admin: true });

    // Logging for debug
    socket.on('server:info', function (info) {
        console.log(info);
    });

    // The array must NOT be replaced. The questionResult directive depends on it for plotting.
    $scope.answers = [];

    // A reference to the question the user is currently viewing
    $scope.visibleQuestion = {};

    // A reference to the quiz object of the page
    $scope.quiz = {};

    // Get current quiz from the server
    socket.emit('admin:init');
    socket.on('admin:initdata', function (quiz) {
        $scope.quiz = quiz;
        $scope.visibleQuestion = $scope.quiz.questions[0];
    });

    // Easier to replace the question than targeting specific values, and only one function necessary
    socket.on('admin:questionChange', function (question) {
        // TODO: A bug here
        var questionUpdated = false;
        for (var i=0; i<$scope.quiz.questions.length; i++) {
            if ($scope.quiz.questions[i]._id === question._id) {
                // Update the object
                $scope.quiz.questions[i] = question;
                questionUpdated = true;
            }
        }
        if (!questionUpdated)
            $scope.quiz.questions.push(question);
    });


    // Change the question in view
    $scope.viewQuestion = function(question) {
        $scope.visibleQuestion = question;

        // TODO: change this into using the question data when we get data for questions
        var newAnswers = [
            { data: [5], name: "Alt. 1" },
            { data: [6], name: "Alt. 2" },
            { data: [12], name: "Alt. 3" },
            { data: [1], name: "Alt. 4" }
        ];
        // Remove the existing data
        while ($scope.answers.length > 0 )
            $scope.answers.pop();
        // And fill in new data
        for (var i=0; i<newAnswers.length; i++) {
            $scope.answers.push(newAnswers[i]);
        };
        console.log($scope.answers);
    };

    // TODO: remove this when real functionality for updating graph is in place
    $scope.plusOne = function () {
       $scope.answers[0].data[0] += 1;
    };


    // Create a new question for the current quiz
    $scope.newQuestion = {
        alternatives: [],
        addAlternative: function () {
            this.alternatives.push({ name: "Content here", isCorrect: false, answers: [] });
        },
        removeAlternative: function (alt) {
            var a = this.alternatives;
            for(var i = a.length - 1; i >= 0; i--) {
                if(a[i] === alt) {
                    a.splice(i, 1);
                    break;
                };
            };
        },
        submit: function () {
            console.log(JSON.stringify(this));
            socket.emit('admin:addQuestion', this);
        }
    };

    // Grouping of the actions in the action bar
    $scope.actions = {
        activateQuestion: function () {alert("Activate question: " + $scope.visibleQuestion.question)},
        activateChat: function () {alert("Activate chat")},
        viewResponses: function() {alert("View responses")},
        addAdmin: function() {alert("Add admin")}
    };

});