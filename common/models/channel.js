module.exports = function (Channel) {
  var _ = require('lodash');
  var request = require('request');
  var cheerio = require('cheerio');
  var moment = require('moment');
  var Q = require('q');

  /**
   * Discover channels.
   *
   * @return Promise
   */
  Channel.discover = function () {
    console.log('verbose', 'Channels discovering...');

    return Q.all(_.map([
      'http://www.jeuxvideo.com/gaming-live/tv01.htm',
      'http://www.jeuxvideo.com/gaming-live/tv-casters.htm',
      'http://www.jeuxvideo.com/gaming-live/tv-competitions.htm'
    ], function (url) {
      return Q.Promise(function (resolve, reject, notify) {
        request(url, function (err, res, body) {
          if (err) return reject(err);

          var $ = cheerio.load(body);

          Q.all(_.map($('.chaines-glive a.a-lien-chaine, .webtv-cast > a'), function (element) {
            var $t = $(element);

            var name = $t.text().trim();
            var url = 'http://www.jeuxvideo.com' + $t.attr('href');
            var thumbnail = $t.children('img').attr('src') || null;

            var data = {
              name: name,
              url: url,
              thumbnail: thumbnail
            };

            return Q.Promise(function (resolve, reject, notify) {
              Channel.findOrCreate({ where: { url: data.url } }, data, function (err, channel) {
                if (err) return reject(err);

                if (channel.isNewRecord) {
                  console.log('debug', 'New channel discovered: %s', channel.name);
                }

                channel.updateSources().then(function () {
                  resolve(channel);
                }, reject, notify)
                .finally(function () {
                  _.each(['thumbnail'], function (field) {
                    if (!channel[field]) {
                      console.warn('Channel %s has no %s, please add these informations manually', channel.name, field);
                    }
                  });
                });
              });
            });
          }))
          .then(resolve, reject, notify);
        });
      });
    }));
  };

  /**
   * Update channels schedules.
   *
   * @return Promise
   */
  Channel.updateSchedules = function () {
    console.log('verbose', 'Updating channels schedules...');

    return Q.Promise(function (resolve, reject, notify) {
      Channel.find(function (err, channels) {
        if (err) return reject(err);

        Q.all(_.map(channels, function (channel) {
          return channel.updateSchedule();
        }))
        .then(resolve, reject, notify);
      });
    });
  };

  /**
   * Update channels statuses.
   *
   * @return Promise
   */
  Channel.updateStatuses = function () {
    console.log('verbose', 'Updating channels statuses...');

    return Q.Promise(function (resolve, reject, notify) {
      Channel.find(function (err, channels) {
        if (err) return reject(err);

        Q.all(_.map(channels, function (channel) {
          return channel.updateStatus();
        }))
        .then(resolve, reject, notify);
      });
    });
  };

  /**
   * Update channel sources.
   *
   * @return Promise
   */
  Channel.prototype.updateSources = function () {
    var that = this;

    console.log('debug', 'Updating %s channel sources...', this.name);

    return Q.Promise(function (resolve, reject, notify) {
      request(that.url, function (err, res, body) {
        if (err) return reject(err);

        var $ = cheerio.load(body);
        var $container = $('.content-live-chat');
        var $player = $container.find('.col-md-8');
        var $playerIframe = $player.find('iframe, object');
        var $chat = $container.find('.col-md-4');
        var $chatIframe = $chat.find('iframe');

        var videoUrl = $playerIframe.attr('src') || $playerIframe.attr('data') || null;
        var chatUrl = $chatIframe.attr('src') || null;

        var source = /(twitch|dailymotion)\.(?:com|tv)\/(?:widgets\/live_embed_player\.swf\?channel=|(?:embed\/)?video\/)?([a-z0-9-_]+)/i.exec(videoUrl);
        var sourceName = (source ? source[1] : null);
        var sourceValue = (source ? source[2] : null);

        switch (sourceName) {
          case 'twitch':
            videoUrl = 'http://www.twitch.tv/' + sourceValue.toLowerCase() + '/popout';
            chatUrl = 'http://www.twitch.tv/' + sourceValue.toLowerCase() + '/chat';
            break;
        }

        var data = {
          name: sourceName,
          value: sourceValue,
          videoUrl: videoUrl,
          chatUrl: chatUrl
        };

        that.sources({ where: { name: data.name, value: data.value } }, function (err, sources) {
          if (err) return reject(err);

          if (_.isEmpty(sources)) {
            that.sources.create(data, function (err, source) {
              if (err) {
                console.warn('Unable to add a source to channel %s: %s', that.name, err.message);
              }
            });
          }

          resolve();
        });
      });
    });
  };

  /**
   * Update channel schedule.
   *
   * @return Promise
   */
  Channel.prototype.updateSchedule = function () {
    var that = this;

    console.log('debug', 'Updating %s channel schedule...', this.name);

    return Q.Promise(function (resolve, reject, notify) {
      request(that.url, function (err, res, body) {
        if (err) return reject(err);

        var $ = cheerio.load(body);

        Q.all(_.map($('.programme-journee-live .header-programme-live'), function (schedule) {
          var $s = $(schedule);
          var text = $s.text().trim();
          var result = /Le (.*?) sur (?:gaming live )?(.*)/i.exec(text);

          if (!result) {
            return reject(new Error('Unable to parse event date'));
          }

          return Q.all(_.map($s.next('ul.wrap-programme-live').find('li'), function (event) {
            return Q.Promise(function (resolve, reject, notify) {
              var $e = $(event);
              var periodStr = $('.horaire', $e).text().trim();
              var period = /([0-9]{2}:[0-9]{2}) - ([0-9]{2}:[0-9]{2})/.exec(periodStr);

              if (!period) {
                return reject(new Error('Unable to parse event period'));
              }

              var eventName = $('.lib-programme', $e).text().trim();
              var eventStart = moment(result[1] + ' ' + period[1], 'DD MMM YYYY HH:mm', 'fr');
              var eventEnd = moment(result[1] + ' ' + period[2], 'DD MMM YYYY HH:mm', 'fr');

              if (eventStart.isAfter(eventEnd)) {
                eventEnd.add(1, 'days');
              }

              var data = {
                name: eventName,
                start: eventStart.toDate(),
                end: eventEnd.toDate()
              };

              that.schedule({
                where: {
                  or: [
                    { start: { between: [eventStart.toDate(), moment(eventEnd).subtract(1, 'milliseconds').toDate()] } },
                    { end: { between: [moment(eventStart).add(1, 'milliseconds').toDate(), eventEnd.toDate()] } }
                  ]
                }
              }, function (err, events) {
                if (err) return reject(err);

                var matchedEvent = _.find(events, { name: data.name, start: data.start, end: data.end });

                _.each(_.reject(events, 'id', _.get(matchedEvent, 'id')), function (event) {
                  event.updateAttribute('deletedAt', new Date(), function (err, event) {});
                });

                if (matchedEvent) {
                  return resolve(matchedEvent);
                }

                that.schedule.create(data, function (err, event) {
                  if (err) return reject(err);

                  resolve(event);
                });
              });
            });
          }));
        }))
        .finally(resolve);
      });
    });
  };

  /**
   * Update channel status.
   *
   * @return Promise
   */
  Channel.prototype.updateStatus = function () {
    var that = this;

    console.log('debug', 'Updating %s channel status...', this.name);

    return Q.Promise(function (resolve, reject, notify) {
      that.sources({ order: 'priority ASC' }, function (err, sources) {
        if (_.isEmpty(sources)) {
          return reject(new Error('Channel ' + that.name + ' has missing sources'));
        }

        _.map(sources, function (source) {
          return function (data) {
            return Q.Promise(function (resolve, reject, notify) {
              if (data.online) {
                return resolve(data);
              }

              var dataSource = Channel.app.dataSources[source.name];

              if (!dataSource) {
                return reject(new Error('Source ' + source.name + ' not exists'));
              }

              dataSource.status(source.value, function (err, res) {
                if (err) return reject(err);

                switch (source.name) {
                  case 'twitch':
                    data.online = !!res.stream;
                    data.viewers = (res.stream ? res.stream.viewers : 0);
                    break;
                  case 'dailymotion':
                    data.online = res.onair || false;
                    data.viewers = res.audience || 0;
                    break;
                }

                if (data.online) {
                  data.source = source;
                }

                resolve(data);
              });
            });
          };
        })
        .reduce(Q.when, Q({
          online: false,
          viewers: 0
        }))
        .then(function (data) {
          that.schedule({ where: { start: { lt: new Date() }, end: { gt: new Date() } } }, function (err, events) {
            if (err) return reject(err);

            var event = events[0];
            var eventId = (event ? event.id : undefined);

            data.event = event;

            that.status(function (err, status) {
              if (err) return reject(err);

              if (status && status.online === data.online && status.viewers === data.viewers && status.eventId === eventId) {
                status.save(function (err, status) {
                  if (err) return reject(err);

                  resolve(status);
                });
              } else {
                that.statuses.create(data, function (err, status) {
                  if (err) return reject(err);

                  that.status(status);

                  that.save(function (err, channel) {
                    if (err) return reject(err);

                    resolve(status);
                  });
                });
              }
            });
          }, reject, notify);
        });
      });
    });
  };

  /**
   * Disable remote methods
   */
  _.each(['create', 'upsert', 'exists', 'findOne', 'updateAll', 'deleteById', 'count'], function (property) {
    Channel.disableRemoteMethod(property, true);
  });
  Channel.disableRemoteMethod('updateAttributes');

  var disableRemoteRelationMethods = function (relation, methods) {
    methods.forEach(function (method) {
      Channel.disableRemoteMethod('__' + method + '__' + relation);
    });
  };

  _.each(['schedule', 'statuses', 'sources'], function (relation) {
    disableRemoteRelationMethods(relation, ['count', 'create', 'delete', 'destroyById', 'findById', 'updateById']);
  });
};
