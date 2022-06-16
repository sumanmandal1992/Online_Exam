const dt = new Date('2022-01-01');
const year = dt.getFullYear();
const month = String(dt.getMonth()).padStart(2, 0);
const day = String(dt.getDate()).padStart(2, 0)
const date = `${year}-${month}-${day}`;
console.log(date);