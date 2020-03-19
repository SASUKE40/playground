const { on, EventEmitter } = require('events');

(async () => {
    const ee = new EventEmitter();

    // Emit later on
    process.nextTick(() => {
        ee.emit('foo', 'bar');
        ee.emit('foo', 42);
    });

    for await (const event of on(ee, 'foo')) {
        // The execution of this inner block is synchronous and it
        // processes one event at a time (even with await). Do not use
        // if concurrent execution is required.
        console.log(event); // prints ['bar'] [42]
    }
    console.log('The End'); // This is never printed...!
})();