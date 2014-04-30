/**
 * Simple directive to display a chatroom. For now, one global chatroom
 * that all clients connect to.
 * usage: add <chatroom></chatroom> in the html file
 */
angular.module('nodePuzzles').directive('chatroom', function () {
    return {
        restrict: 'E',
        templateUrl: '/templates/chatroom.html',
        scope: { },
        controller: function ($scope, $element, $attrs, socket, $location, $anchorScroll, $timeout) {

            // Tell the server that the chat is ready
            // Otherwise, socket may send info before directive is ready
            socket.emit('chat:init');

            $scope.newMessage = {sender: "Anonymous"};
            $scope.newTopic = {sender: "Anonymous", title:""};

            // Send a new message
            $scope.sendMessage = function() {
                if ($scope.newMessage.title != "") {
                    console.log('sending message')
                    $scope.newMessage.topic = $scope.activeTopic;
                    socket.emit('chatclient:message', $scope.newMessage);
                    $scope.newMessage.title = "";
                }
            };

            // Create a new topic
            $scope.createTopic = function() {
                if ($scope.newTopic.title != "") {
                    console.log('sending topic')
                    socket.emit('chatclient:topic', $scope.newTopic);
                    $scope.newTopic.title = "";
                }
            };

            // Set active topic
            $scope.chooseTopic = function(index) {
                $scope.activeTopic = index;
            }

            // Receive a message
            socket.on('chat:message', function(message) {
                console.log('received: ' + message)
                // Save scroll position to avoid moving off active topic
                var scroll = $('#chat-container').scrollTop() - $('#topic-' + message.topic).height();
                $scope.topics[message.topic].messages.push(message);
                // Scroll to old position
                if($scope.activeTopic !== undefined && message.topic < $scope.activeTopic)
                    $timeout(function() {$('#chat-container').scrollTop(scroll + $('#topic-' + message.topic).height());});
            });

            // Receive a topic
            socket.on('chat:topic', function(topic) {
                $scope.topics.push(topic);
                if(topic.isOwn) {
                    $scope.chooseTopic(topic.index);
                    // Scroll to new topic
                    $location.hash('topic-' + topic.index);
                    $anchorScroll();
                }
            });

            // Sync topics
            socket.on('chat:roomStatus', function(data){
                $scope.topics=data;
            });

        }
    }
});



/**
 * Directive to display modal for adding new questions
 * Not finished yet
 */
angular.module('nodePuzzles').directive('questionResults', function () {
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
 * Not finished yet
 */
angular.module('nodePuzzles').directive('addquestionmodal', function () {
    return {
        restrict: 'E',
        templateUrl: '/templates/addquestion_modal.html',
        scope: {},
        controller: function ($scope) {

        }
    };
});
