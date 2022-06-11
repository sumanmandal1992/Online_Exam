const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: 'localhost',
    user: 'tmp',
    password: 'Suman@1992',
    database: 'sessiondb',
    connectionLimit: 1,
});

async function main() {
    let conn;
    try {
        conn = await pool.getConnection();
        const res = await conn.query("DELETE FROM sessiondb.session");
        console.log(JSON.parse(res[0].session).isAuth); // { affectedRows: 1, insertId: 1, warningStatus: 0 }

    } catch (err) {
        // Manage errors
        console.log("SQL error in establishing a connection: ", err);

    } finally {
        // Close connection
        if (conn) conn.end();
    }
}

main();