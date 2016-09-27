console.log('Loading function createCompany');

var AWS = require('aws-sdk');
var doc = new AWS.DynamoDB.DocumentClient();
var async = require('async');
var jwt = require('jsonwebtoken');

var propertyId;

/**
 * Verifies that the sent token is authentic and belongs to the correct person
 * If authentic, calls the given callback function with plain-text token.
 * @Param token: The token to verify
 * @Param callback: The function to call when the token has been verified to be correct
 */
function verifyToken(token, callback) {
    var verified = jwt.verify(token, secret_key);
    console.log("Getting data for userid: " + verified.userid);
    doc.get({
        TableName : "Users",
        Key : {
            ID: verified.userid
        }
    }, function(err, data) {
        if (err) {
            callback(err);
        }
        if (verified.email != data.Item.Email || verified.username != data.Item.Username) {
            callback("Could not identify user: " + JSON.stringify(data));
        } else {
            callback(null, verified, data);
        }
    });
}

/**
 * Creates a new company and assigns it one basic property.
 * Params
 *  event - contains all the parameters needed to create a company in JSON format
 *      {token: [String], areaId: [Int], industryId : [Int], gameId : [Id], companyName : [String]}
 */
exports.handler = function(event, context) {
    console.log('Beginning function createCompany with parameters: ' + JSON.stringify(event));

    if( !event.hasOwnProperty('token') || event.token == ''){
        context.done("Could not create a company with an unknown token.");
    }
        
    if( !event.hasOwnProperty('gameId') || event.gameId == ''){
        context.done("Could not create a company to an unknown game.");
    }
        
    if( !event.hasOwnProperty('areaId') || event.areaId == ''){
        context.done("Could not create a company to an unknown area.");
    }
        
    if( !event.hasOwnProperty('industryId') || event.industryId == ''){
        context.done("Could not create a company to an unknown industry.");
    }
        
    if( !event.hasOwnProperty('companyName') || event.companyName == ''){
        context.done("Could not create a company with an unknown name.");
    }
        
    async.waterfall([
        function verifyTokena(callback) {
            console.log("Starting to verify token.");
            verifyToken(event.token, callback);
        },
        function getVariables(verifiedToken, user, callback) {
            console.log("Starting to get Variables.");
            doc.get({
                TableName : "Game" + event.gameId  + ".Variables",
                Key : {
                    "Name": "NextIds"
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Game variables received: " + JSON.stringify(data));
                callback(null, verifiedToken, user, data);
            });
        },
        function handleUser(verifiedToken, user, gameVariables, callback) {
            console.log("User received: " + JSON.stringify(user));
            var companies = user.Item.Companies;
            var hasCompany = false;
            var gId = parseInt(event.gameId);
            for (var gameId in companies) {
                if (gameId == gId) {
                    hasCompany = true;
                    break;
                }
            }
            if( hasCompany) {
                context.done("You already have a company in this game.");
            }
            console.log("Received companies: " +JSON.stringify(companies));
            callback(null, verifiedToken, gameVariables, user);
        },
        function getIndustry(verifiedToken, gameVariables, user, callback) {
            var params = {
                TableName : "Game" + event.gameId  + ".Industries",
                Key : {
                    ID: parseInt(event.industryId)
                }
            };
            console.log("Starting to get Industry with params: " + JSON.stringify(params));
            doc.get(params, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Industries received: " + JSON.stringify(data));
                callback(null, verifiedToken, gameVariables, user, data);
            });
        },
        function getArea(verifiedToken, gameVariables, user, industries, callback) {
            console.log("Starting to get Areas.");
            doc.get({
                TableName : "Game" + event.gameId + ".Areas",
                Key : {
                    ID: parseInt(event.areaId)
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Areas received: " + JSON.stringify(data));
                callback(null, verifiedToken, gameVariables, user, industries, data)
            });
        },
        function createProperty(verifiedToken, gameVariables, user, industries, areas, callback) {
            /*
             * Combines the data from all the tables and creates a new company.
             * Updates the tables in DynamoDB.
             */
            console.log("Starting to create a property.");
            propertyId = gameVariables.Item.NextPropertyId;
            var property = {
                "ID" : propertyId,
                "Area" : parseInt(event.areaId),
                "Industry" : parseInt(event.industryId),
                "Company" : gameVariables.Item.NextCompanyId,
                "Type" : 1, // 1 = production, 2 = warehouse
                "CapacityProduction" : 50,
                "CapacityMax" : 100,
                "CostCapacityIncrease" : 10000,
                "CostCapacityDecrease" : 4000,
                "StepCapacityChange" : 50,
                "WarehouseSize" : 50,
                "WarehouseSizeMax" : 100,
                "Production" : 50,
                "Price" : 5,
                "StoredItems" : 0,
                "CostFixed" : 10,
                "CostVariable" : 1,
                "CostStorageFixed" : 5,
                "CostStorageVariable" : 0.1,
                "CostStorageIncrease" : 5000,
                "CostStorageDecrease" : 2000,
                "StepStorageChange" : 50
            };
            doc.put({
                TableName : "Game" + event.gameId  + ".Properties",
                Item : property
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Updating Variables table 1.");
                doc.update({
                    TableName : "Game" + event.gameId  + ".Variables",
                    Key : {
                        "Name": "NextIds"
                    },
                    UpdateExpression: "set NextPropertyId = :i",
                    ExpressionAttributeValues : {
                        ":i" : propertyId + 1
                    }
                }, function( err, data) {
                    if( err) {
                        callback(err);
                    }
                    var tableIndustryName = "Game" + event.gameId  + ".Industries";
            
                    console.log("Updating Industries table.");
                    doc.update({
                        TableName : tableIndustryName,
                        Key : {
                            "ID": parseInt(event.industryId)
                        },
                        UpdateExpression: "set Properties = list_append(:p, Properties)",
                        ExpressionAttributeValues : {
                            ":p" : [propertyId]
                        }
                    }, function(err, data) {
                        if (err) {
                            callback(err);
                        }
                        console.log("Update of Industries successful.");
                        callback(null, verifiedToken, gameVariables, user, industries, areas, property);
                    });
                });
            });
        },
        function createCompany(verifiedToken, gameVariables, user, industries, areas, property, callback) {
            /*
             * Combines the data from all the tables and creates a new company.
             * Updates the tables in DynamoDB.
             */
            console.log("Starting to create a company with name " + event.companyName + ".");
            var params = {
                "ID" : gameVariables.Item.NextCompanyId,
                "Name" : event.companyName,
                "Loans" : [],
                "Money" : 10000,
                "Properties" : [propertyId]
            };
            doc.put({
                TableName : "Game" + event.gameId  + ".Companies",
                Item : params,
                ConditionExpression: "#n <> :name",
                ExpressionAttributeNames : {
                  '#n' : 'Name'
                },
                ExpressionAttributeValues : {
                  ':name' : event.companyName
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Updating Variables table 2.");
                doc.update({
                    TableName : "Game" + event.gameId  + ".Variables",
                    Key : {
                        "Name": "NextIds"
                    },
                    UpdateExpression: "set NextCompanyId = :i",
                    ExpressionAttributeValues : {
                        ":i" : gameVariables.Item.NextCompanyId + 1
                    }
                }, function(err, data) {
                    if (err) {
                        callback(err);
                    }
                    console.log("Update of Variables successful.");
                    callback(null, {'created': 'True', 'company': params, 'property': property}, user, gameVariables.Item.NextCompanyId);
                });
            });
        },
        function updateUser(message, user, companyId, callback) {
            /*
             * Updates the user table with the newly created company.
             */
            console.log("Starting to update  User table.");
            var newCompanies = user.Item.Companies;
            newCompanies[parseInt(event.gameId)] = companyId;
            doc.update({
                TableName : "Users",
                Key : {
                    "ID": user.Item.ID
                },
                UpdateExpression: "set Companies = :r",
                ExpressionAttributeValues : {
                    ":r" : newCompanies
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Update of User table successful.");
                callback(null, message);
            });
        }
    ], function (err, data) {
        console.log('A new company was created successfully!');
        context.done(err, data);
    });
};