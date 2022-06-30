const path = require('path');
const express = require('express');
const session = require('express-session');
const mariadb = require('mariadb');
const MariaDBStore = require('express-session-mariadb-store');
require('dotenv').config();
const cheerio = require('cheerio');
const fs = require('fs');
const { isMap } = require('util/types');
const { time } = require('console');
const { isNullOrUndefined } = require('util');

const app = express();


/*****************
 * Mariadb pool. *
 * ***************/
const pool = mariadb.createPool({
    host: process.env.MDB_HOST,
    user: process.env.MDB_USER,
    password: process.env.MDB_PASS,
    database: 'sessiondb',
    connectionLimit: 5,
});


/****************************
 * Mariadb session storage. *
 ****************************/
app.use(session({
    store: new MariaDBStore({
        user: process.env.MDB_USER,
        password: process.env.MDB_PASS,
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

    if (filestats !== undefined && filestats.isFile()) {
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


/*************************************
 * Collecting ans showing login info *
 *************************************/
app.post('/login', async (req, res) => {
    const index = path.join(__dirname, 'public', 'index.html');
    const stddb = path.join(__dirname, 'database', 'students.db');
    let docstats;
    try { docstats = fs.statSync(index); } catch (e) { }

    const { regno, dob } = req.body;
    const isodob = new Date(dob);
    const htmdob = isodob.toISOString().split('T')[0];

    if (docstats !== undefined && docstats.isFile()) {
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

                    let photo = path.join('images/candidates', (regno + '.jpg'));
                    let filestats;
                    try { filestats = fs.statSync(path.join(__dirname, 'public', photo)); } catch (e) { }
                    if (filestats === undefined || !filestats.isFile()) {
                        photo = path.join('images/candidates', (regno + '.png'));
                        try { filestats = fs.statSync(path.join(__dirname, 'public', photo)); } catch (e) { }
                    }


                    $('#regno').attr('value', regno);
                    $('#dob').attr('value', dob);
                    $('#cname').text(stdinfo[0].name);
                    $('#subcode').text(stdinfo[0].course);
                    if (filestats !== undefined && filestats.isFile()) $('img').attr('src', photo);

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
                const logged_session_id = await conn.query("SELECT sid FROM loggedUser WHERE regno = ?", [regno]);
                const timer = await conn.query("SELECT * FROM timer WHERE regno = ?", [regno]);
                if (timer[0] === undefined)
                    await conn.query("INSERT INTO timer VALUES(?, ?)", [regno, 3600]);

                if (logged_session_id[0] === undefined) {
                    console.log("New session started...");
                    await conn.query("INSERT INTO loggedUser VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE regno = ?, loggedStats = ?", [req.sessionID, regno, 1, regno, 1]);
                } else if (logged_session_id[0].sid !== req.sessionID) {
                    console.log("New session started, you come back...");
                    await conn.query("DELETE FROM session WHERE sid = ?", [logged_session_id[0].sid]);
                    await conn.query("UPDATE loggedUser SET sid = ?, loggedStats = ? WHERE regno = ?", [req.sessionID, 1, regno])
                } else {
                    console.log("Existing session...");
                    await conn.query("UPDATE loggedUser SET loggedStats = ? WHERE regno = ?", [1, regno]);
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



/**************************
 * Designing questions... *
 **************************/
function designQns(question) {
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
    return qns;
}


// Design questions with checked key...
function designQnsChkd(question, ans) {
    let qns;
    if (ans[0].choice === 'A') {
        qns = `<tr>
                    <td>${question[0].q_id}.</td>
                    <td>${question[0].questions}</td>
                </tr>
                <tr>
                    <td></td>
                    <td>
                        <label for="chA">A)</label>
                        <input type="radio" name="choice" value="A" checked>
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
    } else if (ans[0].choice === 'B') {
        qns = `<tr>
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
                        <input type="radio" name="choice" value="B" checked>
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
    } else if (ans[0].choice === 'C') {
        qns = `<tr>
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
                        <input type="radio" name="choice" value="C" checked>
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
    } else if (ans[0].choice === 'D') {
        qns = `<tr>
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
                        <input type="radio" name="choice" value="D" checked>
                        ${question[0].chD}
                    </td>
                </tr>`;
    } else {
        qns = designQns(question);
    }
    return qns;
}


/*************************
 * 
 * @param {*} qlen 
 * @param {*} ansAll 
 * @returns 
 * Crating buttons...
 **************************/
function generateBtns(qlen, ansAll) {
    let btns1 = `<form method="post" action="/exam/btns"><div id="btns1">
                <input type="hidden" name="time" id="btnstime" value="">`;
    let btns2 = '<div id="btns2">';
    let btns3 = '<input type="button" id="np" value="Next>>" onclick="NP()">';
    if (qlen <= 50) {
        let indx = 0, qid = [];
        for (let i = 0; i < qlen; i++) {
            if (ansAll[i] !== undefined) {
                if (ansAll[i].choice !== '') {
                    qid.push(ansAll[i].qid);
                    ++indx;
                }
            } else {
                break;
            }
        }

        let track = 0;
        for (let i = 0; i < qlen; ++i) {
            if (qid[track] === (i + 1)) {
                btns1 += `<input type="submit" name="btnval" value="${i + 1}" style="background-color: green;">`;
                if (track < indx) ++track;
            } else {
                btns1 += `<input type="submit" name="btnval" value="${i + 1}">`;
            }
        }
        btns1 += '</div></form>';
        return btns1;
    } else {
        let indx = 0, qid = [];
        for (let i = 0; i < qlen; i++) {
            if (ansAll[i] !== undefined) {
                if (ansAll[i].choice !== '') {
                    qid.push(ansAll[i].qid);
                    ++indx;
                }
            } else {
                break;
            }
        }

        let track = 0;
        for (let i = 0; i < 50; ++i) {
            if (qid[track] === (i + 1)) {
                btns1 += `<input type="submit" name="btnval" value="${i + 1}" style="background-color: green;">`;
                if (track < indx) ++track;
            } else {
                btns1 += `<input type="submit" name="btnval" value="${i + 1}">`;
            }
        }
        btns1 += '</div>';
        for (let i = 50; i < qlen; ++i) {
            if (qid[track] === (i + 1)) {
                btns2 += `<input type="submit" name="btnval" value="${i + 1}" style="background-color: green;">`;
                if (track < indx) ++track;
            } else {
                btns2 += `<input type="submit" name="btnval" value="${i + 1}">`;
            }
        }
        btns2 += '</div></form>';
        return (btns1 + btns2 + btns3);
    }
}



/**************************************
 * Check login session and start exam *
 **************************************/
app.get('/exam', async (req, res) => {
    tracker = 1;
    const qlist = path.join(__dirname, 'public', 'qlist.html');


    let conn;
    try {
        conn = await pool.getConnection();
        const ssn = await conn.query("SELECT session FROM session WHERE sid = ?", [req.sessionID]);
        const session = JSON.parse(ssn[0].session);
        const question = await conn.query("SELECT * FROM qlist WHERE q_id = ?", [tracker]); /* 1st question */
        const regno = await conn.query("SELECT * FROM loggedUser WHERE sid = ?", [req.sessionID]);
        const timer = await conn.query("SELECT * FROM timer WHERE regno = ?", [regno[0].regno]);
        const len = await conn.query("SELECT COUNT(*) AS qlen FROM qlist");
        const qlen = parseInt(len[0].qlen, 10);
        let timesec = timer[0].timesec;
        //console.log(timesec[0].timesec);


        if (session.isAuth && regno[0].loggedStats === 1) {
            // Create temporary answer table in database...
            await conn.query(`CREATE TABLE IF NOT EXISTS ${regno[0].regno}_tmp(
                                qid INT(3) NOT NULL PRIMARY KEY,
                                choice CHAR(1),
                                correct CHAR(1) NOT NULL)
                            `);
            // Query for answer key...
            const ans = await conn.query(`SELECT * FROM ${regno[0].regno}_tmp WHERE qid = ?`, [tracker]);
            const ansAll = await conn.query(`SELECT * FROM ${regno[0].regno}_tmp ORDER BY qid`);

            // Check existance of image file...
            let uimg = path.join('images/candidates', (regno[0].regno + '.jpg'));
            let imgstats;
            try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            if (imgstats === undefined || !imgstats.isFile()) {
                uimg = path.join('images/candidates', (regno[0].regno + '.png'));
                try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            }


            let docstats;
            try { docstats = fs.statSync(qlist); } catch (e) { }
            // End checking...

            if (docstats !== undefined && docstats.isFile()) {
                fs.readFile(qlist, 'utf-8', (err, data) => {
                    if (err) console.log(err);

                    const $ = cheerio.load(data);
                    if (timesec < 0) timesec = 0;
                    if (timer[0] !== undefined) $('#time').attr('value', timesec);
                    $('.qstat').text(`Question ${question[0].q_id} of ${qlen}`);

                    // Desining question and choices for represent.
                    if (ans[0] === undefined)
                        $('table').append(designQns(question));
                    else if (ans[0].choice === '')
                        $('table').append(designQns(question));
                    else
                        $('table').append(designQnsChkd(question, ans));


                    if (imgstats !== undefined && imgstats.isFile()) $('#uimg').attr('src', ('../' + uimg));
                    $('#logo').attr('src', '../images/logo.png');
                    $('#regno').text(regno[0].regno);


                    // Creating buttons for tracking questions.
                    $('.btns').append(generateBtns(qlen, ansAll));


                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/html');
                    res.send($.html());
                });
            } else {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/html');
                res.send("Document not found...");
            }
        } else {
            res.redirect('/');
        }

        await conn.query("UPDATE loggedUser SET loggedStats = ? WHERE regno = ?", [0, regno[0].regno]);

    } catch (err) {
        // Manage errors  
        console.log("SQL error in establishing connection:", err);

        res.redirect('/');


    } finally {
        // Close connection
        if (conn) conn.end();
    }
});



/************************
 * Handling prev button *
 ************************/
app.post('/exam/prev', async (req, res) => {
    const qlist = path.join(__dirname, 'public', 'qlist.html');
    let filestats;
    try { filestats = fs.statSync(qlist); } catch (e) { }

    const { time } = req.body;


    if (filestats !== undefined && filestats.isFile()) {
        if (tracker > 1) --tracker;
        let conn;
        try {
            conn = await pool.getConnection();
            const question = await conn.query("SELECT * FROM qlist WHERE q_id = ?", [tracker]);
            const regno = await conn.query("SELECT regno FROM loggedUser WHERE sid = ?", [req.sessionID]);
            const ans = await conn.query(`SELECT * FROM ${regno[0].regno}_tmp WHERE qid = ?`, [tracker]);
            const ansAll = await conn.query(`SELECT * FROM ${regno[0].regno}_tmp ORDER BY qid`);
            const len = await conn.query("SELECT COUNT(*) AS qlen FROM qlist");
            const qlen = parseInt(len[0].qlen, 10);

            await conn.query("UPDATE timer SET timesec = ? WHERE regno = ?", [time, regno[0].regno]);



            // Check existance of image file...
            let uimg = path.join('images/candidates', (regno[0].regno + '.jpg'));
            let imgstats;
            try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            if (imgstats === undefined || !imgstats.isFile()) {
                uimg = path.join('images/candidates', (regno[0].regno + '.png'));
                try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            }
            // End checking...


            fs.readFile(qlist, 'utf-8', (err, data) => {
                if (err) console.error(err);

                const $ = cheerio.load(data);

                $('#logo').attr('src', '../images/logo.png');
                $('.qstat').text(`Question ${question[0].q_id} of ${qlen}`);
                $('#regno').text(regno[0].regno);
                if (imgstats !== undefined && imgstats.isFile()) $('#uimg').attr('src', ('../' + uimg));


                // Desining question and choices for represent.
                if (ans[0] === undefined) {
                    $('table').append(designQns(question));
                } else if (ans[0].choice === '') {
                    $('table').append(designQns(question));
                } else {
                    $('table').append(designQnsChkd(question, ans));
                }


                // Creating buttons for tracking questions.
                $('.btns').append(generateBtns(qlen, ansAll));


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



/*************************
 * Handleing next button *
 *************************/
app.post('/exam/next', async (req, res) => {
    const qlist = path.join(__dirname, 'public', 'qlist.html');
    let filestats;
    try { filestats = fs.statSync(qlist); } catch (e) { }

    const { choice, time } = req.body;
    //console.log('In next: ', choice, time);

    if (filestats !== undefined && filestats.isFile()) {
        let conn;
        try {
            conn = await pool.getConnection();
            const regno = await conn.query("SELECT regno FROM loggedUser WHERE sid = ?", [req.sessionID]);
            const dbCh = await conn.query(`SELECT choice FROM ${regno[0].regno}_tmp WHERE qid = ?`, [tracker]);
            const len = await conn.query("SELECT COUNT(*) AS qlen FROM qlist");
            const qlen = parseInt(len[0].qlen, 10);
            const correctCh = await conn.query("SELECT correct FROM qlist WHERE q_id = ?", [tracker]);

            await conn.query("UPDATE timer SET timesec = ? WHERE regno = ?", [time, regno[0].regno]);

            // Storing answer into database...
            let ch = choice;
            if (choice === undefined)
                ch = '';
            if (dbCh[0] === undefined)
                await conn.query(`INSERT INTO ${regno[0].regno}_tmp VALUES(?, ?, ?)`, [tracker, ch, correctCh[0].correct]);
            else
                await conn.query(`UPDATE ${regno[0].regno}_tmp SET choice = ? WHERE qid = ?`, [ch, tracker]);

            if (tracker < qlen) ++tracker;
            const question = await conn.query("SELECT * FROM qlist WHERE q_id = ?", [tracker]);
            const ans = await conn.query(`SELECT * FROM ${regno[0].regno}_tmp WHERE qid = ?`, [tracker]);
            const ansAll = await conn.query(`SELECT * FROM ${regno[0].regno}_tmp ORDER BY qid`);




            // Check existance of image file...
            let uimg = path.join('images/candidates', (regno[0].regno + '.jpg'));
            let imgstats;
            try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            if (imgstats === undefined || !imgstats.isFile()) {
                uimg = path.join('images/candidates', (regno[0].regno + '.png'));
                try { imgstats = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            }
            // End checking...


            fs.readFile(qlist, 'utf-8', (err, data) => {
                if (err) console.log(err);

                const $ = cheerio.load(data);

                $('#logo').attr('src', '../images/logo.png');
                $('.qstat').text(`Question ${question[0].q_id} of ${qlen}`);
                $('#regno').text(regno[0].regno);
                if (imgstats !== undefined && imgstats.isFile()) $('#uimg').attr('src', ('../' + uimg));


                // Desining question and choices for represent.
                if (ans[0] === undefined) {
                    $('table').append(designQns(question));
                } else if (ans[0].choice === '') {
                    $('table').append(designQns(question));
                } else {
                    $('table').append(designQnsChkd(question, ans));
                }


                // Creating buttons for tracking questions.
                $('.btns').append(generateBtns(qlen, ansAll));


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



/*********************************
 * Handling button press request *
 *********************************/
app.post('/exam/btns', async (req, res) => {
    // Checking existance of file...
    const qlist = path.join(__dirname, 'public', 'qlist.html');
    let filestats;
    try { filestats = fs.statSync(qlist); } catch (err) { }
    // End checking...

    const { btnval, time } = req.body;

    if (filestats !== undefined && filestats.isFile()) {
        tracker = btnval;
        let conn;
        try {
            conn = await pool.getConnection();
            const regno = await conn.query("SELECT regno FROM loggedUser WHERE sid = ?", [req.sessionID]);
            const question = await conn.query("SELECT * FROM qlist WHERE q_id = ?", [tracker]);
            const len = await conn.query("SELECT COUNT(*) AS qlen FROM qlist");
            const qlen = parseInt(len[0].qlen, 10);
            const ans = await conn.query(`SELECT * FROM ${regno[0].regno}_tmp WHERE qid = ?`, [tracker]);
            const ansAll = await conn.query(`SELECT * FROM ${regno[0].regno}_tmp ORDER BY qid`);
            await conn.query("UPDATE timer SET timesec = ? WHERE regno = ?", [time, regno[0].regno]);
            //console.log(regno[0]);

            // Checking existance of file...
            let uimg = path.join('images/candidates', (regno[0].regno + '.jpg'));
            let imgstat;
            try { imgstat = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            if (imgstat === undefined || !imgstat.isFile()) {
                uimg = path.join('images/candidates', (regno[0].regno + '.png'));
                try { imgstat = fs.statSync(path.join(__dirname, 'public', uimg)); } catch (e) { }
            }
            // End checking...


            fs.readFile(qlist, 'utf-8', (err, data) => {
                if (err) console.log(err);


                const $ = cheerio.load(data);

                $('#logo').attr('src', '../images/logo.png');
                if (imgstat !== undefined && imgstat.isFile()) $('#uimg').attr('src', ('../' + uimg));
                $('#regno').text(regno[0].regno);
                $('.qstat').text(`Question ${question[0].q_id} of ${qlen}`);

                // Desiging question for display
                if (ans[0] === undefined) {
                    $('table').append(designQns(question));
                } else if (ans[0].choice === '') {
                    $('table').append(designQns(question));
                } else {
                    $('table').append(designQnsChkd(question, ans));
                }


                // Creating buttons for tracking questions
                $('.btns').append(generateBtns(qlen, ansAll));


                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html');
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



/*******************************************************************
 * Logout from the exam, status will remain saved until next login *
 *******************************************************************/
app.get('/exam/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});




/**************************
 * Handling submit button *
 **************************/
app.get('/exam/submit', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const regno = await conn.query("SELECT regno FROM loggedUser WHERE sid = ?", [req.sessionID]);
        await conn.query(`CREATE TABLE IF NOT EXISTS ${regno[0].regno} AS SELECT * FROM ${regno[0].regno}_tmp`);
        await conn.query(`DROP TABLE ${regno[0].regno}_tmp`);
        await conn.query("UPDATE timer SET timesec = ? WHERE regno = ?", [0, regno[0].regno]);
    } catch (err) {
        if (err) console.log(err);
    } finally {
        if (conn) conn.end();
    }

    const endExam = path.join(__dirname, 'public', 'endExam.html');
    let filestats;
    try { filestats = fs.statSync(endExam); } catch (e) { }
    if (filestats !== undefined && filestats.isFile()) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(endExam, (err) => {
            if (err) console.log(err);
        });
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.send("Page not found...");
    }
});



app.get('/exam/autoSubmit', (req, res) => {
    const submit = path.join(__dirname, 'public', 'submit.html')
    let filestats;
    try { filestats = fs.statSync(submit) } catch (e0) { }
    if (filestats !== undefined && filestats.isFile()) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(submit, (err) => {
            if (err) console.log(err);
        });
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.send("Page not found...");
    }
});



/*******************************
 * Redirect to the login page. *
 *******************************/
app.get('/exam/end', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const regno = await conn.query("SELECT regno FROM loggedUser WHERE sid = ?", [req.sessionID]);
        await conn.query("DELETE FROM timer WHERE regno = ?", [regno[0].regno]);
    } catch (err) {
        if (err) console.log(err);
    } finally {
        if (conn) conn.end();
    }

    req.session.destroy();
    res.redirect('/');
});


/*********************************
 * Listening server at the port. *
 *********************************/
const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log(`Listening at port ${port}...`);
});