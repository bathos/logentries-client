/* jshint node: true, esnext: true */
'use strict';

// REQUIRES ////////////////////////////////////////////////////////////////////

var _ = require('lodash');
var bunyan = require('bunyan');
var defaults = require('defaults');
var lu = require('logger-util');
var mitm = require('mitm');
var tape = require('tape');
var winston = require('winston');

var Logger = require('logger');

// CUSTOM LEVEL NAMES //////////////////////////////////////////////////////////

tape('Levels are default if custom levels are not supplied.', function(t) {
	t.deepEqual(lu.normalizeCustomLevels(), defaults.levels, 'undefined');
	t.deepEqual(lu.normalizeCustomLevels(null), defaults.levels, 'null');
	t.deepEqual(lu.normalizeCustomLevels({}), defaults.levels, 'empty obj');
	t.deepEqual(lu.normalizeCustomLevels([]), defaults.levels, 'empty arr');
	t.deepEqual(lu.normalizeCustomLevels(_.noop), defaults.levels, 'function');

	t.end();
});

tape('Weird value for custom levels object throws.', function(t) {
	t.throws(lu.normalizeCustomLevels.bind(null, 4), 'number');
	t.throws(lu.normalizeCustomLevels.bind(null, 'cheese'), 'string');
	t.throws(lu.normalizeCustomLevels.bind(null, NaN), 'number (NaN)');
	t.throws(lu.normalizeCustomLevels.bind(null, true), 'boolean');
	
	t.end();
});

tape('Custom levels without valid indices are ignored.', function(t) {
	var levels = lu.normalizeCustomLevels({ a: 1, b: 3.14, c: '$$$', d: null });

	t.equal(levels[0], defaults.levels[0], 'defaults come through as needed');
	t.equal(levels[1], 'a', 'valid keys still comes through.');
	t.notEqual(levels[3], 'b', 'other keys are ignored');

	t.end();
});

tape('Custom levels with invalid names throw.', function(t) {
	t.throws(lu.normalizeCustomLevels.bind(null, [ [] ]), 'object');
	t.throws(lu.normalizeCustomLevels.bind(null, [ true ]), 'boolean');
	t.throws(lu.normalizeCustomLevels.bind(null, [ NaN ]), 'NaN');
	
	t.end();

});

tape('Custom levels with duplicate names throw.', function(t) {
	t.throws(lu.normalizeCustomLevels.bind(null, [ 'a', 'b', 'a' ]),
		'duplicate strings');

	t.throws(lu.normalizeCustomLevels.bind(null, [ '230', 230 ]),
		'coercively duplicative strings');

	t.doesNotThrow(lu.normalizeCustomLevels.bind(null, [ 'A', 'a' ]),
		'case sensitive');
	
	t.end();
});

tape('Custom levels with conflicting names throw.', function(t) {
	function Dummy() { this.propN = true; }
	
	Dummy.prototype = { propQ: true };

	var dummy = new Dummy();

	t.throws(lu.validateCustomLevels.bind(null, [ 'propN' ], dummy),
		'own property');
	
	t.throws(lu.validateCustomLevels.bind(null, [ 'propQ' ], dummy),
		'inherited property');

	t.doesNotThrow(lu.validateCustomLevels.bind(null, [ 'propX' ], dummy),
		'valid property');
	
	t.end();
});

// LOGGER CONSTRUCTION /////////////////////////////////////////////////////////

tape('Logger throws with bad options.', function(t) {

	function withOpts(opts) { return function() { new Logger(opts); }; }

	t.throws(withOpts(), 'missing options');
	t.throws(withOpts('cats'), 'primitive');
	t.throws(withOpts({}), 'missing token');
	t.throws(withOpts({ token: [] }), 'nonsense token');

	t.end();
});

tape('Logger shelters the inept from their own mistakes.', function(t) {
	/* jshint newcap: false */

	t.equal(Logger({ token: 'x' }) instanceof Logger, true,
		'missing new operator');

	t.end();
});

tape('Logger allows custom log level methods at construction.', function(t) {
	var logger = new Logger({
		token: 'x',
		levels: [ 'tiny', 'small' ]
	});

	t.equal(_.isFunction(logger.tiny), true,
		'custom method present');

	t.equal(_.isFunction(logger[defaults.levels[1]]), false,
		'replaced default absent');

	t.equal(_.isFunction(logger[defaults.levels[2]]), true,
		'other default present');

	t.end();
});

tape('Logger allows specification of minLevel at construction', function(t) {

	var logger1 = new Logger({ token: 'x', minLevel: defaults.levels[3] });

	t.equal(logger1.minLevel, defaults.levels[3], 'Specified by name.');

	var logger2 = new Logger({ token: 'x', minLevel: 3 });

	t.equal(logger2.minLevel, defaults.levels[3], 'Specified by index (num)');

	var logger3 = new Logger({ token: 'x', minLevel: '3' });

	t.equal(logger3.minLevel, defaults.levels[3], 'Specified by index (str)');

	t.end();

});

// CUSTOM JSON SERIALIZATION ///////////////////////////////////////////////////

tape('Error objects are serialized nicely.', function(t) {
	var msg = 'no kittens found';
	var err = new Error(msg);
	var log = { errs: [ err ] };

	var logger1 = new Logger({ token: 'x' });

	t.equal(JSON.parse(logger1._stringify(err)).message, msg,
		'error object is serialized.');

	t.equal(JSON.parse(logger1._stringify(log)).errs[0].message, msg,
		'including when nested.');

	t.equal(JSON.parse(logger1._stringify(err)).stack, undefined,
		'by default, stack is not included.');

	var logger2 = new Logger({ token: 'x', withStack: true });

	t.equal(JSON.parse(logger2._stringify(err)).stack, err.stack,
		'withStack option causes its inclusion.');

	t.end();
});

tape('Custom value transformer is respected.', function(t) {
	function alwaysKittens(key, val) {
		console.log('OKAY', val);
		return _.isObject(val) ? val : 'kittens'; 
	}

	var log = {
		status: 'green',
		friends: [ 'dogs', 'gerbils', 'horses' ],
		err: new Error('not kittens :(')
	};

	var logger = new Logger({ token: 'x', replacer: alwaysKittens });

	var res = JSON.parse(logger._stringify(log));

	t.equal(res.status, 'kittens', 'single property.');

	t.true(res.friends.every(function(v) { return v == 'kittens'; }),
		'array elements');

	t.equal(res.err.message, 'kittens',
		'custom replacer cooperates with automatic error transormation');

	t.end();
});

tape('Circular references don’t make the sad times.', function(t) {
	var consciousness = { };
	consciousness.iAm = consciousness;

	var logger = new Logger({ token: 'x' });

	var res = JSON.parse(logger._stringify(consciousness));

	t.true(res, 'circular reference allowed');

	t.equal(res.iAm, '[Circular ~]', 'circular reference indicated');

	t.end();
});

// SENDING DATA ////////////////////////////////////////////////////////////////

function mockTest(cb) {
	var mock = mitm();

	mock.on('connection', function(socket) {
		socket.on('data', function(buffer) {
			mock.disable();
			cb(buffer.toString());
		});
	});
}

tape('Data is sent over standard connection.', function(t) {
	t.plan(3);
	t.timeoutAfter(2000);

	var lvl = defaults.levels[3];
	var msg = 'test';
	var tkn = 'x';

	var mock = mitm();

	mock.on('connection', function(socket, opts) {

		t.pass('connection made');

		socket.on('data', function(buffer) {
			t.pass('data received');

			var log = buffer.toString();
			var expected = [ tkn, lvl, msg + '\n' ].join(' ');

			t.equal(log, expected, 'message matched');

			mock.disable();
		});
	});

	var logger = new Logger({ token: tkn });

	logger[lvl](msg);
});

tape('Data is sent over secure connection.', function(t) {
	t.plan(2);
	t.timeoutAfter(2000);

	var lvl = defaults.levels[3];
	var msg = 'test';
	var tkn = 'x';

	var mock = mitm();

	mock.on('connection', function(socket, opts) {

		t.pass('connection made');

		t.equal(opts.port, defaults.portSecure, 'correct port');

		mock.disable();
	});

	var logger = new Logger({ token: tkn, secure: true });

	logger[lvl](msg);
});

tape('Log methods can send multiple entries.', function(t) {
	t.plan(4);
	t.timeoutAfter(4000);

	function test(type, act, cb) {
		var count = 0;

		mockTest(function(data) {
			count++;

			if (count == 2) {
				t.pass(type);
				t.equal(tkn + ' ' + lvl + ' test2\n', data, 'message matched');
				if (cb) cb();
			}
		});

		act();
	}

	var lvl = defaults.levels[3];
	var tkn = 'x';

	test('as extra args', function() {

		var logger = new Logger({ token: tkn });

		logger[lvl]('test1', 'test2');

	}, function() {
		test('as array', function() {

			var logger = new Logger({ token: tkn });
			
			logger[lvl]([ 'test1', 'test2' ]);

		});
	});
});

tape('Non-JSON logs may carry timestamp.', function(t) {
	t.plan(1);
	t.timeoutAfter(2000);

	mockTest(function(data) {

		t.true(pattern.test(data), 'matched');

	});

	var lvl = defaults.levels[3];
	var tkn = 'x';
	var pattern = /^x \d{4}-\d\d-\d\dT\d\d:\d\d:\d\d.\d{3}Z \w+ test\n$/;

	var logger = new Logger({ token: tkn, timestamp: true });

	logger[lvl]('test');
});

tape('JSON logs match expected pattern.', function(t) {
	t.timeoutAfter(2000);

	mockTest(function(data) {
		try {

			var log = JSON.parse(data.substr(2));

			t.pass('valid JSON');

			t.true(_.isNull(log.msg), 'JSON datatypes survive');

			t.true(timestampPattern.test(log.time), 'carried timestamp');

			t.equal(log.level, 'o', 'original properties respected');

			t.equal(log._level, lvl, 'appended properties avoid collision');

			t.end();

		} catch (err) {

			t.fail('valid JSON');

			t.end();
		}
	});

	var lvl = defaults.levels[3];
	var tkn = 'x';
	var timestampPattern = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d.\d{3}Z$/;

	var logger = new Logger({ token: tkn, timestamp: true });

	logger[lvl]({ msg: null, level: 'o' });

});

tape('Invalid calls to log methods emit error.', function(t) {
	t.plan(2);
	t.timeoutAfter(500);

	var logger1 = new Logger({ token: 'x' });

	logger1.on('error', function() {
		t.pass('no arguments');
	});

	logger1.log(3);

	var logger2 = new Logger({ token: 'x' });

	logger2.on('error', function() {
		t.pass('empty array');
	});

	logger2.log(3, []);
});

tape('Socket gets re-opened as needed.', function(t) {
	t.plan(1);
	t.timeoutAfter(3000);

	var logger = new Logger({ token: 'x' });

	mockTest(function(data) {

		mockTest(function(data) {
			t.pass('successful');
		});
	});

	logger.log(3, 'qwerty');

	setTimeout(function() {
		logger.end();

		setTimeout(function() {
			logger.log(3, 'qwerty');
		}, 500);
	}, 500);

});

// WINSTON TRANSPORT ///////////////////////////////////////////////////////////

tape('Winston integration is provided.', function(t) {
	t.plan(4);
	t.timeoutAfter(2000);

	t.true(winston.transports.Logentries,
		'provisioned constructor automatically');

	t.doesNotThrow(function() {
		winston.add(winston.transports.Logentries, { token: 'x' });
	}, 'transport can be added');

	winston.remove(winston.transports.Console);

	mockTest(function(data) {
		t.pass('winston log transmits');
		t.equal(data, 'x warn mysterious radiation\n', 'msg as expected');
	});

	winston.warn('mysterious radiation');
});

// BUNYAN STREAM ///////////////////////////////////////////////////////////////

tape('Bunyan integration is provided.', function(t) {
	t.plan(9);

	var streamDef = Logger.bunyanStream({ token: 'x', minLevel: 3 });

	t.true(streamDef, 'bunyan stream definition created');

	t.equal(streamDef.level, defaults.bunyanLevels[3],
		'minLevel translated correctly');

	t.equal(streamDef.stream._logger.minLevel, defaults.bunyanLevels[0],
		'minLevel ignored at logger-level');

	var logger = bunyan.createLogger({
		name: 'whatevs',
		streams: [ streamDef ]
	});

	t.true(logger, 'bunyan logger created');

	mockTest(function(data) {
		t.pass('bunyan stream transmits');

		var log = JSON.parse(data.substr(2));

		t.pass('valid json');

		t.equal(log.yes, 'okay', 'data as expected');

		t.equal(log.level, 40, 'bunyan level number as expected');

		t.equal(log._level, defaults.bunyanLevels[3], 'level name as expected');
	});

	logger[defaults.bunyanLevels[3]]({ yes: 'okay' });
});

