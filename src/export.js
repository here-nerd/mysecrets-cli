const { resolveConfig, parseSpec } = require('./config');
const { fetchSecret } = require('./client');

/**
 * `export` command:
 *   Fetch secrets and print them as KEY=value lines to stdout.
 *
 *   Default format is GitHub Actions compatible (single-line `KEY=value`,
 *   heredoc for multi-line values). The `--format shell` flag emits
 *   single-quoted shell-eval-compatible lines instead.
 *
 *   Examples:
 *     mysecrets-cli export -s stripe-key:STRIPE_KEY >> $GITHUB_ENV
 *     eval "$(mysecrets-cli export -s stripe-key:STRIPE_KEY --format shell)"
 *
 *   File-type secrets are not supported in export — use `run` for those.
 */
async function exportCommand(options) {
  const config = resolveConfig(options);
  const specs = (options.secret || []).map(parseSpec);

  if (specs.length === 0) {
    throw new Error('no secrets specified. Use -s <id>:<envVar>');
  }

  const fileSpecs = specs.filter((s) => s.type === 'file');
  if (fileSpecs.length > 0) {
    throw new Error(
      `file-type secrets not supported in 'export': ${fileSpecs.map((s) => s.id).join(', ')}. ` +
      `Use 'mysecrets-cli run' for file-type secrets.`,
    );
  }

  const format = options.format || 'github';
  if (format !== 'github' && format !== 'shell') {
    throw new Error(`invalid --format '${format}'. Use 'github' (default) or 'shell'.`);
  }

  const values = await Promise.all(specs.map((s) => fetchSecret(config, s.id)));

  const formatLine = format === 'shell' ? formatShellLine : formatGithubLine;

  for (let i = 0; i < specs.length; i++) {
    process.stdout.write(formatLine(specs[i].envVar, values[i]));
  }
}

/**
 * GitHub Actions env-file format.
 * https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-environment-variable
 */
function formatGithubLine(key, value) {
  if (value.includes('\n')) {
    // Pick a delimiter very unlikely to appear in the value.
    const delim = `EOF_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    return `${key}<<${delim}\n${value}\n${delim}\n`;
  }
  return `${key}=${value}\n`;
}

/**
 * Shell-eval-compatible format: single quotes, with embedded single quotes
 * escaped via the standard `'\''` trick.
 */
function formatShellLine(key, value) {
  const escaped = value.replace(/'/g, `'\\''`);
  return `${key}='${escaped}'\n`;
}

module.exports = { exportCommand };
