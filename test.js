const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: 'localhost',
    user: 'tmp',
    password: 'Suman@1992',
    database: 'sessiondb',
    connectionLimit: 1,
});

pool.getConnection()
    .then(conn => {
        conn.query("select * from session")
            .then(rows => {
                console.log(rows);
                conn.end();
            })
            .catch(err => {
                //handle query error
            });
    })
    .catch(err => {
        //handle connection error
    });