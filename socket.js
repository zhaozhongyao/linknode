var sockets = [];

exports.pushsocket = function(client) {
    sockets.push(client);
};
// Broadcast to others, excluding the sender
exports.broadcast = function(from, message) {
	// If there are no sockets, then don't broadcast any messages
	if (sockets.length === 0) {
		console.log('nobody connected.');
		return;
	}
	// If there are clients remaining then broadcast message
	sockets.forEach(function(socket, index, array) {
		// Dont send any messages to the sender
		if(socket.nickname === from) return;
		socket.write(message);
	});
};
 
// Remove disconnected client from sockets array
exports.removeSocket = function(socket) {
	sockets.splice(sockets.indexOf(socket), 1);
};
