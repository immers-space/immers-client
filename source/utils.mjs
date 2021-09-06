/**
 * @typedef {Object} ParsedHandle
 * @property {string | undefined} username - The user's local identifier
 * @property {string | undefined} immer - The user's home immer hostname
 */
/**
 * Parse an immers handle string into username and home immer hostname
 * @param  {string} handle Immers handle (username[home.immer] or username@home.immer)
 * @returns {ParsedHandle} Parsed handle object (values are undefined if handle not valid)
 */
const handleReg = /([^@[]+)[@[]([^\]]+)/
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
