// Define the AngularJS application
var app = angular.module('nodePuzzles', ['highcharts-ng']);

app.controller('NavbarController', function ($scope, $window) {
    $scope.currentPage = $window.location.pathname.substring($window.location.pathname.indexOf('/')+1);
});

app.controller('AdminDashboardController', function ($scope) {
    // Where the users manage their quizzes and profile
});

app.controller('AdminQuizController', function ($scope, $window, socket) {
    // Get the room name from url
    var roomName = $window.location.pathname.substring($window.location.pathname.lastIndexOf('/')+1);

    // Connect to the corresponding room. By specifying admin, will get admin data back
    socket.emit('join_room', { name: roomName, admin: true });

    // The array must NOT be replaced. The questionResult directive depends on it for plotting.
    $scope.plotAnswers = [];


    /**
     * Helper method to update the plot data
     * when the visible question change
     * @param question
     */
    var setPlotAnswers = function (question) {
        var plotAnswers = extractAnswersForPlot(question);
        while ($scope.plotAnswers.length > 0 )
            $scope.plotAnswers.pop();
        // And fill in new data
        for (var i=0; i<plotAnswers.length; i++) {
            $scope.plotAnswers.push(plotAnswers[i]);
        };
    };

    var extractAnswersForPlot = function (question) {
        // { data: [5], name: "Alt. 1", id: 1 },
        var plotAnswers = [];

        question.alternatives.forEach(function (alternative) {
            plotAnswers.push({
               data: [alternative.answers.length],
                name: alternative.name,
                id: alternative._id
            });
        })
        return plotAnswers;
    }

    // A reference to the question the user is currently viewing
    $scope.visibleQuestion = {};

    // A reference to the quiz object of the page
    $scope.quiz = '';

    socket.on('admin:initdata', function (quiz) {
        $scope.quiz = quiz;
        if($scope.quiz.activeQuestionId){
            $scope.quiz.questions.forEach(function (question) {
                if(question._id == $scope.quiz.activeQuestionId) {
                    $scope.visibleQuestion = question;
                    setPlotAnswers($scope.visibleQuestion);
                }
            });
        } else if ($scope.quiz.questions.length) {
            $scope.visibleQuestion = $scope.quiz.questions[0];
            setPlotAnswers($scope.visibleQuestion);
        }
    });

    // Hide the solutions to the questions
    $scope.showAnswers = false;
    $scope.toggleAnswers = function () {
        $scope.showAnswers = !$scope.showAnswers;
    };

    // Easier to replace the question than targeting specific values, and only one function necessary
    socket.on('admin:questionChange', function (question) {
        var questionUpdated = false;

        for (var i=0; i<$scope.quiz.questions.length; i++) {
            if (question._id == $scope.quiz.questions[i]._id) {
                // Update the object
                $scope.quiz.questions[i] = question;
                // Have to update the view if that question is being viewed
                if ($scope.visibleQuestion._id == question._id) {
                    $scope.visibleQuestion = $scope.quiz.questions[i];
                    setPlotAnswers($scope.visibleQuestion);
                }

                questionUpdated = true;
                break;
            };
        };
        if (!questionUpdated)
            $scope.quiz.questions.push(question);

    });

    // Same method as questionChange
    socket.on('admin:groupChange', function (group) {
        var groupUpdated = false;

        for (var i=0; i<$scope.quiz.groups.length; i++) {
            if (group._id == $scope.quiz.groups[i]._id) {
                // Update the object
                $scope.quiz.groups[i] = group;
                groupUpdated = true;
                break;
            };
        };
        if (!groupUpdated)
            $scope.quiz.groups.push(group);
    });

    socket.on('admin:chatStatusUpdated', function (status) {
        $scope.quiz.chatIsActive = status;
    });

    socket.on('admin:privacyStatusUpdated', function (status) {
        $scope.quiz.isPrivate = status;
    });

    socket.on('admin:questionActivated', function (question) {
        $scope.quiz.activeQuestionId = question._id;
    });

    socket.on('admin:questionDeactivated', function () {
        $scope.quiz.activeQuestionId = '';
    });

    socket.on('admin:answer', function (id, selection, answer) {
        $scope.quiz.questions.forEach(function (question) {
            if(id == question._id) {
                question.alternatives.forEach(function (alt) {
                    if(alt._id == selection) {
                        alt.answers.push(answer);
                    }
                });
            }
        });
        if(id == $scope.visibleQuestion._id) {
            $scope.plotAnswers.forEach(function (ans){
                if(ans.id == selection){
                    var tempitem = ($scope.plotAnswers[0].id == ans.id ? 1 : 0);
                    $scope.plotAnswers[tempitem].data[0] += .000001; // Infinitesimal change to avoid page-jump bug
                    ans.data[0]++;
                    $scope.plotAnswers[tempitem].data[0] -= .000001;
                }
            });
        }
    });

    $scope.newAlternative = {
        name: '',
        isCorrect: false,
        answers: [],
        submit: function (question) {
            if (!question || !this.name)
                return;

            this.permalink = $scope.quiz.permalink;
            this.questionId = question._id;
            socket.emit('admin:addAlternative', this);

            // Reset and close window
            this.name = '';
            this.isCorrect = false,
            $('#addAlternative').modal('hide');
        }
    };

    // Change the question in view
    $scope.viewQuestion = function(question) {
        $scope.visibleQuestion = question;
        setPlotAnswers(question);
    };

    // Create a new question for the current quiz
    $scope.newQuestion = {
        alternatives: [],
        addAlternative: function () {
            this.alternatives.push({ name: "", isCorrect: false, answers: [] });
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
        setQuizPrivacy: function (status) {
            socket.emit('admin:setQuizPrivacy', !!status)
        },
        setChatStatus: function (status) {
            socket.emit('admin:setChatStatus', !!status)
        },
        activateQuestion: function () {
            socket.emit('admin:activateQuestion', $scope.visibleQuestion)
        },
        deactivateQuestion: function () {
            socket.emit('admin:deactivateQuestion')
        },
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

app.controller('AdminGroupsController', function ($scope) {

});
