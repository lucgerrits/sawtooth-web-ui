var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var config = require('./config.json');

console.log("Starting sawatooth-web-ui");

var libEvents = require('./lib/events')();



var indexRouter = require('./routes/index');
var configRouter = require('./routes/configuration');
var dataRouter = require('./routes/data');
var searchRouter = require('./routes/search');
var carRouter = require('./routes/cars');

var app = express();
app.use(function (req, res, next) {
  res.ejs_params = {};
  res.ejs_params.title = "Sawtooth Web UI";
  res.ejs_params.config = config;

  res.ejs_params.PrintJSON = function (data) {
    if (typeof data === 'object')
      return JSON.stringify(data);
    try {
      var tmp = JSON.parse(data);
      tmp = JSON.stringify(tmp, null, 4);
      return tmp;
    } catch (e) {
      return data;
    }
  }
  return next();
});
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/configuration', configRouter);
app.use('/data', dataRouter);
app.use('/search', searchRouter);
app.use('/car', carRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
