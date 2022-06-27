This project have been created using nodejs, javascript, css and html.
Run this project as "node index.js", the server will be created.

*************************
* Requirments           *
*************************
SQL Server: mariadb server
Database:   sessiondb
Tables:     session (sid, session, lastSeen), timer(regno, timeSec, loginStat), logged_user (sid, regno), qlist (qid, questions, chA, chB, chC, chD, correct), studInfo(id, name, dob, regno, course)
node_modules:   cheerio, express-session-mariadb-store, express-session, express, mariadb
