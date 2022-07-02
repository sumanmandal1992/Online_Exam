### This project have been created using nodejs, javascript, css and html. Run this project as "node index.js", the server will be created.

# Requirments

* SQL Server: mariadb server
* Database:   sessiondb
* Tables:     session (sid, session, lastSeen), timer(regno, timeSec), loggedUser (sid, regno, loginStat), qlist (qid, questions, chA, chB, chC, chD, correct), std_info(id, name, dob, regno, course)
* node_modules:   cheerio, express-session-mariadb-store, express-session, express, mariadb, dotenv

# Demo data

* Registration No:    acc00000000000
* Date of Birth:      2021-01-01

# Candidate image location and name

Image Path: public/images/candidates
Image Name: acc00000000000.jpg / acc00000000000.png