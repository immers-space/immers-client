import DOMPurify from 'dompurify'
import { Activities } from './activities.js'
import { ImmerOAuthPopup, DestinationOAuthPopup, tokenToActor, SCOPES, preprocessScopes } from './authUtils.js'
import { desc, getURLPart, htmlAnchorForPlace, parseHandle } from './utils.js'
import { ImmersSocket } from './streaming.js'
import { clearStore, createStore } from './store.js'

/**
 * @typedef {object} Destination
 * @property {string} name Title of the destination
 * @property {string} url link to visit the destination
 * @property {string} [privacy] 'direct', 'friends', or 'public' determines who can view this Destination and url e.g. in recently visited places. Default: friends
 * @property {string} [description] text summary of destination
 * @property {string} [previewImage] thumbnail image url
 * @property {Activities.APPlace} [immer] reference to the parent/homepage place object for this experience, if ommitted will use the local immer
 */
/**
 * @typedef {object} Profile
 * @property {string} id - Globally unique identifier (ActivityPub IRI)
 * @property {string} handle - Shorthand globally unique identifier, format: username[home.immer]
 * @property {string} displayName - User's changeable preferred identifier, may contain spaces & symbols
 * @property {string} homeImmer - Domain of imme where user account is registered
 * @property {string} username - User's permanent uniqe identifier within their home immer
 * @property {string} bio - Text description of user, may contain sanitized HTML
 * @property {string} avatarImage - Profile icon url
 * @property {string} avatarModel - Profile avatar 3d model url
 * @property {Activities.APModel} avatarObject - Profile avatar full Model object
 * @property {string} url - Webpage to view full profile
 * @property {object} collections - Map of user collections - urls to fetch lists of related activities. May include user-generated collections in addition to those listed
 * @property {string} collections.avatars - Activities with model objects representing user's collection of avatars
 * @property {string} collections.blocked - User blocks
 * @property {string} collections.destinations - Unique immers visited by user, most recent first
 * @property {string} collections.friends - Most recent activity for each friend (see {@link friendsList})
 * @property {string} collections.friendsDestinations - Unique immers visited by user's friends, most recent first
 * @property {string} collections.inbox - All incoming activities
 * @property {string} collections.outbox - All outgoing activities
 */
/**
 * @typedef {object} FriendStatus
 * @property {Profile} profile - Profile object for friend
 * @property {boolean} isOnline - Currently online anywhere in Immers Space
 * @property {string} [locationName] - Name of current or last immer visited
 * @property {string} [locationURL] - URL of current or last immer visited
 * @property {Destination} [destination] - Destination object for current or last immer visited
 * @property {('friend-online'|'friend-offline'|'request-receved'|'request-sent'|'none')} status - descriptor of the current relationship to this user
 * @property {string} statusString - Text description of current status, "Offline" / "Online at..."
 * @property {string} __unsafeStatusHTML - Unsanitized HTML description of current status with link.
 * You must sanitize this string before inserting into the DOM to avoid XSS attacks.
 * @property {string} statusHTML - Sanitize HTML description of current status with link. Safe to insert into DOM.
 */

/**
 * @typedef {object} Message
 * @property {string} id - URL of original message activity object, usable as unique id
 * @property {Profile} sender - Message sender's Profile
 * @property {Date} timestamp - Message sent time
 * @property {string} type - Describes the message content: 'chat', 'media', 'status', or 'other'
 * @property {string} __unsafeMessageHTML - Unsanitized HTML message content.
 * You must sanitize this string before inserting into the DOM to avoid XSS attacks.
 * @property {string} messageHTML - Sanitized HTML message content. Safe to insert into DOM. Media wrapped in IMG/VIDEO will have class immers-message-media
 * @property {string} [mediaType] - 'image' or 'video' if the message is a media object
 * @property {string} [url] - source url if the message is a media object
 * (messageHTML will contain appropriate tags to display the media, but url can be used if you need custom display)
 * @property {Destination} [destination] - location tied to the message, if available
 * @property {object} _originalActivity - the unmodified ActivityPub activity that is the source of the message
 */

/**
 * @typedef {object} ImmersClientNewMessageEvent
 * @property {object} detail
 * @property {Message} detail.message
 */

/**
 * High-level interface to Immers profile and social features
 * @fires immers-client-connected
 * @fires immers-client-disconnected
 * @fires immers-client-friends-update
 * @fires immers-client-new-message
 * @fires immers-client-profile-update
 */
export class ImmersClient extends window.EventTarget {
  /**
   * Activities instance for access to low-level ActivityPub API
   * @type {Activities}
   * @public
   */
  activities
  /**
   * ImmersSocket instance for access to low-level streaming API
   * @type {ImmersSocket}
   * @public
   */
  streaming
  /**
   * User's Immers profile
   * @type {Profile}
   * @public
   */
  profile
  /**
   * Is the client connected to the User's immer?
   * @type {boolean}
   * @public
   */
  connected = false
  /**
   * Additional data returned from the user's immer on login
   * @type {Object.<string, any>}
   * @property {boolean} [isNewUser] true when this is the first login of a new local user
   * @property {string} [email] only included on home immer domain when that immer has passEmailToHub config enabled and this is their first login
   * @property {string} [provider] identity provider domain if on home immer domain and logged in with OpenId Connect and this is their first login
   * @public
   */
  sessionInfo = {}
  #store
  /**

   * @param  {(Destination|Activities.APPlace|string)} destinationDescription Metadata about this destination used when sharing or url for the related Place object. Either a Destination/APPlace object or a url where one can be fetched.
   * @param  {object} [options]
   * @param  {string} [options.localImmer] Domain (host) of the local Immers Server, if there is one
   * @param  {boolean} [options.allowStorage] Enable localStorage of handle & token for reconnection (make sure you've provided complaince notices as needed)
   */
  constructor (destinationDescription, options) {
    super()
    this.localImmer = options?.localImmer ? getURLPart(options.localImmer, 'host') : undefined
    this.allowStorage = options?.allowStorage
    this.enterBound = () => this.enter()
    this.#store = createStore(this.allowStorage)
    try {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      if (hashParams.has('me')) {
        this.#store.handle = hashParams.get('me')
        // restore original hash
        hashParams.delete('me')
        window.location.hash = hashParams.toString().replace(/=$/, '')
      }
    } catch (err) {
      console.warn(`Unable to parse handle from URL hash: ${err.message}`)
    }
    if (this.localImmer) {
      // some functionality enabled prior to login when local immer present
      this.activities = new Activities({}, this.localImmer, this.place, null, this.localImmer)
    }
    this.#setPlaceFromDestination(destinationDescription)
  }

  /**
   * Utility method to hide details for checking if user is logged in
   * or waiting util they have before performing actions that require
   * a logged-in user
   * @example
   * await client.waitUntilConnected()
   * client.sendChatMessage('Hey friends, I am connected!', 'friends')
   * @returns {Promise<true>}
   */
  async waitUntilConnected () {
    if (this.connected) {
      return true
    }

    return new Promise(resolve => {
      this.addEventListener('immers-client-connected', () => resolve(true), { once: true })
    })
  };

  /**
   * Connect to user's Immers Space profile, using pop-up window for OAuth
   * @param  {string} tokenCatcherURL Page on your domain that runs {@link catchToken} on load to retrieve the granted access token.
   * Can be the same page as long as loading it again in a pop-up won't cause a the main session to disconnect.
   * @param  {string} requestedRole Access level to request, see {@link roles} for details
   * @param  {string} [handle] User's immers handle. Optional if you have a local Immers Server
   * @param  {boolean} [registration] For use with local immer only, open the popup with the registration tab selected instead of login. handle will be used to prefill the registratoin form if provided
   * @returns {Promise<string>} token OAuth2 acess token
   */
  async login (tokenCatcherURL, requestedRole, handle, registration) {
    let authResult
    if (this.localImmer) {
      const client = await this.localImmerPlaceObject
      authResult = await ImmerOAuthPopup(this.localImmer, client.id, requestedRole, tokenCatcherURL, handle, registration ? 'Register' : undefined)
    } else {
      authResult = await DestinationOAuthPopup(handle, requestedRole, tokenCatcherURL)
    }
    const { actor, token, homeImmer, authorizedScopes, sessionInfo } = authResult
    this.#store.credential = { token, homeImmer, authorizedScopes, sessionInfo }
    this.#setupAfterLogin(actor, homeImmer, token, authorizedScopes, sessionInfo)
    return token
  }

  /**
   * Initialize client with an existing credential,
   * e.g. one obtained through a service account or one returned from {@link catchToken}
   * when performing a redirect based OAuth flow
   * @param  {string} token - OAuth2 Access Token
   * @param  {string} homeImmer - Domain (host) for user's home immer
   * @param  {(string|string[])} authorizedScopes - Scopes authorized for the token
   * @param {object} [sessionInfo] - optional session data provided alongside token
   * @returns {Promise<boolean>} true if the login was successful
   */
  loginWithToken (token, homeImmer, authorizedScopes, sessionInfo) {
    homeImmer = getURLPart(homeImmer, 'origin')
    authorizedScopes = preprocessScopes(authorizedScopes)
    this.#store.credential = { token, homeImmer, authorizedScopes, sessionInfo }
    return this.restoreSession()
  }

  /**
   * Attempt to restore session from a previously granted token. Requires options.allowStorage
   * @returns {Promise<boolean>} Was reconnection successful
   */
  async restoreSession () {
    try {
      const { token, homeImmer, authorizedScopes, sessionInfo } = this.#store.credential
      const actor = await tokenToActor(token, homeImmer)
      if (actor) {
        this.#setupAfterLogin(actor, homeImmer, token, authorizedScopes, sessionInfo)
        return true
      }
    } catch {}
    return false
  }

  /**
   * Mark user as "online" at this immer and share the location with their friends.
   * Must be called after successful {@link login} or {@link restoreSession}
   *  @param  {(Destination|Activities.APPlace|string)} [destinationDescription]
   */
  async enter (destinationDescription) {
    // optionally update the place before going online
    if (destinationDescription) {
      await this.#setPlaceFromDestination(destinationDescription)
    }
    if (!this.connected) {
      throw new Error('Immers login required to udpate location')
    }
    if (!this.#store.credential.authorizedScopes.includes(SCOPES.postLocation)) {
      console.info('Not sharing location because not authorized')
      return
    }
    const actor = this.activities.actor
    if (this.streaming.connected) {
      await this.activities.arrive()
      this.streaming.prepareLeaveOnDisconnect(actor, this.place)
    }
    // also update on future (re)connections
    this.streaming.addEventListener('immers-socket-connect', this.enterBound)
  }

  /**
   * Update user's current online location and share with friends
   * @param  {(Destination|Activities.APPlace|string)} destinationDescription
   */
  async move (destinationDescription) {
    if (!this.connected) {
      throw new Error('Immers login required to update location')
    }
    if (!this.#store.credential.authorizedScopes.includes(SCOPES.postLocation)) {
      console.info('Not sharing location because not authorized')
      return
    }
    await this.exit()
    return this.enter(destinationDescription)
  }

  /**
   * Mark user as no longer online at this immer.
   */
  async exit () {
    if (!this.connected) {
      throw new Error('Immers login required to update location')
    }
    if (!this.#store.credential.authorizedScopes.includes(SCOPES.postLocation)) {
      console.info('Not sharing location because not authorized')
      return
    }
    await this.activities.leave()
    this.streaming.clearLeaveOnDisconnect()
    this.streaming.removeEventListener('immers-socket-connect', this.enterBound)
  }

  /**
   * Disconnect from User's immer, retaining credentials to reconnect
   */
  disconnect () {
    this.streaming?.disconnect()
    this.streaming = undefined
    this.activities = undefined
    this.connected = false
    /**
     * Fired when disconnected from immers server or logged out
     * @event immers-client-disconnected
     */
    this.dispatchEvent(new window.CustomEvent('immers-client-disconnected'))
  }

  /**
   * Disconnect from User's immer and delete any traces of user identity.
   * If the user is from the local immer on the same apex domain
   * ({@link https://github.com/immers-space/immers#api-access more info}),
   * alsoLogoutFromImmer can cause the
   * login session on the immer to be terminated as well for a complete logout.
   * @param {boolean} [alsoLogoutFromImmer] - terminate the login session on the local immer as well
   * @returns {Promise<void>}
   */
  async logout (alsoLogoutFromImmer) {
    const usersImmer = this.profile.homeImmer
    clearStore(this.#store)
    this.disconnect()
    if (alsoLogoutFromImmer && this.localImmer === usersImmer) {
      await fetch(`https://${this.localImmer}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      }).catch(err => console.warn('Error logging out from immer', err))
    }
  }

  /**
   * Update user's profile description
   * @param {object} info
   * @param  {string} [info.displayName] User's preferred shorthand identifier, may contain spaces & symbols
   * @param  {string} [info.bio] Summary paragraph displayed on user profile
   */
  updateProfileInfo ({ displayName, bio }) {
    let somethingUpdated
    const update = {}
    if (displayName) {
      update.name = displayName
      somethingUpdated = true
    }
    if (bio) {
      update.summary = bio
      somethingUpdated = true
    }
    if (somethingUpdated) {
      return this.activities.updateProfile(update)
    }
  }

  #setupAfterLogin (actor, homeImmer, token, authorizedScopes, sessionInfo) {
    this.connected = true
    this.profile = ImmersClient.ProfileFromActor(actor)
    this.sessionInfo = sessionInfo
    this.#store.handle = this.profile.handle
    this.activities = new Activities(actor, homeImmer, this.place, token, this.localImmer)
    this.streaming = new ImmersSocket(homeImmer, token)

    if (authorizedScopes.includes('viewFriends')) {
      this.#publishFriendsUpdate()
      this.streaming.addEventListener(
        'immers-socket-friends-update',
        () => this.#publishFriendsUpdate()
      )
      this.#publishBlockedUpdate()
      this.streaming.addEventListener(
        'immers-socket-blocked-update',
        () => this.#publishBlockedUpdate()
      )
    }
    if (authorizedScopes.includes('viewPublic')) {
      this.streaming.addEventListener(
        'immers-socket-inbox-update',
        event => this.#publishIncomingMessage(event.detail)
      )
      this.streaming.addEventListener(
        'immers-socket-outbox-update',
        ({ detail: activity }) => {
          if (activity.type === 'Update' && activity.object.id === this.profile.id) {
            this.#handleProfileUpdate(activity.object)
          }
        }
      )
    }
    /**
     * User has connected to the immers server
     * @event immers-client-connected
     * @type {object}
     * @property {Profile} detail.profile the connected user's profile
     */
    this.dispatchEvent(new window.CustomEvent('immers-client-connected', { detail: { profile: this.profile } }))
  }

  /**
   * Fetch list of friends and their online status and location
   * @returns {Promise<FriendStatus[]>}
   */
  async friendsList () {
    const friendsCol = await this.activities.friends()
    this.#store.friends = friendsCol.orderedItems
      .map(ImmersClient.FriendStatusFromActivity)
    return friendsCol.orderedItems
      // don't show ex-friends in list
      .filter(activity => activity.type !== 'Reject')
      // map it again to avoid shared, mutable objects
      .map(ImmersClient.FriendStatusFromActivity)
      .sort(ImmersClient.FriendsSorter)
  }

  /**
   * Fetch a page of recent activity Messages
   * @returns {Promise<Message[]>}
   */
  async feed () {
    const inboxCol = await this.activities.inbox()
    const outboxCol = await this.activities.outbox()
    return inboxCol.orderedItems
      .concat(outboxCol.orderedItems)
      .map(ImmersClient.MessageFromActivity)
      .filter(msg => !!msg) // posts not convertable to Message
      .sort(desc('timestamp'))
  }

  /**
   * Fetch list of Profile.id of all users blocked by this user
   * @param {boolean} forceRefresh - skip local cache and fetch from server
   * @returns {Promise<string[]>}
   */
  async blockList (forceRefresh) {
    if (!forceRefresh && this.#store.blocked) {
      return this.#store.blocked.map(activity => activity.object)
    }
    const blocked = await this.activities.blockList()
    this.#store.blocked = blocked
    return blocked.slice()
  }

  /**
   * Send a message with text content.
   * privacy level determines who receives and can acccess the message.
   * direct: Only those named in `to` receive the message.
   * friends: Direct plus friends list.
   * public: Direct plus Friends plus accessible via URL for sharing.
   * @param {string} content - The text/HTML content. Will be sanitized before sending
   * @param {string} privacy - 'direct', 'friends', or 'public'
   * @param {string[]} [to] - Addressees. Accepts Immers handles (username[domain.name]) and ActivityPub IRIs
   * @returns {Promise<string>} Url of newly posted message
   */
  sendChatMessage (content, privacy, to = []) {
    return this.activities.note(DOMPurify.sanitize(content), to, privacy)
  }

  /**
   * Delete a message.
   * @param  {(string|Activities.APActivity)} sourceActivity - IRI of activity or Activity in the Outbox
   * @returns {Promise<string>} IRI of the remove activity
   */
  async deleteMessage (sourceActivity) {
    const activity = typeof sourceActivity === 'string'
      ? await this.activities.getObject(sourceActivity)
      : sourceActivity
    switch (activity.type.toLowerCase()) {
      case 'arrive':
      case 'leave':
        return this.activities.undo(activity)
      case 'create':
        return this.activities.delete(activity.object)
    }
  }

  /**
   * Upload and/or share an image.
   * When image is a canvas element, its toBlob method is used to generate a
   * png image to upload.
   * When image is a File/Blob, it will be uploaded to the user's home immer
   * and shared. The `name` attribute is optional, but `type` must contain the
   * correct MIME. When image is a url, an existing image is shared without
   * re-uploading. It's better to upload a file so that the user's home
   * immer can ensure it remains available.
   * privacy level determines who receives and can acccess the message.
   * direct: Only those named in `to` receive the message.
   * friends: Direct plus friends list.
   * public: Direct plus Friends plus accessible via URL for sharing.
   * @param {(File|Blob|HTMLCanvasElement|string)} image - Image data to upload or url to share
   * @param {string} privacy - 'direct', 'friends', or 'public'
   * @param {string[]} [to] - Addressees. Accepts Immers handles (username[domain.name]) and ActivityPub IRIs
   * @returns {Promise<string>} Url of newly posted message
   */
  async sendImage (image, privacy, to = []) {
    if (image instanceof HTMLCanvasElement) {
      image = await new Promise(resolve => {
        image.toBlob(resolve)
      })
    }
    return this.activities.image(image, to, privacy)
  }

  /**
   * Upload and/or share a video.
   * When video is a File/Blob, it will be uploaded to the user's home immer
   * and shared. The `name` attribute is optional, but `type` must contain the
   * correct MIME. When video is a url, an existing video is shared without
   * re-uploading. It's better to upload a file so that the user's home
   * immer can ensure it remains available.
   *
   * Privacy level determines who receives and can access the message.
   * direct: Only those named in `to` receive the message.
   * friends: Direct plus friends list.
   * public: Direct plus Friends plus accessible via URL for sharing.
   * @param {(File|Blob|string)} video - Video data to upload or url to share
   * @param {string} privacy - 'direct', 'friends', or 'public'
   * @param {string[]} [to] - Addressees. Accepts Immers handles (username[domain.name]) and ActivityPub IRIs
   * @returns {Promise<string>} Url of newly posted message
   */
  sendVideo (video, privacy, to = []) {
    return this.activities.video(video, to, privacy)
  }

  /**
   * Upload and optionally share a 3D model.
   * GLB is preferred. Other single-file model formats can be uploaded,
   * but may not be supported when shared to other immers. The blob's
   * type attribute must contain the correct MIME.
   *
   * The privacy and to arguments determine who receives and can access a post featuring the uploaded model.
   * For some uses, like collecting a new avatar, you may omit these to not share a post
   * (this user will still be able to see the model in their outbox).
   * direct: Only those named in `to` receive the message.
   * friends: Direct plus friends list.
   * public: Direct plus Friends plus accessible via URL for sharing.
   * @param {string} name - Label for the model
   * @param  {(File|Blob)} glb - the 3D model file
   * @param  {(File|Blob)} [icon] - optional 2d image preview for the model
   * @param {string} [privacy] - 'direct', 'friends', or 'public'
   * @param {string[]} [to] - Addressees. Accepts Immers handles (username[domain.name]) and ActivityPub IRIs
   */
  async sendModel (name, glb, icon, privacy = 'direct', to = []) {
    return this.activities.model(name, glb, icon, to, privacy)
  }

  /**
   * This method will either initiate a new friend request or,
   * if a request has already been received from the target user,
   * accept a pending friend request. To create a friend connection,
   * both users will need to call this method with the other user's handle.
   * @param  {string} handle - the target user's immers handle or profile id
   */
  async addFriend (handle) {
    const userId = handle.startsWith('https://') ? handle : await this.resolveProfileIRI(handle)
    const pendingRequest = this.#store.friends?.find(status => status.profile.id === userId && status.status === 'request-received')
    if (pendingRequest) {
      return this.activities.accept(pendingRequest._activity)
    }
    return this.activities.follow(userId)
  }

  /**
   * Remove a relationship to another immerser,
   * either by removing an existing friend,
   * rejecting a pending incoming friend request,
   * or canceling a pending outgoing friend request
   * @param  {string} handle - the target user's immers handle or profile id
   */
  async removeFriend (handle) {
    const userId = handle.startsWith('https://') ? handle : await this.resolveProfileIRI(handle)
    const pendingRequest = this.#store.friends
      ?.find(status => status.profile.id === userId && status.status === 'request-received')
    if (pendingRequest) {
      return this.activities.reject(pendingRequest._activity.id, userId)
    }
    const pendingOutgoingRequest = this.#store.friends
      ?.find(status => status.profile.id === userId && status.status === 'request-sent')
    if (pendingOutgoingRequest) {
      return this.activities.undo(pendingOutgoingRequest._activity)
    }
    // technically reject needs the original follow activity ID, but
    // immers server will do this lookup for us if we send reject of a friends list user id
    return this.activities.reject(userId, userId)
  }

  /**
   * Add an someone to this immerser's blocklist. While on a blocklist,
   * no messages/requests will sent or received between these two users,
   * and any past messages will be omitted from feeds and friends lists.
   * You should also prevent realtime interactions in your
   * application from users in Profile.collections.blocked (e.g. hide avatars, mute audio)
   * @param  {string} handle - the target user's immers handle or profile id
   */
  async blockUser (handle) {
    const userId = handle.startsWith('https://') ? handle : await this.resolveProfileIRI(handle)
    return this.activities.block(userId)
  }

  /**
   * Remove someone to this immerser's blocklist. Messages will once again
   * be sent & received between users and past messages from before the block
   * will be visible again in feeds and friends lists.
   * @param  {string} handle - the target user's immers handle or profile id
   */
  async unblockUser (handle) {
    const userId = handle.startsWith('https://') ? handle : await this.resolveProfileIRI(handle)
    // this undo formation can have different results depending on relationship state,
    // so confirm the user is blocked first
    if (!this.#store.blocked.includes(userId) && !(await this.blockList(true)).includes(userId)) {
      throw new Error(`Unable to unblock ${userId}: User not found in block list`)
    }
    return this.activities.undo({ id: userId })
  }

  /**
   * Upload a 3d model as an avatar and optionally share it
   * @param  {string} name - Name/description
   * @param  {Blob} glb - 3d model gltf binary file
   * @param  {Blob} icon - Preview image for thumbnails
   * @param  {string} privacy - 'direct', 'friends', or 'public'
   * @param  {} [to] - Addressees. Accepts Immers handles (username[domain.name]) and ActivityPub IRIs
   * @returns {Promise<string>} IRI of avatar creation post
   */
  createAvatar (name, glb, icon, privacy, to = []) {
    return this.activities.model(name, glb, icon, to, privacy)
  }

  /**
   * Add an existing avatar to a user's personal avatar collection
   * @param  {(string|Activities.APActivity)} sourceActivity - Create activity for the avatar or IRI of activity (other activities with the avatar as their object, e.g. Offer, also allowed)
   * @returns {Promise<string>} IRI of avatar add activity
   */
  addAvatar (sourceActivity) {
    return this.activities.add(sourceActivity, this.profile.collections.avatars)
  }

  /**
   * Update user's avatar in their profile.
   * @param  {(object|string)} avatar - Model type object or id for one (or activity containing the model as its object)
   * @returns {Promise<string>} IRI of profile update activity
   */
  async useAvatar (avatar) {
    // if IRI, fetch object
    if (typeof avatar === 'string') {
      avatar = await this.activities.getObject(avatar)
    }
    // if Activity, extract object
    if (avatar.object) {
      avatar = avatar.object
    }
    if (!ImmersClient.URLFromProperty(avatar?.url)) {
      throw new Error('Invalid avatar')
    }
    const profileUpdate = { avatar }
    if (avatar.icon) {
      profileUpdate.icon = avatar.icon
    }
    return this.activities.updateProfile(profileUpdate)
  }

  /**
   * Remove user's avatar from their Avatar Collection.
   * @param  {(string|Activities.APActivity)} sourceActivity - Activity IRI or Activity from the Avatars Collection to remove
   * @returns {Promise<string>} IRI of the remove activity
   */
  async removeAvatar (sourceActivity) {
    return this.activities.remove(sourceActivity, this.profile.collections.avatars)
  }

  // Misc utilities
  /**
   * Attempt to fetch a cross-domain resource.
   * Prefers using the local immer's proxy service if available,
   * falling back to the user's home immer's proxy service if available or plain fetch.
   * @param  {string} url - resource to GET
   * @param  {object} headers - fetch headers
   */
  async corsProxyFetch (url, headers) {
    if (this.localImmer) {
      // prefer direct local fetch or local proxy if possible
      return window.fetch(
        url.startsWith(`https://${this.localImmer}`) ? url : `https://${this.localImmer}/proxy/${url}`,
        { headers }
      )
    }
    const homeProxy = this.activities?.actor?.endpoints?.proxyUrl
    if (homeProxy) {
      try {
        headers = {
          ...headers,
          Authorization: `Bearer ${this.store.credential.token}`
        }
        // note this GET proxy is different from the ActivityPub standard POST proxy used for AP objects
        const result = await window.fetch(`${homeProxy}/${url}`, {
          headers
        })
        if (!result.ok) {
          throw new Error(`Fetch failed: ${result.statusText} ${result.body}`)
        }
        return result
      } catch (err) {
        console.log('Home immer CORS proxy failed', err.message)
      }
    }
    console.warn('No local immer nor user-provided proxy available, attempting normal fetch')
    return window.fetch(url, {
      headers
    })
  }

  /**
   * Get a user ID/URL from their handle using webfinger
   * @param  {string} handle - immers handle
   * @returns {string | undefined} - The profile IRI or undefined if failed
   */
  async resolveProfileIRI (handle) {
    if (this.#store.cachedHandleIRIs?.[handle]) {
      return this.#store.cachedHandleIRIs[handle]
    }
    const { username, immer } = parseHandle(handle)
    const finger = await this.corsProxyFetch(
      `https://${immer}/.well-known/webfinger?resource=acct:${username}@${immer}`,
      { headers: { Accept: 'application/json' } }
    )
      .then(res => res.json())
      .catch(err => {
        console.error(`Could not resolve profile webfinger ${err.message}`)
        return undefined
      })
    const iri = finger?.links?.find?.((l) => l.rel === 'self')?.href
    if (iri) {
      this.#store.cachedHandleIRIs = {
        ...this.#store.cachedHandleIRIs || {},
        [handle]: iri
      }
    }
    return iri
  }

  /**
   * Get a user's profile object from their handle.
   * Uses logged-in users's home immer proxy service if available
   * @param {string} handle - Immers handle
   * @returns {Profile | undefined} - User profile or undefined if failed
   */
  async getProfile (handle) {
    if (this.#store.cachedActors?.[handle]) {
      return ImmersClient.ProfileFromActor(this.#store.cachedActors[handle])
    }
    let actor
    const iri = await this.resolveProfileIRI(handle)
    if (!iri) {
      return
    }
    if (this.connected) {
      actor = await this.activities.getObject(iri).catch(() => {})
    }
    if (!actor) {
      actor = await this.corsProxyFetch(iri, { Accept: Activities.JSONLDMime })
        .then(res => res.json())
        .catch(() => {})
    }
    if (actor) {
      this.#store.cachedActors = {
        ...this.#store.cachedActors || {},
        [handle]: actor
      }
      return ImmersClient.ProfileFromActor(actor)
    }
  }

  async getNodeInfo (handle) {
    const { immer } = parseHandle(handle)
    if (this.#store.cachedNodeInfos?.[immer]) {
      return this.#store.cachedNodeInfos[immer]
    }
    const headers = { Accept: 'application/json' }
    const resource = await this.corsProxyFetch(
      `https://${immer}/.well-known/nodeinfo`,
      { headers }
    )
      .then(res => res.json())
      .catch(err => {
        console.error(`Could not resolve nodeinfo links ${err.message}`)
        return undefined
      })
    const url = (
      resource?.links?.find((l) => l.rel === Activities.NodeInfoV21) ||
      resource?.links?.find((l) => l.rel === Activities.NodeInfoV20)
    )?.href
    if (!url) {
      return
    }
    const info = await this.corsProxyFetch(url, { headers })
      .then(res => res.json())
      .catch(err => {
        console.error(`Could not resolve nodeinfo ${err.message}`)
        return undefined
      })
    if (info) {
      this.#store.cachedNodeInfos = {
        ...this.#store.cachedNodeInfos || {},
        [immer]: info
      }
    }
    return info
  }

  /**
   * Make navigating between immers easier by providing the user's
   * handle to the next experience so they don't have to type it in.
   * Use as an onClick handler to inject the "me hash" into any cross-origin
   * anchor when navigating. Can be registered directly on the anchor
   * or on a parent element.
   * Will fallback to default click behavior if same-origin, not logged in,
   * or unable to process url.
   * @param  {MouseEvent} clickEvent
   */
  handleImmerLinkClick (clickEvent) {
    const a = clickEvent.composedPath()
      .find(element => element.tagName === 'A')
    if (!a) {
      return
    }
    if (this.profile && a.origin !== window.location.origin) {
      try {
        this.navigateToImmerLink(a.href)
        clickEvent.preventDefault()
      } catch (ignore) {
        /* if fail, leave original url unchanged */
      }
    }
  }

  /**
   * Navigate to a given url while injecting a "me hash" to provide the
   * user's handle to the destination site so that they don't have to re-enter it.
   * Safe to use without checking if user is logged in, will just navigate normally
   * if not
   * @param  {string} href
   */
  navigateToImmerLink (href) {
    const url = new URL(href)
    if (this.profile) {
      const hashParams = new URLSearchParams(
        // preserve original hash if present, must strip '#' to avoid doubling it
        url.hash.replace(/^#/, '')
      )
      hashParams.set('me', this.profile.handle)
      url.hash = hashParams.toString()
    }
    window.location = url
  }

  async #publishFriendsUpdate () {
    /**
     * Friends status/location has changed
     * @event immers-client-friends-update
     * @type {object}
     * @property {FriendStatus[]} detail.friends Current status for each friend
     */
    const evt = new window.CustomEvent('immers-client-friends-update', {
      detail: {
        friends: await this.friendsList()
      }
    })
    this.dispatchEvent(evt)
  }

  async #publishBlockedUpdate () {
    /**
     * Blocklist has changed
     * @event immers-client-blocked-update
     * @type {object}
     * @property {string[]} detail.blocked Profile.id for each blocked user
     */
    const evt = new window.CustomEvent('immers-client-blocked-update', {
      detail: {
        blocked: await this.blockList(true)
      }
    })
    this.dispatchEvent(evt)
  }

  #publishIncomingMessage (activity) {
    const message = ImmersClient.MessageFromActivity(activity)
    if (!message) {
      // activity type was not convertable to chat message
      return
    }
    /**
     * New chat or status message received
     * @event immers-client-new-message
     * @type {ImmersClientNewMessageEvent}
     */
    const evt = new window.CustomEvent('immers-client-new-message', {
      detail: { message }
    })
    this.dispatchEvent(evt)
  }

  #handleProfileUpdate (actor) {
    this.profile = ImmersClient.ProfileFromActor(actor)
    this.activities.actor = actor
    /**
     * Profile data has changed
     * @event immers-client-profile-update
     * @type {object}
     * @property {Profile} detail.profile updated profile
     */
    const evt = new window.CustomEvent('immers-client-profile-update', {
      detail: { profile: this.profile }
    })
    this.dispatchEvent(evt)
  }

  #localImmerPlaceObject
  /**
   * fetch the /o/immer object for the current immer from memory cache or network
   * @type {Promise<Activities.APPlace>}
   */
  get localImmerPlaceObject () {
    if (this.#localImmerPlaceObject) {
      return Promise.resolve(this.#localImmerPlaceObject)
    }
    return window.fetch(`${getURLPart(this.localImmer, 'origin')}/o/immer`, {
      headers: { Accept: Activities.JSONLDMime }
    })
      .then(res => res.json())
      .then(place => {
        this.#localImmerPlaceObject = place
        return place
      })
      .catch(() => undefined)
  }

  /**
   * Users Immers handle, if known. May be available even when logged-out if passed via URL or stored from past login
   * @type {string}
   */
  get handle () {
    return this.#store.handle
  }

  /**
   * List of scopes authorized by the user during login.
   * This may differ from what you requested, as the user can override
   * during the authorization process.
   * @type {string[]}
   * @see {SCOPES}
   */
  get authorizedScopes () {
    return this.#store.credential.authorizedScopes ?? []
  }

  /**
   * Array.sort compareFunction to sort a friends list putting online
   * friends at the top and the rest by most recent update
   * @param  {FriendStatus} a
   * @param  {FriendStatus} b
   */
  static FriendsSorter (a, b) {
    if (a.status === 'friend-online' && b.status !== 'friend-online') {
      return -1
    }
    if (b.status === 'friend-online' && a.status !== 'friend-online') {
      return 1
    }
    if (a._activity.published === b._activity.published) {
      return 0
    }
    return a._activity.published > b._activity.published ? -1 : 1
  }

  /**
   * Extract a Destination from a place object
   * @param  {Activities.APPlace} place
   * @returns {Destination}
   */
  static DestinationFromPlace (place) {
    /** @type {Destination} */
    const dest = {
      name: place.name,
      url: place.url,
      previewImage: place.icon || place.context?.icon
    }
    if (place.summary) {
      dest.description = DOMPurify.sanitize(place.summary)
    }
    if (place.context) {
      dest.immer = place.context
    }
    return dest
  }

  /**
   * Extract friend status information from their most recent location activity
   * @param  {Activities.APActivity} activity
   * @returns {FriendStatus}
   */
  static FriendStatusFromActivity (activity) {
    const locationName = activity.target?.name
    const locationURL = activity.target?.url
    let status = 'none'
    let statusString = ''
    let __unsafeStatusHTML = '<span></span>'
    let actor = activity.actor
    switch (activity.type.toLowerCase()) {
      case 'arrive':
        status = 'friend-online'
        statusString = `Online at ${locationName} (${locationURL})`
        __unsafeStatusHTML = `<span>Online at ${htmlAnchorForPlace(activity.target)}</span>`
        break
      case 'leave':
      case 'accept':
        status = 'friend-offline'
        statusString = 'Offline'
        __unsafeStatusHTML = `<span>${statusString}</span>`
        break
      case 'follow':
        if (actor.id) {
          status = 'request-received'
          statusString = 'Sent you a friend request'
          __unsafeStatusHTML = `<span>${statusString}</span>`
        } else if (activity.object?.id) {
          // for outgoing request, current user is the actor; we're interested in the object
          actor = activity.object
          status = 'request-sent'
          statusString = 'You sent a friend request'
          __unsafeStatusHTML = `<span>${statusString}</span>`
        }
        break
    }
    const isOnline = status === 'friend-online'
    const friendStatus = {
      profile: ImmersClient.ProfileFromActor(actor),
      destination: activity.target && ImmersClient.DestinationFromPlace(activity.target),
      isOnline,
      locationName,
      locationURL,
      status,
      statusString,
      __unsafeStatusHTML,
      statusHTML: DOMPurify.sanitize(__unsafeStatusHTML)
    }
    Object.defineProperty(friendStatus, '_activity', { enumerable: false, value: activity })
    return friendStatus
  }

  /**
   * Extract a Message from an activity object
   * @param  {Activities.APActivity} activity
   * @returns {Message | null}
   */
  static MessageFromActivity (activity) {
    /** @type {Message} */
    const message = {
      id: activity.id,
      type: 'other',
      sender: ImmersClient.ProfileFromActor(activity.actor),
      timestamp: activity.published ? new Date(activity.published) : new Date(),
      _originalActivity: activity
    }
    if (activity.context?.type === 'Place') {
      message.destination = ImmersClient.DestinationFromPlace(activity.context)
    }
    message.__unsafeMessageHTML = activity.object?.content || activity.content
    switch (activity.type) {
      case 'Create':
        switch (activity.object?.type) {
          case 'Note':
            message.type = 'chat'
            message.__unsafeMessageHTML = activity.object.content
            break
          case 'Image':
            message.type = 'media'
            message.mediaType = 'image'
            message.url = activity.object.url
            message.__unsafeMessageHTML = `<img class="immers-message-media" src=${activity.object.url} crossorigin="anonymous">`
            break
          case 'Video':
            message.type = 'media'
            message.mediaType = 'video'
            message.url = activity.object.url
            message.__unsafeMessageHTML = `<video class="immers-message-media" controls autplay muted plasinline src=${activity.object.url} crossorigin="anonymous">`
            break
        }
        break
      case 'Arrive':
      case 'Leave':
        message.type = 'status'
        message.__unsafeMessageHTML = activity.summary
        break
      case 'Follow':
        // ignore automated follow-backs
        if (!activity.inReplyTo) {
          message.type = 'status'
          message.__unsafeMessageHTML = activity.summary || '<span>Sent you a friend request</span>'
        }
        break
      case 'Accept':
        message.type = 'status'
        message.__unsafeMessageHTML = activity.summary || '<span>Accepted your friend request</span>'
        break
      default:
        message.__unsafeMessageHTML = activity.summary
    }
    if (!message.__unsafeMessageHTML) {
      return null
    }
    message.messageHTML = DOMPurify.sanitize(message.__unsafeMessageHTML)
    return message
  }

  /**
   * Convert ActivityPub Actor format to Immers profile
   * @param  {Activities.APActor} actor - ActivityPub Actor object
   * @returns {Profile}
   */
  static ProfileFromActor (actor) {
    const { id, name: displayName, preferredUsername: username, icon, avatar, url, summary } = actor
    const homeImmer = new URL(id).host
    const collections = { ...actor.streams, inbox: actor.inbox, outbox: actor.outbox }
    return {
      id,
      handle: `${username}[${homeImmer}]`,
      homeImmer,
      displayName,
      username,
      bio: DOMPurify.sanitize(summary),
      avatarImage: ImmersClient.URLFromProperty(icon),
      avatarModel: ImmersClient.URLFromProperty(avatar),
      avatarObject: avatar,
      url: url ?? id,
      collections
    }
  }

  /**
   * Links in ActivityPub objects can take a variety of forms.
   * Find and return the URL string.
   * @param  {Activities.APObject|object|string} prop
   * @returns {(string|undefined)} URL string, if present
   */
  static URLFromProperty (prop) {
    return prop?.url?.href ?? prop?.url ?? prop?.href ?? prop
  }

  async #setPlaceFromDestination (destinationDescription) {
    if (destinationDescription.type) {
      // user supplied fully formed APPlace, no need to modify
      this.place = destinationDescription
    } else if (typeof destinationDescription === 'string') {
      // if URL, fetch the object and use as-is
      this.place = await window.fetch(destinationDescription, {
        headers: { Accept: Activities.JSONLDMime }
      }).then(res => res.json())
    } else {
      // form APPlace from Destination
      const { name, url, privacy, description, previewImage, immer } = destinationDescription
      const place = { type: 'Place', audience: [], name, url }
      if (privacy === 'public') {
        place.audience.push(Activities.PublicAddress)
      }
      if (this.activities?.actor && (privacy === 'public' || privacy === 'friends' || !privacy)) {
        place.audience.push(this.activities.actor.followers)
      }
      if (description) {
        place.summary = DOMPurify.sanitize(description)
      }
      if (previewImage) {
        place.icon = previewImage
      }
      if (immer) {
        place.context = immer
      } else if (this.localImmer) {
        place.context = await this.localImmerPlaceObject
      }
      if (place.url?.endsWith('#')) {
        // avoid duplicate entries in destinations history from empty hashes
        place.url = place.url.substring(0, place.url.length - 1)
      }
      this.place = place
    }
    if (this.activities) {
      this.activities.place = this.place
    }
  }

  /**
   * Connect to user's Immers Space profile, using pop-up window for OAuth if needed
   * @param  {string} tokenCatcherURL Page on your domain that runs {@link catchToken} on load to retrieve the granted access token.
   * Can be the same page as long as loading it again in a pop-up won't cause a the main session to disconnect.
   * @param  {string} requestedRole Access level to request, see {@link roles} for details
   * @param  {string} [handle] User's immers handle. Optional if you have a local Immers Server
   * @deprecated Split into to methods, {@link login} and {@link enter}, for better control over when a user goes online
   * @returns {string} token OAuth2 acess token
   */
  async connect (tokenCatcherURL, requestedRole, handle) {
    const token = await this.login(tokenCatcherURL, requestedRole, handle)
    this.enter()
    return token
  }

  /**
   * Attempt to restore session from a previously granted token. Requires options.allowStorage
   * @returns {Promise<boolean>} Was reconnection successful
   * @deprecated Split into to methods, {@link restoreSession} and {@link enter}, for better control over when a user goes online
   */
  async reconnect () {
    if (await this.restoreSession()) {
      this.enter()
      return true
    }
    return false
  }
}
