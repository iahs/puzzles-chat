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

app.controller('NavbarController', function ($scope) {
    // Navbar on top of page
});

app.controller('AdminDashboardController', function ($scope) {
    // Where the users manage their quizzes and profile
});

app.controller('AdminQuizController', function ($scope, $window, socket) {
    // Get the room name from url
    var roomName = $window.location.pathname.substring($window.location.pathname.lastIndexOf('/')+1);

    // Connect to the corresponding room. By specifying admin, will get admin data back
    socket.emit('join_room', { name: roomName, admin: true });

    // Logging for debug
    socket.on('server:info', function (info) {
        console.log(info);
    });

    // The array must NOT be replaced. The questionResult directive depends on it for plotting.
    $scope.answers = [
        { data: [4], name: "Alt. 1", id: 1 },
        { data: [3], name: "Alt. 2", id: 2 },
        { data: [6], name: "Alt. 3", id: 3 },
        { data: [1], name: "Alt. 4", id: 4 }
    ];

    // A reference to the question the user is currently viewing
    $scope.visibleQuestion = {};

    // A reference to the quiz object of the page
    $scope.quiz = {};

    socket.on('admin:initdata', function (quiz) {
        $scope.quiz = quiz;
        $scope.visibleQuestion = $scope.quiz.questions[0] || {};
    });

    // Easier to replace the question than targeting specific values, and only one function necessary
    socket.on('admin:questionChange', function (question) {
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

    socket.on('admin:chatStatusUpdated', function (status) {
        $scope.quiz.chatIsActive = status;
    });

    socket.on('admin:questionActivated', function (question) {
        $scope.quiz.activeQuestionId = question._id;
    });

    socket.on('admin:questionDeactivated', function () {
        $scope.quiz.activeQuestionId = '';
    });

    socket.on('admin:newanswer', function (alternativeId) {
        for(var i=0; i<$scope.answers.length; i++) {
            if ($scope.answers[i].id === alternativeId) {
                console.log($scope.answers[i]);
                $scope.answers[i].data[0] += 1;
            }
        }
    });

    $scope.addAlternative = function (quiz, alternative) {
        socket.emit('addAlternative', {
            questionId: $scope.visibleQuestion._id,
            alternative: alternative
        });
    };

    socket.on('admin:newAlternative', function (data) {
        // Find the right question, and add the alternative
    });


    $scope.newAlternative = {
        name: 'New alternative',
        isCorrect: false,
        answers: [],
        submit: function (question) {
            if (!question)
                return;
            console.log(this);
            socket.emit('admin:addAlternative', {
                questionId: question._id,
                alternative: this
            });
        }
    };

    // Change the question in view
    $scope.viewQuestion = function(question) {
        $scope.visibleQuestion = question;

        // TODO: change this into using the question data when we get data for questions
        var newAnswers = [
            { data: [5], name: "Alt. 1", id: 1 },
            { data: [6], name: "Alt. 2", id: 2 },
            { data: [12], name: "Alt. 3", id: 3 },
            { data: [1], name: "Alt. 4", id: 4 }
        ];
        // Remove the existing data
        while ($scope.answers.length > 0 )
            $scope.answers.pop();
        // And fill in new data
        for (var i=0; i<newAnswers.length; i++) {
            $scope.answers.push(newAnswers[i]);
        };
    };

    // TODO: remove this when real functionality for updating graph is in place
    $scope.plusOne = function () {
        socket.emit('test:newanswer', $scope.answers[0].id)
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
            socket.emit('admin:addQuestion', this);
            this.alternatives = [];
            this.name = '';
            this.question = '';
            $('#addQuestion').modal('hide');
        }
    };

    $scope.newGroup = {
        permalink: "",
        add: function () {
            if (this.permalink) {
                socket.emit("admin:addGroup", this.permalink)
                this.permalink = "";
                $('#addGroup').modal('hide');
            };
        }
    };

    // Grouping of the actions in the action bar
    $scope.actions = {
        setChatStatus: function (status) {
            socket.emit('admin:setChatStatus', !!status)
        },
        activateQuestion: function () {
            socket.emit('admin:activateQuestion', $scope.visibleQuestion)
        },
        deactivateQuestion: function () {
            socket.emit('admin:deactivateQuestion')
        },
        viewResponses: function() {alert("View responses")},
        addAdmin: function() {alert("Add admin")}
    };
});

app.controller('AdminDetailsController', function ($scope, socket) {
    socket.emit('join_room', { name: 'ogga', admin: true }); // Todo: use actual permalink

    socket.on('admin:initdata', function (quiz) {
        $scope.quiz = quiz;
    });

    // table sorting
    $scope.reverseSort = true;
    $scope.setSortBy = function (string) {
        if ($scope.sortBy == string) {
            $scope.reverseSort = !$scope.reverseSort;
        } else {
            $scope.sortBy = string;
        }
    }
});

app.controller('AdminGroupController', function ($scope, $window, socket) {
    var groupPermalink = $window.location.pathname.substring($window.location.pathname.lastIndexOf('/')+1);

    $scope.group = {};
    socket.emit('admin:manage_group', groupPermalink);

    socket.on('admin:groupData', function (group) {
        $scope.group = group;
        $scope.group.emailString = "";
        console.log(JSON.stringify(group))
    });

    $scope.addMembers = function () {
        if (!$scope.group.emailString) return;
        socket.emit('admin:group:addMembers', $scope.group);
        $scope.group.emailString = "";
    };

    $scope.removeMember = function (member) {
        socket.emit('admin:group:removeMember', {permalink: groupPermalink, email: member} );
    };
});
