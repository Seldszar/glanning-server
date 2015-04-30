require('dotenv').load();

var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();

require('loopback-ds-timestamp-mixin')(app);
require('./mixins/soft-delete')(app);

app.start = function() {
  // start the web server
  return app.listen(function() {
    console.info('Web server listening at: %s', app.get('url'));
    app.emit('started');
  });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
