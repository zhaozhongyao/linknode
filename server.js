var express = require('express');
var crypto = require('crypto');

var moment = require('moment');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var net = require('net');
var pass = require('pwd');
var app = express();
var httpport = process.env.PORT;
var port = 16378;
var guestId = 0;

var data_obj = require('./redis.js');
var socket_obj = require('./socket.js');
var wechat_obj = require('./wechat.js');

var Users = {
	"USERNAME"  : "",
	"EMAIL"  : "",
	"SALT"	: "",
	"HASH"	: "",
	"DEVICEID"  : "",
	"TOKIN"  : ""
};

var server = net.createServer(function(socket) {
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
		//process.stdout.write(message);
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
server.on('error', function(error) {
	console.log("So we got problems!", error.message);
});

// Listen for a port to telnet to
// then in the terminal just run 'telnet localhost [port]'
server.listen(port, function() {
	console.log("TCP  listening on port :" + port);
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
	data_obj.UserQuery(name, function(temp) {
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
			return fn(new Error('invalid password'));
		});
	});
}

function restrict(req, res, next) {
  if (req.session.user) {
    console.log("User: " + req.session.user);
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

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
	if(req.body.uname === "") {
		res.redirect('/error_uname');
	}
	if(req.body.email === "") {
		res.redirect('/error_email');
	}
	if(req.body.password === "") {
		res.redirect('/error_password');
	}
	Users.USERNAME = req.body.uname;
	Users.EMAIL = req.body.email;
	
	pass.hash(req.body.password, function(err, salt, hash){
		Users.SALT = salt;
		Users.HASH = hash;
		crypto.randomBytes(16, function(ex, buf) {  
			Users.TOKIN = buf.toString('hex').toUpperCase();
			data_obj.UserRegister(Users.USERNAME, JSON.stringify(Users), function(temp) {
				res.send(temp);
			});
		}); 
	}); 
});

app.post('/login', function(req, res){
  authenticate(req.body.uname, req.body.password, function(err, userinfo){
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
            console.log("Login success:" + user.USERNAME);
            res.redirect('/panel');
          });
        } else {
          req.session.error = 'Authentication failed, please check your '
            + ' username and password.';
          res.redirect('back');
        }
    } else {
        console.log("ErrMsg:" + err);
        console.log("UserInfo:" + userinfo);
        req.session.error = 'Authentication failed, please check your '
            + ' username and password.';
        res.redirect('/login');
    }
  });
});

app.get("/user/delete/:user" , function(req, res) {
	data_obj.UserRegister(req.params.user, "", function(temp) {
		res.send(temp);
	});
});

app.get("/user/:user" , function(req, res) {
	data_obj.UserQuery(req.params.user, function(temp) {
		if(temp === undefined || temp === null ||temp ==="") {
			res.send("User not found!");
		}
		else
		{
			res.send(temp);
		}
	});
});

app.get('/wechat',function(req,res){
	wechat_obj.validateToken(req, res);
});

app.post('/wechat',function(req,res){
	var xmldata = wechat_obj.handler(req,res);
});

app.get('/qrcode', function(req, res){
	res.send('<img src="qrcode.jpg"  alt="qrcode" />');
});

app.get("/device/:id/:slot?/:operation?" , function(req, res){
	//var temp = 'error';
	var json_out = {
		"DeviceId"  : "00000000",
		"IsSuccess" : "Success",
		"NSlots"    : "5",
		"State"     : "00000",
		"ServerTime": "2014-5-19 14:47:56"
	};
	json_out.DeviceId = req.params.id;
	json_out.ServerTime = moment().format('YYYY-MM-DD, HH:mm:ss');
	if (req.params.operation !== undefined) {
		data_obj.setRedis(req.params.id, null, req.params.slot, req.params.operation, function(temp){
			json_out.State = temp;
			socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
			res.send(JSON.stringify(json_out));
		});
	}
	else {
		data_obj.getRedis(req.params.id , function(temp){			
			json_out.State = temp;			
			socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
			res.send(JSON.stringify(json_out));
		});
	}
});

app.get("/api/device/:id/:slot?/:operation?" , function(req, res){
	//var temp = 'error';
	var json_out = {
		"DeviceId"  : "00000000",
		"IsSuccess" : "Success",
		"NSlots"    : "5",
		"State"     : "00000",
		"ServerTime": "2014-5-19 14:47:56"
	};
	json_out.DeviceId = req.params.id;
	json_out.ServerTime = moment().format('YYYY-MM-DD, HH:mm:ss');
	if (req.params.operation !== undefined) {
		data_obj.setRedis(req.params.id, null, req.params.slot, req.params.operation, function(temp){
			json_out.State = temp;
			socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
			res.send(JSON.stringify(json_out));
		});
	}
	else {
		data_obj.getRedis(req.params.id , function(temp){			
			json_out.State = temp;			
			socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
			res.send(JSON.stringify(json_out));
		});
	}
});

var server = app.listen(httpport, function() {
    console.log('HTTP listening on port :%d', server.address().port);
    console.log('Dir :%s', __dirname);
});
