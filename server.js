var express = require('express');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');
var xml2js = require('node-xml');
var moment = require('moment');
var stathat = require('stathat');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var pass = require('pwd');

var app = express();
var httpport = 18080;
var net = require('net');
var sockets = [];
var port = 30059;
var guestId = 0;

var redis = require('redis'); 
var db_port = 6379;

var Users = {
	"USERNAME"  : "",
	"EMAIL"  : "",
	"SALT"	: "",
	"HASH"	: "",
	"DEVICEID"  : "",
	"TOKIN"  : ""
};

function UserRegister(Username, JsonUser, callback) {
	var client = redis.createClient(db_port);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	if (JsonUser == "") {
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
			if (result == null) {
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
}

function UserQuery(Username, callback) {
	var client = redis.createClient(db_port);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	console.log("Username" + Username);
	client.get(Username, function(err, result) {
		if (err) {
			console.log(err);
		}
		console.log("UserQuery" + result);
		callback(result);    
	});
}

function bindRedis(FromUserName, deviceId , callback) {
	var client = redis.createClient(db_port);
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
}
 
function setRedis(devId, userId, slotId , slotState , callback) {
	var client = redis.createClient(db_port);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	if(devId == null) {
		client.get(userId, function(err, deviceId) {
			if (err) {
				console.log(err);
			}
			if (deviceId == null) {
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
 
}
 
function replacePos(strObj, pos, replacetext , callback) {
	if (strObj == null ||strObj.length > 5) {
		strObj = '00000'
		if ((pos > 0) && (pos < 6)) {
			var str = strObj.substr(0, pos-1) + replacetext + strObj.substring(pos, strObj.length);
			callback(str);
		}
		else {
			var err = strObj
			callback(err);
		}
	}
	else {
		if ((pos > 0) && (pos < 6)) {
			var str = strObj.substr(0, pos-1) + replacetext + strObj.substring(pos, strObj.length);
			callback(str);
		}
		else {
			var err = strObj
			callback(err);
		}
	}
}
 
function getRedis(key , callback) {
	var client = redis.createClient(db_port);
	client.on("error", function (err) {
		console.log("Error " + err);
	});
	client.get(key, function(err, value) {
		if (err) {
			console.log(err);   
		}
		callback(value); 
	});  
}

var server = net.createServer(function(socket) {
	// Increment
	guestId++;
	socket.nickname = "Client_" + guestId;
	var clientName = socket.nickname;
	stathat.trackEZCount("54anson@gmail.com", "TcpConnects", 1, function(status, json) {});
	sockets.push(socket);
	// Log it to the server output
	console.log(clientName + ' connected.');
	// Welcome user to the socket
	socket.write("Hi "+ clientName +" Welcome!\n");
	// Broadcast to others excluding this socket
	//broadcast(clientName, clientName + ' joined this chat.\n');
	// When client sends data
	socket.on('data', function(data) {
		var message = clientName + '> ' + data.toString();
		//broadcast(clientName, message);
		//process.stdout.write(message);
	});
	// When client leaves
	socket.on('end', function() {
		var message = clientName + ' disconnected\n';
		console.log(message);
		removeSocket(socket);
		//broadcast(clientName, message);
	});
 
	// When socket gets errors
	socket.on('error', function(error) {
		console.log('Socket got problems: ', error.message);
	});
});
function sha1(str) {
    var md5sum = crypto.createHash('sha1');
    md5sum.update(str);
    str = md5sum.digest('hex');
    return str;
}

function validateToken(req, res) {
    var query = req.query;
    var signature = query.signature;
    var echostr = query.echostr;
    var timestamp = query['timestamp'];
    var nonce = query.nonce;
    var oriArray = new Array();
    oriArray[0] = nonce;
    oriArray[1] = timestamp;
    oriArray[2] = "414cf5d02e";// your token
    oriArray.sort();
    var original = oriArray[0]+oriArray[1]+oriArray[2];
    console.log("Original Str:"+original);
    console.log("signature:"+signature);
    var scyptoString = sha1(original);
    if (signature == scyptoString) {
        res.send(echostr);
    }
    else {
        res.send("Bad Token!");
    }
}
function ProccessRequest(commands){
	console.log(commands);
}

function processMessage(data, res){
	var tempid="";
	var xmldata="";
	var ToUserName="";
	var FromUserName="";
	var CreateTime="";
	var MsgType="";
	var Content="";
	var EventKey="";
	var Location_X="";
	var Location_Y="";
	var Scale=1;
	var Label="";
	var tempstate = "";
	var PicUrl="";
	var FuncFlag="";
	var tempName="";
		var json_out = {
		"DeviceId"  	: "00000000",
		"IsSuccess" 	: "Success",
		"NSlots"    	: "5",
		"State"     	: "00000",
		"ServerTime"	: "2014-5-19 14:47:56"
	};

	json_out.ServerTime = moment().format('YYYY-MM-DD, HH:mm:ss');
	
	var parse=new xml2js.SaxParser(function(cb){
		cb.onStartElementNS(function(elem,attra,prefix,uri,namespaces){
			tempName=elem;
		});
		cb.onCharacters(function(chars){
			chars=chars.replace(/(^\s*)|(\s*$)/g, "");
			if(tempName=="CreateTime"){
				CreateTime=chars;
			}else if(tempName=="Location_X"){
				Location_X=cdata;
			}else if(tempName=="Location_Y"){
				Location_Y=cdata;
			}else if(tempName=="Scale"){
				Scale=cdata;
			}			
		});
		cb.onCdata(function(cdata){
			if(tempName=="ToUserName"){
				ToUserName=cdata;
			}else if(tempName=="FromUserName"){
				FromUserName=cdata;
			}else if(tempName=="MsgType"){
				MsgType=cdata;
			}else if(tempName=="Content"){
				Content=cdata;
			}else if(tempName=="PicUrl"){
				PicUrl=cdata;
			}else if(tempName=="EventKey"){
				EventKey=cdata;
			}
			//console.log("cdata:"+cdata);
		});
		cb.onEndElementNS(function(elem,prefix,uri){
			tempName="";
		});
		cb.onEndDocument(function(){
			stathat.trackEZCount("54anson@gmail.com", "ClientRequests", 1, function(status, json) {});
			tempName="";
			var msg="";
			if(MsgType=="text"){
				msg="你说的是："+Content;
			}else if (MsgType=="event"){
				msg="Your command："+EventKey;
				Content = EventKey;
				//ProccessRequest(EventKey);
			}else if (MsgType=="image"){
				msg="你发的图片是："+PicUrl;
			}else {
				//console.log(MsgType);
			}
			//xmldata = ToXML(FromUserName,ToUserName,'text',msg,FuncFlag);
			//broadcast('SYSTEM',"Command long:" + Content.length + '\n');
			if(Content.indexOf("bind") != -1) {
				if(Content.length == 13) {
					bindRedis(FromUserName, Content.substr(5,8) , function(temp){
						broadcast('SYSTEM',JSON.stringify(temp) + '\n');
					});
				}
			} else if(Content.indexOf("打开台灯") != -1) {
				setRedis(null, FromUserName, 5, 1, function(temp){
					json_out.State = temp;
					//console.log("temp.length " + temp.length );
					if(temp.length == 5) {
						getRedis(FromUserName , function(temp1){
							json_out.DeviceId = temp1;
							broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
						});
					} else {
						msg = "您的账号未绑定任何设备！";
						console.log("NOTBINDYET!");
					}
				});
			} else if(Content.indexOf("关闭台灯") != -1) {
				setRedis(null, FromUserName, 5, 0, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("打开音箱") != -1) {
				setRedis(null, FromUserName, 4, 1, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("关闭音箱") != -1) {
				setRedis(null, FromUserName, 4, 0, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("打开苹果充电器") != -1) {
				setRedis(null, FromUserName, 3, 1, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("关闭苹果充电器") != -1) {
				setRedis(null, FromUserName, 3, 0, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("打开安卓充电器") != -1) {
				setRedis(null, FromUserName, 2, 1, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("关闭安卓充电器") != -1) {
				setRedis(null, FromUserName, 2, 0, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("打开树莓派") != -1) {
				setRedis(null, FromUserName, 1, 1, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("关闭树莓派") != -1) {
				setRedis(null, FromUserName, 1, 0, function(temp){
					json_out.State = temp;
					getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else {
				broadcast('SYSTEM',"Command long:" + Content.length + '\n');
			}
			xmldata = ToXML(FromUserName,ToUserName,'text',msg,FuncFlag);
			res.send(xmldata);
		});
	});
	parse.parseString(data);
	return xmldata;
}

function ToXML(FromUserName,ToUserName,MsgType,Msg,FuncFlag) {
  var msgxml = "" +
      "<xml>" +
      "<ToUserName>" + FromUserName + "</ToUserName>" +
      "<FromUserName>" + ToUserName + "</FromUserName>" +
      "<CreateTime>" + Date.now()/1000 + "</CreateTime>" +
	  "<FuncFlag>0</FuncFlag>" +
      "<MsgType>" + MsgType + "</MsgType>";

 // switch(MsgType) {
 //   case 'text' : 
      msgxml += "" +
        "<Content>" + Msg + "</Content>" +
        "</xml>";
        //console.log(msgxml);
      return msgxml;
 // }
}

function handler(req, res) {
  //RES = res;
  var xml = '';
  var xmldata = '';
  var self = this;

  req.setEncoding('utf8');
  req.on('data', function (chunk) {
    xml += chunk;
  });

  req.on('end', function() {
    xmldata = processMessage(xml, res);
  });
  
  return xmldata
}

// Broadcast to others, excluding the sender
function broadcast(from, message) {
	// If there are no sockets, then don't broadcast any messages
	if (sockets.length === 0) {
		console.log('nobody connected.')
		return;
	}
	// If there are clients remaining then broadcast message
	sockets.forEach(function(socket, index, array){
		// Dont send any messages to the sender
		if(socket.nickname === from) return;
		socket.write(message);
	});
};
 
// Remove disconnected client from sockets array
function removeSocket(socket) {
	sockets.splice(sockets.indexOf(socket), 1);
};
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views'); 
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
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

function authenticate(name, pass, fn) {
	var userinfo = {
		"USERNAME"  : "",
		"EMAIL"  : "",
		"SALT"	: "",
		"HASH"	: "",
		"DEVICEID"  : "",
		"TOKIN"  : ""
	};
	if (!module.parent) console.log('authenticating %s:%s', name, pass);
	UserQuery(name, function(temp) {
		userinfo = JSON.parse(temp);
		
		console.log("Query Result:" + userinfo.USERNAME);
		console.log("userinfo.SALT:" + userinfo.SALT);
		if (!userinfo) {
			console.log("cannot find user");
			return fn(new Error('cannot find user'));
		}
		var password = require('pwd');
		password.hash(pass, userinfo.SALT, function(err, hash){
			if (err) {
				return fn(err);
			}
			if (userinfo.HASH == hash) {
				console.log("User authenticate success:" + Users.USERNAME);
				return fn(null, temp); // yay
			}
			fn(new Error('invalid password'));
		});
	});
	// query the db for the given username

  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
 // hash(pass, user.salt, function(err, hash){
 //   if (err) return fn(err);
 //   if (hash == user.hash) return fn(null, user);
 //   fn(new Error('invalid password'));
 // });
  

}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

// Listening for any problems with the server
server.on('error', function(error) {
	console.log("So we got problems!", error.message);
});

// Listen for a port to telnet to
// then in the terminal just run 'telnet localhost [port]'
server.listen(port, function() {
	console.log("TCP  listening on port :" + port);
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.send(500, 'Something broke!');
});

app.get('/panel', restrict, function(req, res){
  res.sendfile('./public/admin.html');
});

app.get('/login', function(req, res){
  res.sendfile('./public/login.html');
});

app.get('/register', function(req, res){
  res.sendfile('./public/register.html');
});

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/panel');
  });
});

app.post('/register', function(req, res){
	if(req.body.uname == "") {
		res.redirect('/error_uname');
	}
	if(req.body.email == "") {
		res.redirect('/error_email');
	}
	if(req.body.password == "") {
		res.redirect('/error_password');
	}
	Users.USERNAME = req.body.uname;
	Users.EMAIL = req.body.email;
	
	pass.hash(req.body.password, function(err, salt, hash){
		Users.SALT = salt;
		Users.HASH = hash;
		crypto.randomBytes(16, function(ex, buf) {  
			Users.TOKIN = buf.toString('hex').toUpperCase();
			UserRegister(Users.USERNAME, JSON.stringify(Users), function(temp) {
				res.send(temp);
			});
		}); 
	}); 
});

app.post('/login', function(req, res){
  authenticate(req.body.uname, req.body.password, function(err, userinfo){
	console.log("UserInfo:" + userinfo);
	var user = JSON.parse(userinfo);
	console.log(user.USERNAME);
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
		console.log("Login success:" + user.USERNAME);
        res.redirect('/panel');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.';
      res.redirect('back');
    }
  });
});

app.get("/user/delete/:user" , function(req, res) {
	UserRegister(req.params.user, "", function(temp) {
		res.send(temp);
	});
});

app.get('/wechat',function(req,res){
	validateToken(req, res);
});

app.post('/wechat',function(req,res){
	xmldata = handler(req,res);
});

app.get('/qrcode', function(req, res){
	res.send('<img src="qrcode.jpg"  alt="qrcode" />');
});

app.get("/device/:id/:slot?/:operation?" , function(req, res){
	var temp = 'error'
	var json_out = {
		"DeviceId"  	: "00000000",
		"IsSuccess" 	: "Success",
		"NSlots"    	: "5",
		"State"     	: "00000",
		"ServerTime"	: "2014-5-19 14:47:56"
	};
	json_out.DeviceId = req.params.id;
	json_out.ServerTime = moment().format('YYYY-MM-DD, HH:mm:ss');
	if (req.params.operation != undefined) {
		setRedis(req.params.id, null, req.params.slot, req.params.operation, function(temp){
			json_out.State = temp;
			broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
			res.send(JSON.stringify(json_out));
		});
	}
	else {
		getRedis(req.params.id , function(temp){			
			json_out.State = temp;			
			broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
			res.send(JSON.stringify(json_out));
		});
	}
});

app.get("/api/device/:id/:slot?/:operation?" , function(req, res){
	var temp = 'error'
	var json_out = {
		"DeviceId"  	: "00000000",
		"IsSuccess" 	: "Success",
		"NSlots"    	: "5",
		"State"     	: "00000",
		"ServerTime"	: "2014-5-19 14:47:56"
	};
	json_out.DeviceId = req.params.id;
	json_out.ServerTime = moment().format('YYYY-MM-DD, HH:mm:ss');
	if (req.params.operation != undefined) {
		setRedis(req.params.id, null, req.params.slot, req.params.operation, function(temp){
			json_out.State = temp;
			broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
			res.send(JSON.stringify(json_out));
		});
	}
	else {
		getRedis(req.params.id , function(temp){			
			json_out.State = temp;			
			broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
			res.send(JSON.stringify(json_out));
		});
	}
});

var server = app.listen(httpport, function() {
    console.log('HTTP listening on port :%d', server.address().port);
});