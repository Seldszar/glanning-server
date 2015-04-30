function softDelete(Model, options) {
  'use strict';

  var deletedAt = options.deletedAt || 'deletedAt';

  Model.defineProperty(deletedAt, { type: Date });

  Model.observe('access', function event (ctx, next) {
    ctx.query.where[deletedAt] = undefined;
    next();
  });
}

module.exports = function mixin(app) {
  app.loopback.modelBuilder.mixins.define('SoftDelete', softDelete);
};
