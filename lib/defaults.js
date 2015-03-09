/* jshint node: true */
'use strict';

module.exports.host = 'api.logentries.com';

module.exports.levels = [
	'debug', 'info', 'notice', 'warning', 'err', 'crit', 'alert', 'emerg'
];

module.exports.bunyanLevels = [
	'trace', 'debug', 'info', 'warn', 'error', 'fatal'
];

module.exports.port = 10000;

module.exports.portSecure = 20000;

module.exports.timeout = 3 * 60 * 1000;
