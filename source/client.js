import { Activities } from './activities.js'
import { ImmerOAuthPopup, DestinationOAuthPopup, tokenToActor } from './authUtils.js'
import { ImmersSocket } from './streaming.js'
import { clearStore, createStore } from './store.js'

/**
 * @typedef {object} Destination
 * @property {string} name Title of the destination
 * @property {string} url link to visit the destination
 */
/**
 * @typedef {object} Profile
 * @property {string} id - Globally unique identifier (ActivityPub IRI)
 * @property {string} handle - Shorthand globally unique identifier, format: username[home.immer]
 * @property {string} displayName - User's changeable preferred identifier, may contain spaces & symbols
 * @property {string} homeImmer - Domain of imme where user account is registered
 * @property {string} username - User's permanent uniqe identifier within their home immer
 * @property {string} avatarImage - Profile icon url
 * @property {string} avatarGltf - Profile avatar 3d model url
 * @property {string} url - Webpage to view full profile
 */
/**
 * @typedef {object} FriendStatus
 * @property {Profile} profile - Profile object for friend
 * @property {boolean} isOnline - Currently online anywhere in Immers Space
 * @property {string} [locationName] - Name of current or last immer visited
 * @property {string} [locationURL] - URL of current or last immer visited
 * @property {string} statusString - Text description of current status, "Offline" / "Online at..."
 * @property {string} __unsafeStatusHTML - Unsanitized HTML description of current status with link.
 * You must sanitize this string before inserting into the DOM to avoid XSS attacks.
 */

/** High-level interface to Immers profile and social features */
export class ImmersClient extends window.EventTarget {
  activities
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
  #store
  /**

   * @param  {(Destination|import('./activities').APPlace)} destinationDescription Metadata about this destination used when sharing
   * @param  {object} [options]
   * @param  {string} [options.localImmer] Origin of the local Immers Server, if there is one
   * @param  {boolean} [options.allowStorage] Enable localStorage of handle & token for reconnection (make sure you've provided complaince notices as needed)
   */
  constructor (destinationDescription, options) {
    super()
    this.place = Object.assign(
      { type: 'Place', audience: Activities.PublicAddress },
      destinationDescription
    )
    if (!this.place.id) {
      // fake AP IRI for destinations without their own immer
      this.place.id = this.place.url
    }
    this.localImmer = options?.localImmer
    this.allowStorage = options?.allowStorage
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
  }

  /**
   * Connect to user's Immers Space profile, using pop-up window for OAuth if needed
   * @param  {string} tokenCatcherURL Page on your domain that runs {@link catchToken} on load to retrieve the granted access token.
   * Can be the same page as long as loading it again in a pop-up won't cause a the main session to disconnect.
   * @param  {string} requestedRole Access level to request, see {@link roles} for details
   * @param  {string} [handle] User's immers handle. Optional if you have a local Immers Server
   * @returns {string} token OAuth2 acess token
   */
  async connect (tokenCatcherURL, requestedRole, handle) {
    let authResult
    if (this.localImmer) {
      authResult = await ImmerOAuthPopup(this.localImmer, this.place.id, requestedRole, tokenCatcherURL, handle)
    } else {
      authResult = await DestinationOAuthPopup(handle, requestedRole, tokenCatcherURL)
    }
    const { actor, token, homeImmer, authorizedScopes } = authResult
    this.#store.credential = { token, homeImmer, authorizedScopes }
    this.#setupAfterConnect(actor, homeImmer, token, authorizedScopes)
    return token
  }

  /**
   * Attempt to restore session from a previously granted token. Requires options.allowStorage
   * @returns {Promise<boolean>} Was reconnection successful
   */
  async reconnect () {
    try {
      const { token, homeImmer, authorizedScopes } = this.#store.credential
      const actor = await tokenToActor(token, homeImmer)
      if (actor) {
        this.#setupAfterConnect(actor, homeImmer, token, authorizedScopes)
        return true
      }
    } catch {}
    return false
  }

  /**
   * Disconnect from User's immer, retaining credentials to reconnect
   */
  disconnect () {
    this.streaming.disconnect()
    this.streaming = undefined
    this.activities = undefined
    this.connected = false
  }

  /**
   * Disconnect from User's immer and delete any traces of user identity
   */
  logout () {
    this.disconnect()
    clearStore(this.#store)
  }

  #setupAfterConnect (actor, homeImmer, token, authorizedScopes) {
    this.connected = true
    this.profile = ImmersClient.ProfileFromActor(actor)
    this.#store.handle = this.profile.handle
    this.activities = new Activities(actor, homeImmer, this.place, token)
    this.streaming = new ImmersSocket(homeImmer, token)
    this.streaming.addEventListener('immers-socket-connect', () => {
      if (authorizedScopes.includes('postLocation')) {
        this.activities.arrive()
        this.streaming.prepareLeaveOnDisconnect(actor, this.place)
      }
    })
    if (authorizedScopes.includes('viewFriends')) {
      this.#publishFriendsUpdate()
      this.streaming.addEventListener(
        'immers-socket-friends-update',
        () => this.#publishFriendsUpdate()
      )
    }
  }

  /**
   * Fetch list of friends and their online status and location
   * @returns {Promise<FriendStatus[]>}
   */
  async friendsList () {
    const friendsCol = await this.activities.friends()
    return friendsCol.orderedItems
      .map(ImmersClient.FriendStatusFromActivity)
  }

  async #publishFriendsUpdate () {
    const evt = new window.CustomEvent('immers-client-friends-update', {
      detail: {
        friends: await this.friendsList()
      }
    })
    this.dispatchEvent(evt)
  }

  /**
   * Users Immers handle, if known. May be available even when logged-out if passed via URL or stored from past login
   * @type {string}
   */
  get handle () {
    return this.#store.handle
  }

  /**
   * Extract friend status information from their most recent location activity
   * @param  {APActivity} activity
   * @returns {FriendStatus}
   */
  static FriendStatusFromActivity (activity) {
    const isOnline = activity.type === 'Arrive'
    const locationName = activity.target?.name
    const locationURL = activity.target?.url
    const statusString = isOnline
      ? `Online at ${locationName} (${locationURL})`
      : 'Offline'
    const __unsafeStatusHTML = isOnline
      ? `<span>Online at <a href="${locationURL}">${locationName}</a></span>`
      : '<span>Offline</span>'
    return {
      profile: ImmersClient.ProfileFromActor(activity.actor),
      isOnline,
      locationName,
      locationURL,
      statusString,
      __unsafeStatusHTML
    }
  }

  /**
   * Convert ActivityPub Actor format to Immers profile
   * @param  {APActor} actor - ActivityPub Actor object
   */
  static ProfileFromActor (actor) {
    const { id, name: displayName, preferredUsername: username, icon, avatar, url } = actor
    const homeImmer = new URL(id).host
    return {
      id,
      handle: `${username}[${homeImmer}]`,
      homeImmer,
      displayName,
      username,
      avatarImage: ImmersClient.URLFromProperty(icon),
      avatarModel: ImmersClient.URLFromProperty(avatar),
      url: url ?? id
    }
  }

  /**
   * Links in ActivityPub objects can take a variety of forms.
   * Find and return the URL string.
   * @param  {APObject|object|string} prop
   * @returns {string} URL string
   */
  static URLFromProperty (prop) {
    return prop?.url?.href ?? prop?.url ?? prop
  }
}
