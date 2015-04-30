module.exports = function(Notification) {
  var _ = require('lodash');

  /**
   * Disable remote methods
   */
  _.each(['upsert', 'exists', 'findOne', 'findById', 'updateAll', 'count'], function (property) {
    Notification.disableRemoteMethod(property, true);
  });
  Notification.disableRemoteMethod('updateAttributes');
};
