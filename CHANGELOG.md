## v2.12.0 (2022-10-24)

### Added

* `ImmersClient.login` gains an optional `registration` argument to redirect users directly to the registration tab when opening the login popup.
* new `ImmersClient.authorizedScopes` getter to access the scopes authorized for the current login session

### Changed

* The OAuth popup size is now 800x800 to avoid mobile syling and is positioned to appear slightly outside the opening window's border in order to avoid [BITB attacks](https://usa.kaspersky.com/blog/browser-in-the-browser-attack/26399/)

## v2.11.0 (2022-10-20)

### Added

* `Immersclient.navigateToImmersLink` - navigate to a given URL while passing along the user's handle so they don't have to re-enter it at the next destination
* `ImmersClient.handleImmersLinkClick` - onClick handler to make navigating between immers easier by passing along the user's handle

## v2.10.0 (2022-10-05)

### Added

* `ImmersClient.removeAvatar` - new high-level api to remove models from user's Avatar collection
* `Activities.remove` - new low-level api to remove activities

### Fixed

* `Activities.add` - fixed target URL logic

## v2.9.0 (2022-10-05)

### Added

* `ImmersClient.sendImage` and `ImmersClient.sendVideo` - new high level apis to upload and share media

### Changed

* `Activities.image` and `Activities.video` now accept Blob/File and upload them with postMedia in addition to urls

## v2.8.2 (2022-09-28)

### Fixed
* `ImmersClient.login` was failing to send clientId, causing full immers to be treated like destinations with limited permissions

## v2.8.1 (2022-09-21)

### Changed
* Added `destination-image` and `destination-description` attributes for `<immers-hud>` to improve destination metadata
* Improved default values for `<immers-hud>` attributes, including pulling destination description and image from `og` meta tags, if available
* Filled out and documented the formerly non-functional `Activities.create` low-level api method. Useful if your application implements custom object types

### Fixed
* `<immers-hud>` now works when using `local-immer`

## v2.8.0 (2022-08-26)

### Added

* New event `immers-client-profile-update` fires whenever logged-in user's profile
has changed
* New method `immersClient.waitUntilConnected`, utility to simplify timing checks when a logged-in user is required (contributed by @wswoodruff)
* New static method `ImmersClient.DestinationFromPlace` to transform ActivityPub Place to Destination type

### Changed

* Added `bio` and `avatarObject` to `Profile`
* Added `inbox` and `outbox` to `Profile.collections`
* Added `destination` to `FriendStatus`
* `URLFromProperty` can also find `href` prop if given a `Link` object
* `Activities.getObject` can accept URL object in addition to string
* Destination urls ending with an empty fragment will have the trailing `#` dropped to more accutately aggregate Destinations history

### Fixed

* Restore summary messages in arrive/leave activities
* Fix local immer place object not updating
* Fix error in Profile type, url for avatar 3d Model is in prop `avatarModel` not `avatarGltf`

## v2.7.1 (2022-08-04)

### Fixed

* Type Error when loading client on destination-only sites

## v2.7.0 (2022-08-04)

## Changed

* Improved destination metadata
  * Separate identity for a specific page/room from the identity of the experience/application
  * Support optional previewImage and description props on Destinations
  * destination.context links it to its immer (i.e. `/o/immer` Place object)
  * Standardize destination link formats in status updates and include immer name
* Improved type linking in docs and type inference in IDEs for low-level types in Activities

## v2.6.0 (2022-06-24)

## Added

* `ImmersClient.blockUser` for adding to user's block list
* `ImmersClient.unblockUser` for removing from user's block list\*
* New event `'immers-client-blocked-update'` when a user's block list has changed\*
* `ImmersClient.blockList` to fetch user's current block list

\* requires Immers Server version 3.1.0

### Fixed

* Fixed incorrect error message when an activity fails to post to outbox

## v2.5.0 (2022-05-11)

### Changed

* `ImmersClient.friendsList` sort updated to list online friends first
* `ImmersClient.enter` now takes an optional destination argument that will update the current location before going online

### Fixed

* Fix memory leak in oauth popup that could cause page to crash if left open
* OAuth client ID was incorrect when using with local immer
* FriendStatus.isOnline is now `true` when friend is online

## v2.4.0 (2022-04-23)
### Friend management

New high-level apis to add & remove friends

* New `ImmersClient.addFriend` - Send a friend request or accept one in order to create a relationship and start sharing location
* New `ImmersClient.removeFriend` - Cancel a previous relationship or request
* Updated `ImmersClient.friendsList` - exclude ex-friends
* Updated `FriendStatus` structure - include `status` enum (friend-online, friend-offline, request-receved, request-sent, none) and user `profile`
* Updated `ImmersClient` event `'immers-client-friends-update'` - also fires when an outgoing activity (e.g. friend request/accept) causes the statuses to update\*
* Fixed destination object for local immer not fetched correctly

### Avatar utilities

New high-level apis for creating, saving, sharing, and using avatars.

* New `ImmersClient.createAvatar` - uploads a 3D avatar and thumbnail and Creates a Model object for it\*
* New `ImmersClient.addAvatar` - add an avatar to a user's portable avatar collection
* new `ImmersClient.useAvatar` - change a users current avatar
* Updated `ImmersClient.Profile` structure - include listing of user collections

### Low-level apis

* New `Activities.postMedia` - upload and share media files via ActivityPub Media Upload\*
* New `Activities.model` - upload a 3D model with `postMedia`\*
* New `Activities.undo` - revert a past activity, such as a Follow or Accept
* Updated `Activities.add` - clarify inputs and allow creation of new collections
* New `ImmersSocket` event `'immers-socket-outbox-update'` - when th current user has posted something new, either from current client or another\*
* Fixed the auto leave-on-disconnect activity to have the same summary format as `ImmersClient.exit` activity

\*  requires user's home Immers server version (TBD sorry this feature is still in development), otherwise error 'Missing/invalid upload media endpoint' will be thrown.

## v2.3.0

* New method `ImmersClient.loginWithToken` - allow login without user interaction if credentials acquired through another means (for controlled accounts feature coming soon in immers server)
* When a local immer is available, `ImmersClient.activities` will now be available immediately upon contstruction to allow interactions with local immer that don't require authentication (e.g. `Activities.getObject` for local, public objects). `ImmersClient.activities` will be replaced with a new instance connected to the user's account upon login
* Be more flexible with how immer domains are specified - accepts domain (host) or origin and transforms as needed
* Fix issue with `enter`/`move` location updates not using most recent Destination

## v2.2.2

* Ensure that the correct Leave activity is posted on disconnect after using `ImmersClient.move` or `ImmersClient.exit`

## v2.2.1

* Fix missing return value in deprecated `ImmersClient.connect` method

## v2.2.0

* New lookup and fetch utilities in `ImmersClient`
  * `corsProxyFetch` - fetch wrapper to help with cross-origin resources. If using a local immer, its proxy service will be used. If no  local immer but user is logged in, their home immer proxy service will be used. If neither is available, a normal fetch is attempted
  * `resolveProfileIRI` - Lookup a user's profile ID / resource URL from their immers handle using webfinger
  * `getProfile` - Resolve an immers handle to a Profile object. If user is logged in, will use their homer immer's ActivityPub standard proxy-and-cache service. If not, fallback to `corsProxyFetch`
  * `getNodeInfo` - Discover features and compatibility info about a user's home immer via [nodeinfo](https://github.com/jhass/nodeinfo)

Note that proxy services will only succeed with immers servers versions >=2.1.0

## v2.1.0

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
