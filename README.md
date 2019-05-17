irpc
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

    npm install irpc --save

Then include `node_modules/irpc/src/irpc.js` in your web build process or as a
`<script>` tag.

Repeat this process for both the iframe web application and the parent web
application.


Setup
--------
The irpc system must be initialized by both sides as they use the `window.postMessage`
interface for communicating.  Care should be taken in setting the **origin** correctly
from both contexts.

Example from the parent frame who's html includes an iframe with src of
`https://iframe`:

```javascript
irpc.init({peerOrigin: 'https://iframe'});
```

And in the code for the aforementioned iframe:

```javascript
irpc.init({peerOrigin: 'https://parent'});
```


Usage
--------
With setup completed you can now use irpc to add command handlers and trigger
events.  Commands are defined by either application and they are fulfilled by
a JavaScript function.  The return value (or exception) of these functions will
be serialized (via structured clone algo) and sent to the peer frame.  The
invocation of commands is a Promise based interface so the caller doesn't need
to be concerned with the mechanics of the message passing.

The main functions to use are:
 * `irpc.addCommandHandler(name, callback)`: `name` should any string and callback
   should be a `function` or `async function` whose return value will be sent to the
   invoking peer.
 * `irpc.addEventListener(name, callback)`: `name` should any string and callback
   should be a `function` or `async function`.
 * `irpc.triggerEvent(name, ...args)`: `name` is the event name defined by the peer
   frame with `irpc.addEventListener`.
 * `irpc.invokeCommand(name, ...args)`: `name` is the command name defined by the peer
   frame with `irpc.addCommandHandler`.  This function returns a Promise that resolves
   with the eventual return value of the command handler's callback.  If the command
   handler throws an exception the Promise will reject with an `iprc.RemoteError`
   exception describing the remote error.


Examples
--------
### Simple ping/pong...
**App A**
```javascript
irpc.addCommandHandler('ping', () => 'pong');
```

**App B**
```javascript
const pong = await irpc.invokeCommand('ping');
console.assert(pong === 'pong');
```

### Argument passing...
**App A**
```javascript
irpc.addCommandHandler('sum', (a, b) => a + b);
```

**App B**
```javascript
const sum = await irpc.invokeCommand('sum', 1, 1);
console.assert(sum === 2);
```

### Async handler...
**App A**
```javascript
irpc.addCommandHandler('soon', async () => {
    await somethingAsync();
    return true;
}
```

**App B**
```javascript
const soon = await irpc.invokeCommand('soon');
console.assert(soon === true);
```
