var crypto = require('crypto');
var xml2js = require('node-xml');
var moment = require('moment');

var data_obj = require('./redis.js');
var socket_obj = require('./socket.js');

function sha1(str) {
    var md5sum = crypto.createHash('sha1');
    md5sum.update(str);
    str = md5sum.digest('hex');
    return str;
}

exports.validateToken = function(req, res) {
    var query = req.query;
    var signature = query.signature;
    var echostr = query.echostr;
    var timestamp = query['timestamp'];
    var nonce = query.nonce;
    var oriArray = new Array(0);
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
};

function processMessage(data, res){
	//var tempid="";
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
	//var Label="";
	//var tempstate = "";
	var PicUrl="";
	var FuncFlag="";
	var tempName="";
		var json_out = {
		"DeviceId"  : "00000000",
		"IsSuccess" : "Success",
		"NSlots"    : "5",
		"State"     : "00000",
		"ServerTime": "2014-5-19 14:47:56"
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
				Location_X=chars;
			}else if(tempName=="Location_Y"){
				Location_Y=chars;
			}else if(tempName=="Scale"){
				Scale=chars;
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
			tempName="";
			var msg="";
			if(MsgType=="text"){
				msg="你说的是："+Content;
			}else if (MsgType=="event"){
				msg="Your command："+EventKey;
				Content = EventKey;
			}else if (MsgType=="image"){
				msg="你发的图片是："+PicUrl;
			}else {
				//console.log(MsgType);
			}
			//xmldata = ToXML(FromUserName,ToUserName,'text',msg,FuncFlag);
			//broadcast('SYSTEM',"Command long:" + Content.length + '\n');
			if(Content.indexOf("bind") != -1) {
				if(Content.length == 13) {
					data_obj.bindRedis(FromUserName, Content.substr(5,8) , function(temp){
						socket_obj.broadcast('SYSTEM',JSON.stringify(temp) + '\n');
					});
				}
			} else if(Content.indexOf("打开台灯") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 5, 1, function(temp){
					json_out.State = temp;
					//console.log("temp.length " + temp.length );
					if(temp.length == 5) {
						data_obj.getRedis(FromUserName , function(temp1){
							json_out.DeviceId = temp1;
							socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
						});
					} else {
						msg = "您的账号未绑定任何设备！";
						console.log("NOTBINDYET!");
					}
				});
			} else if(Content.indexOf("关闭台灯") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 5, 0, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("打开音箱") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 4, 1, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("关闭音箱") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 4, 0, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("打开苹果充电器") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 3, 1, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("关闭苹果充电器") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 3, 0, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("打开安卓充电器") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 2, 1, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("关闭安卓充电器") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 2, 0, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("打开树莓派") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 1, 1, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else if(Content.indexOf("关闭树莓派") != -1) {
				data_obj.WechatSetRedis(null, FromUserName, 1, 0, function(temp){
					json_out.State = temp;
					data_obj.getRedis(FromUserName , function(temp1){
						json_out.DeviceId = temp1;
						socket_obj.broadcast('SYSTEM',JSON.stringify(json_out) + '\n');
					});
				});
			} else {
				socket_obj.broadcast('SYSTEM',"Command long:" + Content.length + '\n');
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
    return msgxml;
    // }
}

exports.handler = function(req, res) {
  //RES = res;
  var xml = '';
  var xmldata = '';
  //var self = this;

  req.setEncoding('utf8');
  req.on('data', function (chunk) {
    xml += chunk;
  });

  req.on('end', function() {
    xmldata = processMessage(xml, res);
  });
  
  return xmldata;
};

