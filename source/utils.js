import DOMPurify from 'dompurify'

/**
 * @typedef {Object} ParsedHandle
 * @property {string | undefined} username - The user's local identifier
 * @property {string | undefined} immer - The user's home immer hostname
 */
const handleReg = /([^@[]+)[@[]([^\]]+)/
/**
 * Parse an immers handle string into username and home immer hostname
 * @param  {string} handle Immers handle (username[home.immer] or username@home.immer)
 * @returns {ParsedHandle} Parsed handle object (values are undefined if handle not valid)
 */
export function parseHandle (handle) {
  const match = handleReg.exec(handle)
  if (match && match.length === 3) {
    return {
      username: match[1],
      immer: match[2]
    }
  }
  return {}
}

export function desc (prop) {
  return (a, b) => {
    if (a[prop] < b[prop]) {
      return 1
    }
    if (b[prop] < a[prop]) {
      return -1
    }
    return 0
  }
}
/**
 * Process a url-like input into a fully formed URL in order to fetch
 * a specific portion via the URL API
 * @param  {string} input - potentially incomplete origin, e.g. domain/hostname, host, or origin
 * @param  {string} part - property name from the URL API to return, e.g. 'origin' or 'host'
 */
export function getURLPart (input, part) {
  let url
  let location = input.toString()
  if (!/^https?:\/\//.test(location)) {
    location = `https://${location}`
  }
  try {
    url = new URL(location)
  } catch (err) {
    console.debug(err.message)
    throw new Error(`Invalid URL: ${input}`)
  }
  return url[part]
}
/**
 * Generate anchor tag for a place, e.g. for arrive/leave summaries.
 * Returned value is sanitized and safe to render.
 * @param  {Activities.APPlace} place
 * @returns {string} sanitized html
 */
export function htmlAnchorForPlace (place) {
  if (!place) {
    return ''
  }
  const contextName = place.context?.name ? `${place.context.name}: ` : ''
  return DOMPurify.sanitize(`<a href="${place.url}">${contextName}${place.name}</a>`)
}
