const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: 'localhost',
    user: 'tmp',
    password: 'Suman@1992',
    database: 'tmp'
});

async function asyncFunction(query) {
    let conn;
    try {
        conn = await pool.getConnection();
        //const rows = await conn.query("SELECT 1 as val");
        //console.log(rows); //[ {val: 1}, meta: ... ]
        const rows = await conn.query(query);
        console.log(rows); // { affectedRows: 1, insertId: 1, warningStatus: 0 }

    } catch (err) {
        throw err;
    } finally {
        if (conn) return conn.end();

    }
    pool.end();
}

const query = 'SELECT * FROM std_info';
asyncFunction(query);