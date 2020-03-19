const { on, EventEmitter } = require('events')

;(async () => {
    const ee = new EventEmitter()

    // Emit later on
    process.nextTick(() => {
        ee.emit('foo', 'bar')
        ee.emit('foo', 42)
    })
    const e = await on(ee, 'foo')
    console.log(e.next())
    console.log(e.next())
    await e.next()
    console.log('The End') // This is never printed...!
})()