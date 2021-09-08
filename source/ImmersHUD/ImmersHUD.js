import htmlTemplate from './ImmersHUD.html'
import styles from './ImmersHUD.css'
import { ImmersClient } from '../client'

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
  }

  connectedCallback () {
    if (this.immersClient) {
      // already initialized
      return
    }
    // Immers client setup
    if (this.getAttribute('local-immer')) {
      /* todo: fetch local place object and initialize client in full immer mode */
    } else {
      this.immersClient = new ImmersClient({
        id: window.location.href,
        name: this.getAttribute('destination-name'),
        url: this.getAttribute('destination-url')
      })
    }

    this.container.addEventListener('click', evt => {
      switch (evt.target.id) {
        case 'login':
          evt.preventDefault()
          this.login()
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

  async login () {
    await this.immersClient.connect(
      this.getAttribute('token-catcher'),
      this.getAttribute('access-role'),
      this.container.querySelector('#handle-input').value
    )
    this.container.querySelector('#login-container').classList.add('removed')
  }

  static get observedAttributes () {
    return ['position']
  }

  static get POSITION_OPTIONS () {
    return ['top-left', 'bottom-left', 'top-right', 'bottom-right']
  }
}
