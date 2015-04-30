module.exports = function (Status) {
  var _ = require('lodash');

  Status.online = function (cb) {
    Status.app.models.Channel.find({}, function (err, channels) {
      if (err) cb(err, null);

      var statuses = [];

      _.each(channels, function (channel) {
        var status = channel.status();

        if (status && status.online) {
          statuses.push(status);
        }
      });

      cb(null, statuses);
    });
  };

  Status.remoteMethod('online', {});

  /**
   * Disable remote methods
   */
  _.each(['find', 'upsert', 'exists', 'findOne', 'findById', 'updateAll', 'count'], function (property) {
    Status.disableRemoteMethod(property, true);
  });

  var disableRemoteRelationMethods = function (relation, methods) {
    methods.forEach(function (method) {
      Status.disableRemoteMethod('__' + method + '__' + relation);
    });
  };

  _.each(['channel', 'event', 'source'], function (relation) {
    disableRemoteRelationMethods(relation, ['get']);
  });

};
