function dateValidate() {
    const date = document.getElementById('dob').value
    const d = new Date(date);
    console.log(date);
    if (isNaN(d.getTime()))
        alert("Invalide date string insertion...");
}