var express = require('express'),
    logger = require('morgan'),
    connect = require('connect'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    mongoose = require('mongoose'),
    flash = require('connect-flash'),
    session = require('express-session'),
    passport = require('passport'),
    passportSocketIo = require("passport.socketio"),
    dbConfig = require('./config/db');

    var EXPRESS_SID_KEY = 'express.sid';
    var COOKIE_SECRET = 'keyboard cat';

    // Create a new store in mongo for the Express sessions
    var MongoStore = require('connect-mongo-store')(connect);
    var mongoStore = new MongoStore(dbConfig.url);

/**************************
 * Database
 * Load and initialize sockets
 **************************/
mongoose.connect(dbConfig.url);

/**************************
 * App initialization
 * Load and initialize sockets
 **************************/
var app = express(),
    server = app.listen(3000),
    io = require('socket.io').listen(server);

/**************************
 * Middleware handlers
 * Load and initialize sockets
 **************************/
// app.use(logger());
app.use(cookieParser(COOKIE_SECRET));
app.use(bodyParser());
app.use(session( { store: mongoStore, secret: COOKIE_SECRET, key: EXPRESS_SID_KEY } ));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.set('view engine', 'jade');
app.set('views', __dirname + '/app/views');
app.use(express.static(__dirname + '/public'));

/**************************
 * Passport configuration
 * Set up users and authentication strategies
 **************************/
require('./config/passport')(passport);

/**************************
 * Sockets
 * Load and initialize sockets
 **************************/
require('./app/sockets.js')(io);

/**************************
 * Routes
 * Load and initialize routes
 **************************/
require('./app/routes.js')(app, passport);
require('./app/adminroutes.js')(app);

/***************************
 * Socket authentication
 ***************************/

 io.set('authorization', passportSocketIo.authorize({
  cookieParser: cookieParser,
  key:         EXPRESS_SID_KEY,
  secret:      COOKIE_SECRET,
  store:       mongoStore
}));
