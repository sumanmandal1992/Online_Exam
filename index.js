const path = require('path');
const express = require('express');
const session = require('express-session');
const mariadb = require('mariadb');
const MariaDBStore = require('express-session-mariadb-store');
const cheerio = require('cheerio');
const fs = require('fs');
const { stdin } = require('process');
const { isMap } = require('util/types');

const app = express();


/*****************
 * Mariadb pool. *
 * ***************/
const pool = mariadb.createPool({
    host: 'localhost',
    user: 'tmp',
    password: 'Suman@1992',
    database: 'sessiondb',
    connectionLimit: 5,
});


/****************************
 * Mariadb session storage. *
 ****************************/
app.use(session({
    store: new MariaDBStore({
        user: 'tmp',
        password: 'Suman@1992'
    }),
    secret: 'secret key',
    resave: false,
    saveUninitialized: false,
    //cookie: { secure: true }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
let tracker = 1;


/*******************
 * Send index page *
 *******************/
app.get('/', (req, res) => {
    const index = path.join(__dirname, 'public', 'index.html');
    let filestats;
    try { filestats = fs.statSync(index); } catch (e) { }

    if (filestats.isFile()) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(index, (err) => {
            if (err) console.log(err);
        });
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.send('Document not found...');
    }
});


/************************
 * Gathering login info *
 ************************/
app.post('/login', async (req, res) => {
    const index = path.join(__dirname, 'public', 'index.html');
    const stddb = path.join(__dirname, 'database', 'students.db');
    let docstats;
    try { docstats = fs.statSync(index); } catch (e) { }

    const { regno, dob } = req.body;
    const isodob = new Date(dob);
    const htmdob = isodob.toISOString().split('T')[0];

    if (docstats.isFile()) {
        let conn;
        try {
            conn = await pool.getConnection();
            const stdinfo = await conn.query('SELECT * FROM std_info WHERE reg_no = ?', [regno]);

            // Calculate date
            const isodate = new Date(stdinfo[0].dob);
            const year = isodate.getFullYear();
            const month = String(isodate.getMonth() + 1).padStart(2, 0);
            const day = String(isodate.getDate()).padStart(2, 0);
            const dbdob = `${year}-${month}-${day}`;
            //console.log("Date: ", dbdob);
            // End date calculateion

            fs.readFile(index, 'utf-8', (err, data) => {
                if (err) console.log(err);

                const $ = cheerio.load(data);

                if (stdinfo[0] !== undefined && dbdob === htmdob) {
                    req.session.isAuth = true;

                    let photo = path.join('images', (regno + '.jpg'));

                    let imgstats;
                    try { imgstats = fs.statSync(path.join(__dirname, 'public', photo)); } catch (e) { }
                    if (!imgstats.isFile()) {
                        photo = path.join('images', (regno + '.png'));
                        try { imgstats = fs.statSync(path.join(__dirname, 'public', photo)); } catch (e) { }
                    }

                    $('#regno').attr('value', regno);
                    $('#dob').attr('value', dob);
                    $('#cname').text(stdinfo[0].name);
                    $('#subcode').text(stdinfo[0].course);
                    if (imgstats.isFile()) $('img').attr('src', photo);

                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/html');
                    res.send($.html());
                } else {
                    $('.regwarn').append(`<label for="warning" 
                                    style="color: red; font-weight: bold; font-size: 27px;">&otimes;</label>`);
                    $('.dobwarn').append(`<label for="warning"
                                    style="color: red; font-weight: bold; font-size: 27px;">&otimes;</label>`);
                    $('#msg').text("Registration number or date of birth mismatch.");
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/html');
                    res.send($.html());
                }

            });

            if (req.sessionID.length > 0) {
                const logged_session_id = await conn.query('SELECT sid FROM logged_user WHERE regno = ?', [regno]);
                if (logged_session_id[0].sid !== req.sessionID) {
                    console.log("New session started...");
                    await conn.query("DELETE FROM session WHERE sid = ?", [logged_session_id[0].sid]);
                    await conn.query("UPDATE logged_user SET sid = ? WHERE regno = ?", [req.sessionID, regno])
                }
            }

        } catch (err) {
            if (err) console.log(err);

            res.redirect('/');

        } finally {
            if (conn) conn.end();
        }
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.send('Page not found...');
    }
});


/**************************************
 * Check login session and start exam *
 **************************************/
app.get('/exam', async (req, res) => {
    tracker = 1;
    const qlist = path.join(__dirname, 'public', 'qlist.html');
    const index = path.join(__dirname, 'public', 'index.html');


    let conn;
    try {
        conn = await pool.getConnection();
        const ssn = await conn.query("SELECT session FROM session WHERE sid = ?", [req.sessionID]);
        const session = JSON.parse(ssn[0].session);
        const question = await conn.query("SELECT * FROM qlist WHERE q_id = ?", [1]); /* 1st question */
        const regno = await conn.query("SELECT regno FROM logged_user WHERE sid = ?", [req.sessionID]);
        const timesec = await conn.query("SELECT timesec FROM timer WHERE regno = ?", [regno[0].regno]);
        if (timesec[0] === undefined)
            await conn.query("INSERT INTO timer values(?, ?, ?)", [regno[0].regno, 3600, 1]);
        const len = await conn.query("SELECT COUNT(*) AS qlen FROM qlist");
        const qlen = parseInt(len[0].qlen, 10);
        //console.log(timesec[0].timesec);


        if (session.isAuth) {

            // Check existance of image file...
            let uimg = path.join('images', (regno[0].regno + '.jpg'));
            let imgstats;
            try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            if (!imgstats.isFile()) {
                uimg = path.join('images', (regno[0].regno + '.png'));
                try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            }


            let docstats;
            try { docstats = fs.statSync(qlist); } catch (e) { }
            // End checking...

            if (docstats.isFile()) {
                fs.readFile(qlist, 'utf-8', (err, data) => {
                    if (err) console.log(err);

                    const $ = cheerio.load(data);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/html');

                    if (timesec[0] !== undefined) $('#time').attr('value', timesec[0].timesec);
                    $('.qstat').text(`Question ${question[0].q_id} of ${qlen}`);

                    // Desining question and choices for represent.
                    const qns = `<tr>
                                    <td>${question[0].q_id}.</td>
                                    <td>${question[0].questions}</td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td>
                                        <label for="chA">A)</label>
                                        <input type="radio" name="choice" value="A">
                                        ${question[0].chA}
                                    </td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td>
                                        <label for="chB">B)</label>
                                        <input type="radio" name="choice" value="B">
                                        ${question[0].chB}
                                    </td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td>
                                        <label for="chC">C)</label>
                                        <input type="radio" name="choice" value="C">
                                        ${question[0].chC}
                                    </td>
                                </tr>
                                <tr>
                                    <td></td>
                                    <td> 
                                        <label for="chD">D)</label>
                                        <input type="radio" name="choice" value="D">
                                        ${question[0].chD}
                                    </td>
                                </tr>`;
                    $('table').append(qns);

                    if (imgstats.isFile()) $('#uimg').attr('src', ('../' + uimg));
                    $('#logo').attr('src', '../images/logo.png');
                    $('#regno').text(regno[0].regno);

                    // Creating buttons for tracking questions.
                    let btns1 = '<form method="post" action="/exam/btns"><div id="btns1">';
                    let btns2 = '<div id="btns2">';
                    let btns3 = '<input type="button" id="np" value="Next>>" onclick="NP()">';
                    if (qlen <= 50) {
                        for (let i = 1; i <= qlen; i++) {
                            btns1 += `<input type="submit" name="btnval" value="${i}">`;
                        }
                        btns1 += '</div></form>';
                        $('.btns').append(btns1);
                    } else {
                        for (let i = 1; i <= 50; i++) {
                            btns1 += `<input type="submit" name="btnval" value="${i}">`;
                        }
                        btns1 += '</div>';
                        for (let i = 50; i <= qlen; i++) {
                            btns2 += `<input type="submit" name="btnval" value="${i}">`;
                        }
                        btns2 += '</div></form>';
                        $('.btns').append(btns1 + btns2 + btns3);
                    }

                    res.send($.html());
                });
            } else {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/html');
                res.send("Document not found...");
            }
        }


    } catch (err) {
        // Manage errors  
        console.log("SQL error in establishing connection:", err);

        res.redirect('/');


    } finally {
        // Close connection
        if (conn) conn.end();
    }
});



/**********************
 * Handle back button *
 **********************/
app.get('/exam/prev', async (req, res) => {
    const qlist = path.join(__dirname, 'public', 'qlist.html');
    let filestats = false;
    try { filestats = fs.statSync(qlist); } catch (e) { }


    if (filestats) {
        if (tracker > 1) --tracker;
        let conn;
        try {
            conn = await pool.getConnection();
            const question = await conn.query("SELECT * FROM qlist WHERE q_id = ?", [tracker]);
            const regno = await conn.query("SELECT regno FROM logged_user WHERE sid = ?", [req.sessionID]);
            const len = await conn.query("SELECT COUNT(*) AS qlen FROM qlist");
            const qlen = parseInt(len[0].qlen, 10);


            // Check existance of image file...
            let uimg = path.join('images', (regno[0].regno + '.jpg'));
            let imgstats;
            try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            if (!imgstats.isFile()) {
                uimg = path.join('images', (regno[0].regno + '.png'));
                try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            }
            // End checking...


            fs.readFile(qlist, 'utf-8', (err, data) => {
                if (err) console.error(err);

                const $ = cheerio.load(data);

                $('#logo').attr('src', '../images/logo.png');
                $('.qstat').text(`Question ${question[0].q_id} of ${qlen}`);
                $('#regno').text(regno[0].regno);
                if (imgstats.isFile()) $('#uimg').attr('src', ('../' + uimg));


                // Desining question and choices for represent.
                const qns = `<tr>
                                <td>${question[0].q_id}.</td>
                                <td>${question[0].questions}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chA">A)</label>
                                    <input type="radio" name="choice" value="A">
                                    ${question[0].chA}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chB">B)</label>
                                    <input type="radio" name="choice" value="B">
                                    ${question[0].chB}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chC">C)</label>
                                    <input type="radio" name="choice" value="C">
                                    ${question[0].chC}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td> 
                                    <label for="chD">D)</label>
                                    <input type="radio" name="choice" value="D">
                                    ${question[0].chD}
                                </td>
                            </tr>`;
                $('table').append(qns);


                // Creating buttons for tracking questions.
                let btns1 = '<form method="post" action="/exam/btns"><div id="btns1">';
                let btns2 = '<div id="btns2">';
                let btns3 = '<input type="button" id="np" value="Next>>" onclick="NP()">';
                if (qlen <= 50) {
                    for (let i = 1; i <= qlen; i++) {
                        btns1 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns1 += '</div></form>';
                    $('.btns').append(btns1);
                } else {
                    for (let i = 1; i <= 50; i++) {
                        btns1 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns1 += '</div>';
                    for (let i = 50; i <= qlen; i++) {
                        btns2 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns2 += '</div></form>';
                    $('.btns').append(btns1 + btns2 + btns3);
                }


                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html');
                res.send($.html());
            });

        } catch (err) {
            // Manage errors  
            console.log("SQL error in establishing connection:", err);

            res.redirect('/exam');

        } finally {
            // Close connection
            if (conn) conn.end();
        }

    } else {
        res.redirect('/exam');
    }
});



/**********************
 * Handle next button *
 **********************/
app.post('/exam/next', async (req, res) => {
    const qlist = path.join(__dirname, 'public', 'qlist.html');
    let filestats;
    try { filestats = fs.statSync(qlist); } catch (e) { }


    if (filestats.isFile()) {
        let conn;
        try {
            conn = await pool.getConnection();
            const question = await conn.query("SELECT * FROM qlist WHERE q_id = ?", [tracker]);
            const regno = await conn.query("SELECT regno FROM logged_user WHERE sid = ?", [req.sessionID]);
            const len = await conn.query("SELECT COUNT(*) AS qlen FROM qlist");
            const qlen = parseInt(len[0].qlen, 10);


            if (tracker < qlen) ++tracker;
            // Check existance of image file...
            let uimg = path.join('images', (regno[0].regno + '.jpg'));
            let imgstats;
            try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            if (!imgstats.isFile()) {
                uimg = path.join('images', (regno[0].regno + '.png'));
                try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            }
            // End checking...


            fs.readFile(qlist, 'utf-8', (err, data) => {
                if (err) console.log(err);

                const $ = cheerio.load(data);

                $('#logo').attr('src', '../images/logo.png');
                $('.qstat').text(`Question ${question[0].q_id} of ${qlen}`);
                $('#regno').text(regno[0].regno);
                if (imgstats.isFile()) $('#uimg').attr('src', ('../' + uimg));


                // Desining question and choices for represent.
                const qns = `<tr>
                                <td>${question[0].q_id}.</td>
                                <td>${question[0].questions}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chA">A)</label>
                                    <input type="radio" name="choice" value="A">
                                    ${question[0].chA}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chB">B)</label>
                                    <input type="radio" name="choice" value="B">
                                    ${question[0].chB}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chC">C)</label>
                                    <input type="radio" name="choice" value="C">
                                    ${question[0].chC}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td> 
                                    <label for="chD">D)</label>
                                    <input type="radio" name="choice" value="D">
                                    ${question[0].chD}
                                </td>
                            </tr>`;
                $('table').append(qns);

                // Creating buttons for tracking questions.
                let btns1 = '<form method="post" action="/exam/btns"><div id="btns1">';
                let btns2 = '<div id="btns2">';
                let btns3 = '<input type="button" id="np" value="Next>>" onclick="NP()">';
                if (qlen <= 50) {
                    for (let i = 1; i <= qlen; i++) {
                        btns1 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns1 += '</div></form>';
                    $('.btns').append(btns1);
                } else {
                    for (let i = 1; i <= 50; i++) {
                        btns1 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns1 += '</div>';
                    for (let i = 50; i <= qlen; i++) {
                        btns2 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns2 += '</div></form>';
                    $('.btns').append(btns1 + btns2 + btns3);
                }


                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html');
                res.send($.html());
            });
        } catch (err) {
            if (err) console.log("Next button SQL error in establishing connection: ", err);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.sendFile(qlist, (err) => {
                if (err) console.log("Next button error in catch: ", err);
            });

        } finally {
            if (conn) conn.end();
        }
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.send("Next button Page not found...");
    }
});



/*******************************
 * Handle button press request *
 *******************************/
app.post('/exam/btns', async (req, res) => {
    const qlist = path.join(__dirname, 'public', 'qlist.html');
    let filestats;
    try { filestats = fs.statSync(qlist); } catch (err) { }

    const { btnval } = req.body;
    tracker = btnval;
    console.log(btnval);


    if (filestats.isFile()) {
        let conn;
        try {
            conn = await pool.getConnection();
            const regno = await conn.query("SELECT regno FROM logged_user WHERE uid = ?", [req.sessionID]);
            const question = await conn.query("SELECT * FROM qlist WHERE q_id = ?", [btnval]);
            const len = await conn.query("SELECT COUNT(*) AS qlen FROM qlist");
            const qlen = parseInt(len[0].qlen, 10);
            //console.log(regno[0]);

            fs.readFile(qlist, 'utf-8', (err, data) => {
                if (err) console.log(err);

                const $ = cheerio.load(data);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html');

                let uimg = path.join('images', (regno[0].regno + '.jpg'));
                let imgstat;
                try { imgstat = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
                if (!imgstat.isFile()) {
                    uimg = path.join('images', (regno[0].regno + '.png'));
                    try { imgstat = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
                }

                if (imgstat.isFile()) $('img').attr('src', ('../' + uimg));
                $('#regno').text(regno[0].regno);

                $('.qstat').text(`Question ${question[0].q_id} of ${qlen}`);

                // Desiging question for display
                const qns = `<tr>
                                <td>${question[0].q_id}.</td>
                                <td>${question[0].questions}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chA">A)</label>
                                    <input type="radio" name="choice" value="A">
                                    ${question[0].chA}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chB">B)</label>
                                    <input type="radio" name="choice" value="B">
                                    ${question[0].chB}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td>
                                    <label for="chC">C)</label>
                                    <input type="radio" name="choice" value="C">
                                    ${question[0].chC}
                                </td>
                            </tr>
                            <tr>
                                <td></td>
                                <td> 
                                    <label for="chD">D)</label>
                                    <input type="radio" name="choice" value="D">
                                    ${question[0].chD}
                                </td>
                            </tr>`;
                $('table').append(qns);


                // Creating buttons for tracking questions
                let btns1 = '<form method="post" action="/exam/btns"><div id="btns1">';
                let btns2 = '<div id="btns2">';
                let btns3 = '<input type="button" id="np" value="Next>>" onclick="NP()">';
                if (qlen <= 50) {
                    for (let i = 1; i <= qlen; i++) {
                        btns1 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns1 += '</div></form>';
                    $('.btns').append(btns1);
                } else {
                    for (let i = 1; i <= 50; i++) {
                        btns1 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns1 += '</div>';
                    for (let i = 50; i <= qlen; i++) {
                        btns2 += `<input type="submit" name="btnval" value="${i}">`;
                    }
                    btns2 += '</div></form>';
                    $('.btns').append(btns1 + btns2 + btns3);
                }

                res.send($.html());
            });

        } catch (err) {
            if (err) console.log("Buttons SQL error in establishing connection: ", err);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.sendFile(qlist, (err) => {
                if (err) console.log("Buttons file error in catch: ", err);
            });

        } finally {
            if (conn) conn.end();
        }
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.send('Buttons Page not found...');
    }
});



/************************
 * Handle submit button *
 ************************/
app.get('/exam/submit', (req, res) => {
    const index = path.join(__dirname, 'public', 'submit.html');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(index, (err) => {
        if (err) console.log(err);
    });
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log(`Listening at port ${port}...`);
});