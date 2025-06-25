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
export function fetchJson(url, options = {}) {
  return fetch(url, {
    credentials: 'same-origin',
    ...options
  })
    .then(r => {
      if (!r.ok) return r.text().then(t => Promise.reject(t));
      return r.json();
    });
}
