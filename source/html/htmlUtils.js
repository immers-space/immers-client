import './htmlUtils.css'
import immersHoverButton from './immersHoverButton.html'
const loginButtonClass = 'immers-login-button'
const loginInputClass = 'immers-login-input'
export function immersLoginButton () {
  const div = document.createElement('div')
  div.innerHTML = immersHoverButton
  div.addEventListener('click', evt => {
    if (evt.target.classList.contains(loginButtonClass)) {
      evt.preventDefault()
      div.dispatchEvent(new window.CustomEvent('immers-login-event', {
        detail: {
          handle: div.querySelector(`.${loginInputClass}`).value
        }
      }))
    }
  })
  return div
}
