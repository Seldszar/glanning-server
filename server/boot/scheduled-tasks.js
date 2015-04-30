module.exports = function (app) {
  var schedule = require('node-schedule');
  var Q = require('q');

  app.once('started', function () {
    console.info('Execute all tasks once...');

    Q.fcall(app.models.Channel.discover)
      .then(app.models.Channel.updateSchedules)
      .then(app.models.Channel.updateStatuses)
      .fail(console.error)
      .then(function () {
        console.info('Scheduling prior tasks...');

        schedule.scheduleJob('0 0 * * *', function () {
          app.models.Channel.discover()
          .fail(console.error);
        });

        schedule.scheduleJob('0 * * * *', function () {
          app.models.Channel.updateSchedules()
          .fail(console.error);
        });

        schedule.scheduleJob('* * * * *', function () {
          app.models.Channel.updateStatuses()
          .fail(console.error);
        });
      });
  });
};
