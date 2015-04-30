module.exports = function(Source) {
  var _ = require('lodash');

  /**
   * Disable remote methods
   */
  _.each(['upsert', 'exists', 'findOne', 'findById', 'updateAll', 'count'], function (property) {
    Source.disableRemoteMethod(property, true);
  });

  var disableRemoteRelationMethods = function (relation, methods) {
    methods.forEach(function (method) {
      Source.disableRemoteMethod('__' + method + '__' + relation);
    });
  };

  _.each(['events'], function (relation) {
    disableRemoteRelationMethods(relation, ['get', 'count', 'create', 'delete', 'destroyById', 'findById', 'updateById']);
  });
  disableRemoteRelationMethods('channel', ['get']);
};
