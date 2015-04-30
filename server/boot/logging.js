module.exports = function (app) {
  var _ = require('lodash');
  var moment = require('moment');
  var path = require('path');
  var fs = require('fs-plus');
  var winston = require('winston');

  /**
   * Setup logger.
   */
  var logsPath = path.resolve('.tmp', 'logs', (+moment()).toString());
  fs.makeTreeSync(logsPath);

  var logger = new (winston.Logger)({
    exitOnError: false,
    transports: [
      new winston.transports.Console({ level: (app.get('env') === 'production' ? 'info' : 'debug'), colorize: true, handleExceptions: true }),
      new winston.transports.File({ level: 'silly', filename: path.resolve(logsPath, 'all-logs.log') })
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: path.resolve(logsPath, 'exceptions.log') })
    ]
  });

  /**
   * Extend console.
   */
  logger.extend(console);
  console.log = function () {
    if (_.has(logger.levels, arguments[0])) {
      logger.log.apply(logger, arguments);
    } else {
      logger.debug.apply(logger, arguments);
    }
  };
};
