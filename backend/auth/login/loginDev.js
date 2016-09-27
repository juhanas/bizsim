console.log('Loading function');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

// Get reference to AWS clients
var doc = new AWS.DynamoDB.DocumentClient();
//var cognitoidentity = new AWS.CognitoIdentity();

function computeHash(password, salt, fn) {
    // Bytesize
    var len = 128;
    var iterations = 4096;

    if (3 == arguments.length) {
        crypto.pbkdf2(password, salt, iterations, len, function(err, derivedKey) {
            if (err) return fn(err);
            else fn(null, salt, derivedKey.toString('base64'));
        });
    } else {
        fn = salt;
        crypto.randomBytes(len, function(err, salt) {
            if (err) return fn(err);
            salt = salt.toString('base64');
            computeHash(password, salt, fn);
        });
    }
}

function getUser(email, callback) {
    /*
     * Gets the data of the user from database based on email.
     * Calls the callback function with parameters
     *    error, hash, salt, username, userid, verified (true/false)
     */
    var params = {
        TableName : "Emails",
        Key : {
            "Email": email
        }
    }
    console.log("Getting Emails with params: " + JSON.stringify(params));
    doc.get(params, function(err, data) {
        if (err) return callback(err);
        else if (!('Item' in data)) return callback("No user found: " +JSON.stringify(data));
        else {
            var params2 = {
                TableName : "Users",
                Key : {
                    "ID": data.Item.ID
                }
            }
            console.log("Getting info for user with params: " + JSON.stringify(params2));
            doc.get(params2, function(err, data) {
                if (err) return callback(err);
                else {
                    console.log('Found: ' + JSON.stringify(data));
                    if ('Item' in data) {
                        var hash = data.Item.PasswordHash;
                        var salt = data.Item.PasswordSalt;
                        var username = data.Item.Username;
                        var userid = data.Item.ID;
                        var companies = data.Item.Companies;
                        var verified = true;//data.Item.verified.BOOL;
                        callback(null, hash, salt, username, userid, companies, verified);
                    } else {
                      callback("User not found.");
                    }
                }
            });
        }
    });
}

function getToken(email, username, userid, fn) {
    /*
    Returns a JSON Web Token that contains the user's email.
    */
    /*
    var param = {
      IdentityPoolId: config.IDENTITY_POOL_ID,
      Logins: {} // To have provider name in a variable
    };
    param.Logins[config.DEVELOPER_PROVIDER_NAME] = email;
    cognitoidentity.getOpenIdTokenForDeveloperIdentity(param,
      function(err, data) {
        if (err) return fn(err); // an error occurred
        else fn(null, data.IdentityId, data.Token); // successful response
      });
    */
    // Using JSON Web Token with SHA256
    var token = jwt.sign({ "email": email, "username": username, "userid": userid }, secret_key);
    fn(null, token);
}

/**
 * Logs the given user in and returns a web-token containing information about the user.
 * event:
 *  {email: [String], password: [String]}
 */
exports.handler = function(event, context) {
    if( !event.hasOwnProperty('email') || event.email == ''){
        context.done("Did not get a proper email.");
    }

    if( !event.hasOwnProperty('password') || event.password == ''){
        context.done("Did not get a proper password.");
    }

    var email = event.email;
    var clearPassword = event.password;

    getUser(email, function(err, correctHash, salt, username, userid, companies, verified) {
        if (err) {
            context.succeed({error: err, message: 'Error getting user from database: ' + JSON.stringify(err)});
        } else {
            if (correctHash == null) {
                // User not found
                console.log('User not found: ' + email);
                context.succeed({
                    login: false,
                    message: 'User not found.'
                });
            /*
            } else if (!verified) {
              // User not verified
              console.log('User not verified: ' + email);
              context.succeed({
                login: false,
                          error: 'Please verify the email address before continuing.'
              });
            */
            } else {
                computeHash(clearPassword, salt, function(err, salt, hash) {
                    if (err) {
                        context.succeed({error: err, message: 'Error in Hash: ' + JSON.stringify(err)});
                    } else {
                        console.log('correctHash: ' + correctHash + ' hash: ' + hash);
                        if (hash == correctHash) {
                            // Login ok
                            console.log('User logged in: ' + email);
                            getToken(email, username, userid, function(err, token) {
                                if (err) {
                                    context.succeed({error: err, message: 'Error in getToken: ' + JSON.stringify(err)});
                                } else {
                                    context.succeed({
                                        login: true,
                                        username: username,
                                        companies: companies,
                                        token: token
                                    });
                                }
                            });
                        } else {
                            // Login failed
                            console.log('User login failed: ' + email);
                            context.succeed({
                                login: false,
                                message: 'Invalid password.'
                            });
                        }
                    }
                });
            }
        }
    });
}