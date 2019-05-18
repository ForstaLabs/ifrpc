ifrpc
========
Iframe (or popup) RPC interface.


About
--------
This library is designed for use in managing frame to frame control.  Either
in the case of 3rd party parent frames managing an iframe(s).  Or in the case
of a window managing popup windows it created with `window.open()`.

You must have control over both frames involved (referred to as peers).
This library needs to be included in both origins.


Installation
--------
Run:

    npm install ifrpc --save

Then include `node_modules/ifrpc/src/ifrpc.js` in your web build process or as a
`<script>` tag.

Repeat this process for both peers if they are separate web applications.


Setup
--------
The ifrpc system must be initialized by both sides as they use the `window.postMessage`
interface for communicating.  Care should be taken in setting the **origin** correctly
from both contexts.

Example from the parent frame who's html includes an iframe with src of
`https://iframe`:

```javascript
const iframe = document.querySelector('iframe').contentWindow;
const iframeRPC = ifrpc.init(iframe, {peerOrigin: 'https://iframe'});
```

And in the code for the aforementioned iframe:

```javascript
const parentRPC = ifrpc.init(self.parent, {peerOrigin: 'https://parent'});
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
 * `ifrpc.init(frame, [{options}])`:
    * `frame` should be the frame/window object you wish to communicate with.
    * `options` is an optional object with config options:
       * `peerOrigin`: The expected origin of the peer for security.
       * `magic`: A special string value used to disambiguate postMesssage
         communication.
    * Returns and `RPC` object.
 * `<RPC>.addCommandHandler(name, callback)`:
    * `name` should any string.
    * `callback` should be a `function` or `async function` whose return value
     will be sent to the invoking peer.
 * `<RPC>.addEventListener(name, callback)`:
    * `name` should any string.
    * `callback` should be a `function` or `async function`.
 * `<RPC>.triggerEvent(name, ...args)`:
    * `name` is the event name defined by the peer frame with
      `<RPC>.addEventListener`.
 * `<RPC>.invokeCommand(name, ...args)`:
    * `name` is the command name defined by the peer frame with
      `<RPC>.addCommandHandler`.
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
rpcForIframe.addCommandHandler('ping', () => 'pong');
```

```javascript
const pong = await rpcForParent.invokeCommand('ping');
console.assert(pong === 'pong');
```


**Argument passing**
```javascript
rpcForIframe.addCommandHandler('sum', (a, b) => a + b);
```

```javascript
const sum = await rpcForParent.invokeCommand('sum', 1, 1);
console.assert(sum === 2);
```


**Async handler**
```javascript
rpcForIframe.addCommandHandler('soon', async () => {
    await somethingAsync();
    return true;
}
```

```javascript
const soon = await rpcForParent.invokeCommand('soon');
console.assert(soon === true);
```


**Simple event**
```javascript
rpcForIframe.addEventListener('hello', () => {
    console.warn("The peer frame said hello");
});
```

```javascript
rpcForParent.triggerEvent('hello');
```


**Event with args**
```javascript
rpcForIframe.addEventListener('hello', whom => {
    console.warn("The peer frame said hello to", whom);
});
```

```javascript
rpcForParent.triggerEvent('hello', 'Bob');
```
