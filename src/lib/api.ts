/**
 * Typed fetch wrapper for the CU.Setu Flask API.
 *
 * All browser requests go through the gateway as relative paths with the
 * backend port carried in the `XTransformPort` query parameter — never an
 * absolute URL. Session cookies flow automatically (same-origin).
 */

const API_PORT = 5001

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function extractError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as { error?: unknown }).error
    if (typeof message === 'string' && message.trim() !== '') return message
  }
  return fallback
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const url = `/api${path}${separator}XTransformPort=${API_PORT}`

  const headers = new Headers(init?.headers)
  if (init?.body) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(url, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError('Could not reach the CU.Setu server.', 0)
  }

  let payload: unknown = null
  try {
    const text = await response.text()
    if (text !== '') payload = JSON.parse(text)
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ApiError(
      extractError(payload, `Request failed with status ${response.status}`),
      response.status,
    )
  }

  return payload as T
}

/**
 * Multipart upload (profile photos, post photos / videos). The browser
 * sets the multipart Content-Type boundary itself, so no header is forced.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const url = `/api${path}${separator}XTransformPort=${API_PORT}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError('Could not reach the CU.Setu server.', 0)
  }

  let payload: unknown = null
  try {
    const text = await response.text()
    if (text !== '') payload = JSON.parse(text)
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ApiError(
      extractError(payload, `Upload failed with status ${response.status}`),
      response.status,
    )
  }

  return payload as T
}

/**
 * Media URLs returned by the backend (e.g. avatar_url) live under /api/*,
 * so <img> / <video> tags must also carry the gateway port parameter.
 */
export function mediaSrc(path: string): string {
  if (!path) return ''
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}XTransformPort=${API_PORT}`
}
