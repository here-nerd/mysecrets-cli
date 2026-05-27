/**
 * Fetch a single secret from the backend by id.
 *
 * Expects a 200 response with shape { id, value, fetchedAt }.
 * Throws on auth failure, not-found, or any other non-2xx.
 */
async function fetchSecret(config, id) {
  const url = `${config.apiUrl.replace(/\/+$/, '')}/secrets/${encodeURIComponent(id)}`;

  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch (err) {
    throw new Error(`failed to reach backend at ${url}: ${err.message}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`auth failed (${res.status}). Check MYSECRETS_TOKEN.`);
  }

  if (res.status === 404) {
    throw new Error(`secret '${id}' not found on backend.`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`backend error (${res.status}): ${body || res.statusText}`);
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new Error(`backend returned non-JSON response for '${id}'`);
  }

  if (typeof body.value !== 'string') {
    throw new Error(`malformed response for '${id}': missing or non-string 'value' field`);
  }

  return body.value;
}

module.exports = { fetchSecret };
