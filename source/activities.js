/** @namespace Activities */
/**
 * @typedef {string} Activities.IRI String representing a unique resource URL
 */
/** @typedef {('direct'|'friends'|'public')} Activities.Audience visibilty and delivery targets for activity or obejct */
/**
 * @typedef {Object} Activities.APObject Object representing an ActivityPub object
 * @property {Activities.IRI} id
 * @property {string} type
 */
/**
 * @typedef {Object} Activities.APLink Object representing an ActivityPub object
 * @property {Activities.IRI} id
 * @property {string} type
 */
/**
 * @typedef {Object} Activities.APActivity Object representing an ActivityPub activity
 * @property {Activities.IRI} id
 * @property {string} type
 * @property {Activities.APActor} actor
 */
/**
 * @typedef {Object} Activities.APActor Object representing an ActivityPub actor
 * @property {Activities.IRI} id
 * @property {string} type
 * @property {Activities.IRI} inbox
 * @property {Activities.IRI} outbox
 */
/**
 * @typedef {Object} Activities.APPlace
 * @property {Activities.IRI} id
 * @property {'Place'} type
 * @property {String} name Title of the destination
 * @property {String} [summary] Description destination
 * @property {String} url link to visit the destination
 * @property {String} audience who can view this object (generally Activities.PublicAddress)
 * @property {(string|Activities.APObject|Activities.APLink)} [icon] preview image
 * @property {Activities.APPlace} [context] Main Place object representing the immer this place exists in
 */
/**
 * @typedef {Object} Activities.APModel
 * @property {Activities.IRI} id
 * @property {'Model'} type
 * @property {string} name Model name
 * @property {(string|Activities.APObject|Activities.APLink)} url link to 3D model file
 * @property {(string|Activities.APObject|Activities.APLink)} [icon] preview image
 * @property {string} audience who can view this object (generally Activities.PublicAddress)
 */

import { getURLPart, htmlAnchorForPlace } from './utils'

/** Low-level API client-to-server ActivityPub methods */
export class Activities {
  static JSONLDMime = 'application/activity+json'
  static PublicAddress = 'as:Public'
  static NodeInfoV21 = 'http://nodeinfo.diaspora.software/ns/schema/2.1'
  static NodeInfoV20 = 'http://nodeinfo.diaspora.software/ns/schema/2.0'

  #token
  /**
   * @param  {Activities.APActor} actor The user's actor object
   * @param  {string} homeImmer Protocol and domain of user's home Immers server
   * @param  {Activities.APObject} place Place-type object representing this Immersive Web experience
   * @param  {string} [token] OAuth2 token for user's home Immers server
   * @param  {string} [localImmer] Origin of local Immers server, e.g. https://immers.space
   */
  constructor (actor, homeImmer, place, token, localImmer) {
    this.actor = actor
    this.homeImmer = homeImmer
    this.place = place
    this.#token = token
    this.localImmer = localImmer ? getURLPart(localImmer, 'origin') : undefined
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
  /**
   * Fetch the ActivityPub entity at the given IRI
   * (may be object, activity, collection, et c).
   * If the domain is the user's home immer or the local immer,
   * makes a fetch with credentials included. Otherwise uses the user's
   * home immer proxy service, if available
   * @param  {string} IRI
   * @returns {Promise<any>}
   */
  async getObject (IRI) {
    let result
    const headers = { Accept: Activities.JSONLDMime }
    if (this.#token) {
      headers.Authorization = `Bearer ${this.#token}`
    }
    if (this.trustedIRI(IRI.toString())) {
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
      throw new Error(`Error posting activity: ${result.status} ${await result.text()}`)
    }
    return result.headers.get('Location')
  }

  /**
   * Post an activity with media upload
   * @param  {Activities.APActivity} activity
   * @param  {Blob} file
   * @param  {Blob} [icon]
   */
  async postMedia (activity, file, icon) {
    if (!this.trustedIRI(this.actor.endpoints.uploadMedia)) {
      throw new Error('Missing/invalid upload media endpoint')
    }
    const formData = new globalThis.FormData()
    formData.append('file', file, file.name ?? 'UploadedFile')
    if (icon) {
      formData.append('icon', icon, icon.name ?? 'UploadedIcon')
    }
    formData.append('object', JSON.stringify(activity))
    const result = await window.fetch(this.actor.endpoints.uploadMedia, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#token}`
      },
      body: formData
    })
    if (!result.ok) {
      throw new Error(`Error creating avatar: ${result.status} ${await result.text()}`)
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

  /**
   * List of IRIs for users blocked by this user
   * @returns {string[]} blocked user IRIs
   */
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
      summary: '<span>Accepted your friend request</span>'
    })
  }

  /**
   * Add something to a user collection. The object of this must be an activity,
   * use e.g. the Create actvitiy for a Model object to add it to the 'avatars' collection
   * @param  {(Activities.IRI|Activities.APObject)} activity - id or object of the activity to be added
   * @param  {(Activities.IRI|string)} target - Collection identifier from actor.streams, or collection name to be converted into an identifier
   */
  add (activity, target) {
    return this.postActivity({
      type: 'Add',
      actor: this.actor.id,
      object: typeof activity === 'string' ? activity : activity.id,
      target: target.startsWith('https://')
        ? target
        : `https://${getURLPart(this.homeImmer, 'host')}/collection/${this.actor.preferredUsername}/${target}`
    })
  }

  arrive (place = this.place) {
    return this.postActivity({
      type: 'Arrive',
      actor: this.actor.id,
      target: place,
      to: this.actor.followers,
      summary: `<span>Arrived at ${htmlAnchorForPlace(place)}</span>`
    })
  }

  leave (place = this.place) {
    return this.postActivity({
      type: 'Leave',
      actor: this.actor.id,
      target: place,
      to: this.actor.followers,
      summary: `<span>Left ${htmlAnchorForPlace(place)}</span>`
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
   * @param  {Activities.APObject} object - New object to be wrapped in Create activity
   * @param  {Activities.IRI[]} to - direct addressee IRIs
   * @param  {Activities.Audience} audience - direct, friends, or public
   * @param  {string} [summary] - activity summary description (may contain HTML)
   * @return {Promise<IRI>} The resulting Create activity IRI
   */
  create (object, to, audience, summary) {
    object.context = this.place
    const activity = {
      type: 'Create',
      actor: this.actor.id,
      to: to.slice(),
      object
    }
    if (summary) {
      activity.summary = summary
    }
    if (audience === 'friends' || audience === 'public') {
      activity.to.push(this.actor.followers)
    }
    if (audience === 'public') {
      activity.to.push(Activities.PublicAddress)
    }
    return this.postActivity(activity)
  }

  delete (object) {
    return this.postActivity({
      type: 'Delete',
      actor: this.actor.id,
      object: typeof object === 'string' ? object : object.id
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

  image (urlOrBlob, to, audience, summary) {
    const obj = {
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
    if (typeof urlOrBlob === 'string') {
      obj.url = urlOrBlob
      return this.postActivity(obj)
    }
    if (urlOrBlob instanceof Blob) {
      return this.postMedia(obj, urlOrBlob)
    }
    return Promise.reject(new Error('Image must be either url string or Blob data'))
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

  model (name, glb, icon, to, audience) {
    const obj = {
      name,
      type: 'Model',
      attributedTo: this.actor.id,
      context: this.place,
      to: to.slice()
    }
    if (audience === 'friends' || audience === 'public') {
      obj.to.push(this.actor.followers)
    }
    if (audience === 'public') {
      obj.to.push(Activities.PublicAddress)
    }
    return this.postMedia(obj, glb, icon)
  }

  reject (objectId, recipientId) {
    return this.postActivity({
      type: 'Reject',
      actor: this.actor.id,
      object: objectId,
      to: recipientId
    })
  }

  remove (activity, target) {
    return this.postActivity({
      type: 'Remove',
      actor: this.actor.id,
      object: typeof activity === 'string' ? activity : activity.object,
      target: target.startsWith('https://')
        ? target
        : `https://${getURLPart(this.homeImmer, 'host')})/collection/${this.actor.preferredUsername}/${target}`
    })
  }

  undo (activity) {
    return this.postActivity({
      type: 'Undo',
      actor: this.actor.id,
      object: typeof activity === 'string' ? activity : activity.id,
      to: activity.to
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

  video (urlOrBlob, to, audience, summary) {
    const obj = {
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
    if (typeof urlOrBlob === 'string') {
      obj.url = urlOrBlob
      return this.postActivity(obj)
    }
    if (urlOrBlob instanceof Blob) {
      return this.postMedia(obj, urlOrBlob)
    }
    return Promise.reject(new Error('Image must be either url string or Blob data'))
  }
}
