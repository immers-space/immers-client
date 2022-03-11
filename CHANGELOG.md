2.1.0

* Fix script query params not working with one-liner
* Deprecated `connect` & `reconnect` methods that combined login and presence
* New `login`/`restoreSession` methods to connect to immers account
* New `enter`/`exit` methods to update presence status to online at your immer or offline
* New `move` method to change the current online location
* New type: `Message`
* New `ImmersClient` event: `immers-client-new-message` when a message is received in inbox while connected
* New method `feed` to fetch past inbox & outbox activity
* All message content is now purified with DOMPurify
* New method `sendChatMessage` to publish a text/HTML content post
