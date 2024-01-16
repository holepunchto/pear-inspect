# pear-inspect

Connects a [hyperswarm](https://github.com/holepunchto/hyperswarm) with a [bare-inspector](https://github.com/holepunchto/bare-inspector).

## Installation

```
npm i @holepunchto/pear-inspect
```

## Usage

On the app where inspection is needed:

``` js
import { Inspect } from 'pear-inspect'

const inspect = new Inspect({ dhtKey })
await inspect.enable() // Only enable, when inspection is needed

// When inspection is no longer neededa:
// await inspect.disable()
```

On the server that holds the connected Inspector clients, and shows the inspection calls:

``` js
import { Server } from 'pear-inspect'

const inspectorServer = new Server(dhtKey)
await inspectorServer.start()

inspectorServer.on('client', client => {
  const res = await client.post('Runtime.evaluate', { expression: '1 + 2' })
  console.log(res)
})
....

// When server needs to shut down:
// await inspectorServer.stop()
```

## Methods

### new Inspector({ swarm, dhtKey })

Inspector that connects to an Inspector Server in a hyperswarm, and allows inspection into this process.

Either pass a `dhtKey` to allow the Inspector to create/destroy the hyperswarm instance, or pass a `swarm` if this is handled outside of this.

#### async .enable()

Enables inspection. If a `dhtKey` was passed to the constructor then it also creates a hyperswarm instance and connects to that `dhtKey`.

#### async .disable()

Disables inspection. If a `dhtKey` was passed to the constructor then it also destroys the hyperswarm instance.

### new Server({ swarm, dhtKey })

Server that handles connections from Inspector Clients which can then be inspected. It's an eventemitter and will emit `client` whenever a new client connects.

Either pass a `dhtKey` to allow the Inspector to create/destroy the hyperswarm instance, or pass a `swarm` if this is handled outside of this.

#### event('client', client => { ... })

Event is emitted when a new Inspector Client has connected to the server.

**client.post(...args)***

``` js
server.on('client', async client => {
  const res = await client.post('Runtime.evaluate', { expression: '1 + 2' })
  console.log(res)
})
```

#### async .start()

Starts the server.

#### async .stop()

Stops the server.
