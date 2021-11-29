export const IMMERS_STORE_KEY = '_immers_client_store'

// keeps in-memory store syncrhonized with localStorage via proxy.
// Does not yet support deep assignments
export function createStore (persistInLocalStorage) {
  if (!persistInLocalStorage) {
    return {}
  }
  let storeTemp
  try {
    storeTemp = JSON.parse(window.localStorage.getItem(IMMERS_STORE_KEY) || '{}')
  } catch {
    storeTemp = {}
  }
  return new Proxy(storeTemp, {
    set (target, property, value) {
      target[property] = value
      window.localStorage.setItem(IMMERS_STORE_KEY, JSON.stringify(target))
      return true
    }
  })
}

export function clearStore (store) {
  Object.keys(store).forEach(key => { store[key] = undefined })
}
