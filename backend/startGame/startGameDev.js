console.log('Loading function startGame');

var AWS = require('aws-sdk');
var doc = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB();
var async = require('async');

var GameName, gameNumber;

/**
 * Starts the game by initiating all the databases.
 * Params:
 *  event - Contains all the initialization parameters as JSON
 *      {}
 *  context - Contains the context of the call
 */
exports.handler = function(event, context) {
    console.log('Starting function startGame.');
    async.waterfall([
        function (callback) {
            doc.get({
                TableName : "GlobalVariables",
                Key : {
                    Category: "Games"
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Read table GlobalVariables: " + JSON.stringify(data));
                gameNumber = data.Item.ValueNumber + 1;
                gameName = "Game" + gameNumber;
                console.log("NextGame: " + gameName);

                callback(null);
            });
        },
        function (callback) {
            var tableArea = {
                TableName : gameName + ".Areas",
                KeySchema: [       
                    { AttributeName: "ID", KeyType: "HASH"}  //Partition key
                ],
                AttributeDefinitions: [       
                    { AttributeName: "ID", AttributeType: "N" }
                ],
                ProvisionedThroughput: {       
                    ReadCapacityUnits: 1, 
                    WriteCapacityUnits: 1
                }
            }; 
            
            dynamodb.createTable(tableArea, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Created Area table: " + JSON.stringify(data));
                callback(null);
            });
        },
        function (callback) {
            var tableIndustry = {
                TableName : gameName + ".Industries",
                KeySchema: [       
                    { AttributeName: "ID", KeyType: "HASH"}  //Partition key
                ],
                AttributeDefinitions: [       
                    { AttributeName: "ID", AttributeType: "N" },
                ],
                ProvisionedThroughput: {       
                    ReadCapacityUnits: 1, 
                    WriteCapacityUnits: 1
                }
            };

            dynamodb.createTable(tableIndustry, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Created Industries table: " + JSON.stringify(data));
                callback(null);
            });
        },
        function (callback) {
            var tableCompany = {
                TableName : gameName + ".Companies",
                KeySchema: [       
                    { AttributeName: "ID", KeyType: "HASH"}  //Partition key
                ],
                AttributeDefinitions: [       
                    { AttributeName: "ID", AttributeType: "N" },
                ],
                ProvisionedThroughput: {       
                    ReadCapacityUnits: 1, 
                    WriteCapacityUnits: 1
                }
            };

            dynamodb.createTable(tableCompany, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Created Companies table: " + JSON.stringify(data));
                callback(null);
            });
        },
        function (callback) {
            var tableProperty = {
                TableName : gameName + ".Properties",
                KeySchema: [       
                    { AttributeName: "ID", KeyType: "HASH"}  //Partition key
                ],
                AttributeDefinitions: [       
                    { AttributeName: "ID", AttributeType: "N" },
                ],
                ProvisionedThroughput: {       
                    ReadCapacityUnits: 1, 
                    WriteCapacityUnits: 1
                }
            };

            dynamodb.createTable(tableProperty, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Created Properties table: " + JSON.stringify(data));
                callback(null);
            });
        },
        function (callback) {
            var tableVariables = {
                TableName : gameName + ".Variables",
                KeySchema: [       
                    { AttributeName: "Name", KeyType: "HASH"}  //Partition key
                ],
                AttributeDefinitions: [       
                    { AttributeName: "Name", AttributeType: "S" }
                ],
                ProvisionedThroughput: {       
                    ReadCapacityUnits: 1, 
                    WriteCapacityUnits: 1
                }
            };

            dynamodb.createTable(tableVariables, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Created Variables table: " + JSON.stringify(data));
                callback(null);
            });
        },
        function (callback) {
            console.log("Table creation successful.");
            
            doc.update({
                TableName : "GlobalVariables",
                Key : {
                    "Category": "Games"
                },
                UpdateExpression: "set ValueNumber = :n",
                ExpressionAttributeValues : {
                    ":n" : gameNumber
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                setTimeout(function() {
                    console.log("Timeout finished.");
                    callback(null);
                }, 5000); // Waiting for DynamoDB to finish creating all the tables
            });
        },
        function (callback) {
            var tableAreaName = gameName + ".Areas";
            console.log("Starting to fill the table " + tableAreaName);
            
            doc.put({
                TableName : tableAreaName,
                Item : {
                    "ID" : 1,
                    "Name" : "Region 1",
                    "Industries" : [1],
                    "Residents" : 1000
                }
            }, function(err, data) {
                callback(err);
            });
        },
        function (callback) {
            var tableIndustryName = gameName + ".Industries";
    
            console.log("Starting to fill the table " + tableIndustryName);
            doc.put({
                TableName : tableIndustryName,
                Item : {
                    "ID" : 1,
                    "Name" : "Paper",
                    "Area" : 1,
                    "Demand" : 0.1*1000, // TODO: Proper demand calculation
                    "Properties" : []
                }
            }, function(err, data) {
                callback(err);
            });
        },
        function (callback) {
            var tableVariableName = gameName + ".Variables";
    
            console.log("Starting to fill the table " + tableVariableName);
            doc.put({
                TableName : tableVariableName,
                Item : {
                    "Name" : "NextIds",
                    "NextAreaId" : 2,
                    "NextIndustryId" : 2,
                    "NextCompanyId" : 1,
                    "NextPropertyId" : 1
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                callback(null,data);
            });
        }
    ], function (err, data) {
        context.done(err,'Game ' + gameNumber + ' started successfully!');
    });
};