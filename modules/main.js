const fs = require('fs');
const cheerio = require('cheerio');


exports.htmldoc = (res, htmldoc) => {
    const readStream = fs.createReadStream(htmldoc, 'utf-8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    readStream.on('open', () => {
        readStream.pipe(res);
    });

    readStream.on('error', (err) => {
        res.end(err)
    });
}


exports.showinfo = (res, dbdata, fspaths) => {

    fs.readFile(fspaths.index, 'utf-8', (err, data) => {
        if (err) console.log(err);

        const $ = cheerio.load(data);
        $('#regno').attr('value', dbdata.reg_no);
        $('#dob').attr('value', dbdata.dob);
        $('#cname').text(dbdata.name);
        $('#subcode').text(dbdata.sub_code);
        if (fspaths.stats) {
            $('img').attr('src', fspaths.image);
        } else {
            $('img').attr('src', '#');
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.write($.html());
        res.end();
    });
}