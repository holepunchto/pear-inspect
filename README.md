# pear-inspect

Connects a [hyperswarm](https://github.com/holepunchto/hyperswarm) with a [bare-inspector](https://github.com/holepunchto/bare-inspector).

## Installation

```
npm i @holepunchto/pear-inspect
```

## Usage

On the app where inspection is needed:


``` js
import Inspect from 'pear-inspect'

const inspect = new Inspect({ dhtKey })
await inspect.enable()

// When inspection is no longer needed:
// await inspect.destroy()
```

On the server that shows the clients:

``` js
import Inspect from 'pear-inspect'

const inspect = new Inspect({ dhtKey })
inspect.serve(async client => {
  const res = await client.post('Runtime.evaluate', { expression: '1 + 2' })
  console.log(res)
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

// When the server should stop:
// await inspect.destroy()
```

## Methods

### new Inspect({ swarm, dhtKey })

Create new Inspect that can either inspect into the running process or act as a server that the inspectors connect to.

Either pass a `dhtKey` to allow the Inspect to create and handle the hyperswarm logic, or pass a `swarm` if this is handled outside of this.

#### async .enable()

Enables inspection. If a `dhtKey` was passed to the constructor then it also creates a hyperswarm instance and connects to that `dhtKey`.

### async .serve(client => { ... })

Start server, where the client handler is called every time a new client enables inspection.

The passed `client` has a post method that enables inspection on the client side:

**client.post(...args)***

``` js
server.on('client', async client => {
  const res = await client.post('Runtime.evaluate', { expression: '1 + 2' })
  console.log(res)
})
```

#### async .destroy()

Disables inspection and stops serving. If a `dhtKey` was passed to the constructor then it also destroys the hyperswarm instance.
