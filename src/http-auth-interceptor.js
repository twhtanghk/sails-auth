// Generated by CoffeeScript 1.8.0
(function() {
  var $httpProvider, $sailsSocketProvider, authInterceptor, authService, httpBuffer;

  authService = function($rootScope, httpBuffer) {
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
  };


  /*
  $http interceptor.
  On 401 response (without 'ignoreAuthModule' option) stores the request
  and broadcasts 'event:auth-loginRequired'.
  On 403 response (without 'ignoreAuthModule' option) discards the request
  and broadcasts 'event:auth-forbidden'.
   */

  authInterceptor = function($injector, $rootScope, $q, httpBuffer, transport) {
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
          }
        }
        return $q.reject(rejection);
      }
    };
  };

  $httpProvider = function(provider) {
    var interceptor;
    interceptor = function($injector, $rootScope, $q, httpBuffer) {
      return authInterceptor($injector, $rootScope, $q, httpBuffer, '$http');
    };
    return provider != null ? provider.interceptors.push(['$injector', '$rootScope', '$q', 'httpBuffer', interceptor]) : void 0;
  };

  $sailsSocketProvider = function(provider) {
    var interceptor;
    interceptor = function($injector, $rootScope, $q, httpBuffer) {
      return authInterceptor($injector, $rootScope, $q, httpBuffer, '$sailsSocket');
    };
    return provider != null ? provider.interceptors.push(['$injector', '$rootScope', '$q', 'httpBuffer', interceptor]) : void 0;
  };

  angular.module('http-auth-interceptor', ['http-auth-interceptor-buffer', 'sails.io']).factory('authService', ['$rootScope', 'httpBuffer', authService]).config(['$httpProvider', $httpProvider]).config(['$sailsSocketProvider', $sailsSocketProvider]);

  httpBuffer = function() {
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
        var req, _i, _len;
        if (reason) {
          for (_i = 0, _len = buffer.length; _i < _len; _i++) {
            req = buffer[_i];
            req.deferred.reject(reason);
          }
        }
        return buffer = [];
      },
      retryAll: function(updater) {
        var req, _i, _len;
        for (_i = 0, _len = buffer.length; _i < _len; _i++) {
          req = buffer[_i];
          retryHttpRequest(updater(req.config), req.deferred);
        }
        return buffer = [];
      }
    };
  };

  angular.module('http-auth-interceptor-buffer', []).factory('httpBuffer', httpBuffer);

}).call(this);
