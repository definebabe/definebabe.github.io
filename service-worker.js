'use strict';

importScripts('/scripts/indexdbwrapper.js');

var YAHOO_WEATHER_API_ENDPOINT = 'https://raw.githubusercontent.com/definebabe/definebabe.github.io/master/json.json';
var KEY_VALUE_STORE_NAME = 'key-value-store';

var idb;

// avoid opening idb until first call
function getIdb() {
  if (!idb) {
    idb = new IndexDBWrapper('key-value-store', 1, function(db) {
      db.createObjectStore(KEY_VALUE_STORE_NAME);
    });
  }
  return idb;
}

self.addEventListener('push', function(event) {
  console.log('Received a push message', event);

  // Since this is no payload data with the first version
  // of Push notifications, here we'll grab some data from
  // an API and use it to populate a notification
  event.waitUntil(
    fetch(YAHOO_WEATHER_API_ENDPOINT).then(function(response) {
      if (response.status !== 200) {
        console.log('Looks like there was a problem. Status Code: ' +
          response.status);
        // Throw an error so the promise is rejected and catch() is executed
        throw new Error();
      }

      // Examine the text in the response
      return response.json().then(function(data) {
        // console.log('Data = ', JSON.stringify(data));
        if (data.query.count === 0) {
          // Throw an error so the promise is rejected and catch() is executed
          throw new Error();
        }

        var title = 'Hi from DefineBabe';
        var message = data.query.results.channel.item.condition.text;
        var icon = data.query.results.channel.image.url ||
          'images/touch/chrome-touch-icon-192x192.png';
        var notificationTag = 'simple-push-demo-notification';

        // Add this to the data of the notification
        var urlToOpen = data.query.results.channel.link;

        if (!Notification.prototype.hasOwnProperty('data')) {
          // Since Chrome doesn't support data at the moment
          // Store the URL in IndexDB
          getIdb().put(KEY_VALUE_STORE_NAME, notificationTag, urlToOpen);
        }

        var notificationFilter = {
          tag: 'simple-push-demo-notification'
        };

        if (self.registration.getNotifications) {
          return self.registration.getNotifications(notificationFilter)
            .then(function(notifications) {
              var notificationOptions = {
                body: message,
                icon: icon,
                tag: notificationTag,
                data: {
                  url: urlToOpen
                }
              };

              if (notifications && notifications.length > 0) {
                notificationOptions.body = 'You have ' + notifications.length +
                  ' weather updates.';
              }

              return self.registration.showNotification(title,
                notificationOptions);
            });
        } else {
          return self.registration.showNotification(title, {
            body: message,
            icon: icon,
            tag: notificationTag,
            data: {
              url: urlToOpen
            }
          });
        }
      });
    }).catch(function(err) {
      console.error('Unable to retrieve data', err);

      var title = 'An error occured';
      var message = 'We were unable to get the information for this ' +
        'push message';
      var icon = 'images/touch/chrome-touch-icon-192x192.png';
      var notificationTag = 'simple-push-demo-notification';

      return self.registration.showNotification(title, {
          body: message,
          icon: icon,
          tag: notificationTag
        });
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('On notification click: ', event);

  if (Notification.prototype.hasOwnProperty('data')) {
    console.log('Using Data');
    var url = event.notification.data.url;
    event.waitUntil(clients.openWindow(url));
  } else {
    event.waitUntil(getIdb().get(KEY_VALUE_STORE_NAME, event.notification.tag).then(function(url) {
      // At the moment you cannot open third party URL's, a simple trick
      // is to redirect to the desired URL from a URL on your domain
      var redirectUrl = '/redirect.html?redirect=' +
        url;
      return clients.openWindow(redirectUrl);
    }));
  }
});
