module.exports = function (Event) {
  var moment = require('moment');
  var _ = require('lodash');

  Event.observe('access', function (ctx, next) {
    if (ctx.query.today) {
      var start = moment().startOf('day');
      var end = moment().endOf('day');

      _.assign(ctx.query.where, {
        or: [
          { start: { between: [start.toDate(), end.toDate()] } },
          { end: { between: [start.add(1, 'milliseconds').toDate(), end.add(1, 'milliseconds').toDate()] } }
        ]
      });
    }

    next();
  });

};
