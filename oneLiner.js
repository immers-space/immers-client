import { catchToken } from './source/authUtils.js'
import { ImmersHUD } from './source/ImmersHUD/ImmersHUD.js'
ImmersHUD.Register()
let scriptArgs
try {
  const meta = import.meta
  scriptArgs = Object.fromEntries(new URL(meta.url).searchParams)
} catch (err) {
  scriptArgs = {}
  console.warn(`Unable to process query arguments to script, ${err.message}`)
}
(async function () {
  if (catchToken()) {
    // token was passed to opener window; this is just a popup
    return
  }
  const installHUD = () => {
    // insert the hud element unless disabled by script arg or already present
    if (scriptArgs.position !== 'none' && !document.querySelector('immers-hud')) {
      const hud = document.createElement('immers-hud')
      hud.setAttribute('position', scriptArgs.position ?? 'bottom-left')
      hud.setAttribute('destination-name', scriptArgs.title ?? document.title)
      if (scriptArgs.save === 'true') {
        hud.setAttribute('allow-storage', 'true')
      }
      if (scriptArgs.role) {
        hud.setAttribute('access-role', scriptArgs.role)
      }
      document.body.appendChild(hud)
    }
  }

  if (/complete|interactive|loaded/.test(document.readyState)) {
    installHUD()
  } else {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        installHUD()
      }
    }, { once: true })
  }
})()
