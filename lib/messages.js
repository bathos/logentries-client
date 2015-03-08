/* jshint node: true, esnext: true */
'use strict';

// REQUIRE /////////////////////////////////////////////////////////////////////

var _ = require('lodash');

// MESSAGES ////////////////////////////////////////////////////////////////////

module.exports = {
	duplicateLevels:
		'The custom levels array included duplicate level names.',

	invalidLevelObj:
		_.template('The opts.levels value was a <%= type %>.'),

	levelConflict: _.template(
		'The custom level name <%= name %> conflicts ' +
		'with an existing property.'
	),

	levelNotString:
		_.template('The custom level name <%= name %> is invalid.'),

	noLogMessage:
		'Log method was called without a message argument.',

	noOptions:
		'Missing options object.',

	noToken:
		'An access token is required.',

	unknownLevel:
		_.template('Unknown log level: <%= lvl %>.')
};