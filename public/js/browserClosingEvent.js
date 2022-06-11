window.addEventListener('beforeunload', (e) => {
    //e.preventDefault();
    //e.returnValue = '';
    console.log("Hello", e.returnValue);
});