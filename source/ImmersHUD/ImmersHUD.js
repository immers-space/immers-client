import htmlTemplate from './ImmersHUD.html'
import styles from './ImmersHUD.css'
import { ImmersClient } from '../client'
import { roles } from '../authUtils'

/**
 * Web Component heads-up display for Immers profile login.
 * Unobtrusively connects your Immersive Web experience to Immers Space,
 * allowing immersers to connect with their profiles from your site
 * and share your site with their friends. Grants access to profile information
 * so you can bring users' preferred identity into your experience.
 *
 * The HTML attributes are listed in the Properties table below.
 * Properties you can access from the element object directly are listed under Members.
 *
 * The following CSS properties can be set on the immers-hud:
 *
 * color: text color for floating text
 *
 * --main-margin: distance from edge of window in overlay mode
 *
 * --inner-margin: gap between elements
 *
 * --handle-input-width: size of the handle input
 *
 * @class ImmersHUD
 *
 * @fires immers-hud-connected - On successful login, detail.profile will include users {@link Profile}
 *
 * @prop {'top-left'|'top-right'|'bottom-left'|'bottom-right'} [position] - Enable overlay positioning.
 * @prop {string} [token-catcher] - OAuth redirect URL, a page on your domain that runs {@link catchToken} on load (default: current url)
 * @prop {string} [access-role] - Requested authorization scope from {@link roles}. Users are given the option to alter this and grant a different level. (default: modAdditive)
 * @prop {string} [destination-name] Title for your experience (default: meta[og:description], document.title)
 * @prop {string} [destination-url] Sharable URL for your experience (default: current url)
 * @prop {string} [destination-description] Social share preview test (default meta[og:description], meta[twitter:description])
 * @prop {string} [destination-image] Image url for social share previews (default: meta[og:image], meta[twitter:image])
 * @prop {string} [local-immer] Origin of your local Immers Server, if you have one
 * @prop {boolean} [allow-storage] Enable local storage of user identity to reconnect when returning to page
 * @prop {'true'|'false'} open - Toggles between icon and full HUD view (default: true is user's handle is saved but login is needed, false otherwise)
 *
 * @example <caption>Load & register the custom element via import (option 1)</caption>
 * import { ImmersHUD } from 'immers-client';
 * ImmersHUD.Register();
 * @example <caption>Load & register the custom element via CDN (option 2)</caption>
 * <script type="module" src="https://cdn.jsdelivr.net/npm/immers-client/dist/ImmersHUD.bundle.js"></script>
 * @example <caption>Using the custom element in HTML</caption>
 * <immers-hud position="bottom-left" access-role="friends"
 *             destination-name="My Immer" destination-url="https://myimmer.com/"
 *             token-catcher="https://myimmer.com/"></immers-hud>
 *
 */
export class ImmersHUD extends window.HTMLElement {
  #queryCache = {}
  #container
  /**
   * Live-updated friends list with current status
   * @type {FriendStatus[]}
   */
  friends = []
  /**
   * Immers client instance
   * @type {ImmersClient}
   */
  immersClient
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
    const destination = {
      name: this.getAttribute('destination-name') || this.#meta('og:title') || document.title,
      url: this.getAttribute('destination-url') || window.location.href
    }
    const description = this.getAttribute('destination-description') || this.#meta('og:description') || this.#meta('twitter:description')
    if (description) {
      destination.description = description
    }
    const image = this.getAttribute('destination-image') || this.#meta('og:image') || this.#meta('twitter:image')
    if (image) {
      destination.previewImage = image
    }
    this.immersClient = new ImmersClient(destination, {
      localImmer: this.getAttribute('local-immer'),
      allowStorage: this.hasAttribute('allow-storage')
    })
    this.immersClient.addEventListener(
      'immers-client-friends-update',
      ({ detail: { friends } }) => this.onFriendsUpdate(friends)
    )
    this.immersClient.addEventListener(
      'immers-client-connected',
      ({ detail: { profile } }) => this.onClientConnected(profile)
    )
    this.immersClient.addEventListener(
      'immers-client-disconnected',
      () => this.onClientDisconnected()
    )

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
          // TODO: add confirmation modal
          this.remove()
          break
        case 'logout':
          this.immersClient.logout()
          break
      }
    })

    if (this.immersClient.handle) {
      this.#el('handle-input').value = this.immersClient.handle
      this.immersClient.reconnect().then(connected => {
        if (!connected) {
          // user has logged in before, but action required to reconnect
          // prompt with open, pre-filled login
          this.setAttribute('open', true)
        }
      })
    }
  }

  attributeChangedCallback (name, oldValue, newValue) {
    switch (name) {
      case 'position':
        if (newValue && !ImmersHUD.POSITION_OPTIONS.includes(newValue)) {
          console.warn(`immers-hud: unknown position ${newValue}. Valid options are ${ImmersHUD.POSITION_OPTIONS.join(', ')}`)
        }
        break
      case 'open':
        this.#el('notification').classList.add('hidden')
        break
    }
  }

  login () {
    this.immersClient.login(
      this.getAttribute('token-catcher') || window.location.href,
      this.getAttribute('access-role') || roles[2],
      this.#el('handle-input').value
    ).then(() => this.immersClient.enter())
  }

  onClientConnected (profile) {
    this.#el('login-container').classList.add('removed')
    this.#el('status-container').classList.remove('removed')
    // show profile info
    if (profile.avatarImage) {
      this.#el('logo').style.backgroundImage = `url(${profile.avatarImage})`
    }
    this.#el('username').textContent = profile.displayName
    this.#el('profile-link').setAttribute('href', profile.url)
    this.#emit('immers-hud-connected', { profile })
  }

  onClientDisconnected () {
    this.#el('login-container').classList.remove('removed')
    this.#el('status-container').classList.add('removed')
    this.#el('handle-input').value = ''
    this.#el('logo').style.backgroundImage = ''
    this.#el('username').textContent = ''
    this.#el('profile-link').setAttribute('href', '#')
  }

  onFriendsUpdate (friends) {
    this.friends = friends
    if (this.getAttribute('open') !== 'true') {
      this.#el('notification').classList.remove('hidden')
    }
    this.#el('status-message').textContent = `${friends.filter(f => f.isOnline).length}/${friends.length} friends online`
  }

  #el (id) {
    return this.#queryCache[id] ?? (this.#queryCache[id] = this.#container.querySelector(`#${id}`))
  }

  #emit (type, data) {
    this.dispatchEvent(new window.CustomEvent(type, {
      detail: data
    }))
  }

  #meta (name) {
    const attr = name.startsWith('og:') ? 'property' : 'name'
    return document.querySelector(`meta[${attr}="${name}"]`)?.getAttribute('content')
  }

  static get observedAttributes () {
    return ['position', 'open']
  }

  static get POSITION_OPTIONS () {
    return ['top-left', 'bottom-left', 'top-right', 'bottom-right']
  }

  static Register () {
    window.customElements.define('immers-hud', ImmersHUD)
  }
}
