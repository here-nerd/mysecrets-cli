/**
 * Resolve configuration from CLI options + environment variables.
 *
 * Priority: CLI options > env vars.
 */
function resolveConfig(options) {
  const token = options.token || process.env.MYSECRETS_TOKEN;
  const apiUrl = options.apiUrl || process.env.MYSECRETS_API_URL;

  if (!token) {
    throw new Error('no auth token. Set MYSECRETS_TOKEN env var or pass --token.');
  }

  if (!apiUrl) {
    throw new Error('no API URL. Set MYSECRETS_API_URL env var or pass --api-url.');
  }

  return { token, apiUrl };
}

/**
 * Parse a secret spec string of the form `<id>:<envVar>[:value|file]`.
 *
 * Examples:
 *   "stripe-key:STRIPE_API_KEY"             -> { id, envVar, type: 'value' }
 *   "firebase-sa:GOOGLE_APPLICATION_CREDENTIALS:file"
 *                                           -> { id, envVar, type: 'file' }
 *
 * `value` means: set the env var to the secret content directly.
 * `file`  means: write the secret to a temp file, set the env var to its path.
 */
function parseSpec(spec) {
  const parts = spec.split(':');

  if (parts.length < 2 || parts.length > 3) {
    throw new Error(
      `invalid secret spec '${spec}'. Expected '<id>:<envVar>' or '<id>:<envVar>:value|file'.`,
    );
  }

  const [id, envVar, type = 'value'] = parts;

  if (!id || !envVar) {
    throw new Error(`invalid secret spec '${spec}'. id and envVar are required.`);
  }

  if (type !== 'value' && type !== 'file') {
    throw new Error(
      `invalid type '${type}' in spec '${spec}'. Use 'value' (default) or 'file'.`,
    );
  }

  return { id, envVar, type };
}

module.exports = { resolveConfig, parseSpec };
