# pear-inspect

Connects a [hyperswarm](https://github.com/holepunchto/hyperswarm) with a [bare-inspector](https://github.com/holepunchto/bare-inspector).

## Installation

```
npm i @holepunchto/pear-inspect
```

## Usage

On the Pear app where insights is needed:


Server that will show

``` js
import { Inspect } from 'pear-inspect'

const inspect = new Inspect({ dhtKey })
await inspect.enable() // Now PI servers can send inspection commands to this

// When inspection is no longer needed.
inspect.disable()
```

``` js
import { Server } from 'pear-inspect'

const inspectorServer = new Server(dhtKey)
await inspectorServer.start() // When client connect to this server, it can inspect them

inspectorServer.on('client', client => {
  const res = await client.post('Runtime.evaluate', { expression: '1 + 2' })
  console.log(res)
})
....

```


``` js
import PearInspect from '@holepunchto/pear-inspect'

const pi = new PearInspect({ dhtKey: sharedInspectDhtKey })
await pi.enable() // Only do this when/if inspection is required

// When inspection is no longer required
await pi.disable()
```

On the other side:

``` js
import PearInspect from '@holepuchto/pear-inspect'

const pi = new PearInspect({ dhtKey: sharedInspectDhtKey })

const res = await pi.post('Runtime.evaluation', { expression: '1 + 2' })
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
```

### Methods

#### constructur({ swarm, dhtKey })

Pass either a `swarm` or a `dhtKey`.

If passing a `dhtKey` then a hyperswarm will be created, and when calling `disable()` then it will be destroyed.

#### async .enable()

This is to be called from the app where insights are needed.

Internally it adds a `connection` listener on the `swarm`.

#### async .disable()

This is to be called from the app where insights are needed.

Internally it removes the `connection` listener on the `swarm` and if only a `dhtKey` was passed, then the swarm is destroyed.

#### async .post(...args)

This is to be called on the other side, where insights are consumed.

The `...args` are sent over the `hyperswarm` and to the inspector running on the other end.

Example: `await pearInspect.post('Runtime.evaluate', { expression: '1 + 2' })`
