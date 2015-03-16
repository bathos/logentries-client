/* jshint node: true */
'use strict';

module.exports.host = 'data.logentries.com';

module.exports.levels = [
	'debug', 'info', 'notice', 'warning', 'err', 'crit', 'alert', 'emerg'
];

module.exports.bunyanLevels = [
	'trace', 'debug', 'info', 'warn', 'error', 'fatal'
];

module.exports.port = 80;

module.exports.portSecure = 443;

module.exports.timeout = 3 * 60 * 1000;
