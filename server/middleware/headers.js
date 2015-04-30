var _ = require('lodash');

module.exports = function (options) {
  return function (req, res, next) {
    _.each(options, function (value, name) {
      if (_.isNull(value)) {
        res.removeHeader(name, value);
      } else {
        res.header(name, value);
      }
    });
    next();
  };
};
