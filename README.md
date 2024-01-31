# pear-inspect

Enable debugging of Pear apps. This is especially useful when running `terminal` or `mobile` Pear apps. The apps can be running on a fully remote system, making it easier helping others debug their apps.

It's essentially a link between [hyperdht](https://github.com/holepunchto/hyperdht) and [bare-inspector](https://github.com/holepunchto/bare-inspector).

This is a part of how to debug Pear apps using Chrome Devtools Protocol (CDP).

## Installation

```
npm install pear-inspect
```

## Usage with pear://runtime

One of the reasons for using `pear-inspect` is to be able to debug with the pear://runtime application. To do so, all that's needed is to do this, in the app you want to inspect:

``` js
import nodeInspector from 'inspector'
import { Inspector } from 'pear-inspect'

const inspector = new Inspector({ inspector: nodeInspector })
const inspectorKey = await inspector.enable()

console.log(`Add this key to Pear Runtime: ${inspectorKey.toString('hex')}`)
```

## Usage

The main thing to understand is that:

- On the app which that needs to be debuggged, use the `Inspector` class.
- On the other side (where you e.g. run your DevTools), use the `Session` class. This interface is similar to how Node's Inspector works with connect/disconnect/post methods.

On the app where inspection is needed:

``` js
import nodeInspector from 'inspector'
import { Inspector } from 'pear-inspect'

const inspector = new Inspector({ inspector: nodeInspector })
const inspectorKey = await inspector.enable() // Pass the public key to the Session

// When inspection is no longer needed:
// await inspector.disable()
```

On the side where you want to debug the remote app:

``` js
import { Session } from 'pear-inspect'

const session = new Session({ inspectorKey }) // The inspectorKey that was return from the Inspector
session.on('info', ({ filename }) => {
  console.log('This is the main entrypoint', filename)
})
session.on('message', ({ id, result, error }) => {
  console.log(result)
  /*
    {
      result: {
        type: 'number',
        value: 3,
        description: '3'
      }
    }
  */
})

session.connect()
session.post({
  id: 1, // The id is optional, but is used by DevTools as it runs on jsonrpc
  method: 'Runtime.evaluate',
  params: { expression: '1 + 2' }
})

// When the session is no longer required (e.g. when the DevTools window is closed)
// session.disconnect()

// If the hyperdht connection should be completely stopped:
// await session.destroy()
```

## Methods

### new Inspector({ inspector, dhtServer = null, inspectorKey = null, filename = null })

Creates new Inspector that will be able to inspect the process it's currently running.

If `filename` is omitted then it will be set to `require.main.filename`.

#### async .enable()

Enables inspection, creates a `hyperdht` server and returns `inspectorKey`.

If a `dhtServer` was passed, then it just attaches a 'connection' handler. If `inspectorKey` was passed, then this is used as a seed to generate a key pair which is then used for creating the `hyperdht` server.

#### async .disable()

Stops inspection and removes any `hypderdht` server.

If a `dhtServer` was passed, then it just detaches the 'connection' handler.

### new Session({ inspectorKey = null, publicKey = null })

Creates new Session that can inspect a remote app.

Either `inspectorKey` or `publicKey` has to be used. Generally you will use `inspectorKey`, but you can use `publicKey` if you want to have more control.

#### .connect()

Start the remote inspection. `disconnect()` can be called when inspection is no longer needed.

#### .disconnect()

Close the remote inspection. `.connect()` can be called again if more inspection is needed.

#### .post({ id, method, params })

Send a CDP method to the remote app. `id` is optional, but if passed, then it will be returned with the corresponding event.

Throws an error if `.connect()` has not been called

#### event .on('info', ({ filename }) => { ... })

When connected to the Inspector on the remote side, this event is emitted where it's possible to see which filename is the main entrypoint for the Pear app.

#### event .on('message', msg => { ... })

Messages from the remote app's inspector. Will contain `id` if that was passed to the corresponding method.
