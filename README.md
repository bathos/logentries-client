[![Build Status](https://travis-ci.org/bathos/logentries-client.svg?branch=master)](https://travis-ci.org/bathos/logentries-client)

# Logentries Client (JS)

For use with Node.js and io.js.

It might work with Browserify, too, but you would need to use a shims for net
or, if using `secure: true`, tls (both of which exist).

## Start

```javascript
var Logger = require('logentries-client');

var logger = new Logger({
	token: 'myAccessToken'
});

logger.warning('The kittens have become alarmingly adorable.')
```

## Options

The options object you provide to the constructor only requires your access
token, but you can configure its behavior further.

 - **token:** String. Authorization token for the Logentries service.
 - **secure:** If truthy, uses a tls connection. Default: `false`.
 - **console:** If truthy, log events also get sent to `console.log`,
   `console.warn` and `console.error` as appropriate. Default: `false`.
 - **timestamp**: Automatically prefix entries with an ISO timestamp (strings)
   or add the same as a property (objects). Default: `true`.
 - **levels**: Custom names for the 7 log levels and their corresponding
   methods. More details on this below.
 - **minLevel**: The minimum level to actually record logs at. String or
   Number. Defaults to 1.

### Log Levels

The default log levels are:

 0. debug
 1. info
 2. notice
 3. warning
 4. err
 5. crit
 6. alert
 7. emerg

You can provision the constructor with custom names for these levels with
either an array or an object hash:

```javascript
[ 'boring', 'yawn', 'eh', 'hey' ]

{ boring: 0, yawn: 1, eh: 2, hey: 3 }

```

If a name is omitted, the default will be used in its place. If you set a
minLevel value you can either do so by the number (e.g. `2`) or the name (e.g.
`'eh'`).

The names of these levels are also used as methods on the resulting client
instance so you can just do `logger.info('my msg')`; accordingly, they cant’t
collide with the names of native Object properties or EventEmitter properties.
Not that you’d be likely to name a log level ‘hasOwnProperty,’ but just sayin’.
All of these methods are really sugar for the core method `log`, which you can
also use directly if you prefer. The following three are equivalent:

 ```javascript
logger.notice('my msg');
logger.log('notice', 'my msg');
logger.log(2, 'my msg');

```

## Events

The client is an EventEmitter, so you should (as always) make sure you have a
listener on `'error'`. The only other event is `'log'` which fires when you’d
expect. Error events can occur when there’s been a problem with the connection
or if a method was called with invalid parameters.

## Log Objects

Logs can be strings or objects, which will be converted to JSON. If `timestamp`
is truthy, an object will have the `time` property added (or, if it already has
one, `_time`, etc). Likewise JSON logs will get the `level` property.

If the value is an array, it will be interepreted as multiple log entries;
likewise if a log method is called with extra arguments.

## Methods

In addition to `log` and its arbitrary sugary cousins, you can call `end` to
explicitly close an open connection if one exists; you might wish to do this as
part of a graceful exit.

## Properties

The options `console`, `timestamp` and `minLevel` are exposed as properties that
can be changed at any time.