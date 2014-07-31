var redis = require('redis'); 
var db_port = 16379;
var redis_connected = false;
//redis-server --port 16379 --bind $IP
var client = redis.createClient(db_port,process.env.IP);

var DeviceState1 = {
	"DeviceId"  : "00000000",
	"NSlots"    : 5,
	"State"     : "00000",
	"IsOnline"  : false,
	"Heartbeat" : 0,
	"Sensor" : ""
};

client.on("error", function (err) {
	redis_connected = false;
	console.log("Error " + err);
});

client.on("connect", function () {
	redis_connected = true;
    console.log('REDIS connected on port :%d', db_port);
});

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
		} else {
			err = strObj;
			callback(err);
		}
	}
}

exports.UserRegister = function(Username, JsonUser, callback) {
	if (redis_connected) {
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
						//console.log(result);
						callback(result);    
					});
				} else {
					callback("Username already exist!");  
				}
			});  
		}
	} else {
		console.log("Error :Redis not connected!");
		callback("DB_ERR");
	}
};

exports.UserUpdate = function(Username, JsonUser, callback) {
	if (redis_connected) {
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
					//console.log(result);
					callback(result);    
				});
			} else {
				callback("Username not exist!");  
			}
		});  
	} else {
		console.log("Error :Redis not connected!");
		callback("DB_ERR");
	}
};

exports.UserQuery = function(Username, callback) {
	if (redis_connected) {
		//console.log("Username: " + Username);
		client.get(Username, function(err, result) {
			if (err) {
				console.log(err);
			}
			//console.log("UserQuery" + result);
			callback(result);    
		});
	} else {
		console.log("Error :Redis not connected!");
		callback("DB_ERR");
	}
};

exports.bindRedis = function(FromUserName, deviceId , callback) {
	if (redis_connected) {
		client.set(FromUserName, deviceId);
		client.get(FromUserName, function(err, result) {
			if (err) {
				console.log(err);
			}
			console.log("bindRedis " + FromUserName + " " + result);
			callback(result);    
		}); 
	} else {
		console.log("Error :Redis not connected!");
		callback("DB_ERR");
	}
};

exports.setRedis = function(devId, slotId , slotState , callback) {
	var devinfo = DeviceState1;
	if (redis_connected) {
		if(devId.length == 8) {
			client.get(devId , function(err, result) {
				if (err) {
					console.log(err);
				}
				if(result !== null) {
					if (result.length >5 ){
						devinfo = JSON.parse(result);
					}
				}
				replacePos(devinfo.State, slotId, slotState ,function(deviceState) {
					
					devinfo.DeviceId = devId;
					devinfo.NSlots = 5;
					devinfo.State = deviceState;
					
					client.set(devId, JSON.stringify(devinfo));
					console.log('Device State Update [' + result + '->' + deviceState + ']');
					callback(JSON.stringify(devinfo)); 
				});
			}); 
		} else {
			console.log("NOTFOUND");
			callback("NOTFOUND"); 
		}
	} else {
		console.log("Error :Redis not connected!");
		callback("DB_ERR");
	}
};

exports.getRedis = function(key , callback) {
	if (redis_connected) {
		client.get(key, function(err, value) {
			if (err) {
				console.log(err);   
			}
			callback(value); 
		});  
	} else {
		console.log("Error :Redis not connected!");
		callback("DB_ERR");
	}
};

exports.setheartbeat = function(devId, timeout, data, callback) {
	var devinfo = DeviceState1;
	if (redis_connected) {
		client.get(devId , function(err, result) {
			if (err) {
				console.log(err);
			}
			if (result !== null) {
				if (result.length >5 ){
					devinfo = JSON.parse(result);
				}
				if (timeout > 0) {
					devinfo.Heartbeat = timeout;
				} else {
					if (devinfo.Heartbeat > 0) {
						devinfo.Heartbeat = devinfo.Heartbeat + timeout;
					}
				}
				
				if (data !== null) {
					devinfo.Sensor = data;
				}
				
				if (devinfo.Heartbeat > 0) {
					devinfo.IsOnline = true;
				} else {
					devinfo.IsOnline = false;
				}
			}
			client.set(devId, JSON.stringify(devinfo));
			callback(JSON.stringify(devinfo)); 
		}); 
	} else {
		console.log("Error :Redis not connected!");
		callback("DB_ERR");
	}
};

exports.saveOnlinelist = function(ListArray) {
	if (redis_connected) {
		client.set("OnlineList", ListArray);
		console.log('Save Onlinelist to Redis.');
	} else {
		console.log("Error :Redis not connected!");
	}
};

exports.loadOnlinelist = function(callback) {
	if (redis_connected) {
		client.get("OnlineList", function(err, value) {
			if (err) {
				console.log(err);   
			}
			callback(value); 
		});  
	} else {
		console.log("Error :Redis not connected!");
		callback("DB_ERR");
	}
};