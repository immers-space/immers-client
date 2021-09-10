import { Activities } from './activities.js'
import { parseHandle } from './utils.js'

/** @constant User account access roles that can be granted.
    @type {string[]}
    @default
*/
export const allScopes = [
  'viewProfile',
  'viewPublic',
  'viewFriends',
  'postLocation',
  'viewPrivate',
  'creative',
  'addFriends',
  'addBlocks',
  'destructive'
]

/** @constant User account access levels that can be requested.
    @type {string[]}
    @default
*/
export const roles = ['public', 'friends', 'modAdditive', 'modFull']

/**
 * Retrieve OAuth access token and authorization details from URL after
 * redirect and pass it back to the opening window if in a pop-up
 */
export function catchToken () {
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  if (hashParams.has('access_token')) {
    // not safe to update store here, will be saved later in initialize()
    const token = hashParams.get('access_token')
    const homeImmer = hashParams.get('issuer')
    const authorizedScopes = hashParams.get('scope')?.split(' ') || []
    window.location.hash = ''
    // If this is an oauth popup, pass the results back up and close
    // todo check origin
    if (window.opener) {
      window.opener.postMessage({
        type: 'ImmersAuth',
        token,
        homeImmer,
        authorizedScopes
      })
      return true
    }
  }
  // TODO handle #error=access_denied
}
/**
 * @typedef {Object} AuthResult
 * @property {APActor} actor User's ActivityPub profile object
 * @property {string} token OAuth access token
 * @property {string} homeImmer User's home Immers Server origin
 * @property {Array<string>} authorizedScopes Scopes granted by user (may differ from requested scopes)
 */
/**
 * Internal oauth popup handler
 * @returns {Promise<AuthResult>}
 */
function oauthPopup (oauthPath, { clientId, redirectURI, preferredScope, handle }) {
  // center the popup
  const width = 730
  const height = 785
  const left = (window.innerWidth - width) / 2 + window.screenLeft
  const top = (window.innerHeight - height) / 2 + window.screenTop
  const features = `toolbar=no, menubar=no, width=${width}, height=${height}, top=${top}, left=${left}`
  const authURL = new URL(oauthPath)
  const authURLParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectURI,
    response_type: 'token',
    scope: preferredScope,
    me: handle
  })
  authURL.search = authURLParams.toString()
  const popup = window.open(authURL, 'immersLoginPopup', features)
  if (!popup) {
    window.alert('Could not open login window. Please check if popup was blocked and allow it')
  } else {
    document.body.classList.add('immers-authorizing')
    popup.onunload = () => document.body.classList.remove('immers-authorizing')
  }

  return new Promise((resolve, reject) => {
    const handler = ({ data }) => {
      if (data?.type !== 'ImmersAuth') {
        return
      }
      if (!data.token) {
        return reject(new Error('Not authorized'))
      }
      const { token, homeImmer } = data
      const authorizedScopes = data.authorizedScopes[0] === '*' ? allScopes : data.authorizedScopes
      window.removeEventListener('message', handler)
      // have to close the popup in this thread because, in chrome, having the popup close itself crashes the browser
      popup?.close()
      tokenToActor(token, homeImmer).then(actor => {
        resolve({ actor, token, homeImmer, authorizedScopes })
      })
    }
    window.addEventListener('message', handler)
  })
}

/**
 * For a standalone destination without its own Immers Server,
 * trigger OAuth flow to a user's home immer via popup window.
 * Must be invoked from a trusted user input event handler to allow the popup.
 * @param  {string} handle User's Immers Handle (username[home.immer] or username@home.immer)
 * @param  {string} preferredScope Level of access to request (remember the user can alter this before approving)
 * @param  {string} [tokenCatcherURL=window.location] Redirect URI for OAuth, a page on your origin that runs catchToken on load
 * @returns {Promise<AuthResult>}
 */
export async function DestinationOAuthPopup (handle, preferredScope, tokenCatcherURL = window.location) {
  const { immer } = parseHandle(handle)
  if (!immer) {
    throw new Error('Invalid handle')
  }
  /**
   * The proper flow here should be:
   * 1. fetch webfinger, get profile IRI
   * 2. fetch profile IRI, get profile object
   * 3. use object.endpoints.oauthAuthorizationEndpoint to authorize
   *
   * Unfortunately, #2 will be blocked by CORS which requires an oauth token to open up,
   * so we'll just use the hardcoded immers oauth endpoint for now

  // find user profile to get OAuth endpoint
  let profile
  try {
    const finger = await window.fetch(`https://${immer}/.well-known/webfinger?resource=acct:${username}@${immer}`)
      .then(res => res.json())
  } catch (err) {
    throw new Error(`Unable to fetch profile: ${err.message}`)
  }
  */
  return oauthPopup(`https://${immer}/auth/authorize`, {
    redirectURI: tokenCatcherURL,
    preferredScope,
    handle
  })
}
/**
 * For complete immers, trigger popup window OAuth flow starting at local immer and redirecting
 * as necessary. Must be invoked from a trusted user input event handler to allow the popup.
 * @param  {string} localImmer Origin of the local Immers Server
 * @param  {string} localImmerId IRI of the local immer Place object
 * @param  {string} preferredScope Level of access to request (remember the user can alter this before approving)
 * @param  {string} tokenCatcherURL Redirect URI for OAuth, a page on your origin that runs catchToken on load
 * @param  {string} [handle] If known, you can provide the user's handle (username[home.immer]) to pre-fill login forms
 * @returns {Promise<AuthResult>}
 */
export function ImmerOAuthPopup (localImmer, localImmerId, preferredScope, tokenCatcherURL, handle) {
  return oauthPopup(`https://${localImmer}/auth/authorize`, {
    clientId: localImmerId,
    redirectURI: tokenCatcherURL,
    preferredScope,
    handle
  })
}

// TODO logout / upgrade scope

export async function tokenToActor (token, homeImmer) {
  const response = await window.fetch(`${homeImmer}/auth/me`, {
    headers: {
      Accept: Activities.JSONLDMime,
      Authorization: `Bearer ${token}`
    }
  })
  if (!response.ok) {
    throw new Error(`Error fetching actor ${response.status} ${response.statusText}`)
  }
  return response.json()
}
