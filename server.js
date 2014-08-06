var express = require('express');
var crypto = require('crypto');
var moment = require('moment');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var net = require('net');
var pass = require('pwd');
var app = express();

var httpport = 8080;
var port = 30059;
var guestId = 0;
var timezone = -8;
var heartbeat_check_interval = 1000 * 30;

var data_obj = require('./redis.js');
var socket_obj = require('./socket.js');
var wechat_obj = require('./wechat.js');

var ERR_NULL_ID = {"error":"NULLID"};
var UserDelete = {
    "IsSuccess" : "false"
};

var online_list = new Array(0);

var packet_heartbeat = {
    "id" : "",
    "data" : ""
};

var Users = {
	"USERNAME"  : "",
	"EMAIL"  : "",
	"SALT"	: "",
	"HASH"	: "",
	"DEVICEID"  : "",
	"DEVICEID2"  : "",
	"TOKIN"  : ""
};

var DeviceState = {
	"DeviceId"  : "00000000",
	"NSlots"    : 5,
	"State"     : "00000",
	"IsOnline"  : false,
	"Heartbeat" : 0,
	"Sensor" : ""
};

function online_list_add(devid) {
    var dev = {"id" : ""};
    var exist = false;
    dev.id = devid;
    //get online list array form redis.
    data_obj.loadOnlinelist(function(list) {
        online_list = JSON.parse(list);
        for(var i=0; i<online_list.length; i++) {
            if (online_list[i].id == devid) {
                exist = true;
                break;
            }
        }
        if(!exist) {
            online_list.push(dev);
            data_obj.saveOnlinelist(JSON.stringify(online_list));
            //save online list array to redis.
            //send this device states.
            data_obj.getRedis(devid, function(temp) {	
                //console.log(temp);
                if(temp !== null) {
                    if(temp.length > 5) {
                        var json_out = DeviceState;
                        json_out = JSON.parse(temp);
                        socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
                    }
                }
            });         
        }
    });
}

function heartbeatUpdate(id, timeout, data) {
    //{"id":"00000001","data":"haha"}
	data_obj.setheartbeat(id, timeout, data, function(temp) {
        online_list_add(id); 
		//socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
		//console.log(temp);
	});
}


function heartbeat_timer() {
    var state = DeviceState;
    var i;
    var list_changed = false;
    if (online_list !== null) {
        if(online_list.length >0) {
            console.log("...Begin of Online List...");
            //online tree traversal.
            //and dicrease 1 heartbeat counter to every online device.
            for (i = online_list.length - 1; i >= 0; i--) { 
                (function (i) {
                    data_obj.setheartbeat(online_list[i].id, -1, null, function(temp) {
                        state = JSON.parse(temp);
    				    if (state.Heartbeat === 0) {
               		        console.log('!!!device %s offline!!!', online_list[i].id);
                		    //console.log(state);
                		    online_list.splice(i, 1);
                		    list_changed = true;
                	    }
                    });
                })(i); 
            } 
            if(list_changed === true) {
                data_obj.saveOnlinelist(JSON.stringify(online_list));
                console.log('save online list.');
    　　      }
            console.log(online_list);
            console.log("....End of Online List....");
        } else {
            //console.log('....None online device....');
        }
    }
}

var tcp_server = net.createServer(function(socket) {
	// Increment
	guestId++;
	socket.nickname = "Client_" + guestId;
	var clientName = socket.nickname;
	socket_obj.pushsocket(socket);
	// Log it to the server output
	console.log(clientName + ' connected.');
	// Welcome user to the socket
	socket.write("Hi "+ clientName +" Welcome!\n");
	// Broadcast to others excluding this socket
	//broadcast(clientName, clientName + ' joined this chat.\n');
	// When client sends data
	socket.on('data', function(data) {
		//var message = clientName + '> ' + data.toString();
		//broadcast(clientName, message);
		//parse packet,find device id.
		if (data !== null) {
            if (data.length > 20) {
                var posStart = data.indexOf('{');
                var posEnd = data.indexOf('}');
                if(posStart >= 0 && posEnd >= 0) {
                    var newData = data.substring(posStart, posEnd);
                    console.log(newData);
                    packet_heartbeat = JSON.parse(newData);
                    heartbeatUpdate(packet_heartbeat.id, 6 ,packet_heartbeat.data);
                    //console.log('length :%d',data.length);
                }
            }
		}
		//set device heartbeat counter to N(similer to TTL). mybe N = heartbeat_check_interval × 6
	});
	// When client leaves
	socket.on('end', function() {
		var message = clientName + ' disconnected\n';
		console.log(message);
		socket_obj.removeSocket(socket);
		//broadcast(clientName, message);
	});
	// When socket gets errors
	socket.on('error', function(error) {
		console.log('Socket got problems: ', error.message);
	});
});

// Listening for any problems with the server
tcp_server.on('error', function(error) {
	console.log("So we got problems!", error.message);
});

// Listen for a port to telnet to
// then in the terminal just run 'telnet localhost [port]'
tcp_server.listen(port, function() {
	console.log("TCP   listening on port :" + port);
});

app.use(express.static(__dirname + '/public'));
app.use(bodyParser());
app.use(cookieParser('shhhh, very secret'));
app.use(session());

app.use(function(req, res, next){
    var err = req.session.error;
    var msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = '';
    if (err) {
        res.locals.message = '<p class="msg error">' + err + '</p>';
    }
    if (msg) {
        res.locals.message = '<p class="msg success">' + msg + '</p>';
    }
    next();
});

function authenticate(name, pass, fn) {
	var userinfo = Users;
	if (!module.parent) {
        //console.log('authenticating %s:%s', name, pass);
	}
	data_obj.UserQuery(name, function(temp) {
		if (temp === null) {
			console.log("cannot find user");
			return fn(new Error('cannot find user'));
		} else if (temp == "DB_ERR") {
            console.log("DB_ERROR");
			return fn(new Error('DB_ERROR'));
		} else {
            userinfo = JSON.parse(temp);
            //console.log("Query Result:" + userinfo.USERNAME);
            //console.log("userinfo.SALT:" + userinfo.SALT);
            var password = require('pwd');
            password.hash(pass, userinfo.SALT, function(err, hash) {
                if (err) {
                    return fn(err);
                }
                if (userinfo.HASH == hash) {
                    console.log("User authenticate success:" + name);
                    return fn(null, temp); // yay
                }
                return fn(new Error('invalid password'));
            });
        }
	});
}

function restrict(req, res, next) {
    if (req.session.user) {
        //console.log("User: " + req.session.user);
        next();
    } else {
        req.session.error = 'Access denied!';
        res.redirect('/login');
    }
}

app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.send(500, 'Something broke!');
});

app.get('/panel', restrict, function(req, res) {
    res.sendfile('./public/admin.html');
});

app.get('/panel/accessibility', restrict, function(req, res) {
    res.sendfile('./public/accessibility.html');
});

app.get('/tokin/:refresh?', restrict, function(req, res) {
    var userinfo = Users;
    if (req.params.refresh !== undefined) {
        data_obj.UserQuery(req.session.user , function(temp) {
            if(temp === undefined || temp === null || temp ==="") {
                res.send("User not found!");
            }
            else
            {
                userinfo = JSON.parse(temp);
                crypto.randomBytes(16, function(ex, buf) {  
                    userinfo.TOKIN = buf.toString('hex').toUpperCase();
                    data_obj.UserUpdate(req.session.user, JSON.stringify(userinfo), function(result) {
                        res.send(result);
                    });
                }); 
            }
        });
    } else {
        data_obj.UserQuery(req.session.user , function(UserInfo) {
            if(UserInfo === undefined || UserInfo === null || UserInfo ==="") {
                res.send("User not found!");
            }
            else
            {
                res.send(UserInfo);
            }
        });
    }
});

app.get('/password/:new', restrict, function(req, res) {
    var userinfo = Users;
    data_obj.UserQuery(req.session.user , function(temp) {
        if(temp === undefined || temp === null || temp ==="") {
            res.send("User not found!");
        } else {
            userinfo = JSON.parse(temp);
            pass.hash(req.params.new, function(err, salt, hash) {
                userinfo.SALT = salt;
                userinfo.HASH = hash;
                crypto.randomBytes(16, function(ex, buf) {  
                    userinfo.TOKIN = buf.toString('hex').toUpperCase();
                    data_obj.UserUpdate(userinfo.USERNAME, JSON.stringify(userinfo), function(temp) {
                        authenticate(userinfo.USERNAME, req.params.new, function(err, userinfo) {
                            if(err === null) {
                                var user = JSON.parse(userinfo);
                                if (user.USERNAME) {
                                    req.session.regenerate(function() {
                                        req.session.user = user.USERNAME;
                                        req.session.success = 'Authenticated as ' + user.USERNAME
                                          + ' click to <a href="/logout">logout</a>. '
                                          + ' You may now access <a href="/panel">/panel</a>.';
                                        res.send(user);
                                    });
                                }
                            }
                        });
                    });
                }); 
            });
        }
    });
});

app.get('/panel/device', restrict, function(req, res) {
    res.sendfile('./public/device.html');
});

app.get('/panel/user', restrict, function(req, res) {
    res.sendfile('./public/user.html');
});

app.get('/login', function(req, res) {
    res.sendfile('./public/login.html');
});

app.get('/register', function(req, res) {
    res.sendfile('./public/register.html');
});

app.get('/logout', function(req, res) {
    // destroy the user's session to log them out
    // will be re-created next request
    req.session.destroy(function() {
        res.redirect('/panel');
    });
});

app.post('/register', function(req, res) {
    var newUsers = Users;
	if(req.body.uname === "") {
		res.redirect('/error_uname');
	}
	if(req.body.email === "") {
		res.redirect('/error_email');
	}
	if(req.body.password === "") {
		res.redirect('/error_password');
	}
	newUsers.USERNAME = req.body.uname;
	newUsers.EMAIL = req.body.email;
	
	pass.hash(req.body.password, function(err, salt, hash) {
		newUsers.SALT = salt;
		newUsers.HASH = hash;
		crypto.randomBytes(16, function(ex, buf) {  
			newUsers.TOKIN = buf.toString('hex').toUpperCase();
			data_obj.UserRegister(newUsers.USERNAME, JSON.stringify(newUsers), function(temp) {
				//res.send(temp);
				authenticate(newUsers.USERNAME, req.body.password, function(err, userinfo) {
                    if(err === null) {
                        var user = JSON.parse(userinfo);
                        if (user.USERNAME) {
                            req.session.regenerate(function(){
                            req.session.user = user.USERNAME;
                            req.session.success = 'Authenticated as ' + user.USERNAME
                              + ' click to <a href="/logout">logout</a>. '
                              + ' You may now access <a href="/panel">/panel</a>.';
                            res.redirect('/panel');
                          });
                        } else {
                            req.session.error = 'Authentication failed, please check your '
                            + ' username and password.';
                            res.redirect('back');
                        }
                    } else {
                        req.session.error = 'Authentication failed, please check your '
                            + ' username and password.';
                        res.redirect('/login');
                    }
                });
			});
		}); 
	}); 
});

app.post('/login', function(req, res) {
    //console.log(req.body.uname);
    //console.log(req.body.password);
    if(req.body.uname === null || req.body.password === null)
    {
        console.log("Error ,username or password empty!");
        req.session.error = 'Authentication failed, please check your '
            + ' username and password.';
        res.redirect('/login');
        
    } else {
        authenticate(req.body.uname, req.body.password, function(err, userinfo) {
            if(err === null) {
                var user = JSON.parse(userinfo);
                if (user.USERNAME) {
                  // Regenerate session when signing in
                  // to prevent fixation
                    req.session.regenerate(function(){
                    // Store the user's primary key
                    // in the session store to be retrieved,
                    // or in this case the entire user object
                    req.session.user = user.USERNAME;
                    req.session.success = 'Authenticated as ' + user.USERNAME
                      + ' click to <a href="/logout">logout</a>. '
                      + ' You may now access <a href="/panel">/panel</a>.';
                    //console.log("Login success:" + user.USERNAME);
                    res.redirect('/panel');
                  });
                } else {
                  req.session.error = 'Authentication failed, please check your '
                    + ' username and password.';
                  res.redirect('back');
                }
            } else if (err == "DB_ERROR") {
                console.log("ErrMsg:" + err);
                req.session.error = 'DBERROR';
                res.redirect('/login');
            } else {
                //console.log("ErrMsg:" + err);
                //console.log("UserInfo:" + userinfo);
                req.session.error = 'Authentication failed, please check your '
                    + ' username and password.';
                res.redirect('/login');
            }
        });
    }
});

//app.get("/user/delete/:user" , function(req, res) {
//	data_obj.UserRegister(req.params.user, "", function(temp) {
//		res.send(temp);
//	});
//});
//Resverd functions.
//this functions can delete users.



app.get("/user/delete" ,restrict , function(req, res) {
    var result = UserDelete;
	data_obj.UserRegister(req.session.user, "", function(temp) {
		req.session.destroy(function() {
            result.IsSuccess = "true";
            res.send(JSON.stringify(result));
        });
	});
});

app.get("/user" ,restrict , function(req, res) {
	data_obj.UserQuery(req.session.user , function(UserInfo) {
		if(UserInfo === undefined || UserInfo === null ||UserInfo ==="") {
			res.send("User not found!");
		}
		else
		{
			res.send(UserInfo);
		}
	});
});

app.get('/wechat',function(req, res) {
    wechat_obj.validateToken(req, res);
});

app.post('/wechat',function(req, res) {
	//var xmldata = wechat_obj.handler(req,res);
	wechat_obj.handler(req, res);
});

app.get("/bind/:num/:id", restrict, function(req, res) {
	var userinfo = Users;
	if (req.params.num !== undefined && req.params.id !== undefined && req.session.user !== undefined) {
        data_obj.UserQuery(req.session.user, function(temp) {
            if (temp === null) {
                console.log("cannot find user");
                res.send("cannot find user");
            } else {
                userinfo = JSON.parse(temp);
                if (req.params.num == "1") {
                    userinfo.DEVICEID = req.params.id;
                } else if (req.params.num == "2") {
                    userinfo.DEVICEID2 = req.params.id;
                }
                //console.log("Query Result:" + userinfo.USERNAME);
                //console.log("\nUserinfo.DEVICEID:" + userinfo.DEVICEID);
                
                data_obj.UserUpdate(userinfo.USERNAME, JSON.stringify(userinfo), function(temp) {
                    res.send(temp);
                });
            }
        });
	}
	else {
		res.send("UserName / DeviceId error or not login!");
	}
});

app.get("/api/device/:num/:slot?/:operation?", restrict, function(req, res) {
	var json_out = DeviceState;
    var userinfo = Users;
	json_out.ServerTime = moment().zone(timezone).format('YYYY-MM-DD, HH:mm:ss');
	if (req.params.operation !== undefined) {
        data_obj.UserQuery(req.session.user, function(temp) {
            if (temp === null) {
                console.log("cannot find user");
            } else {
                userinfo = JSON.parse(temp);
                if(userinfo.DEVICEID !== null && userinfo.DEVICEID !== "") {
                    if (req.params.num == "1") {
                        json_out.DeviceId = userinfo.DEVICEID;
                    }
                    if (req.params.num == "2") {
                        json_out.DeviceId = userinfo.DEVICEID2;
                    }
                    data_obj.setRedis(json_out.DeviceId, req.params.slot, req.params.operation, function(temp) {
                        //json_out.State = temp;
                        //console.log(temp);
                        json_out = JSON.parse(temp);
                        socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
                        res.send(JSON.stringify(json_out));
                    });                    
                } else {
                    res.send(ERR_NULL_ID);
                }
            }
        });
	} else {
        data_obj.UserQuery(req.session.user, function(temp) {
            if (temp === null) {
                console.log("cannot find user");
            } else {
                userinfo = JSON.parse(temp);
                if(userinfo.DEVICEID !== null && userinfo.DEVICEID !== "") {
                    if (req.params.num == "1") {
                        json_out.DeviceId = userinfo.DEVICEID;
                    }
                    if (req.params.num == "2") {
                        json_out.DeviceId = userinfo.DEVICEID2;
                    }
                    //console.log(json_out.DEVICEID);
                    data_obj.getRedis(json_out.DeviceId , function(temp) {	
                        //console.log(temp);
                        if(temp !== null) {
                            if(temp.length > 5) {
                                json_out = JSON.parse(temp);
                                //json_out.State = temp;
                                //socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
                                res.send(JSON.stringify(json_out));
                            } else {
                                res.send('');
                            }
                        } else {
                            res.send('{"err":"uninit"}');
                        }
                    });                   
                } else {
                    res.send(ERR_NULL_ID);
                }
            }
        });
        
	}
});

app.listen(httpport, function() {
    console.log('HTTP  listening on port :%d', httpport);
    console.log('Server started at :%s', moment().zone(timezone).format('YYYY-MM-DD, HH:mm:ss'));
    
    //get online list array form redis.
    setInterval(heartbeat_timer,heartbeat_check_interval);
});
