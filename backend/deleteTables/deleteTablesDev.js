console.log('Loading function deleteTables');

var AWS = require('aws-sdk');
var doc = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB();

exports.handler = function(event, context) {
    console.log("starting");
    var i = 5;
    dynamodb.deleteTable({
        TableName : "Game" + i + ".Industries"
    }, function(err, data) {
        if (err) context.done(err);
        console.log("Successfully deleted Area table from Game: " + i);
        /*
        console.log("Starting to delete the 2nd table");
        
        dynamodb.deleteTable({
            TableName : "Game" + i + ".Areas"
        }, function(err, data) {
            if (err) context.done(err);
            console.log("Successfully deleted Industries table from Game: " + i);
            context.done(null,'success!');
        });
        */
        context.done(null, 'success!');
    });
}