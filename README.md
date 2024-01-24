# pear-inspect

Connects a [hyperdht](https://github.com/holepunchto/hyperdht) with an [bare-inspector](https://github.com/holepunchto/bare-inspector).

Is a part of how to debug Pear apps using Chrome Devtools Protocol (CDP).

## Installation

```
npm i @holepunchto/pear-inspect
```

## Usage

On the app where inspection is needed:

``` js
import inspector from 'inspector'
import { AppInspector } from 'pear-inspect'

const appInspector = new AppInspector({ inspector })
const { publicKey } = await appInspector.enable() // Pass the public key to the Client

// When inspection is no longer needed:
// await appInsepctor.disable()
```

On the side where you want to debug the remote app:

``` js
import { Client } from 'pear-inspect'

const client = new Client({ publicKey }) // The publicKey that was return from the AppInspector
client.on('message', ({ id, result, error }) => {
  console.log(result)
  /*
    {
      type: 'number',
      value: 3,
      description: '3'
    }
  */
})

client.send({
  id: 1, // The id is optional, but is used by DevTools as it runs on jsonrpc
  method: 'Runtime.evaluate',
  params: { expression: '1 + 2' }
})

// When the client should stop:
// await client.destroy()
```

## Methods

### new AppInspector({ inspector, dhtServer = null, keyPair = null })

Creates new AppInspector that will be able to inspect the process it's currently running.

#### async .enable()

Enables inspection, creates a `hyperdht` server and returns a keypair.

If a `dhtServer` was passed, then it just attaches a 'connection' handler. If `keyPair` was passed, then this is used when creating the `hyperdht` server.

#### async .disable()

Stops inspection and removes any `hypderdht` server.

If a `dhtServer` was passed, then it just detaches the 'connection' handler.

### new Client({ publicKey })

Creates new Client that can inspect a remote app.

`publicKey` is a `hyperdht` key that it's used to connect to.

#### .send({ id, method, params })

Send a CDP method to the remote app. `id` is optional, but if passed, then it will be returned with the corresponding event.

#### event .on('message', msg => { ... })

Messages from the remote app's inspector. Will contain `id` if that was passed to the corresponding method.
