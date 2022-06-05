const sqlite3 = require('sqlite3').verbose();
//const { Parser } = require('json2csv');
//const fs = require('fs');

/***********************************
 * Opening and closing database... *
 ***********************************/
let db;
module.exports.db = db;

module.exports.open = (path) => {
	this.db = new sqlite3.Database(path, (err) => {
		if (err) {
			return console.error(err.message);
		}

		console.log('Connected to the SQlite database.');
	});
}

module.exports.close = () => {
	this.db.close((err) => {
		if (err) {
			return console.error(err.message);
		}

		console.log('Close the database connection.');
	});
}

/*************************************************
 * Any query create/delete/drop... *
 *************************************************/
module.exports.run = (query) => {
	this.db.run(query, (err) => {
		if (err) {
			return console.error(err.message);
		}
		console.log("Query run successfully...");
	});
}

/*****************************
 * INSERT or UPDATE query... *
 *****************************/
module.exports.modify = (query, params, callback) => {
	if (params == undefined || params == '' || params == null) params = [];

	this.db.run(query, params, (err) => {
		if (err) {
			callback(err.code);
			return console.error(err.message);
		}
		console.log("Data modified successfully...");
	});
}

/***********************
 * Fetching one row... *
 ***********************/
module.exports.get = (query, params, callback) => {
	if (params == undefined || params == '' || params == null) params = [];

	this.db.get(query, params, (err, row) => {
		if (err) {
			return console.error(err.message);
		}
		row ? callback(row) : callback(false);
	});
}

/*****************************************
 * Fetching questions list from database *
 *****************************************/
module.exports.all = (query, params, callback) => {
	if (params == undefined || params == '' || params == null) params = [];

	this.db.all(query, params, (err, rows) => {
		if (err) {
			return console.error(err.message);
		}
		rows ? callback(rows) : callback(false);
	})
}



/*****************************************
 * Saving data from database to csv file *
 *****************************************/
/*function saveQuery( database, file, schema ) {
	const db = new sqlite3.Database(database, sqlite3.OPEN_READONLY, (err) => {
		if (err) {
			return console.error(err.message);
		}

		console.log('Connected to the SQlite database.');
	});

	const sqlQuery = `SELECT * FROM ${ schema }`;
	db.all(sqlQuery, [], (err, rows) => {
		if (err) {
			return console.error(err.message);
		}

		const fields = ['q_id', 'choice', 'correct'];
		const opts = { fields };
		try {
			const parser = new Parser(opts)
			const csv = parser.parse(rows);

			fs.writeFile(file, csv, 'utf8', (err) => {
				if (err) {
					console.log(err);
				}
				console.log('csv saved...');
			});
		} catch(err) {
			console.error(err);
		}
	});

	db.close((err) => {
		if (err) {
			return console.error(err.message);
		}
		console.log('Close the database connection.');
	});
}*/
