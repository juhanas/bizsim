console.log('Loading function getPropertyInfo');

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
 * Returns information regarding the requested property.
 * If propertyId = 0, returns all the properties in a table.
 * event:
 * { gameId : [Int], propertyId : [Int]}
 */
exports.handler = function(event, context) {
    console.log("Starting function getPropertyInfo with event: " + JSON.stringify(event));
    if( !event.hasOwnProperty('gameId') || event.gameId == ''){
        context.done("Could not get a property with an unknown game.");
    }
        
    if( !event.hasOwnProperty('propertyId') || event.propertyId == ''){
        context.done("Could not get an unknown property.");
    }
    
    if( parseInt(event.propertyId) == 0) {
        var params = {
            TableName: "Game" + event.gameId + ".Properties",
            ProjectionExpression: "Area, CapacityProduction, Company, Industry, #tp",
            ExpressionAttributeNames:{
                "#tp": "Type"
            }
        };

        console.log("Scanning Properties table with params: " + JSON.stringify(params));
        doc.scan(params, function(err, data) {
            context.done(err, data);
        });
        
    } else {
        if( !event.hasOwnProperty('token') || event.token == ''){
            context.done("Could not get a property with an unknown token.");
        }
        verifyToken(event.token, function(error, verifiedToken, user) {
            if(error) {
                context.done(error);
            } else {
                var params = {
                    TableName : "Game" + event.gameId + ".Properties",
                    Key : {
                        ID: parseInt(event.propertyId)
                    }
                };
                console.log("Getting info for property with params: " + JSON.stringify(params));
                doc.get(params, function(err, propertyData) {
                    if(err) {
                        context.done(err);
                    } else if(!propertyData.hasOwnProperty('Item')) {
                        context.done("Could not find the requested property.");
                    } else {
                        console.log("Got property data: " + JSON.stringify(propertyData));
                        var params2 = {
                            TableName : "Game" + event.gameId + ".Companies",
                            Key : {
                                ID: parseInt(propertyData.Item.Company)
                            }
                        };
                        console.log("Getting company data with params: " + JSON.stringify(params2));
                        doc.get(params2, function(err2, companyData) {
                            if(err2) {
                                context.done(err2);
                            } else if(!companyData.hasOwnProperty('Item')) {
                                context.done("Could not identify the company for requested property: " + JSON.stringify(propertyData));
                            } else if(user.Item.Companies[event.gameId] != companyData.Item.ID) {
                                context.done("You may only see information of the properties you own.");
                            } else {
                                context.done(err,propertyData);
                            }
                        });
                    }
                });
            }
        });
    }
};

