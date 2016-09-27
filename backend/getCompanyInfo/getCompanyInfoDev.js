console.log('Loading function getCompanyInfo');

var AWS = require('aws-sdk');
var doc = new AWS.DynamoDB.DocumentClient();
var jwt = require('jsonwebtoken');

/**
 * Verifies that the sent token is authentic and belongs to the correct person
 * If authentic, calls the given callback function with plain-text token.
 * @Param token: The token to verify
 * @Param callback: The function to call when the token has been verified to be correct
 */
function verifyToken(token, callback) {
    jwt.verify(token, secret_key, function(err, verified) {
        if(err) {
            callback("Token could not be verified: " + err);
        } else {
            console.log("Token verified. Getting data for userid: " + verified.userid);
            doc.get({
                TableName : "Users",
                Key : {
                    ID: verified.userid
                }
            }, function(err, data) {
                if(err) {
                    callback(err);
                } else if(verified.email != data.Item.Email || verified.username != data.Item.Username) {
                    callback("Could not identify user: " + JSON.stringify(data));
                } else {
                    callback(null, verified, data);
                }
            });
        }
    });
}

/**
/**
 * Returns information regarding the requested company.
 * If companyId = 0, returns all the companies in a table.
 * event:
 * { gameId : [Int], companyId : [Int]}
 */
exports.handler = function(event, context) {
    console.log("Starting function getCompanyInfo with event: " + JSON.stringify(event));
    if( !event.hasOwnProperty('gameId') || event.gameId == ''){
        context.done("Could not get a company with an unknown game.");
    }
        
    if( !event.hasOwnProperty('companyId') || event.companyId == ''){
        context.done("Could not get an unknown company.");
    }
    
    if( parseInt(event.companyId) == 0) {
        var params = {
            TableName: "Game" + event.gameId + ".Companies",
            ProjectionExpression: "#nm, #prop",
            ExpressionAttributeNames:{
                "#nm": "Name",
                "#prop": "Properties"
            }
        };

        console.log("Scanning Companies table with params: " + JSON.stringify(params));
        doc.scan(params, function(error, data) {
            context.done(error, data);
        });
    } else {
        if( !event.hasOwnProperty('token') || event.token == ''){
            context.done("Could not get a company with an unknown token.");
        }
        verifyToken(event.token, function(error, verifiedToken, user) {
            if(error) {
                context.done(error);
            } else if(event.companyId != user.Item.Companies[event.gameId]) {
                context.done("You may only access the information of your own company.");
            } else {
                var params = {
                    TableName : "Game" + event.gameId + ".Companies",
                    Key : {
                        ID: parseInt(event.companyId)
                    }
                };
                console.log("Getting info for company with params: " + JSON.stringify(params));
                doc.get(params, function(err, data) {
                    context.done(err,data);
                });
            }
        });
    }
};

