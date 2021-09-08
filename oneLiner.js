import { Activities } from './source/activities.js'
import { ImmersSocket } from './source/streaming.js'
import { catchToken, DestinationOAuthPopup } from './source/authUtils.js'
import ImmersHUD from './source/ImmersHUD/ImmersHUD.js'
window.customElements.define('immers-hud', ImmersHUD)
let scriptArgs
try {
  scriptArgs = Object.fromEntries(new URL(document.currentScript.src).searchParams)
} catch (err) {
  scriptArgs = {}
  console.warn(`Unable to process query arguments to script, ${err.message}`)
}
(async function () {
  if (catchToken()) {
    // token was passed to opener window; this is just a popup
    return
  }
  // fake place object to share link with friends
  const place = {
    id: window.location.href,
    type: 'Place',
    audience: 'as:Public',
    name: document.title,
    url: window.location.href
  }
  let authorizedScopes, homeImmer, profile, token, streaming, activities

  async function loginAs (handle) {
    ({ authorizedScopes, homeImmer, profile, token } = await DestinationOAuthPopup(handle, 'friends'))
    activities = new Activities(profile, homeImmer, place, token)
    streaming = new ImmersSocket(homeImmer, token)
    streaming.addEventListener('immers-socket-connect', () => {
      if (authorizedScopes.includes('postLocation')) {
        activities.arrive()
        streaming.prepareLeaveOnDisconnect(profile, place)
      }
    })
  }

  if (!scriptArgs.noButton) {
    const hud = document.createElement('immers-hud')
    hud.setAttribute('position', scriptArgs.position ?? 'bottom-left')
    document.body.appendChild(hud)

    hud.addEventListener('immers-login-event', async ({ detail: { handle } }) => {
      await loginAs(handle)
    })
  }

  window.IMMERS_CLIENT ??= {}
  Object.assign(window.IMMERS_CLIENT, {
    loginAs,
    place,
    streaming,
    activities
  })
})()
