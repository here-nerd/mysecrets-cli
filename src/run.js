const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { resolveConfig, parseSpec } = require('./config');
const { fetchSecret } = require('./client');

/**
 * `run` command:
 *   Fetch the specified secrets, inject them into the environment, and spawn
 *   a child process. File-type secrets are written to temp files which are
 *   cleaned up when the child exits.
 */
async function runCommand(commandArgs, options) {
  if (!commandArgs || commandArgs.length === 0) {
    throw new Error('no command provided. Usage: mysecrets-cli run [options] -- <command> [args]');
  }

  const config = resolveConfig(options);
  const specs = (options.secret || []).map(parseSpec);

  if (specs.length === 0) {
    console.error('mysecrets-cli: no secrets requested; running command unchanged.');
  }

  // Fetch all secrets in parallel — fail fast on the first error.
  const values = await Promise.all(specs.map((s) => fetchSecret(config, s.id)));

  // Build the env and any temp files.
  const env = { ...process.env };
  const tempFiles = [];

  // Register cleanup once; runs synchronously on every exit path,
  // including process.exit(), uncaught exceptions, and signals.
  process.on('exit', () => cleanupTempFiles(tempFiles));

  try {
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const value = values[i];

      if (spec.type === 'file') {
        const filePath = writeTempFile(value, spec.id);
        tempFiles.push(filePath);
        env[spec.envVar] = filePath;
      } else {
        env[spec.envVar] = value;
      }
    }

    const [cmd, ...args] = commandArgs;
    const exitCode = await spawnChild(cmd, args, env);
    process.exit(exitCode);
  } catch (err) {
    // Cleanup will still run via the 'exit' handler when process.exit is
    // called (either by the top-level catch in index.js or below).
    throw err;
  }
}

/**
 * Write `content` to a 0600 temp file inside a dedicated mkdtemp directory.
 * Returns the absolute file path.
 */
function writeTempFile(content, idHint) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mysecrets-'));
  const safeName = (idHint || 'secret').replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(dir, safeName);
  fs.writeFileSync(filePath, content, { mode: 0o600 });
  return filePath;
}

function cleanupTempFiles(paths) {
  for (const p of paths) {
    try {
      fs.unlinkSync(p);
      fs.rmdirSync(path.dirname(p));
    } catch {
      // best effort
    }
  }
}

/**
 * Spawn a child process with stdio inherited from the parent.
 * Forwards SIGINT/SIGTERM to the child.
 * Resolves with the child's exit code (or 128+signal if killed by signal).
 */
function spawnChild(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: 'inherit' });

    const forward = (signal) => () => {
      try { child.kill(signal); } catch { /* ignore */ }
    };
    const onSigint = forward('SIGINT');
    const onSigterm = forward('SIGTERM');

    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);

    child.on('exit', (code, signal) => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
      if (code !== null) {
        resolve(code);
      } else if (signal) {
        resolve(128 + (os.constants.signals[signal] || 0));
      } else {
        resolve(1);
      }
    });

    child.on('error', (err) => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
      reject(new Error(`failed to spawn '${cmd}': ${err.message}`));
    });
  });
}

module.exports = { runCommand };
