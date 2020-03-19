(async () => {
    console.log('before await');
    await new Promise((resolve) => {
        resolve()
    });
    console.log('after await');
})();