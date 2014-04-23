// Define the AngularJS application
var app = angular.module('nodePuzzles',
    ['highcharts-ng']);

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

app.controller('AdminPanelController', function ($scope) {

    // Take data from the back end renderer
    $scope.init = function (quiz) {
        $scope.quiz = quiz;
    };

    $scope.questions = [
        { question: "Question 1"},
        { question: "Question 2"},
        { question: "Question 3"},
        { question: "Question 4"},
        { question: "Question 5"}
    ];

    // Store a reference to the current active question
    $scope.openQuestion = null;

    $scope.activateQuestion = function (question) {
        // TODO: use sockets here to get stats for the activated question
        if ($scope.openQuestion === question) {
            $scope.openQuestion = null;
            console.log('Decativated');
        } else {
            console.log('New active question');
            $scope.openQuestion = question;
        }
        for(var n=0; n<4; n++) {
            var data = [];
            for(var i=0; i<12; i++) {
                data.push(30*Math.random())
            };
            chartSeries[n].data = data;
        };
    };

    var chartSeries = [
        {
            name: 'Mr. Black',
            data: [4]
        },
        {
            name: 'Mr. Gray',
            data: [6]
        }
    ];

    $scope.chartConfig = {
        options: {
            chart: {
                type: 'bar'
            }
        },
        series: chartSeries,
        title: {
            text: 'Answers'
        },
        loading: false
    };
});