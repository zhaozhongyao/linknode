var redis = require('redis'); 
var db_port = 16379;

function replacePos(strObj, pos, replacetext , callback) {
    var str = '';
    var err = '';
	if (strObj === null ||strObj.length > 5) {
		strObj = '00000';
		if ((pos > 0) && (pos < 6)) {
			str = strObj.substr(0, pos-1) + replacetext + strObj.substring(pos, strObj.length);
			callback(str);
		}
		else {
			err = strObj;
			callback(err);
		}
	}
	else {
		if ((pos > 0) && (pos < 6)) {
			str = strObj.substr(0, pos-1) + replacetext + strObj.substring(pos, strObj.length);
			callback(str);
		}
		else {
			err = strObj;
			callback(err);
		}
	}
}

exports.UserRegister = function(Username, JsonUser, callback) {
	var client = redis.createClient(db_port,process.env.IP);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	if (JsonUser === "") {
		client.del(Username);
		client.get(Username, function(err, result) {
			if (err) {
				console.log(err);
			}
			callback("User has been deleted!");    
		});
	} else {
		client.get(Username, function(err, result) {
			if (err) {
				console.log(err);
			}
			if (result === null) {
				client.set(Username, JsonUser);
				client.get(Username, function(err, result) {
					if (err) {
						console.log(err);
					}
					console.log(result);
					callback(result);    
				});
			} else {
				callback("Username already exist!");  
			}
		});  
	}
};

exports.UserUpdate = function(Username, JsonUser, callback) {
	var client = redis.createClient(db_port,process.env.IP);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	client.get(Username, function(err, result) {
		if (err) {
			console.log(err);
		}
		if (result !== null) {
			client.set(Username, JsonUser);
			client.get(Username, function(err, result) {
				if (err) {
					console.log(err);
				}
				console.log(result);
				callback(result);    
			});
		} else {
			callback("Username not exist!");  
		}
	});  
};

exports.UserQuery = function(Username, callback) {
	var client = redis.createClient(db_port,process.env.IP);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	//console.log("Username: " + Username);
	client.get(Username, function(err, result) {
		if (err) {
			console.log(err);
		}
		//console.log("UserQuery" + result);
		callback(result);    
	});
};

exports.bindRedis = function(FromUserName, deviceId , callback) {
	var client = redis.createClient(db_port,process.env.IP);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
 
	client.set(FromUserName, deviceId);
 
	client.get(FromUserName, function(err, result) {
		if (err) {
			console.log(err);
		}
		console.log("bindRedis " + FromUserName + " " + result);
		callback(result);    
	}); 
};
 
exports.setRedis = function(devId, userId, slotId , slotState , callback) {
	var client = redis.createClient(db_port,process.env.IP);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	if(devId === null) {
		client.get(userId, function(err, deviceId) {
			if (err) {
				console.log(err);
			}
			if (deviceId === null) {
				console.log("NOTFOUND");
				callback("NOTFOUND"); 
			} else {
				if(deviceId.length == 8) {
					client.get(deviceId , function(err, result) {
						if (err) {
							console.log(err);
						}
						replacePos(result, slotId, slotState ,function(deviceState) {
							client.set(deviceId, deviceState);
							console.log('Device State Update [' + deviceId + ':(' + result + '->' + deviceState + ')]');
							callback(deviceState); 
						});
					}); 
				}
			}
		}); 
	}
	else {
		if(devId.length == 8) {
			client.get(devId , function(err, result) {
				if (err) {
					console.log(err);
				}
				replacePos(result, slotId, slotState ,function(deviceState) {
					client.set(devId, deviceState);
					console.log('Device State Update [' + devId + ':(' + result + '->' + deviceState + ')]');
					callback(deviceState); 
				});
			}); 
		}
		else {
			console.log("NOTFOUND");
			callback("NOTFOUND"); 
		}
	}
 
};

exports.getRedis = function(key , callback) {
	var client = redis.createClient(db_port,process.env.IP);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	client.get(key, function(err, value) {
		if (err) {
			console.log(err);   
		}
		callback(value); 
	});  
};
