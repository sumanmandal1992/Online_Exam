const path = require('path');
const express = require('express');
const session = require('express-session');
const mariadb = require('mariadb');
const MariaDBStore = require('express-session-mariadb-store');
const cheerio = require('cheerio');
const fs = require('fs');
const db = require('./modules/sqlite');

const app = express();


const pool = mariadb.createPool({
    host: 'localhost',
    user: 'tmp',
    password: 'Suman@1992',
    database: 'tmp'
});


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

app.get('/', (req, res) => {
    const index = path.join(__dirname, 'public', 'index.html');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(index, (err) => {
        if (err) console.log(err);
    });
});


app.post('/login', (req, res) => {
    const index = path.join(__dirname, 'public', 'index.html');
    const stddb = path.join(__dirname, 'database', 'students.db');
    let docstats;
    try {
        docstats = fs.statSync(index);
    } catch (e) { }

    const { regno, dob } = req.body;

    if (docstats.isFile()) {
        fs.readFile(index, 'utf-8', (err, data) => {
            if (err) console.log(err);

            db.open(stddb);

            const query = `SELECT * FROM std_info WHERE reg_no=?`;
            db.get(query, regno, (row) => {

                const $ = cheerio.load(data);

                if (row.dob === dob) {
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
                    $('#cname').text(row.name);
                    $('#subcode').text(row.sub_code);
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

            db.close();
        });
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html');
        res.send('Page not found...');
    }
});


app.get('/exam', (req, res) => {
    const qlist = path.join(__dirname, 'public', 'qlist.html');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(qlist, (err) => {
        if (err) console.log(err);
    });
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Listening at port ${port}...`);
});