// Generated by CoffeeScript 1.10.0
(function() {
  var authInterceptor;

  require('angularSails');


  /*
  $http interceptor.
  On 401 response (without 'ignoreAuthModule' option) stores the request
  and broadcasts 'event:auth-loginRequired'.
  On 403 response (without 'ignoreAuthModule' option) discards the request
  and broadcasts 'event:auth-forbidden'.
   */

  authInterceptor = function($injector, $rootScope, $log, $q, httpBuffer, transport) {
    var $transport;
    $transport = null;
    return {
      responseError: function(rejection) {
        var deferred;
        $transport = $transport || $injector.get(transport);
        if (!rejection.config.ignoreAuthModule) {
          switch (rejection.status) {
            case 401:
              deferred = $q.defer();
              rejection.config.transport = $transport;
              httpBuffer.append(rejection.config, deferred);
              $rootScope.$broadcast('event:auth-loginRequired', rejection);
              return deferred.promise;
            case 403:
              $rootScope.$broadcast('event:auth-forbidden', rejection);
              break;
            default:
              $log.error(rejection);
          }
        }
        return $q.reject(rejection);
      }
    };
  };

  angular.module('http-auth-interceptor', ['http-auth-interceptor-buffer', 'sails.io']).factory('authService', function($rootScope, httpBuffer) {
    return {

      /*
      		Call this function to indicate that authentication was successfull and trigger a
      		retry of all deferred requests.
      		@param data an optional argument to pass on to $broadcast which may be useful for
      		example if you need to pass through details of the user that was logged in
      		@param configUpdater an optional transformation function that can modify the
      		requests that are retried after having logged in.  This can be used for example
      		to add an authentication token.  It must return the request.
       */
      loginConfirmed: function(data, configUpdater) {
        var updater;
        updater = configUpdater || function(config) {
          return config;
        };
        $rootScope.$broadcast('event:auth-loginConfirmed', data);
        return httpBuffer.retryAll(updater);
      },

      /*
      		Call this function to indicate that authentication should not proceed.
      		All deferred requests will be abandoned or rejected (if reason is provided).
      		@param data an optional argument to pass on to $broadcast.
      		@param reason if provided, the requests are rejected; abandoned otherwise.
       */
      loginCancelled: function(data, reason) {
        httpBuffer.rejectAll(reason);
        return $rootScope.$broadcast('event:auth-loginCancelled', data);
      }
    };
  }).config(function($httpProvider) {
    var interceptor;
    interceptor = function($injector, $rootScope, $log, $q, httpBuffer) {
      return authInterceptor($injector, $rootScope, $log, $q, httpBuffer, '$http');
    };
    return $httpProvider != null ? $httpProvider.interceptors.push(['$injector', '$rootScope', '$log', '$q', 'httpBuffer', interceptor]) : void 0;
  }).config(function($sailsSocketProvider) {
    var interceptor;
    interceptor = function($injector, $rootScope, $log, $q, httpBuffer) {
      return authInterceptor($injector, $rootScope, $log, $q, httpBuffer, '$sailsSocket');
    };
    return $sailsSocketProvider != null ? $sailsSocketProvider.interceptors.push(['$injector', '$rootScope', '$log', '$q', 'httpBuffer', interceptor]) : void 0;
  }).config(function($provide) {
    return $provide.decorator('$sailsSocketBackend', function($delegate, $injector, $log) {
      var backend, newBackend;
      backend = null;
      newBackend = function() {
        return backend != null ? backend : backend = new Promise(function(fulfill, reject) {
          var socket;
          socket = io.sails.connect();
          return socket.on('connect', function() {
            socket.on('reconnecting', function() {
              return $log.error("Data connection not available");
            });
            return fulfill(socket);
          });
        });
      };
      document.addEventListener('pause', function() {
        var ref;
        return (ref = io.socket) != null ? ref._raw.disconnect() : void 0;
      });
      document.addEventListener('resume', function() {
        var ref;
        return (ref = io.socket) != null ? ref._raw.connect() : void 0;
      });
      return function(method, url, post, callback, headers, timeout, withCredentials, responseType) {
        return newBackend().then(function(socket) {
          var opts;
          io.socket = socket;
          opts = {
            method: method.toLowerCase(),
            url: url,
            data: typeof post === 'string' ? JSON.parse(post) : post,
            headers: headers
          };
          return io.socket.request(opts, function(body, jwr) {
            return callback(jwr.statusCode, body);
          });
        });
      };
    });
  });

  angular.module('http-auth-interceptor-buffer', []).factory('httpBuffer', function() {
    var buffer, retryHttpRequest;
    buffer = [];
    retryHttpRequest = function(config, deferred) {
      return config.transport(config).then(function(response) {
        return deferred.resolve(response);
      })["catch"](function(response) {
        return deferred.reject(response);
      });
    };
    return {
      append: function(config, deferred) {
        return buffer.push({
          config: config,
          deferred: deferred
        });
      },
      rejectAll: function(reason) {
        var i, len, req;
        if (reason) {
          for (i = 0, len = buffer.length; i < len; i++) {
            req = buffer[i];
            req.deferred.reject(reason);
          }
        }
        return buffer = [];
      },
      retryAll: function(updater) {
        var i, len, req;
        for (i = 0, len = buffer.length; i < len; i++) {
          req = buffer[i];
          retryHttpRequest(updater(req.config), req.deferred);
        }
        return buffer = [];
      }
    };
  });

}).call(this);
