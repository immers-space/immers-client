/**
 * @typedef {string} IRI String representing a unique resource URL
 */
/**
 * @typedef {Object} APObject Object representing an ActivityPub object
 * @property {IRI} id
 * @property {string} type
 */
/**
 * @typedef {Object} APActivity Object representing an ActivityPub activity
 * @property {IRI} id
 * @property {string} type
 * @property {APActor} actor
 */
/**
 * @typedef {Object} APActor Object representing an ActivityPub actor
 * @property {IRI} id
 * @property {string} type
 * @property {IRI} inbox
 * @property {IRI} outbox
 */
/**
 * @typedef {Object} APPlace
 * @property {IRI} id
 * @property {String} type 'Place'
 * @property {String} name Title of the destination
 * @property {String} url link to visit the destination
 * @property {String} audience who can view this object (generally Activities.PublicAddress)
 */

/** Low-level API client-to-server ActivityPub methods */
export class Activities {
  static JSONLDMime = 'application/activity+json'
  static PublicAddress = 'as:Public'
  static NodeInfoV21 = 'http://nodeinfo.diaspora.software/ns/schema/2.1'
  static NodeInfoV20 = 'http://nodeinfo.diaspora.software/ns/schema/2.0'

  #token
  /**
   * @param  {APActor} actor The user's actor object
   * @param  {string} homeImmer Protocol and domain of user's home Immers server
   * @param  {APObject} place Place-type object representing this Immersive Web experience
   * @param  {string} [token] OAuth2 token for user's home Immers server
   * @param  {string} [localImmer] Protocol and domain of local Immers server, e.g. https://immers.space
   */
  constructor (actor, homeImmer, place, token, localImmer) {
    this.actor = actor
    this.homeImmer = homeImmer
    this.place = place
    this.#token = token
    this.localImmer = localImmer
    // this.authorizedScopes = null
    this.nextInboxPage = null
    this.nextOutboxPage = null
    this.inboxStartDate = new Date()
    this.outboxStartDate = this.inboxStartDate
    // this.friends = []
  }

  trustedIRI (IRI) {
    return (this.localImmer && IRI.startsWith(this.localImmer)) || IRI.startsWith(this.homeImmer)
  }

  // lower-level utilities
  async getObject (IRI) {
    let result
    const headers = { Accept: Activities.JSONLDMime }
    if (this.#token) {
      headers.Authorization = `Bearer ${this.#token}`
    }
    if (this.trustedIRI(IRI)) {
      result = await window.fetch(IRI, { headers })
    } else if (this.actor.endpoints?.proxyUrl) {
      result = await window.fetch(this.actor.endpoints.proxyUrl, {
        method: 'POST',
        body: new URLSearchParams({ id: IRI }),
        headers
      })
    } else {
      throw new Error('Home immer does not support object fetch proxy')
    }
    if (!result.ok) {
      throw new Error(`Object fetch error ${result.message}`)
    }
    return result.json()
  }

  async postActivity (activity) {
    if (!this.trustedIRI(this.actor.outbox)) {
      throw new Error('Invalid outbox address')
    }
    const result = await window.fetch(this.actor.outbox, {
      method: 'POST',
      headers: {
        'Content-Type': Activities.JSONLDMime,
        Authorization: `Bearer ${this.#token}`
      },
      body: JSON.stringify(activity)
    })
    if (!result.ok) {
      throw new Error(`Error creating avatar: ${result.status} ${result.body}`)
    }
    return result.headers.get('Location')
  }

  // collection fetchers
  async inbox () {
    let col
    if (this.nextInboxPage === null) {
      col = await this.getObject(this.actor.inbox)
      if (!col.orderedItems && col.first) {
        col = await this.getObject(col.first)
      }
    } else if (this.nextInboxPage) {
      col = await this.getObject(this.nextInboxPage)
    }
    this.nextInboxPage = col?.next
    return col
  }

  async outbox () {
    let col
    if (this.nextOutboxPage === null) {
      col = await this.getObject(this.actor.outbox)
      if (!col.orderedItems && col.first) {
        col = await this.getObject(col.first)
      }
    } else if (this.nextOutboxPage) {
      col = await this.getObject(this.nextOutboxPage)
    }
    this.nextOutboxPage = col?.next
    return col
  }

  async blockList () {
    const blocked = []
    // use blocklist IRI if specified, fallback to immers default
    const blockedIRI = this.actor.streams?.blocked || `${this.homeImmer}/blocked/${this.actor.preferredUsername}`
    let col
    try {
      col = await this.getObject(blockedIRI)
    } catch (err) {
      console.warn('Unable to fetch blocklist: ', err.message)
      return blocked
    }
    if (col.orderedItems?.length) {
      blocked.push(...col.orderedItems)
    } else {
      col = await this.getObject(col.first)
      blocked.push(...col.orderedItems)
    }
    // fetch entire collection
    while (col.next) {
      col = await this.getObject(col.next)
      if (!col.orderedItems?.length) {
        break
      }
      blocked.push(...col.orderedItems)
    }
    return blocked.map(b => (typeof b === 'object' ? b.id : b))
  }

  // activity-specific posting methods
  accept (follow) {
    return this.postActivity({
      type: 'Accept',
      actor: this.actor.id,
      object: follow.id,
      to: follow.actor,
      summary: '<span>Accepted your a friend request</span>'
    })
  }

  /**
   * "Add" object to the target collection
   * @param  {APObject} object
   * @param  {IRI} target
   */
  add (object, target) {
    return this.postActivity({
      type: 'Add',
      actor: this.actor.id,
      object: object.id,
      target
    })
  }

  arrive (place = this.place) {
    return this.postActivity({
      type: 'Arrive',
      actor: this.actor.id,
      target: place,
      to: this.actor.followers,
      summary: `<span>Arrived at <a href="${place.url}">${place.name}</a></span>`
    })
  }

  leave (place = this.place) {
    return this.postActivity({
      type: 'Leave',
      actor: this.actor.id,
      target: place,
      to: this.actor.followers,
      summary: `<span>Left <a href="${place.url}">${place.name}</a></span>`
    })
  }

  block (blockeeId) {
    return this.postActivity({
      type: 'Block',
      actor: this.actor.id,
      object: blockeeId
    })
  }

  /**
   * Post a create activity for an object
   * @param  {APObject} object New object to be wrapped in Create activity
   * @return {Promise<APActivity>} The resulting Create activity
   */
  create (object) {
    return this.postActivity({
      type: 'Create',
      actor: this.actor.id,
      object
    }).then(res => {
      if (!res.ok) {
        throw new Error('Error creating', res.status, res.body)
      }
      return this.getObject(res.headers.get('Location'))
    })
  }

  follow (targetId) {
    return this.postActivity({
      type: 'Follow',
      actor: this.actor.id,
      object: targetId,
      to: targetId,
      summary: '<span>Sent you a friend request</span>'
    })
  }

  friends () {
    const friendsEndpoint = this.actor.endpoints?.friends ?? `${this.actor.id}/friends`
    return this.getObject(friendsEndpoint)
  }

  image (url, to, audience, summary) {
    const obj = {
      url,
      type: 'Image',
      attributedTo: this.actor.id,
      context: this.place,
      to: to.slice()
    }
    if (summary) {
      obj.summary = summary
    }
    if (audience === 'friends' || audience === 'public') {
      obj.to.push(this.actor.followers)
    }
    if (audience === 'public') {
      obj.to.push(Activities.PublicAddress)
    }
    return this.postActivity(obj)
  }

  note (content, to, audience, summary) {
    const obj = {
      content,
      type: 'Note',
      attributedTo: this.actor.id,
      context: this.place,
      to: to.slice()
    }
    if (summary) {
      obj.summary = summary
    }
    if (audience === 'friends' || audience === 'public') {
      obj.to.push(this.actor.followers)
    }
    if (audience === 'public') {
      obj.to.push(Activities.PublicAddress)
    }
    return this.postActivity(obj)
  }

  reject (objectId, recipientId) {
    return this.postActivity({
      type: 'Reject',
      actor: this.actor.id,
      object: objectId,
      to: recipientId
    })
  }

  updateProfile (update) {
    update.id = this.actor.id
    const activity = {
      type: 'Update',
      actor: this.actor.id,
      object: update,
      to: this.actor.followers
    }
    return this.postActivity(activity)
  }

  video (url, to, audience, summary) {
    const obj = {
      url,
      type: 'Video',
      attributedTo: this.actor.id,
      context: this.place,
      to: to.slice()
    }
    if (summary) {
      obj.summary = summary
    }
    if (audience === 'friends' || audience === 'public') {
      obj.to.push(this.actor.followers)
    }
    if (audience === 'public') {
      obj.to.push(Activities.PublicAddress)
    }
    return this.postActivity(obj)
  }
}
