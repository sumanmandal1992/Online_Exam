# Introduction
### This is a personal project for learning and testing. This project have been created using nodejs, javascript, css and html. Run this project as "node index.js", the server will be created. You have to have nodejs and mariadb installed in your machine.

# Requirments

* SQL Server: mariadb server
* Database:   sessiondb
* Tables:     session (sid, session, lastSeen), timer(regno, timeSec), loggedUser (sid, regno, loginStat), qlist (qid, questions, chA, chB, chC, chD, correct), std_info(id, name, dob, regno, course)
* node_modules:   cheerio, express-session-mariadb-store, express-session, express, mariadb, dotenv
* Note: Create a '.env' file and store your database information. Such as 'MDB_HOST = host_name, MDB_USER = database_user_name, MDB_PASS = database_password'

# Demo data

* Registration No:    acc00000000000
* Date of Birth:      2021-01-01

# Candidate image location and name

Image Path: public/images/candidates
Image Name: acc00000000000.jpg / acc00000000000.png