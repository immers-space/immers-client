Unreleased changes

* New lookup and fetch utilities in `ImmersClient`
  * `corsProxyFetch` - fetch wrapper to help with cross-origin resources. If using a local immer, its proxy service will be used. If no  local immer but user is logged in, their home immer proxy service will be used. If neither is available, a normal fetch is attempted
  * `resolveProfileIRI` - Lookup a user's profile ID / resource URL from their immers handle using webfinger
  * `getProfile` - Resolve an immers handle to a Profile object. If user is logged in, will use their homer immer's ActivityPub standard proxy-and-cache service. If not, fallback to `corsProxyFetch`
  * `getNodeInfo` - Discover features and compatibility info about a user's home immer via [nodeinfo](https://github.com/jhass/nodeinfo)

Note that proxy services will only succeed with immers servers versions >=2.1.0

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
