const stableHash = (value: string): string => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const buildDeterministicUid = (
  namespace: string,
  name: string,
  creationTimestamp: string
): string => {
  const base = `${namespace}/${name}/${creationTimestamp}`
  const chunk = stableHash(base)
  return `${chunk}-${chunk.slice(0, 4)}-${chunk.slice(4)}-${chunk.slice(0, 4)}-${chunk}${chunk.slice(0, 4)}`
}

export const buildDeterministicResourceVersion = (
  namespace: string,
  name: string,
  creationTimestamp: string
): string => {
  const base = `${namespace}/${name}/${creationTimestamp}`
  const numeric = parseInt(stableHash(base).slice(0, 7), 16)
  return String((numeric % 900000) + 100000)
}

export const normalizeKubernetesTimestamp = (rawTimestamp: string): string => {
  const parsedTimestamp = new Date(rawTimestamp)
  if (Number.isNaN(parsedTimestamp.getTime())) {
    return rawTimestamp
  }
  return parsedTimestamp.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
