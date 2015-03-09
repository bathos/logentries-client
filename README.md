[![Build Status](https://travis-ci.org/bathos/logentries-client.svg?branch=master)](https://travis-ci.org/bathos/logentries-client)

# Logentries Client (JS)

Allows you to send logs to your [logentries](https://www.logentries.com) account from Node or io.js.

> It might work with Browserify, too, but you would need to use shims for net
> or tls (depending on whether you set `secure` to `true`). Such shims do exist,
> but I haven’t tested it.

Tested in Node v0.10 + and io.js. It probably works in Node 0.8 too, but one of
the test libraries ([mitm](https://www.npmjs.com/package/mitm)) doesn’t, so it
remains unconfirmed.

## Start

```javascript
var LogentriesClient = require('logentries-client');

var logger = new LogentriesClient({
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
 - **timestamp**: If truthy, prefix entries with an ISO timestamp (if strings)
   or add the same as a property (if objects). Default: `false`.
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

## Using as a Winston ‘Transport’

If Winston is included in your package.json dependencies, simply requiring the
Logentries client will place the transport constructor at `winston.transports`,
even if Winston itself hasn’t yet been required.

```javascript
var winston = require('winston');
var LogentriesClient = require('logentries-client');

winston.add(winston.transports.Logentries, opts);
```

The usual options are supported. If custom levels are not provided, Winston’s
defaults will be used.

In the hard-to-imagine case where you’re using Winston without including it in
package.json, you can explicitly provision the transport by first requiring
Winston and then calling `LogentriesClient.provisionWinston()`.

## Using with Bunyan

For Bunyan it’s like so:

```javascript
var bunyan = require('bunyan');

var LogentriesClient = require('logentries-client');

var leBunyan = LogentriesClient.bunyanStream(opts);

// One stream
var logger = bunyan.createLogger(leBunyan);

// Multiple streams
var logger = bunyan.createLogger({
	name: 'whatevs',
	streams: [ leBunyan, otherStream ]
});
```

Note that with Bunyan, only the first six log levels will be used, and
timestamps are provided by Bunyan already. Other options are the same. If after
creation you wish to change the minimum log level, use Bunyan’s methods. The
stream will be named ‘logentries,’ though you can change it on the object
returned by `bunyanStream()`.

## Setting Up With Logentries Itself

When you create an account at Logentries (just a standard signup form; there’s a
free tier), you can find the token you need. It’s shown during the initial walk-
through but you can find it later under Logs/Hosts/{ the name of your host } --
on the far right, a gray TOKEN button that you can click to reveal the string.

That’s it -- once you have the token you’re set.