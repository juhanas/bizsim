console.log('Loading function createUser');

// dependencies
var AWS = require('aws-sdk');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var async = require('async');

// Get reference to AWS clients
var doc = new AWS.DynamoDB.DocumentClient();
//var ses = new AWS.SES();

function computeHash(password, salt, fn) {
	// Bytesize
	var len = 128;
	var iterations = 4096;

	if (3 == arguments.length) {
		crypto.pbkdf2(password, salt, iterations, len, fn);
	} else {
		fn = salt;
		crypto.randomBytes(len, function(err, salt) {
			if (err) return fn(err);
			salt = salt.toString('base64');
			crypto.pbkdf2(password, salt, iterations, len, function(err, derivedKey) {
				if (err) return fn(err);
				fn(null, salt, derivedKey.toString('base64'));
			});
		});
	}
}

function getToken(email, username, userid, callback) {
    /*
     * Creates a JSON Web Token that contains the user's email, username and id.
     * Using JSON Web Token with SHA256.
     * When finished, calls the given function with (error, token).
     */
    var token = jwt.sign({ "email": email, "username": username, "userid": userid }, secret_key);
    callback(null, token);
}

function storeUser(email, username, nextUserId, password, salt, callback) {
    /*
    Stores the user in the database.
    Creates a unique token for the user and returns it.
    */
    doc.put({
        TableName : "Users",
        Item : {
            "Email" : email,
            "Username" : username,
            "ID" : nextUserId,
            "Companies" : {},
            "PasswordHash" : password,
            "PasswordSalt" : salt
        },
        ConditionExpression: 'attribute_not_exists (Email) and attribute_not_exists (Username) and attribute_not_exists (ID)'
    }, function(err, data) {
        if (err) return callback(err);
        else {
            doc.put({
                TableName : "Emails",
                Item : {
                    "Email" : email,
                    "ID" : nextUserId,
                },
                ConditionExpression: 'attribute_not_exists (Email) and attribute_not_exists (ID)'
            }, function(err, data) {
                if (err) return callback(err);
                else getToken(email, username, nextUserId, callback);
            });
        }
    });
}

/*
function sendVerificationEmail(email, token, fn) {
	var subject = 'Verification Email for ' + 'test@example.com';
	var verificationLink = '/verification' + '?email=' + encodeURIComponent(email) + '&verify=' + token;
	ses.sendEmail({
		Source: 'test@example.com',
		Destination: {
			ToAddresses: [
				email
			]
		},
		Message: {
			Subject: {
				Data: subject
			},
			Body: {
				Html: {
					Data: '<html><head>'
					+ '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'
					+ '<title>' + subject + '</title>'
					+ '</head><body>'
					+ 'Please <a href="' + verificationLink + '">click here to verify your email address</a> or copy & paste the following link in a browser:'
					+ '<br><br>'
					+ '<a href="' + verificationLink + '">' + verificationLink + '</a>'
					+ '</body></html>'
				}
			}
		}
	}, fn);
}
*/

/**
 * Creates a new user and returns web-token for it.
 * event:
 *  {email: [String], username: [String], password: [String]}
 */
exports.handler = function(event, context) {
    if( !event.hasOwnProperty('email') || event.email == ''){
        context.done("Did not get a proper email.");
    }
        
    if( !event.hasOwnProperty('username') || event.username == ''){
        context.done("Did not get a proper user");
    }
        
    if( !event.hasOwnProperty('password') || event.password == ''){
        context.done("Did not get a proper password.");
    }

    var email = event.email;
    var username = event.username;
    var clearPassword = event.password;

    async.waterfall([
        function (callback) {
            doc.get({
                TableName : "GlobalVariables",
                Key : {
                    Category: "NextUserId"
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                console.log("Read table GlobalVariables: " + JSON.stringify(data));
                nextUserId = data.Item.ValueNumber;
                console.log("Next user id: " + nextUserId);

                callback(null);
            });
        },
        function (callback) {
            doc.update({
                TableName : "GlobalVariables",
                Key : {
                    "Category": "NextUserId"
                },
                UpdateExpression: "set ValueNumber = :n",
                ExpressionAttributeValues : {
                    ":n" : nextUserId + 1
                }
            }, function(err, data) {
                if (err) {
                    callback(err);
                }
                callback(null);
            });
        },
        function (callback) {
            computeHash(clearPassword, function(err, salt, hash) {
                if (err) {
                    context.fail('Error in hash: ' + err);
                } else {
                    storeUser(email, username, nextUserId, hash, salt, function(err, token) {
                        if (err) {
                            if (err.code == 'ConditionalCheckFailedException') {
                                // userId already found
                                context.succeed({
                                    created: false,
                                    error: 'User is already registered.'
                                });
                            } else {
                                context.fail('Error in storeUser: ' + err);
                            }
                        } else {
                            /*
                            sendVerificationEmail(email, token, function(err, data) {
                                if (err) {
                                    context.fail('Error in sendVerificationEmail: ' + err);
                                } else {
                                    context.succeed({
                                        created: true
                                    });
                                }
                            });
                            */
                            context.succeed({
                                created: true,
                                username: username,
                                token: token
                            });
                        }
                    });
                }
            });
        }
    ]);
}