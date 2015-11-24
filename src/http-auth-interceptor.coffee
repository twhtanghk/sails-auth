###
$http interceptor.
On 401 response (without 'ignoreAuthModule' option) stores the request
and broadcasts 'event:auth-loginRequired'.
On 403 response (without 'ignoreAuthModule' option) discards the request
and broadcasts 'event:auth-forbidden'.
###
authInterceptor = ($injector, $rootScope, $q, httpBuffer, transport) ->
	$transport = null
			
	responseError: (rejection) ->
		$transport = $transport || $injector.get(transport)
		if !rejection.config.ignoreAuthModule
			switch rejection.status
				when 401
					deferred = $q.defer()
					rejection.config.transport = $transport
					httpBuffer.append(rejection.config, deferred)
					$rootScope.$broadcast('event:auth-loginRequired', rejection)
					return deferred.promise
				when 403
					$rootScope.$broadcast('event:auth-forbidden', rejection)
					
		# otherwise, default behaviour
		return $q.reject(rejection)
     
angular.module 'http-auth-interceptor', ['http-auth-interceptor-buffer', 'sails.io']
	
	.factory 'authService', ($rootScope, httpBuffer) ->
		###
		Call this function to indicate that authentication was successfull and trigger a
		retry of all deferred requests.
		@param data an optional argument to pass on to $broadcast which may be useful for
		example if you need to pass through details of the user that was logged in
		@param configUpdater an optional transformation function that can modify the                                                                                                                                                   
		requests that are retried after having logged in.  This can be used for example
		to add an authentication token.  It must return the request.
		###
		loginConfirmed: (data, configUpdater) ->
			updater = configUpdater || (config) -> return config
			$rootScope.$broadcast('event:auth-loginConfirmed', data)
			httpBuffer.retryAll(updater)
		  
		###
		Call this function to indicate that authentication should not proceed.
		All deferred requests will be abandoned or rejected (if reason is provided).
		@param data an optional argument to pass on to $broadcast.
		@param reason if provided, the requests are rejected; abandoned otherwise.
		###
		loginCancelled: (data, reason) ->
			httpBuffer.rejectAll(reason)
			$rootScope.$broadcast('event:auth-loginCancelled', data)
		
	.config ($httpProvider) ->
		interceptor = ($injector, $rootScope, $q, httpBuffer) ->
			authInterceptor($injector, $rootScope, $q, httpBuffer, '$http')
		$httpProvider?.interceptors.push ['$injector', '$rootScope', '$q', 'httpBuffer', interceptor] 
	

	.config ($sailsSocketProvider) ->
		interceptor = ($injector, $rootScope, $q, httpBuffer) ->
			authInterceptor($injector, $rootScope, $q, httpBuffer, '$sailsSocket')
		$sailsSocketProvider?.interceptors.push ['$injector', '$rootScope', '$q', 'httpBuffer', interceptor]
	
	# define sails socket backend setting and initialize the backend
	.config ($provide) ->
		$provide.decorator '$sailsSocketBackend', ($delegate, $injector, $log) ->
			backend = null
			newBackend = ->
				backend ?= new Promise (fulfill, reject) ->
					socket = io.sails.connect()
					socket.on 'connect', ->
						fulfill(socket)
					socket.on 'connect_error', ->
						reject()
					socket.on 'connect_timeout', ->
						reject()
			
			# power saving or reduce network traffic		
			document.addEventListener 'pause', ->
				io.socket?._raw.disconnect()
				
			document.addEventListener 'resume', ->
				io.socket?._raw.connect()
			
			(method, url, post, callback, headers, timeout, withCredentials, responseType) ->
				newBackend()
					.then (socket) ->
						io.socket = socket
						opts = 
							method: 	method.toLowerCase()
							url: 		url
							data:		if typeof post == 'string' then JSON.parse(post) else post
							headers:	headers
						io.socket.request opts, (body, jwr) ->
							callback jwr.statusCode, body
					.catch $log.error

# Private module, a utility, required internally by 'http-auth-interceptor'.
angular.module 'http-auth-interceptor-buffer', []

	.factory 'httpBuffer', ->
		buffer = []
		
		retryHttpRequest = (config, deferred) ->
			config.transport(config)
				.then (response) ->
					deferred.resolve(response)
				.catch (response) ->
					deferred.reject(response)
	
		# Appends HTTP request configuration object with deferred response attached to buffer.
		append: (config, deferred) ->
			buffer.push
				config: config
				deferred: deferred
	        
		# Abandon or reject (if reason provided) all the buffered requests.
		rejectAll: (reason) ->
			if reason
				for req in buffer 
					req.deferred.reject(reason)
			buffer = []
	      
		# Retries all the buffered requests clears the buffer.
		retryAll: (updater) ->
			for req in buffer
				retryHttpRequest(updater(req.config), req.deferred)
			buffer = []