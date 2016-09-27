console.log('Loading function setOrders');

var AWS = require('aws-sdk');
var doc = new AWS.DynamoDB.DocumentClient();
var async = require('async');
var jwt = require('jsonwebtoken');

var verifiedToken;
var user;

var gameId = 0;
var companyId = 0;
var propertyId = 0;

var updateCompany = false;
var somethingChanged = false;

var operations = '';
var changed = {};
var companyCash = 0;
var newCapacity = -1;

var newProperty;
var newCompany;

var updateExpressionProperties = "";
var expressionAttributeValuesProperties = {};

var updateExpressionCompanies = "";
var expressionAttributeValuesCompanies = {};

/**
 * Verifies that the sent token is authentic and belongs to the correct person
 * If authentic, calls the given callback function with plain-text token.
 * @Param token: The token to verify
 * @Param callback: The function to call when the token has been verified to be correct
 */
function verifyToken(token, callback) {
    jwt.verify(token, secret_key, function(err, verified) {
        if(err) {
            callback("Token could not be verified: " + err, null, null);
        } else {
            console.log("Token verified. Getting data for userid: " + verified.userid);
            doc.get({
                TableName : "Users",
                Key : {
                    ID: verified.userid
                }
            }, function(err, data) {
                if(err) {
                    callback(err, null, data);
                } else if(verified.email != data.Item.Email || verified.username != data.Item.Username) {
                    callback("Could not identify user: " + JSON.stringify(data), verified, data);
                } else {
                    callback(null, verified, data);
                }
            });
        }
    });
}

/**
 * Handles the change of production capacity.
 * Checks that the operation is valid, then updates the JSON for update query.
 * If the current production is larger than the new capacity, production is adjusted to max new capacity.
 * @Param event: The event sent
 * @Param company: JSON containing the values for a company
 * @Param property: JSON containing the values for a property
 * @Param callback: The function(error, company, property) to call when the capacity has been changed or if there is an error
 */
function changeCapacity(event, company, property, callback) {
    var cap;
    if( typeof event.capacityChange == 'string') {
        cap = parseFloat(event.capacityChange);
    } else if(typeof event.capacityChange != 'number') {
        callback("received invalid type of variable for capacityChange.", company, property);
        return;
    } else {
        cap = event.capacityChange;
    }

    var capacityIncrease = (cap > 0);
    var capacityChangeSteps = cap / property.Item.StepCapacityChange;
    newCapacity = property.Item.CapacityProduction + cap;
    var moneyNeeded = (capacityIncrease ? (capacityChangeSteps * property.Item.CostCapacityIncrease) : (capacityChangeSteps * property.Item.CostCapacityDecrease * -1));

    if( (cap % property.Item.StepCapacityChange) != 0) {
        callback("Capacity can only be changed at steps of " + property.Item.StepCapacityChange + " units.", company, property);
    } else if( newCapacity > property.Item.CapacityMax ||  newCapacity < 0) {
        callback("Capacity must be between 0 and " + property.Item.CapacityMax + ".", company, property);
    } else if( moneyNeeded > companyCash) {
        callback("You do not have enough money to pay for the change in capacity. Money needed: " + moneyNeeded + ". Money available" + ((operations!='') ? " (after operations: " +operations+ "): " : ": " )+ companyCash, company, property);
    } else {
        companyCash -= moneyNeeded;
        console.log('Company cash after capacity change: ' + companyCash);

        if( updateExpressionProperties.indexOf(':c') < 0) {
                if(updateExpressionProperties == "") {
                updateExpressionProperties = "set CapacityProduction = :c";
            } else { 
                updateExpressionProperties = updateExpressionProperties + ", CapacityProduction = :c";
            }
        }
        expressionAttributeValuesProperties[':c'] = newCapacity;
        changed.capacity = newCapacity;

        operations += ( (operations == '') ? '' : ', ') + 'capacity change';
        
        if( property.Item.Production > newCapacity) {
            if( updateExpressionProperties.indexOf(':p') < 0) {
                if(updateExpressionProperties == "") {
                    updateExpressionProperties = "set Production = :p";
                } else { 
                    updateExpressionProperties = updateExpressionProperties + ", Production = :p";
                }
            }
            expressionAttributeValuesProperties[':p'] = newCapacity;
            changed.production = newCapacity;

        }
        console.log("Updating capacity. Current capacity: " + JSON.stringify(property.Item.CapacityProduction) + ". Production change: " + cap + ". New capacity: " + newCapacity + '. Money needed: '+ moneyNeeded);
        callback(null, company, property);
    }
}

/**
 * Handles the change of production amount.
 * Checks that the operation is valid, then updates the JSON for update query.
 * @Param event: The event sent
 * @Param company: JSON containing the values for a company
 * @Param property: JSON containing the values for a property
 * @Param callback: The function(error, company, property) to call when the production has been changed or if there is an error
 */
function changeProduction(event, company, property, callback) {
    var prod;
    if( typeof event.production == 'string') {
        prod = parseInt(event.production);
    } else if(typeof event.production != 'number') {
        callback("received invalid type of variable for production.", company, property);
        return;
    } else {
        prod = event.production;
    }
    var productionIncrease = (prod > property.Item.Production);

    if( newCapacity < 0 && prod >  property.Item.CapacityProduction) {
        callback("You can not produce more than the capacity of " + JSON.stringify(property.Item.CapacityProduction) + " units allow.", company, property);
    } else if( newCapacity >= 0 && prod >  newCapacity) {
        callback("You can not produce more than the new capacity of " + newCapacity + " units allow.", company, property);
    } else if( prod < 0) {
        callback("Production can not be negative.", company, property);
    } else {
        if( updateExpressionProperties.indexOf(':p') < 0) {
            if(updateExpressionProperties == "") {
                updateExpressionProperties = "set Production = :p";
            } else { 
                updateExpressionProperties = updateExpressionProperties + ", Production = :p";
            }
        }
        expressionAttributeValuesProperties[':p'] = prod;
        changed.production = prod;
        console.log("Updating production amount. Old production: " + JSON.stringify(property.Item.Production) + '. New production: ' + prod);
        callback(null, company, property);
    }
}

/**
 * Handles the change of storage capacity.
 * Checks that the operation is valid, then updates the JSON for update query.
 * @Param event: The event sent
 * @Param company: JSON containing the values for a company
 * @Param property: JSON containing the values for a property
 * @Param callback: The function(error, company, property) to call when the storage has been changed or if there is an error
 */
function changeStorage(event, company, property, callback) {
    var stor;
    if( typeof event.storageChange == 'string') {
        stor = parseFloat(event.storageChange);
    } else if(typeof event.storageChange != 'number') {
        callback("received invalid type of variable for storageChange.", company, property);
        return;
    } else {
        stor = event.storageChange;
    }

    var storageIncrease = (stor > 0);
    var storageChangeSteps = stor / property.Item.StepStorageChange;
    var newStorage = property.Item.WarehouseSize + stor;
    var moneyNeeded = (storageIncrease ? (storageChangeSteps * property.Item.CostStorageIncrease) : (storageChangeSteps * property.Item.CostStorageDecrease * -1));

    console.log("Updating warehouse size. Current size: " + JSON.stringify(property.Item.WarehouseSize) + ". Size change: " + stor + ". New size: " + newStorage + '. Money needed: '+ moneyNeeded);
    
    if( (stor % property.Item.StepStorageChange) != 0) {
        callback("The size of warehouse can only be changed at steps of " + property.Item.StepCapacityChange + " units.", company, property);
    } else if( newStorage > property.Item.WarehouseSizeMax ||  newStorage < 0) {
        callback("Capacity must be between 0 and " + property.Item.WarehouseSizeMax + ".", company, property);
    } else if( moneyNeeded > companyCash) {
        callback("You do not have enough money to pay for the change in warehouse size. Money needed: " + moneyNeeded + ". Money available" + ((operations!='') ? " (after operations: " +operations+ "): " : ": " )+ companyCash, company, property);
    } else {
        companyCash -= moneyNeeded;
        console.log('Company cash after storage update: ' + companyCash);

        if( updateExpressionProperties.indexOf(':w') < 0) {
            if(updateExpressionProperties == "") {
                updateExpressionProperties = "set WarehouseSize = :w";
            } else { 
                updateExpressionProperties = updateExpressionProperties + ", WarehouseSize = :w";
            }
        }
        expressionAttributeValuesProperties[':w'] = newStorage;
        operations += ( (operations == '') ? '' : ', ') + 'warehouse change';
        changed.storage = newStorage;
        console.log("Updating warehouse size. Old size: " + JSON.stringify(property.Item.WarehouseSize) + '. New size: ' + newStorage);
        callback(null, company, property);
    }
}

/**
 * Handles the change of price.
 * Checks that the operation is valid, then updates the JSON for update query.
 * @Param event: The event sent
 * @Param company: JSON containing the values for a company
 * @Param property: JSON containing the values for a property
 * @Param callback: The function(error, company, property) to call when the price has been changed or if there is an error
 */
function changePrice(event, company, property, callback) {
    var pric;
    if( typeof event.price == 'string') {
        pric = parseFloat(event.price);
    } else if (typeof event.price != 'number') {
        callback("received invalid type of variable for storageChange.", company, property);
    } else {
        pric = event.price;
    }

    var priceIncrease = (pric > property.Item.Price);

    console.log("Updating price from " + JSON.stringify(property.Item.Price) + ' to ' + pric);
    
    if ( pric < 0) {
        callback("Price can not be negative.", company, property);
    } else {
        if( updateExpressionProperties.indexOf(':r') < 0) {
            if(updateExpressionProperties == "") {
                updateExpressionProperties = "set Price = :r";
            } else { 
                updateExpressionProperties = updateExpressionProperties + ", Price = :r";
            }
        }
        expressionAttributeValuesProperties[':r'] = pric;
        changed.price = pric;
        console.log("Updating price. Old price: " + JSON.stringify(property.Item.Price) + '. New price: ' + pric);
        callback(null, company, property);
    }
}

/**
 * Handles the calls to DynamoDB to update the tables.
 * First updates Properties- table, then Companies-table.
 * Finally calls the callback function, passing error and data from the most recent databasecall.
 * If there is an error while updating Properties, will not update Companies.
 * If there is an error while updating Companies, any updates made to Properties are not reverted.
 * @Param company: JSON containing the values for a company
 * @Param callback: The function(error, company, property) to call when the tables have been updated or if there is an error
 */
function updateTables(company, callback) {
    newProperty.UpdateExpression = updateExpressionProperties;
    newProperty.ExpressionAttributeValues = expressionAttributeValuesProperties;

    expressionAttributeValuesCompanies[':m'] = companyCash;
    newCompany.ExpressionAttributeValues = expressionAttributeValuesCompanies;
    
    if( companyCash != company.Item.Money) changed.money = companyCash;
    
    console.log('Updating table Properties with query: \n' + JSON.stringify(newProperty));
    doc.update(newProperty, function(err, data) {
        if (err) {
            console.log('Error updating table Properties: ' +err + '\n');
            callback(err,data); 
        } else {
            console.log('Update of table Properties complete: ' + JSON.stringify(data));
            console.log('Updating table Companies with query: \n' + JSON.stringify(newCompany));
            doc.update(newCompany, function(err, data) {
                if (err) {
                    console.log('Error updating table Companies: ' +err + '\n'); // TODO: If we get an error, should we revert Properties-table back to where it was?
                    callback(err,data);
                } else {
                    console.log('Update of table Companies complete: ' + JSON.stringify(data) + '\n');
                    callback(err,data);
                }
            });
        }
    });
}

/**
 * Sets the orders for the given company.
 * Returns any errors encountered.
 * Params
 *  event - contains all the parameters needed to set orders for the company in JSON format
 *      {token: [String], gameId: [Int], companyId : [Int], propertyId : [Int], capacityChange: [Int], productionChange: [Int], storageChange: [Int], price: [Int]}
 */
exports.handler = function(event, context) {
    console.log("Starting function setOrders with event: " + JSON.stringify(event));

    if( !event.hasOwnProperty('token') || event.token == ''){
        context.done("Could not set orders with an unknown token.");
    }
        
    if( !event.hasOwnProperty('gameId') || event.gameId == ''){
        context.done("Could not set orders in an unknown game.");
    }
        
    if( !event.hasOwnProperty('companyId') || event.companyId == ''){
        context.done("Could not set orders for an unknown company.");
    }
        
    if( !event.hasOwnProperty('propertyId') || event.propertyId == ''){
        context.done("Could not set orders for an unknown property.");
    }
        
    async.waterfall([
        function setUp(callback) {
            verifyToken(event.token, function(error, verified, userData) {
                if(error) {
                    callback(error);
                } else {
                    console.log("Token verified and got user data.");
                    verifiedToken = verified;
                    user = userData;
                    
                    companyId = parseInt(event.companyId);
                    propertyId = parseInt(event.propertyId);
                    gameId = parseInt(event.gameId);
                    
                    newProperty = {
                        TableName : "Game" + gameId + ".Properties",
                        Key : {
                            "ID": propertyId
                        }
                    };
                    
                    newCompany = {
                        TableName : "Game" + gameId + ".Companies",
                        Key : {
                            "ID": companyId
                        },
                        UpdateExpression : 'set Money = :m',
                    };
                    callback(null);
                }
            });
        },
        function getCompany(callback) {
            console.log("Starting to get company.");
            doc.get({
                TableName : "Game" + gameId + ".Companies",
                Key : {
                    ID: companyId
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                } else {
                    callback(null,data)
                }
            });
        },
        function getProperty(company, callback) {
            console.log("Starting to get property.");
            doc.get({
                TableName : "Game" + gameId + ".Properties",
                Key : {
                    ID: propertyId
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, company, data)
                }
            });
        },
        function processCapacityChange(company, property, callback) {
            console.log('Tables retrieved successfully.');
            if(user.Item.Companies[gameId] != company.Item.ID) {
                callback("You may only set orders for the companies you own.");
                return;
            } else if(company.Item.Properties.indexOf(property.Item.ID) < 0) {
                callback("You may only set orders for the properties you own.");
                return;
            }

            companyCash = company.Item.Money;
            
            console.log("Starting capacity change.");
            if (event.hasOwnProperty('capacityChange') && event.capacityChange != 0) {
                console.log('CapacityChange order: ' + event.capacityChange);
                changeCapacity(event, company, property, callback);
                somethingChanged = true;
            } else {
                callback(null, company, property);
            }
        },
        function processProductChange(company, property, callback) {
            console.log("Starting production change.");
            if (event.hasOwnProperty('production') && event.production != property.Item.Production && event.production != changed.production) {
                console.log('Production order: ' + event.production);
                changeProduction(event, company, property, callback);
                somethingChanged = true;
            } else {
                callback(null, company, property);
            }
        },
        function processStorageChange(company, property, callback) {
            console.log("Starting storage change.");
            if (event.hasOwnProperty('storageChange') && event.storageChange != 0) {
                console.log('Storage change order: ' + event.storageChange);
                changeStorage(event, company, property, callback);
                somethingChanged = true;
            } else {
                callback(null, company, property);
            }
        },
        function processPriceChange(company, property, callback) {
            console.log("Starting price change.");
            if (event.hasOwnProperty('price') && event.price != property.Item.Price) {
                console.log('Price change order: ' + event.price);
                changePrice(event, company, property, callback);
                somethingChanged = true;
            } else {
                callback(null, company, property);
            }
        },
        function updateTable(company, property, callback) {
            if( somethingChanged) {
                console.log('Starting to update tables.');
                updateTables(company, callback);
            } else callback(null, null);
        }
    ], function (err, data) {
        console.log( ((err) ? err : JSON.stringify(err)));
        changed.changed = somethingChanged;
        context.done(err,changed);
    });
};