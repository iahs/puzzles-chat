var app = angular.module('nodePuzzles');
/**
 * Simple directive to display a chatroom. For now, one global chatroom
 * that all clients connect to.
 * usage: add <chatroom></chatroom> in the html file
 */
app.directive('chatroom', function () {
    return {
        restrict: 'E',
        templateUrl: '/templates/chatroom.html',
        scope: { },
        controller: function ($scope, $element, $attrs, socket, $location, $anchorScroll, $timeout) {
            // Tell the server that the chat is ready
            // Otherwise, socket may send info before directive is ready
            socket.emit('chatclient:init');

            $scope.newMessage = {sender: "Anonymous"};
            $scope.newTopic = {sender: "Anonymous", title:""};

            // Send a new message
            $scope.sendMessage = function() {
                if ($scope.newMessage.title != "") {
                    $scope.newMessage.topic = $scope.activeTopic;
                    socket.emit('chatclient:message', $scope.newMessage);
                    $scope.newMessage.title = "";
                }
            };

            // Create a new topic
            $scope.createTopic = function() {
                if ($scope.newTopic.title != "") {
                    socket.emit('chatclient:topic', $scope.newTopic);
                    $scope.newTopic.title = "";
                }
            };

            // Set active topic
            $scope.chooseTopic = function(index) {
                $scope.activeTopic = index;
            }

            // Receive a message
            socket.on('chatserver:message', function(message) {
                // Save scroll position to avoid moving off active topic
                var scroll = $('#chat-container').scrollTop() - $('#topic-' + message.topic).height();
                $scope.topics[message.topic].messages.push(message);
                // Scroll to old position
                if($scope.activeTopic !== undefined && message.topic < $scope.activeTopic)
                    $timeout(function() {$('#chat-container').scrollTop(scroll + $('#topic-' + message.topic).height());});
            });

            // Receive a topic
            socket.on('chatserver:topic', function(topic) {
                $scope.topics.push(topic);
            });

            // Scroll to own new topic
            socket.on('chatserver:selectTopic', function(index) {
                $scope.chooseTopic(index);
                $location.hash('topic-' + index);
                $anchorScroll();
            });

            // Sync topics
            socket.on('chatserver:roomStatus', function(data){
                $scope.topics=data;
            });

            // Chat enable/disable
            socket.on('admin:chatStatusUpdated', function(status){
                $scope.chatEnabled = status;
            });

            socket.on('admin:privacyStatusUpdated', function (status) {
                $scope.privacy = status;
            });

        }
    }
});

/**
 * Directive to display modal for adding new questions
 */
app.directive('questionResults', function () {
    return {
        restrict: 'E',
        templateUrl: '/templates/question_results.html',
        scope: {
            answers: '='
        },
        controller: function ($scope) {
            $scope.chartConfig = {
                options: {
                    chart: {
                        type: 'bar'
                    }
                },
                xAxis: {
                    labels:
                    {
                        enabled: false
                    }
                },
                series: $scope.answers,
                title: {
                    text: 'Answers'
                },
                loading: false
            };
        }
    };
});



/**
 * Directive to display modal for adding new questions
 */
app.directive('addquestionmodal', function () {
    return {
        restrict: 'E',
        templateUrl: '/templates/addquestion_modal.html',
        scope: {},
        controller: function ($scope) {

        }
    };
});

/**
 * Directive to render math for data that is manipulated by Angular
 * This will not be rendered as math if just displayed normally.
 */
app.directive("mathjaxBind", function() {
    return {
        restrict: "A",
        controller: ["$scope", "$element", "$attrs", function($scope, $element, $attrs) {
            MathJax.Hub.Config({
              tex2jax: {
                inlineMath: [ ['$$','$$'], ['\\(','\\)'] ],
                displayMath: [ ['$$$','$$$'], ['\\[','\\]'] ],
                processEscapes: false
              }
            });
            $scope.$watch($attrs.mathjaxBind, function(value) {
                $element.text(value == undefined ? "" : value);
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, $element[0]]);
            });
        }]
    };
});

app.directive('flashMessages', function () {
    return {
        restrict: "E",
        scope: {},
        controller: function ($scope, socket) {
            $scope.flash = [];
            // A message should be on the format { type: 'info|danger|warning|success', message: 'message to display'}
            socket.on('flash:message', function (message) {
                $scope.flash = [message];
            });

            $scope.removeMessage = function(message) {
                $scope.flash.splice($scope.flash.indexOf(message), 1);
            };
        },
        templateUrl: '/templates/flashmessages.html'
    }
});
