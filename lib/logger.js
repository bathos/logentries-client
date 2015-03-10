/* jshint node: true */
'use strict';

// REQUIRE /////////////////////////////////////////////////////////////////////

var _ = require('lodash');
var codependency = require('codependency');
var defaults = require('./defaults');
var events = require('events');
var jsonStringifySafe = require('json-stringify-safe');
var lc = require('./logger-connection');
var lu = require('./logger-util');
var msg = require('./messages');
var stream = require('stream');
var util = require('util');

// NODE < 0.9 FALLBACK /////////////////////////////////////////////////////////

if (!setImmediate) setImmediate = _.partial(setTimeout, _, 0);

// LOGGER //////////////////////////////////////////////////////////////////////

function Logger(opts) {

	// Sanity checks

	if (!(this instanceof Logger)) return new Logger(opts);

	if (!_.isObject(opts)) throw new Error(msg.noOptions);

	if (!opts.token || !_.isString(opts.token)) throw new Error(msg.noToken);

	// Options

	opts = {
		console: opts.console || false,
		host: opts.host || defaults.host,
		levels: opts.levels,
		minLevel: opts.minLevel,
		secure: opts.secure, 
		port: opts.secure ? defaults.portSecure : defaults.port,
		token: opts.token,
		timestamp: !!opts.timestamp
	};

	// Custom levels may be provisioned as an array or an object hash,
	// e.g. [ 'debug' ] (new style) or { 'debug': 0 } (old style). They are just
	// sugar for curried calls to the log method.

	var log = this.log.bind(this);

	var levels = lu.normalizeCustomLevels(opts.levels);

	lu.validateCustomLevels(levels, this);

	var defs = levels.reduce(function(defs, level, index) {
		defs[level] = {
			enumerable: true,
			value: _.partial(log, index)
		};

		return defs;
	}, {});

	// Minimum level for logging is settable with either name or index.

	var minLevel = 1;

	defs.minLevel = {
		enumerable: true,
		get: function() {
			return levels[minLevel];
		},
		set: function(lvl) {
			var lvlNum = this._getLevelNum(lvl);

			if (lvlNum !== false) minLevel = lvlNum;
		}
	};

	defs._getLevelNum = { value: lu.getLevelNumber.bind(null, levels) };
	
	defs._getLevelName = {
		value: function(lvl) {
			return levels[this._getLevelNum(lvl)];
		}
	};

	defs._isBelowMin = {
		value: function(lvl) {
			lvl = this._getLevelNum(lvl);

			return lvl !== false && lvl < minLevel;
		}
	};

	// Other settable options.

	defs.console = {
		enumerable: true,
		get: function() { return opts.console; },
		set: function(val) { opts.console = !!val; }
	};

	defs.timestamp = {
		enumerable: true,
		get: function() { return opts.timestamp; },
		set: function(val) { opts.timestamp = !!val; }
	};

	// Unsettable

	defs._token = { value: opts.token };

	defs._levels = { get: function() { return levels.slice(); } };

	// JSON Serialization

	var errReplacer = lu.errReplacer(opts.withStack);

	var replacer = _.isFunction(opts.replacer) ?
		_.flow(opts.replacer, errReplacer) : errReplacer;

	defs._stringify = { value: _.partial(jsonStringifySafe, _, replacer) };

	// Queue, Connection & State

	defs._queue = { value: [] };

	defs._getConnection = { value: lc.connectionMaker(opts) };

	this._state = 'not connected';

	Object.defineProperties(this, defs);

	this.minLevel = opts.minLevel;

	events.EventEmitter.call(this);
}

util.inherits(Logger, events.EventEmitter);

Object.defineProperties(Logger.prototype, {
	_addToQueue: {
		value: function(log) {
			this._queue.push(log);

			if (this._socket == 'connecting') return;

			if (this._state == 'connected') return this._processQueue();

			this._connect();
		}
	},

	_connect: {
		value: function() {
			this._state = 'connecting';

			if (this._socket) this._socket.end();

			var socket = this._socket = this._getConnection();
			var logger = this;

			socket.on('connect', function() {
				logger._state = 'connected';
				logger._processQueue();
			});

			socket.on('error', function(err) {
				removeSelf();

				socket.destroy();

				logger.emit('error', err);
			});

			socket.on('timeout', function() {
				socket.end();

				removeSelf();
			});

			socket.on('end', removeSelf);

			socket.on('close', removeSelf);

			function removeSelf() {
				if (logger._socket == socket) {
					logger._state = 'not connected';
					logger._socket = null;

					setTimeout(function() {
						if (logger._queue.length && !logger._socket)
							logger._connect();
					}, 1500);
				}
			}
		}
	},

	_processQueue: {
		value: function() {
			while (this._state == 'connected' && this._queue.length) {
				var log = this._queue.shift();

				this.emit('log', log);

				this._socket.write(log);

				// The original le_node wrapped this, as well as a few other
				// async ops, in try blocks. The apparent idea was that were an
				// error to occur, the entry would be unshifted so that it could
				// be tried again instead of lost forever. Unfortunately that
				// code would never have worked -- writing to a socket is async.
				// AFAIK there’s no way to achieve the original intention
				// without getting corresponding responses from the server to
				// confirm receipt. Even if we opened unique connections for
				// every log entry sent so that we could tie error events back
				// to individual entries, we would still not know if an error
				// occurred before or after data was received by the host.
			}
		}
	},

	end: {
		enumerable: true,
		value: function() {
			if (this._socket) this._socket.end();
		}
	},

	log: {
		enumerable: true,
		value: function(lvl, log) {

			if (_.isUndefined(log) || _.isNull(log))
				return this.emit('error', msg.noLogMessage);

			var lvlName = this._getLevelName(lvl);

			if (!lvlName)
				return this.emit('error', msg.unknownLevel({ lvl: lvl }));

			if (this._isBelowMin(lvl)) return;

			if (arguments.length > 2)
				return _.rest(arguments).forEach(function(log) {
					this.log(lvl, log);
				}, this);

			if (_.isArray(log)) {
				if (!log.length)
					return this.emit('error', msg.noLogMessage);

				return log.forEach(function(log) {
					this.log(lvl, log);
				}, this);
			}

			if (_.isObject(log)) {
				if (this.timestamp)
					log[lu.getSafeProp(log, 'time')] = new Date();

				log[lu.getSafeProp(log, 'level')] = lvlName;

				log = this._stringify(log);

			} else {
				log = lvlName + ' ' + log.toString();

				if (this.timestamp)
					log = (new Date()).toISOString() + ' ' + log;
			}

			if (this.console) {
				var lvlNum = this._getLevelNum(lvl);

				var consoleMethod =
					lvlNum === 3 ? 'warn' : lvlNum > 3 ? 'error' : 'log';

				console[consoleMethod](log);
			}

			log = this._token + ' ' + lu.cleanLogString(log);

			this._addToQueue(log);
		}
	}
});

// WINSTON INTEGRATION /////////////////////////////////////////////////////////

var requirePeer = codependency.register(module);

Object.defineProperty(Logger, 'provisionWinston', {
	enumerable: true,
	value: function() {

		var winston = requirePeer('winston');

		if (winston.transports.Logentries) return;
		
		var LL = winston.transports.Logentries = function(opts) {
			opts = _.clone(opts || {});

			opts.minLevel = opts.minLevel || opts.level || 1;

			opts.levels = opts.levels || winston.levels;

			Object.defineProperties(this, {
				_logger: { value: new Logger(opts) },
				level: {
					enumerable: true,
					get: function() { return this._logger.minLevel; },
					set: function(val) { this._logger.minLevel = val; }
				}
			});

			this.levels = this._logger._levels.reduce(function(acc, lvl, i) {
				acc[lvl] = i;
				return acc;
			}, {});

			this.level = this._logger.minLevel;
		};

		util.inherits(LL, winston.Transport);

		Object.defineProperties(LL.prototype, {
			log: {
				enumerable: true,
				value: function(lvl, msg, meta, cb) {
					if (!_.isEmpty(meta)) {
						if (_.isString(msg))
							msg += ' ' + this._stringify(meta);

						else if (_.isObject(msg))
							msg[lu.getSafeProp(msg, 'meta')] = meta;
					}

					this._logger.log(lvl, msg);

					setImmediate(cb.bind(null, null, true));
				}
			},
			name: {
				enumerable: true,
				value: 'logentries'
			}
		});
	}
});

var winston = requirePeer('winston', { optional: true });

if (winston) Logger.provisionWinston();

// BUNYAN STREAM ///////////////////////////////////////////////////////////////

function LEStream(opts) {
	opts.timestamp = false;

	opts.levels = opts.levels || defaults.bunyanLevels;

	Object.defineProperties(this, {
		_logger: { value: new Logger(opts) }
	});

	stream.Writable.call(this, {
		objectMode: true
	});
}

util.inherits(LEStream, stream.Writable);

Object.defineProperties(LEStream.prototype, {
	_write: {
		value: function(log, enc, cb) {

			var lvl = (log.level / 10) - 1;

			this._logger.log(lvl, log);

			setImmediate(cb);
		}
	}
});

Object.defineProperty(Logger, 'bunyanStream', {
	enumerable: true,
	value: function(opts) {
		var stream = new LEStream(opts);
		var level = stream._logger.minLevel;

		stream._logger.minLevel = 0;

		return {
			stream: stream,
			type: 'raw',
			level: level,
			name: 'logentries'
		};
	}
});

// EXPORTS /////////////////////////////////////////////////////////////////////

module.exports = Logger;
