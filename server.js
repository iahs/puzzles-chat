var express = require('express'),
    logger = require('morgan'),
    session = require('express-session'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    flash = require('connect-flash'),
    passport = require('passport'),
    dbConfig = require('./config/db');

    // We define the key of the cookie containing the Express SID
    var EXPRESS_SID_KEY = 'express.sid';

    // We define a secret string used to crypt the cookies sent by Express
    var COOKIE_SECRET = 'keyboard cat';
    var cookieParser = require('cookie-parser')(COOKIE_SECRET);

    // Create a new store in memory for the Express sessions
    var sessionStore = new session.MemoryStore();

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
app.use(cookieParser);
app.use(bodyParser());
app.use(session( { key: EXPRESS_SID_KEY, store: sessionStore } ));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.set('view engine', 'jade');
app.set('views', __dirname + '/app/views');
app.get('/', function (req, res) {
    res.render('index');
});
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
io.set('authorization', function (data, callback) {
    if(!data.headers.cookie) {
        return callback('No cookie transmitted.', false);
    }

    // We use the Express cookieParser created before to parse the cookie
    // Express cookieParser(req, res, next) is used initialy to parse data in "req.headers.cookie".
    // Here our cookies are stored in "data.headers.cookie", so we just pass "data" to the first argument of function
    cookieParser(data, {}, function(parseErr) {
        if(parseErr) { return callback('Error parsing cookies.', false); }

        // Get the SID cookie
        var sidCookie = (data.secureCookies && data.secureCookies[EXPRESS_SID_KEY]) ||
                        (data.signedCookies && data.signedCookies[EXPRESS_SID_KEY]) ||
                        (data.cookies && data.cookies[EXPRESS_SID_KEY]);

        // Then we just need to load the session from the Express Session Store
        sessionStore.load(sidCookie, function(err, session) {
            // And last, we check if the used has a valid session and if he is logged in
            if (err || !session || session.isLogged !== true) {
                callback('Not logged in.', false);
            } else {
                // If you want, you can attach the session to the handshake data, so you can use it again later
                // You can access it later with "socket.handshake.session"
                data.session = session;

                callback(null, true);
            }
        });
    });
});
