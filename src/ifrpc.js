// vim: ts=4:sw=4:expandtab

(function() {
    'use strict';

    const ns = self.ifrpc = self.ifrpc || {};

    const version = 3;
    const defaultPeerOrigin = '*';
    const defaultMagic = 'ifrpc-magic-494581011';

    let _idInc = 0;

    ns.RemoteError = class RemoteError extends Error {
        static serialize(error) {
            return Object.assign({
                name: error.name,
                message: error.message,
                stack: error.stack
            }, JSON.parse(JSON.stringify(error)));
        }

        static deserialize(data) {
            const instance = new this(`Remote error: <${data.name}: ${data.message}>`);
            instance.remoteError = data;
            return instance;
        }
    };


    class RPC {

        constructor(peerFrame, options) {
            options = options || {};
            this.peerFrame = peerFrame;
            this.magic = options.magic || defaultMagic;
            this.peerOrigin = options.peerOrigin || defaultPeerOrigin;
            this.acceptOpener = !!options.acceptOpener;
            this.acceptParent = !!options.acceptParent;
            this.commands = new Map();
            this.listeners = new Map();
            this.activeCommandRequests = new Map();
            this.constructor.registerMessageHandler(this);

            // Couple meta commands for discovery...
            this.addCommandHandler('ifrpc-get-commands', () => {
                return Array.from(this.commands.keys());
            });
            this.addCommandHandler('ifrpc-get-listeners', () => {
                return Array.from(this.listeners.keys());
            });
        }

        static registerMessageHandler(rpc) {
            if (!this._registered) {
                self.addEventListener('message', this.onMessage.bind(this));
                this._registered = [];
            }
            this._registered.push(rpc);
        }

        static async onMessage(ev) {
            if (!ev.source) {
                return;  // Source frame is gone already.
            }
            for (const rpc of this._registered) {
                if (rpc.peerOrigin !== '*' && ev.origin !== rpc.peerOrigin) {
                    continue;
                }
                const validFrames = new Set([ev.source]);
                if (rpc.acceptOpener && ev.source.opener) {
                    validFrames.add(ev.source.opener);
                }
                if (rpc.acceptParent && ev.source.parent) {
                    validFrames.add(ev.source.parent);
                }
                if (!validFrames.has(rpc.peerFrame)) {
                    continue;
                }
                const data = ev.data;
                if (!data || data.magic !== rpc.magic) {
                    console.warn("Invalid ifrpc magic");
                    continue;
                }
                if (data.version !== version) {
                    console.error(`Version mismatch: expected ${version} but got ${data.version}`);
                    continue;
                }
                if (data.op === 'command') {
                    if (data.dir === 'request') {
                        await rpc.handleCommandRequest(ev);
                    } else if (data.dir === 'response') {
                        await rpc.handleCommandResponse(ev);
                    } else {
                        throw new Error("Command Direction Missing");
                    }
                } else if (data.op === 'event') {
                    await rpc.handleEvent(ev);
                } else {
                    throw new Error("Invalid ifrpc Operation");
                }
            }
        }

        addCommandHandler(name, handler) {
            if (this.commands.has(name)) {
                throw new Error("Command handler already added: " + name);
            }
            this.commands.set(name, handler);
        }

        removeCommandHandler(name) {
            this.commands.delete(name);
        }

        addEventListener(name, callback) {
            if (!this.listeners.has(name)) {
                this.listeners.set(name, []);
            }
            this.listeners.get(name).push(callback);
        }

        removeEventListener(name, callback) {
            const scrubbed = this.listeners.get(name).fitler(x => x !== callback);
            this.listeners.set(name, scrubbed);
        }

        triggerEventWithFrame(frame, name) {
            const args = Array.from(arguments).slice(2);
            this.sendMessage(frame, {
                op: 'event',
                name,
                args
            });
        }

        triggerEvent(name) {
            return this.triggerEventWithFrame.apply(this, [this.peerFrame].concat(Array.from(arguments)));
        }

        async invokeCommandWithFrame(frame, name) {
            const args = Array.from(arguments).slice(2);
            const id = `${Date.now()}-${_idInc++}`;
            const promise = new Promise((resolve, reject) => {
                this.activeCommandRequests.set(id, {resolve, reject});
            });
            this.sendMessage(frame, {
                op: 'command',
                dir: 'request',
                name,
                id,
                args
            });
            return await promise;
        }

        async invokeCommand(name) {
            return await this.invokeCommandWithFrame.apply(this, [this.peerFrame].concat(Array.from(arguments)));
        }

        sendMessage(frame, data) {
            const msg = Object.assign({
                magic: this.magic,
                version
            }, data);
            frame.postMessage(msg, this.peerOrigin);
        }

        sendCommandResponse(ev, success, response) {
            this.sendMessage(ev.source, {
                op: 'command',
                dir: 'response',
                name: ev.data.name,
                id: ev.data.id,
                success,
                response
            });
        }

        async handleCommandRequest(ev) {
            const handler = this.commands.get(ev.data.name);
            if (!handler) {
                const e = new ReferenceError('Invalid Command: ' + ev.data.name);
                this.sendCommandResponse(ev, /*success*/ false, ns.RemoteError.serialize(e));
                throw e;
            }
            try {
                this.sendCommandResponse(ev, /*success*/ true, await handler.apply(ev, ev.data.args));
            } catch(e) {
                this.sendCommandResponse(ev, /*success*/ false, ns.RemoteError.serialize(e));
            }
        }

        async handleCommandResponse(ev) {
            const request = this.activeCommandRequests.get(ev.data.id);
            if (!request) {
                throw new Error("Invalid request ID");
            }
            this.activeCommandRequests.delete(ev.data.id);
            if (ev.data.success) {
                request.resolve(ev.data.response);
            } else {
                request.reject(ns.RemoteError.deserialize(ev.data.response));
            }
        }

        async handleEvent(ev) {
            const callbacks = this.listeners.get(ev.data.name);
            if (!callbacks || !callbacks.length) {
                console.debug("ifrpc event triggered without listeners:", ev.data.name);
                return;
            }
            for (const cb of callbacks) {
                try {
                    await cb.apply(ev, ev.data.args);
                } catch(e) {
                    console.error("ifrpc event listener error:", cb, e);
                }
            }
        }
    }

    ns.init = (frame, options) => new RPC(frame, options);
})();
