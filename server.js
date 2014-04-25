var express = require('express'),
    logger = require('morgan'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    flash = require('connect-flash'),
    passport = require('passport'),
    dbConfig = require('./config/db'),
    cookieParser = require('cookie-parser'),
    session = require('express-session')
    ;

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
app.use(cookieParser());
app.use(bodyParser());
app.use(session( { secret: "keyboard cat" } ));
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
