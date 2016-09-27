console.log('Loading function getIndustryInfo');

var AWS = require('aws-sdk');
var doc = new AWS.DynamoDB.DocumentClient();

/**
 * Returns information regarding the requested industry.
 * If industryId = 0, returns all the industries in the game.
 * event:
 * { gameId : [Int], industryId : [Int]}
 */
exports.handler = function(event, context) {
    console.log("Starting function getIndustryInfo with event: " + JSON.stringify(event));
    if( !event.hasOwnProperty('gameId') || event.gameId == ''){
        context.done("Could not get an industry with an unknown game.");
    }
        
    if( !event.hasOwnProperty('industryId') || event.industryId == ''){
        context.done("Could not get an unknown industry.");
    }
    
    if( parseInt(event.industryId) == 0) {
        var params = {
            TableName: "Game" + event.gameId + ".Industries"
        };

        console.log("Scanning Industries table with params: " + JSON.stringify(params));
        doc.scan(params, function(err, data) {
            context.done(err, data);
        });
        
    } else {
        var params = {
            TableName : "Game" + event.gameId + ".Industries",
            Key : {
                ID: parseInt(event.industryId)
            }
        }
        console.log("Getting info for industry with params: " + JSON.stringify(params));
        doc.get(params, function(err, data) {
            context.done(err,data);
        });
    }
};

