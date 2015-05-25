[![Build Status](https://travis-ci.org/bathos/logentries-client.svg?branch=master)](https://travis-ci.org/bathos/logentries-client)

# Logentries Client (JS)

Allows you to send logs to your [logentries](https://www.logentries.com) account
from Node or io.js.

> It might work with Browserify, too, but you would need to use shims for net
> or tls (depending on whether you set `secure` to `true`). Such shims do exist,
> but I haven’t tested it.

Tested in Node v0.10 + and io.js. It probably works in Node 0.8 too, but one of
the test libraries ([mitm](https://www.npmjs.com/package/mitm)) doesn’t, so it
remains unconfirmed.

<!-- MarkdownTOC  autolink=true bracket=round -->

- [Start](#start)
- [Options](#options)
- [Log Levels](#log-levels)
- [Events](#events)
- [Log Entries](#log-entries)
- [Methods](#methods)
- [Buffer & Connection Issues](#buffer--connection-issues)
- [Using as a Winston ‘Transport’](#using-as-a-winston-‘transport’)
- [Using with Bunyan](#using-with-bunyan)
- [Setting Up With Logentries Itself](#setting-up-with-logentries-itself)
- [Changelog](#changelog)

<!-- /MarkdownTOC -->


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

All of the following except `token`, `levels` and `secure` can also be
configured after instantiation as settable properties on the client. They are
accessors, though, and invalid values will be ignored.

### Required

 - **token:** String. Authorization token for the Logentries service.

### Behavior
 - **console:** If truthy, log events also get sent to `console.log`,
   `console.warn` and `console.error` as appropriate. Default: `false`.
 - **levels**: Custom names for the 8 log levels and their corresponding
   methods. More details on this below.
 - **minLevel**: The minimum level to actually record logs at. String or Number.
   Defaults to 0.
 - **secure:** If truthy, uses a tls connection. Default: `false`.
 - **timeout:** The time, in milliseconds, that inactivity should warrant
   closing the connection to the host until needed again. Defaults to three
   minutes.

### Log Processing Options
 - **flatten**: Convert objects into a single-level object where the values of
   interior objects become dot-notation properties of the root object. Defaults
   to `false`. More details on this below.
 - **flattenArrays**: If `flatten` is true, you can also indicate whether arrays
   should be subject to the same process. Defaults to `true` if `flatten` is
   `true`; otherwise meaningless.
 - **replacer**: A custom value-transform function to be used during JSON
   serialization. Applied before error transformation.
 - **timestamp**: If truthy, prefix entries with an ISO timestamp (if strings)
   or add the same as a property (if objects). Default: `false`.
 - **withLevel**: Will prepend (string) or add property (object) indicating the
   log level.
 - **withStack**: If an object is or contains an `Error` object, setting this to
   `true` will cause the stack trace to be included. Default: `false.`

### Other
 - **host**: The host to send logs to. Normally you would not want to set this,
   but it may be useful for mocking during tests. The value may be just the host
   or the host with the port specified.
 - **port**: As above. This will default to 80 if `secure` is false, or 443 if
   it’s true.

## Log Levels

The default log levels are:

 0. debug
 1. info
 2. notice
 3. warning
 4. err
 5. crit
 6. alert
 7. emerg

You can provision the constructor with custom names for these levels with either
an array or an object hash:

```javascript
[ 'boring', 'yawn', 'eh', 'hey' ]

{ boring: 0, yawn: 1, eh: 2, hey: 3 }
```

In the former case, the index corresponds to the numeric level, so sparse arrays
are valid. In either case, missing levels will be filled in with the defaults.

The `minLevel` option respects either level number (e.g. `2`) or the name (e.g.
`'eh'`).

The level names each become methods on the client, which are just sugar for
calling `client.log(lvl, logentry)` with the first argument curried.

Since these names will appear on the client, they can’t collide with existing
properties. Not that you’re particularly likely to try naming a log level
‘hasOwnProperty’ or ‘_write’ but I figured I should mention it.

So the following three are equivalent:

```javascript
logger.notice('my msg');
logger.log('notice', 'my msg');
logger.log(2, 'my msg');
```

It’s also possible to forgo log levels altogether. Just call `log` with a single
argument and it will be interpretted as the log entry. When used this way, the
`minLevel` setting is ignored.

## Events

The client is an EventEmitter, so you should (as always) make sure you have a
listener on `'error'`. The only other event is `'log'` which fires when you’d
expect. Error events can occur when there’s been a problem with the connection
or if a method was called with invalid parameters.

## Log Entries

Log entries can be strings or objects. If the log argument is an array, it will
be interpretted as multiple log events.

### Object Serialization

In the case of objects, the native JSON.stringify serialization is augmented in
several ways. In addition to handling circular references, it will automatically
take care of a variety of objects and primitives which otherwise wouldn’t
serialize correctly, like Error, RegExp, Set, Map, Infinity, NaN, etc.

If you choose to set `withStack` to true, errors will include their stacktraces
as an array (so that they are not painful to look at). Be sure to turn on
"expand JSON" (meaning pretty print) in the options on logentries:

![stack trace as seen in logentries app][screen1]

You can adjust this further by supplying your own custom `replacer`. This is a
standard argument to JSON.stringify -- See [MDN: JSON > Stringify > The Replacer Parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter)
for details. In the event that you supply a custom replacer, it is applied
prior to the built-in replacer described above so you can override its behavior.

### Optional Augmentation

Two options are available, `timestamp` and `withLevel`, which will add data to
your log events. For objects, these are added as properties (non-mutatively).
For strings, these values are prepended. If the name of a property would cause
a collision with an existing property, it will be prepended with an underscore.

### Flattening Log Objects

In some cases it will end up being easier to query your data if objects aren’t
deeply nested. With the `flatten` and `flattenArrays` options, you can tell the
client to transform an object like this:

  * `{ "a": 1, "b": { "c": 2 } }` => `{ "a": 1, "b.c": 2 }`

If `flattenArrays` has not been set to false, this transformation will apply to
arrays as well:

  * `{ "a": [ "b", { "c": 3 } ] }` => `{ "a.0": "b", "a.1.c": 3 }`

## Methods

In addition to `log` and its arbitrary sugary cousins, you can call
`closeConnection` to explicitly close an open connection if one exists; you
might wish to do this as part of a graceful exit. The connection will reopen if
you log further.

Also, because the client is actually a writable stream, you can call `write`
directly. This gives you lower-level access to writing entries. It is in object
mode, but this means it expects discreet units (one call = one entry), not
actual objects; you should pass in strings. This is useful if you want to pipe
stdout, for example.

## Buffer & Connection Issues

If there’s a problem with the connection, entries will be buffered to a max of
60 entries. After that, error events will be emitted when trying to log further.
If the buffer drains, normal logging can resume. If `console` is true, these log
entries will still pass through there, but they will not make it to LogEntries.

If the connection fails, it will retry with an exponential backoff for several
minutes. If it does not succeed in that time, an error is emitted. A ‘ban’ will
be placed on further attempts but it will lift after some more time has passed,
at which point the process can repeat (and hopefully work).

A connection to the host does not guarantee that your logs are transmitting
successfully. If you have a bad token, there is no feedback from the server to
indicate this. The only way to confirm that your token is working is to check
the live tail on Logentries. I will investigate this further to see if there’s
some other means with which a token can be tested for validity.

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

[screen1]: docs/screen1.png

## Changelog

### 1.0.0

 - Major overhaul -- rewrote in ES6
 - Client is now a writable stream, compatible with stdout
 - Added `withLevel` and `timeout` options
 - Exposed `host` and `port` options for testing
 - Expanded default serialization to handle more JSON-choking cases, including
   Map, Set and Symbol
 - Added more sanity checks on instantiation
 - Made 'level' argument optional when calling `client.log`
 - BREAKING CHANGE: `client.log` method no longer accepts an arbitrary number of
   log entry arguments (to support above case, which seems much likely to be
   useful)
 - Added custom, informative error objects
 - Changed default `minLevel` value to zero (1 was an accident)
 - The most significant changes concern handling the connection to the host:
   - An exponential backoff is used when connecting fails
   - After repeated failures, a cooldown period is enforced before further tries
   - The buffer of pending entries has a maximum now (60)
   - Errors get emitted when these conditions occur

### 0.5.0

 - Added `flatten` and `flattenArray` options
 - Added more special cases for the default serializer
 - Added new tests

### 0.4.0

 - Prevented mutation of incoming log objects when adding timestamp or level
 - Turned thrown strings into proper errors (oops!)
 - Updated dependencies

### 0.3.3

 - Switched to the new API endpoint

### 0.3.1 & 0.3.2

 - Readme updated

### 0.3.0

 - Improved stack trace handling when `withStack` set to true

### 0.2.1

 - Path for problems with new 0.2.0 options
 - Added new tests

### 0.2.0

 - Added proper handling for objects with circular references
 - Added custom serialization for Error objects & `withStack` option
 - Changed lodash to `runInContext()` to prevent template string problems

### 0.1.0

 - Initial release
