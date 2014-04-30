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
        controller: function ($scope, $element, $attrs, socket, $location, $anchorScroll, $timeout) {
            $scope.newMessage = {sender: "Anonymous"};
            $scope.newTopic = {sender: "Anonymous", title:""};

            // Send a new message
            $scope.sendMessage = function() {
                if ($scope.newMessage.title != "") {
                    $scope.newMessage.topic = $scope.activeTopic;
                    socket.emit('chatclient:message', $scope.newMessage);
                    var newMsg = angular.copy($scope.newMessage);
                    newMsg.class = "list-group-item-success";
                    $scope.topics[$scope.activeTopic].messages.push(newMsg);
                    $scope.newMessage.title = "";
                }
            };


            // Create a new topic
            $scope.createTopic = function() {
                if ($scope.newTopic.title != "") {
                    $scope.newTopic.index = $scope.nTopics++;
                    $scope.newTopic.messages = [];
                    socket.emit('chatclient:topic', $scope.newTopic);
                    var newTopic = angular.copy($scope.newTopic);
                    newTopic.class = "list-group-item-success";
                    console.log($scope.topics)
                    $scope.topics[newTopic.index]=newTopic;
                    $scope.chooseTopic(newTopic.index);
                    // Scroll to new topic
                    $location.hash('topic-' + newTopic.index);
                    $anchorScroll();
                    $scope.newTopic.title = "";
                }
            };

            // Set active topic
            $scope.chooseTopic = function(index) {
                $scope.activeTopic = index;
            }

            // Receive a message
            socket.on('server:message', function(message) {
                console.log('received: ' + message)
                // Save scroll position to avoid moving off active topic
                var scroll = $('#chat-container').scrollTop() - $('#topic-' + message.topic).height();
                $scope.topics[message.topic].messages.push(message);
                // Scroll to old position
                if($scope.activeTopic !== undefined && message.topic < $scope.activeTopic)
                    $timeout(function() {$('#chat-container').scrollTop(scroll + $('#topic-' + message.topic).height());});
            });

            // Receive a topic
            socket.on('server:topic', function(topic) {
                $scope.topics.push(topic);
                $scope.nTopics++;
            });

            // Sync topic count
            socket.on('server:roomStatus', function(data){
                $scope.nTopics=data.length;
                $scope.topics=data;
                console.log(data)
            });

        }
    }
});
angular.module('nodePuzzles').directive('student-box', function () {
    return {
        restrict: 'E',
        templateUrl: 'templates/student-box.html',
        scope: {},
        controller: function ($scope, $element, $attrs, socket, $location) {

            // Send answer to current question
            $scope.sendAnswer = function() {
            
                // Should send response to answer as a response
                socket.emit('studentclient:question', $scope.question);
                
            };

            // Receive a question (just override previous one)
            socket.on('server:question', function(question) {
                console.log('received: ' + question)
                
                // XXX: Should we auto-submit previous answer when new
                // question is assigned?
                $scope.question = question;
            });

        }
    }
});

