// vim: ts=4:sw=4:expandtab

(function() {
    'use strict';

    self.F = self.F || {};
    const ns = self.F.rpc = {};

    const version = 1;
    let peerOrigin = '*';
    let magic = 'forsta-rpc-magic-494581011';

    let peerFrame;
    const commands = new Map();
    const listeners = new Map();
    const activeCommandRequests = new Map();

    ns.RemoteError = class RemoteError extends Error {
        static serialize(error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }

        static deserialize(data) {
            const instance = new this(`${data.type}: ${data.message}`);
            instance.remoteName = data.name;
            instance.remoteMessage = data.message;
            instance.remoteStack = data.stack;
            return instance;
        }
    };


    function sendMessage(frame, origin, data) {
        const msg = Object.assign({
            magic,
            version
        }, data);
        console.debug("Send RPC message:", msg);
        frame.postMessage(msg, origin);
    }

    function sendCommandResponse(ev, success, response) {
        sendMessage(ev.source, peerOrigin, {
            op: 'command',
            dir: 'response',
            name: ev.data.name,
            id: ev.data.id,
            success,
            response
        });
    }

    async function handleCommandRequest(ev) {
        console.error("GOT a command", ev.data.name, ev.data.args);
        const handler = commands.get(ev.data.name);
        if (!handler) {
            const e = new ReferenceError('Invalid Command: ' + ev.data.name);
            console.warn("HINT, valid commands:", Array.from(commands.keys()).join());
            sendCommandResponse(ev, /*success*/ false, ns.RemoteError.serialize(e));
            throw e;
        }
        try {
            sendCommandResponse(ev, /*success*/ true, await handler.apply(ev, ev.data.args));
        } catch(e) {
            sendCommandResponse(ev, /*success*/ false, ns.RemoteError.serialize(e));
            throw e;
        }
    }

    async function handleCommandResponse(ev) {
        const request = activeCommandRequests.get(ev.data.id);
        if (!request) {
            throw new Error("Invalid request ID");
        }
        activeCommandRequests.delete(ev.data.id);
        if (ev.data.success) {
            request.resolve(ev.data.response);
        } else {
            request.reject(ns.RemoteError.deserialize(ev.data.response));
        }
    }

    async function handleEvent(ev) {
        console.error("GOT an event", ev.data.name, ev.data.args);
        for (const listener of listeners.get(ev.data.name) || []) {
            try {
                await listener.apply(ev, ev.data.args);
            } catch(e) {
                console.error("RPC Event Listener Error:", listener, e);
            }
        }
    }

    ns.init = function(frame, options) {
        options = options || {};
        if (options.magic) {
            magic = options.magic;
        }
        if (options.peerOrigin) {
            peerOrigin = options.peerOrigin;
        }
        peerFrame = frame;
        self.addEventListener('message', async ev => {
            if (peerOrigin !== '*' && ev.origin !== peerOrigin) {
                console.warn("Message from untrusted origin:", ev.origin);
                return;
            }
            const data = ev.data;
            if (!data || data.magic !== magic) {
                console.error("Invalid RPC magic");
                return;
            }
            if (data.version !== version) {
                console.error(`Version mismatch: expected ${version} but got ${data.version}`);
                return;
            }
            if (data.op === 'command') {
                if (data.dir === 'request') {
                    await handleCommandRequest(ev);
                } else if (data.dir === 'response') {
                    await handleCommandResponse(ev);
                } else {
                    throw new Error("Command Direction Missing");
                }
            } else if (data.op === 'event') {
                await handleEvent(ev);
            } else {
                throw new Error("Invalid RPC Operation");
            }
        });
    };

    ns.addCommandHandler = function(name, handler) {
        if (commands.has(name)) {
            throw new Error("Command handler already added: " + name);
        }
        commands.set(name, handler);
    };

    ns.removeCommandHandler = function(name) {
        commands.delete(name);
    };

    ns.addEventListener = function(name, callback) {
        if (!listeners.has(name)) {
            listeners.set(name, []);
        }
        listeners.get(name).push(callback);
    };

    ns.removeEventListener = function(name, callback) {
        const scrubbed = listeners.get(name).fitler(x => x !== callback);
        listeners.set(name, scrubbed);
    };

    ns.triggerEvent = function(name) {
        const args = Array.from(arguments).slice(1);
        sendMessage(peerFrame, peerOrigin, {
            op: 'event',
            name,
            args
        });
    };

    let _idInc = 0;
    ns.invokeCommand = async function(name) {
        const args = Array.from(arguments).slice(1);
        const id = `${Date.now()}-${_idInc++}`;
        const promise = new Promise((resolve, reject) => {
            activeCommandRequests.set(id, {resolve, reject});
        });
        sendMessage(peerFrame, peerOrigin, {
            op: 'command',
            dir: 'request',
            name,
            id,
            args
        });
        return await promise;
    };
})();
