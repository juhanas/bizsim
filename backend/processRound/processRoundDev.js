console.log('Loading function processRound');

var AWS = require('aws-sdk');
var doc = new AWS.DynamoDB.DocumentClient();
var async = require('async');

var companies, industries, properties;
var updateTable = {};
var moneyChange = {};
var prices = {};
var gameId = 0;

/*
updateTable {
    propertyId: {
       "costsManufacturing":60,
       "totalCosts":60,
       "storedItems":50,
       "soldItems": 50,
       "lostItems":0,
       "costsStorage":10,
       "revenue":100,
       "profit":50
    },
    propertyId: {
       ...
    }
}
*/

/**
 * Processes one industry.
 * Goes through all the properties and produces their products.
 * Calculates the amount of products the property sells.
 * Calculates the amount of products the property stores. If there
 * is not enough storage space, extra products are lost.
 * Calculates the profit the property makes.
 * Stores all updates in the UpdateTable, ordered by propertyId.
 * Updates the Properties- table in DynamoDB.
 */
function processIndustry(industry, key, callback) {
    console.log("Starting function processIndustry with industry: " + JSON.stringify(industry));

    var demand = industry.Demand;
    var sumTotalProduction = 0;
    var propertyList = {};
    var prices = [];

    // Going through each property and adding its price to prices-table.
    industry.Properties.forEach(function(propertyId) {
        var property = properties.Items.filter(function(item){
            return (item.ID == propertyId);
        })[0];
        console.log("Property: " + JSON.stringify(property));
        
        if( propertyList.hasOwnProperty(property.Price) ) {
            console.log("Pushing price " + property.Price + " to Property list.");
            propertyList[property.Price].push(property);
        } else {
            console.log("Adding price " + property.Price + " to Property list.");
            propertyList[property.Price] = [property];
        }
        prices.push(property.Price);
        
        var production = property.Production;
        sumTotalProduction += production;
        var costManufacturing = property.CostFixed + ( production * property.CostVariable);

        updateTable[propertyId] = {"costsManufacturing" : costManufacturing};
        updateTable[propertyId].totalCosts = property.CostFixed + ( production * property.CostVariable);
        updateTable[propertyId].storedItems = property.StoredItems + production;
        console.log("UpdateTable: " + JSON.stringify(updateTable));
    });

    prices = prices.sort();
    var priceLen = prices.length;
    var sellPrice = prices[priceLen-1];
    
    console.log("Sorted prices: [" + prices.toString() + "]. Sell price: " + sellPrice);
    
    // Going through properties in the order of lower price.
    for( var i = 0; i < priceLen; i++ ) {
        console.log("Looking for property list with value: " + prices[i]);
        var allProperties = propertyList[prices[i]];
        i += allProperties.length -1;
        console.log("All properties: " + JSON.stringify(allProperties));
        
        allProperties.forEach( function( property) {
            console.log("**** Property 2nd: *** " + JSON.stringify(property));
            var itemsToSell = updateTable[property.ID].storedItems;
            var soldItems = Math.min(demand, itemsToSell);
            demand -= soldItems;
            var itemsInStorage = itemsToSell - soldItems;
            console.log("Items to sell: " + itemsToSell + ". Sold items: " + soldItems + ". Remaining demand: " + demand + ". Items in storage: " + itemsInStorage);
            
            updateTable[property.ID].soldItems = soldItems;
            
            var lostItems = itemsInStorage - property.WarehouseSizeMax;
            if( lostItems > 0) {
                itemsInStorage = property.WarehouseSizeMax;
                updateTable[property.ID].lostItems = lostItems;
            } else {
                updateTable[property.ID].lostItems = 0;
            }
            updateTable[property.ID].storedItems = itemsInStorage;

            var costStorage = property.CostStorageFixed + ( itemsInStorage * property.CostStorageVariable); 
            updateTable[property.ID].costsStorage = costStorage;
            updateTable[property.ID].totalCosts += costStorage;

            var revenue = soldItems * sellPrice;
            updateTable[property.ID].revenue = revenue;
            updateTable[property.ID].profit = revenue - updateTable[property.ID].totalCosts;
            console.log("Update table: " + JSON.stringify(updateTable[property.ID]));
            
            doc.update({
                TableName : "Game" + gameId + ".Properties",
                Key : {
                    "ID": property.ID
                },
                UpdateExpression: "set StoredItems = :r",
                ExpressionAttributeValues : {
                    ":r" : itemsInStorage
                }
            }, function(err, data) {
                if (err) {
                    console.log("Something went wrong when updating Properties-table: " + err);
                }
            });
        });
    }
    callback(null);
}

/**
 * Processes one company.
 * Combines the data from all the properties the company has.
 * Calculates the profit the company makes.
 * Updates the Company- table in DynamoDB.
 */
function processCompany(company, key, callback) {
    console.log("Starting function processCompany with company: " + JSON.stringify(company));
    var costManufacturing = 0;
    var costStorage = 0;
    var costTotal = 0;
    var itemsSold = 0;
    var itemsStored = 0;
    var itemsLost = 0;
    var revenue = 0;
    var profit = 0;

    company.Properties.forEach(function(propertyId) {
        costManufacturing += updateTable[propertyId].costsManufacturing;
        costStorage += updateTable[propertyId].costsStorage;
        costTotal += updateTable[propertyId].totalCosts;
        itemsSold += updateTable[propertyId].soldItems;
        itemsStored += updateTable[propertyId].storedItems;
        itemsLost += updateTable[propertyId].lostItems;
        revenue += updateTable[propertyId].revenue;
        profit += updateTable[propertyId].profit;
        console.log("PropertyId: " + propertyId + ". costTotal: " + costTotal + ". Items sold/stored/lost: " + itemsSold + '/' + itemsStored + '/' + itemsLost + ". Revenue: " + revenue + ". Profit: " + profit);
    });
    
    var totalMoney = company.Money + profit;
    console.log("Company has sold items and has total money of: " + totalMoney);
    
    doc.update({
        TableName : "Game" + gameId + ".Companies",
        Key : {
            "ID": company.ID
        },
        UpdateExpression: "set Money = :r",
        ExpressionAttributeValues : {
            ":r" : totalMoney
        }
    }, callback);
}

/**
 * Processes a single round of game.
 * Goes through all industries, companies and properties,
 * calculates their production and changes and updates
 * database as needed.
 * Params
 *  event - contains all the parameters needed to create the company in JSON format
 *      {gameId : [String]}
 */
exports.handler = function(event, context) {
    console.log('Beginning function processRound with parameters: ' + JSON.stringify(event));
    if( !event.hasOwnProperty('gameId') || event.gameId == ''){
        context.done("Could not process round for unknown game.");
    }
        
    gameId = parseInt(event.gameId);
    async.waterfall([
        function scanCompany(callback) {
            var params = {
                TableName: "Game" + gameId + ".Companies"
            };

            console.log("Scanning Companies table.");
            doc.scan(params, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Scanned companies successfully:\n" + JSON.stringify(data));
                companies = data;
                callback(null);
            });
        },
        function scanIndustry(callback) {
            var params = {
                TableName: "Game" + gameId + ".Industries"
            };

            console.log("Scanning Industries table.");
            doc.scan(params, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Scanned Industries successfully:\n" + JSON.stringify(data));
                industries = data;
                callback(null);
            });
        },
        function scanProperty(callback) {
            var params = {
                TableName: "Game" + gameId + ".Properties"
            };

            console.log("Scanning Properties table.");
            doc.scan(params, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Scanned Properties successfully:\n" + JSON.stringify(data));
                properties = data;
                callback(null);
            });
        },
        function process(callback) {
            /*
             * Combines the data from all the tables and processes the round.
             * Calculates the amount of products the company sells.
             * Calculates the amount of products the company stores. If there
             * is not enough storage space, extra products are lost.
             * Calculates the profit the company makes.
             * Updates the tables in DynamoDB.
             */
            async.forEachOf(industries.Items,processIndustry, function (err) {
                if (err) {
                    callback(err, null);
                    return;
                }
            });
            async.forEachOf(companies.Items,processCompany, function (err) {
                if (err) {
                    callback(err, null);
                }
                else
                    callback(null, "Success!");
            });
        }
    ], function (err) {
        context.done(err,'Round was processed successfully!');
    });
};