(async () => {

    async function* asyncGenerator() {
        let i = 0;
        while (i < 3) {
            yield i++;
        }
    }

    for await (const event of asyncGenerator()) {
        // The execution of this inner block is synchronous and it
        // processes one event at a time (even with await). Do not use
        // if concurrent execution is required.
        console.log(event); // prints ['bar'] [42]
    }
    console.log('The End'); // This is printed normally!
})();