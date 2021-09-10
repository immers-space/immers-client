import htmlTemplate from './ImmersHUD.html'
import styles from './ImmersHUD.css'
import { ImmersClient } from '../client'

/**
 * Heads-up display for Immers profile login.
 * Unobtrusively connects your Immersive Web experiene to the Immers Space
 * metaverse, allowing immersers to connect with their profiles from your site
 * and share your site with their friends. Grants access to profile information
 * so you can bring users' preferred identity into your experience.
 *
 * @element immers-hud
 *
 * @fires immers-hud-connected - On successful login, detail.profile will include users {@link Profile}
 *
 * @attr {top-left|top-right|bottom-left|bottom-right} [position] - Enable overlay positioning.
 * @attr {string} token-catcher - OAuth redirect URL, a page on your domain that runs {@link catchToken} on load
 * @attr {string} access-role - Requested authorization scope from {@link roles}. Users are given the option to alter this and grant a different level.
 * @attr {string} [destination-name] Title for your experience (required if you don't have a local Immers Server)
 * @attr {string} [destination-url] Sharable URL for your experience (required if you don't have a local Immers Server)
 * @attr {string} [local-immer] Origin of your local Immers Server, if you have one
 * @attr {true|false} open - Toggles between icon and full HUD view
 *
 * @prop {ImmersClient} immersClient - Immers client instance
 */
export default class ImmersHUD extends window.HTMLElement {
  #queryCache = {}
  #container
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    const styleTag = document.createElement('style')
    styleTag.innerHTML = styles
    const template = document.createElement('template')
    template.innerHTML = htmlTemplate.trim()
    this.shadowRoot.append(styleTag, template.content.cloneNode(true))
    this.#container = this.shadowRoot.lastElementChild
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

    this.#container.addEventListener('click', evt => {
      switch (evt.target.id) {
        case 'login':
          evt.preventDefault()
          this.login()
          break
        case 'logo':
          this.setAttribute('open', this.getAttribute('open') !== 'true')
          break
        case 'exit-button':
          this.remove()
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
      this.#el('handle-input').value
    )
    this.#el('login-container').classList.add('removed')
    this.#el('status-container').classList.remove('removed')
    const profile = this.immersClient.profile
    // show profile info
    if (profile.avatarImage) {
      this.#el('logo').style.backgroundImage = `url(${profile.avatarImage})`
    }
    this.#el('username').textContent = profile.displayName

    this.#emit('immers-hud-connected', { profile })
  }

  #el (id) {
    return this.#queryCache[id] ?? (this.#queryCache[id] = this.#container.querySelector(`#${id}`))
  }

  #emit (type, data) {
    this.dispatchEvent(new window.CustomEvent(type, {
      detail: data
    }))
  }

  static get observedAttributes () {
    return ['position']
  }

  static get POSITION_OPTIONS () {
    return ['top-left', 'bottom-left', 'top-right', 'bottom-right']
  }

  static Register () {
    window.customElements.define('immers-hud', ImmersHUD)
  }
}
