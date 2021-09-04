import { Activities } from './source/activities'
import { ImmersSocket } from './source/streaming'
import { catchToken, DestinationOAuthPopup } from './source/authUtils'
import { immersLoginButton } from './source/html/htmlUtils'
let scriptArgs
try {
  scriptArgs = new URLSearchParams(new URL(document.currentScript.src).search)
} catch (err) {
  scriptArgs = new URLSearchParams()
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

  if (!scriptArgs.has('noButton')) {
    const loginDiv = immersLoginButton()
    loginDiv.addEventListener('immers-login-event', async ({ detail: { handle } }) => {
      await loginAs(handle)
      document.body.removeChild(loginDiv)
    })
    document.body.appendChild(loginDiv)
  }

  /*
  const immersSocket = new ImmersSocket(homeImmer, token)
  immersSocket.addEventListener('immers-socket-connect', () => {
    // will also send on reconnect to ensure you show as online
    activities.arrive()
    immersSocket.prepareLeaveOnDisconnect(actorObj, place)
  })
  immersSocket.addEventListener('immers-socket-friends-update', () => {
    // if (store.state.profile.id) {
    //   const profile = store.state.profile
    //   try {
    //     friendsCol = await getFriends(profile)
    //     activities.friends = friendsCol.orderedItems
    //     remountUI({ friends: friendsCol.orderedItems.filter(act => act.type !== 'Reject'), handle: profile.handle })
    //   } catch (err) {
    //     console.warn(err.message)
    //     remountUI({ friends: [], handle: profile.handle })
    //   }
    //   // update follow button for new friends
    //   const players = window.APP.componentRegistry['player-info']
    //   players?.forEach(infoComp => setFriendState(infoComp.data.immersId, infoComp.el))
    // }
  })
  immersSocket.addEventListener('immers-socket-inbox-update', ({ detail: activity }) => {
    // const message = activities.activityAsChat(activity)
    // if (message.body) {
    //   if (message.type !== 'activity') {
    //     // play sound for chat/image/video updates
    //     scene.systems['hubs-systems'].soundEffectsSystem.playSoundOneShot(SOUND_CHAT_MESSAGE)
    //   }
    //   immersMessageDispatch.dispatchEvent(new CustomEvent('message', { detail: message }))
    //   if (scene.is('vr-mode')) {
    //     createInWorldLogMessage(message)
    //   }
    // }
  })
  */
  window.IMMERS_CLIENT ??= {}
  Object.assign(window.IMMERS_CLIENT, {
    loginAs,
    place,
    streaming,
    activities
  })
})()
