import { Activities } from './source/activities'
import { ImmersSocket } from './source/streaming'
import { catchToken, DestinationOAuthPopup } from './source/authUtils'
import { immersLoginButton } from './source/html/htmlUtils'
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
    ({ authorizedScopes, homeImmer, profile, token } = await DestinationOAuthPopup(place, handle, 'friends'))
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
    const loginDiv = immersLoginButton(scriptArgs.pos ?? 'bottom-left')
    loginDiv.addEventListener('immers-login-event', async ({ detail: { handle } }) => {
      await loginAs(handle)
      document.body.removeChild(loginDiv)
    })
    document.body.appendChild(loginDiv)
  }

  window.IMMERS_CLIENT ??= {}
  Object.assign(window.IMMERS_CLIENT, {
    loginAs,
    place,
    streaming,
    activities
  })
})()
