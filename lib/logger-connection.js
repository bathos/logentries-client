/* jshint node: true */
'use strict';

// REQUIRE /////////////////////////////////////////////////////////////////////

var _ = require('lodash');
var defaults = require('./defaults');
var net = require('net');
var tls = require('tls');

// CONNECT /////////////////////////////////////////////////////////////////////

function connectionMaker(opts) {
	var connOpts = _.pick(opts, [ 'host', 'port' ]);

	return opts.secure ?
		tlsConnection.bind(null, connOpts) : netConnection.bind(null, connOpts);
}

function tlsConnection(opts) {
	var conn = tls.connect(opts, function() {
		if (!conn.authorized) this.emit(new Error(conn.authorizationError));
	});

	conn.setTimeout(defaults.timeout);

	return conn;
}

function netConnection(opts) {
	var conn = net.createConnection(opts);

	conn.setTimeout(defaults.timeout);

	return conn;
}

// EXPORTS /////////////////////////////////////////////////////////////////////

module.exports.connectionMaker = connectionMaker;
