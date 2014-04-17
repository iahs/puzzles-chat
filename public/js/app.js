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