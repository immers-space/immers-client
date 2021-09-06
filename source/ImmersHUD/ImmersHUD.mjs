import htmlTemplate from './ImmersHUD.html'
import styles from './ImmersHUD.css'

export default class ImmersHUD extends window.HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    const styleTag = document.createElement('style')
    styleTag.innerHTML = styles
    const template = document.createElement('template')
    template.innerHTML = htmlTemplate.trim()
    this.shadowRoot.append(styleTag, template.content.cloneNode(true))
    this.container = this.shadowRoot.lastElementChild

    this.container.addEventListener('click', evt => {
      switch (evt.target.id) {
        case 'login':
          evt.preventDefault()
          this.dispatchEvent(new window.CustomEvent('immers-login-event', {
            detail: {
              handle: this.container.querySelector('#handle-input').value
            }
          }))
          break
        case 'logo':
          this.setAttribute('open', this.getAttribute('open') !== 'true')
          break
      }
    })
  }

  attributeChangedCallback (name, oldValue, newValue) {
    switch (name) {
      case 'position':
        if (newValue && !ImmersHUD.POSITION_OPTIONS.includes(newValue)) {
          console.warn(`immers-hud: unknown position ${newValue}. Valid options are ${ImmersHUD.POSITION_OPTIONS.join(', ')}`)
        }
        break
    }
  }

  static get observedAttributes () {
    return ['position']
  }

  static get POSITION_OPTIONS () {
    return ['top-left', 'bottom-left', 'top-right', 'bottom-right']
  }
}
