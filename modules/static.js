const fs = require('fs');

exports.cssPipe = (res, cssPath) => {
	const readStream = fs.createReadStream(cssPath, "utf8");

	res.writeHead(200, { 'Content-Type': 'text/css' });
	readStream.on('open', () => { readStream.pipe(res); });
	readStream.on('error', (err) => { res.end(err.toString()); });
}

exports.imgPipe = (req, res, imgPath) => {
	const readStream = fs.createReadStream(imgPath);

	if (req.url.match('\.png$')) {
		res.writeHead(200, { 'Content-Type': 'image/png' });
	} else if (req.url.match('\.jpg$')) {
		res.writeHead(200, { 'Content-Type': 'image/jpg' });
	} else if (req.url.match('\.jpeg$')) {
		res.writeHead(200, { 'Content-Type': 'image/jpeg' });
	} else if (req.url.match('\.svg$')) {
		res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
	} else if (req.url.match('\.gif$')) {
		res.writeHead(200, { 'Content-Type': 'image/gif' });
	}

	readStream.on('open', () => { readStream.pipe(res); });
	readStream.on('error', (err) => { res.end(err.toString()); });
}

exports.icoPipe = (res, icoPath) => {
	const readStream = fs.createReadStream(icoPath);

	res.writeHead(200, { 'Content-Type': 'image/x-icon' });
	readStream.on('open', () => { readStream.pipe(res); });
	readStream.on('error', (err) => { res.end(err.toString()); });
}

exports.jsPipe = (res, jsPath) => {
	const readStream = fs.createReadStream(jsPath, "utf8");

	res.writeHead(200, { 'Content-Type': 'text/javascript' });
	readStream.on('open', () => { readStream.pipe(res); });
	readStream.on('error', (err) => { res.end(err.toString()); });
}