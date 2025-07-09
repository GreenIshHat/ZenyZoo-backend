// utils.js
/**
 * Read Django’s “csrftoken” cookie.
 */
export function getCSRFToken() {
  // match “csrftoken=<value>” in document.cookie
  const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/);
  return match ? match[2] : '';
}

/**
 * Helper: fetch + JSON parse + same-origin credentials.
 */
export async function fetchJson(url, options = {}) {
  const r = await fetch(url, {
    credentials: 'same-origin',
    ...options
  });
  if (!r.ok) return r.text().then(t => Promise.reject(t));
  return await r.json();
}
