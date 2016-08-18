'use strict';

angular.module('chatApp.chat.service', [])
    .constant('CHAT_EVENTS', {
        'ON_OPEN': 'ON_OPEN',
        'ON_CLOSE': 'ON_CLOSE',
        'ON_CLIENT_TIMEOUT': 'ON_CLIENT_TIMEOUT',
        'ON_REOPEN': 'ON_REOPEN',
        'ON_TRANSPORT_FAILURE': 'ON_TRANSPORT_FAILURE',
        'ON_MESSAGE': 'ON_MESSAGE',
        'ON_ERROR': 'ON_ERROR',
        'ON_RECONNECT': 'ON_RECONNECT'
    })
    .factory('ChatService', ['BACKEND_URL', 'AtmosphereService', 'EventService', 'CHAT_EVENTS', 'AUTH_EVENTS',
            function (backendUrl, atmosphereService, eventService, CHAT_EVENTS, AUTH_EVENTS) {
        var socket;

        var url = backendUrl.replace(/http\:|https\:/, "ws:");

        var request = {
            url: url + '/chat',
            contentType: 'application/json',
            logLevel: 'debug',
            transport: 'websocket',
            fallbackTransport: 'websocket',
            trackMessageLength: true,
            reconnectInterval: 5000,
            maxReconnectOnClose: 500,
            reconnectOnServerError: true,
            enableXDR: true,
            timeout: 0
        };

        request.onOpen = function (response) {
            eventService.fire(CHAT_EVENTS.ON_OPEN, {
                transport: response.transport
            });
        };

        request.onClose = function (response) {
            socket.push(atmosphere.util.stringifyJSON({
                author: 'currentUser',
                message: 'disconnecting'
            }));
            eventService.fire('ON_CLOSE');
        };

        request.onClientTimeout = function (response) {
            socket.push(atmosphere.util.stringifyJSON({
                author: 'currentUser',
                message: 'is inactive and closed the connection. Will reconnect in '
                + request.reconnectInterval
            }));
            setTimeout(function () {
                socket = atmosphereService.subscribe(request);
            }, request.reconnectInterval);

            eventService.fire(CHAT_EVENTS.ON_CLIENT_TIMEOUT, {
                reconnectInterval: request.reconnectInterval
            });
        };

        request.onReopen = function (response) {
            eventService.fire(CHAT_EVENTS.ON_REOPEN, {
                transport: response.transport
            });
        };

        request.onTransportFailure = function (errorMsg) {
            atmosphere.util.info(errorMsg);

            eventService.fire(CHAT_EVENTS.ON_TRANSPORT_FAILURE, {
                fallbackTransport: request.fallbackTransport
            });
        };

        request.onMessage = function (response) {
            var responseText = response.responseBody;
            try {
                var message = atmosphere.util.parseJSON(responseText);
                eventService.fire(CHAT_EVENTS.ON_MESSAGE, {
                    author: message.author,
                    time: message.time,
                    message: message.message
                });
            } catch (e) {
                console.error("Error parsing JSON: ", responseText);
                throw e;
            }
        };

        request.onError = function (response) {
            eventService.fire(CHAT_EVENTS.ON_ERROR);
        };

        request.onReconnect = function (request, response) {
            eventService.fire(CHAT_EVENTS.ON_RECONNECT, {
                reconnectInterval: request.reconnectInterval
            });
        };

        function onLogout() {
            atmosphereService.unsubscribe();
        }

        function onLogin() {
            socket = atmosphereService.subscribe(request);
        }

        socket = atmosphereService.subscribe(request);

        eventService.subscribe(AUTH_EVENTS.LOGGED_IN, onLogin);
        eventService.subscribe(AUTH_EVENTS.LOGGED_OUT, onLogout);

        return {
            sendMessage: function (message) {
                socket.push(atmosphere.util.stringifyJSON(message));
            }
        }
    }]);