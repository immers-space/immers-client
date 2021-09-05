import './htmlUtils.css'
import immersHoverButton from './immersHoverButton.html'
const loginButtonClass = 'immers-login-button'
const loginInputClass = 'immers-login-input'
export function immersLoginButton (positionClass) {
  const div = document.createElement('div')
  div.classList.add(positionClass)
  div.innerHTML = immersHoverButton
  div.addEventListener('click', evt => {
    const targetClass = evt.target.classList
    if (targetClass.contains(loginButtonClass)) {
      evt.preventDefault()
      div.dispatchEvent(new window.CustomEvent('immers-login-event', {
        detail: {
          handle: div.querySelector(`.${loginInputClass}`).value
        }
      }))
    } else if (targetClass.contains('immers-info-logo')) {
      div.classList[div.classList.contains('open') ? 'remove' : 'add']('open')
    }
  })
  return div
}
