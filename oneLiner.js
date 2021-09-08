import { catchToken, roles } from './source/authUtils.js'
import ImmersHUD from './source/ImmersHUD/ImmersHUD.js'
ImmersHUD.Register()
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
  if (scriptArgs.position !== 'none') {
    const hud = document.createElement('immers-hud')
    hud.setAttribute('position', scriptArgs.position ?? 'bottom-left')
    hud.setAttribute('destination-name', document.title)
    hud.setAttribute('destination-url', window.location.href)
    hud.setAttribute('token-catcher', window.location.href)
    hud.setAttribute('access-role', scriptArgs.role ?? roles[1])
    document.body.appendChild(hud)
  }
})()
