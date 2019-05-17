ifrpc
========
Iframe RPC interface.


About
--------
This library is designed for use in managing an iframe based webapp of your
own control.  You should have control over the outer frame (the parent window)
and the iframe's contents.  E.g. This library needs to be included in both
origins.


Installation
--------
Run:

    npm install ifrpc --save

Then include `node_modules/ifrpc/src/ifrpc.js` in your web build process or as a
`<script>` tag.

Repeat this process for both the iframe web application and the parent web
application.


Setup
--------
The ifrpc system must be initialized by both sides as they use the `window.postMessage`
interface for communicating.  Care should be taken in setting the **origin** correctly
from both contexts.

Example from the parent frame who's html includes an iframe with src of
`https://iframe`:

```javascript
ifrpc.init({peerOrigin: 'https://iframe'});
```

And in the code for the aforementioned iframe:

```javascript
ifrpc.init({peerOrigin: 'https://parent'});
```


Usage
--------
With setup completed you can now use ifrpc to add command handlers and trigger
events.  Commands are defined by either application and they are fulfilled by
a JavaScript function.  The return value (or exception) of these functions will
be serialized (via structured clone algo) and sent to the peer frame.  The
invocation of commands is a Promise based interface so the caller doesn't need
to be concerned with the mechanics of the message passing.

The main functions to use are:
 * `ifrpc.addCommandHandler(name, callback)`:
    * `name` should any string.
    * `callback` should be a `function` or `async function` whose return value
     will be sent to the invoking peer.
 * `ifrpc.addEventListener(name, callback)`:
    * `name` should any string.
    * `callback` should be a `function` or `async function`.
 * `ifrpc.triggerEvent(name, ...args)`:
    * `name` is the event name defined by the peer frame with
      `ifrpc.addEventListener`.
 * `ifrpc.invokeCommand(name, ...args)`:
    * `name` is the command name defined by the peer frame with
      `ifrpc.addCommandHandler`.
    * Returns a `Promise` that resolves with the eventual return value of the
      command handler's callback.  If the command handler throws an exception
      the `Promise` will reject with an `iprc.RemoteError` exception describing
      the remote error.


Examples
--------
Each of these examples shows code from 2 applications who are presumed to be
peers.  *Peers* meaning that one is an iframe of the other.

**Simple ping/pong**
```javascript
ifrpc.addCommandHandler('ping', () => 'pong');
```

```javascript
const pong = await ifrpc.invokeCommand('ping');
console.assert(pong === 'pong');
```


**Argument passing**
```javascript
ifrpc.addCommandHandler('sum', (a, b) => a + b);
```

```javascript
const sum = await ifrpc.invokeCommand('sum', 1, 1);
console.assert(sum === 2);
```


**Async handler**
```javascript
ifrpc.addCommandHandler('soon', async () => {
    await somethingAsync();
    return true;
}
```

```javascript
const soon = await ifrpc.invokeCommand('soon');
console.assert(soon === true);
```


**Simple event**
```javascript
ifrpc.addEventListener('hello', () => {
    console.warn("The peer frame said hello");
});
```

```javascript
ifrpc.triggerEvent('hello');
```


**Event with args**
```javascript
ifrpc.addEventListener('hello', whom => {
    console.warn("The peer frame said hello to", whom);
});
```

```javascript
ifrpc.triggerEvent('hello', 'Bob');
```
