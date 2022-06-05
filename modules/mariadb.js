const mariadb = require('mariadb');


const pool = mariadb.createPool({
    host: 'localhost',
    user: 'tmp',
    password: 'Suman@1992',
    database: 'tmp'
});

async function asyncFunction() {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query("SELECT * FROM std_info");
        console.log(res[0]); // { affectedRows: 1, insertId: 1, warningStatus: 0 }

    } catch (err) {
        throw err;
    } finally {
        if (conn) return conn.end();
    }
}