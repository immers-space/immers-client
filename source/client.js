import { Activities } from './activities.js'
import { ImmerOAuthPopup, DestinationOAuthPopup } from './authUtils.js'
import { ImmersSocket } from './streaming.js'

/**
 * @typedef {object} Destination
 * @property {string} name Title of the destination
 * @property {string} url link to visit the destination
 */
/**
 * @typedef {object} Profile
 * @property {string} id - Unique identifier (ActivityPub IRI)
 * @property {string} handle
 * @property {string} displayName
 * @property {string} homeImmer
 * @property {string} username
 * @property {string} avatarImage
 * @property {string} avatarGltf
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

   * @param  {(Destination|APPlace)} destinationDescription Metadata about this destination used when sharing
   * @param  {string} [localImmer] Origin of the local Immers Server, if there is one
   */
  constructor (destinationDescription, localImmer) {
    super()
    this.place = Object.assign(
      { type: 'Place', audience: Activities.PublicAddress },
      destinationDescription
    )
    if (!this.place.id) {
      // fake AP IRI for destinations without their own immer
      this.place.id = this.place.url
    }
    this.localImmer = localImmer
  }

  /**
   * Connect to user's Immers Space profile, using pop-up window for OAuth if needed
   * @param  {string} tokenCatcherURL Page on your domain that runs {@link catchToken} on load to retrieve the granted access token.
   * Can be the same page as long as loading it again in a pop-up won't cause a the main session to disconnect.
   * @param  {string} requestedRole Access level to request, see {@link roles} for details
   * @param  {string} [handle] User's immers handle. Optional if you have a local Immers Server
   */
  async connect (tokenCatcherURL, requestedRole, handle) {
    let authResult
    if (this.localImmer) {
      authResult = await ImmerOAuthPopup(this.localImmer, this.place.id, requestedRole, tokenCatcherURL, handle)
    } else {
      authResult = await DestinationOAuthPopup(handle, requestedRole, tokenCatcherURL)
    }
    const { actor, token, homeImmer, authorizedScopes } = authResult

    this.profile = ImmersClient.ProfileFromActor(actor)
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
    const { id, name: displayName, preferredUsername: username, icon, avatar, url} = actor
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
