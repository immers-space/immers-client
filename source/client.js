import { Activities } from './activities.js'
import { ImmerOAuthPopup, DestinationOAuthPopup } from './authUtils.js'
import { ImmersSocket } from './streaming.js'

/**
 * @typedef {object} Destination
 * @property {string} name Title of the destination
 * @property {string} url link to visit the destination
 *
 * @typedef {object} Profile
 * @property {string} handle
 * @property {string} displayName
 * @property {string} homeImmer
 * @property {string} username
 * @property {string} avatarImage
 * @property {string} avatarGltf
 */

export class ImmersClient {
  activities
  streaming
  /**
   * User's Immers profile
   * @type {Profile}
   * @public
   */
  profile
  /**
   * High-level interface to Immers profile and social features
   * @param  {Destination|import('./activities.js').APPlace} destinationDescription Metadata about this destination used when sharing
   * @param  {string} [localImmer] Origin of the local Immers Server, if there is one
   */
  constructor (destinationDescription, localImmer) {
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
    const { profile, token, homeImmer, authorizedScopes } = authResult

    this.profile = {
      handle,
      homeImmer,
      displayName: profile.name,
      username: profile.preferredUsername,
      avatarImage: profile.icon?.url?.href ?? profile.icon?.url ?? profile.icon,
      avatarGltf: profile.avatar?.url?.href ?? profile.avatar?.url
    }
    this.activities = new Activities(profile, homeImmer, this.place, token)
    this.streaming = new ImmersSocket(homeImmer, token)
    this.streaming.addEventListener('immers-socket-connect', () => {
      if (authorizedScopes.includes('postLocation')) {
        this.activities.arrive()
        this.streaming.prepareLeaveOnDisconnect(profile, this.place)
      }
    })
  }
}
