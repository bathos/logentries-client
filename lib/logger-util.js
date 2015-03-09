/* jshint node: true, esnext: true */
'use strict';

// REQUIRE /////////////////////////////////////////////////////////////////////

var _ = require('lodash');
var defaults = require('defaults');
var msg = require('messages');

// CUSTOM LEVEL NAMES //////////////////////////////////////////////////////////

function normalizeLevelObject(levels) {
	var arr = [];

	_(levels)
		.pick(validLevelNumber)
		.forEach(function(index, name) { arr[index] = name; })
		.value(); 

	return arr;
}

function normalizeLevelArray(arr) {
	return arr.slice(0, 8).map(function(name) {
		if (name && _.isString(name)) return name;
		if (_.isNumber(name) && !_.isNaN(name)) return name.toString();
		if (_.isNull(name) || _.isUndefined(name) || name === '') return null;

		throw new Error(msg.levelNotString({ name: name }));
	});
}

function normalizeCustomLevels(custom) {

	if (_.isNull(custom) || _.isUndefined(custom))
		return defaults.levels.slice();

	if (!_.isObject(custom))
		throw new Error(msg.invalidLevelObj({ type: typeof custom }));

	if (!_.isArray(custom))
		custom = normalizeLevelObject(custom);

	custom = normalizeLevelArray(custom);

	var levels = defaults.levels.map(function(level, index) {
		return custom[index] || level;
	});

	if (_.uniq(levels).length != levels.length)
		throw new Error(msg.duplicateLevels);

	return levels;
}

function validateCustomLevels(levels, obj) {
	levels.forEach(function(level) {
		if (level in obj) throw new Error(msg.levelConflict({ name: level }));
	});
}

// LEVEL NUMBERS ///////////////////////////////////////////////////////////////

function getLevelNumber(levels, lvl) {
	var lvlNum = levels.indexOf(lvl);

	lvlNum = lvlNum > -1 ? lvlNum : lvl;

	return validLevelNumber(lvlNum) ? lvlNum : false;
}

function validLevelNumber(lvl) {
	var lvlNum = parseInt(lvl, 10);

	if (lvlNum != lvl) return false;

	return Number.isInteger(lvlNum) && lvlNum <= 7 && lvlNum >= 0;
}

// APPENDED PROPERTIES FOR JSON LOG ////////////////////////////////////////////

function getSafeProp(log, prop) {
	while (prop in log) {
		prop = '_' + prop;
	}

	return prop;
}

// NORMALIZE NEWLINES TO U2028 /////////////////////////////////////////////////

var newline = /\n/g;
var u2028 = '\u2028';

function cleanLogString(log) {
	return log.replace(newline, u2028) + '\n';
}

// ES6 SHIM FOR OLD TIMEY NODE /////////////////////////////////////////////////

if (!Number.isInteger) {
	Number.isInteger = function(n) {
		return _.isFinite(n) && parseInt(n, 10) == n;
	};
}

// EXPORTS /////////////////////////////////////////////////////////////////////

module.exports.cleanLogString = cleanLogString;
module.exports.getLevelNumber = getLevelNumber;
module.exports.getSafeProp = getSafeProp;
module.exports.normalizeCustomLevels = normalizeCustomLevels;
module.exports.validateCustomLevels = validateCustomLevels;
module.exports.validLevelNumber = validLevelNumber;
