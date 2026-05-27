# mysecrets-cli

Fetch secrets from your `mysecrets` backend and inject them into processes or CI/CD.

Two commands:

- **`run`** — fetch secrets, set them as env vars, spawn a child process. File-type secrets (e.g. service account JSONs) are written to temp files which are cleaned up when the child exits.
- **`export`** — fetch secrets and print `KEY=value` lines to stdout. Useful for `>> $GITHUB_ENV` or `eval`.

## Install

For local dev:

```bash
git clone <this repo>
cd cli
npm install
npm link        # makes `mysecrets-cli` available globally
```

In GitHub Actions (no publishing required):

```yaml
- run: npm install -g github:yourname/yourrepo
```

Or just call it directly from a checked-out copy with `node bin/mysecrets-cli ...`.

## Configuration

Two environment variables (or CLI flags) are required:

| Env var               | CLI flag       | Purpose                              |
|-----------------------|----------------|--------------------------------------|
| `MYSECRETS_TOKEN`     | `--token`      | Auth token sent as `Bearer <token>`  |
| `MYSECRETS_API_URL`   | `--api-url`    | Backend base URL                     |

## Secret spec format

Each secret you want to fetch is described as `<id>:<envVar>[:value|file]`:

- `id` — the secret's identifier on the backend (path part of `/secrets/:id`)
- `envVar` — the env var the secret will be exposed as
- `value` (default) — set the env var to the secret content directly
- `file` — write the secret to a temp file, set the env var to its path

Examples:

| Spec                                                  | Result                                                        |
|-------------------------------------------------------|---------------------------------------------------------------|
| `stripe-key:STRIPE_API_KEY`                           | `STRIPE_API_KEY=<value>`                                      |
| `firebase-sa:GOOGLE_APPLICATION_CREDENTIALS:file`     | `GOOGLE_APPLICATION_CREDENTIALS=/tmp/.../firebase-sa`         |

## Usage

### `run` — wrap any command

```bash
export MYSECRETS_TOKEN=your-token
export MYSECRETS_API_URL=https://your-mock.vercel.app

mysecrets-cli run \
  -s firebase-sa:GOOGLE_APPLICATION_CREDENTIALS:file \
  -- firebase deploy --only hosting
```

The `--` separates CLI flags from the command to run. Without it, `--only hosting` would be parsed as a `mysecrets-cli` flag.

Pass `-s` multiple times for multiple secrets:

```bash
mysecrets-cli run \
  -s firebase-sa:GOOGLE_APPLICATION_CREDENTIALS:file \
  -s db-url:DATABASE_URL \
  -- npm run deploy
```

### `export` — emit env vars to stdout

For GitHub Actions:

```yaml
- name: Load secrets
  run: |
    mysecrets-cli export \
      -s stripe-key:STRIPE_KEY \
      -s api-url:API_URL >> $GITHUB_ENV
  env:
    MYSECRETS_TOKEN: ${{ secrets.MYSECRETS_TOKEN }}
    MYSECRETS_API_URL: https://your-mock.vercel.app
```

For shell `eval`:

```bash
eval "$(mysecrets-cli export --format shell -s stripe-key:STRIPE_KEY)"
```

The default format (`--format github`) is compatible with `$GITHUB_ENV`, including heredoc for multi-line values. Use `--format shell` for `eval`-safe single-quoted output.

> **Note:** `export` does not support `file`-type secrets — there's no clean way to manage the file lifecycle once the CLI has exited. Use `run` for file-type secrets.

## GitHub Actions example — Firebase deploy

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install mysecrets-cli
        run: npm install -g github:yourname/yourrepo

      - name: Install Firebase CLI
        run: npm install -g firebase-tools

      - name: Build
        run: npm ci && npm run build

      - name: Deploy
        run: |
          mysecrets-cli run \
            -s firebase-sa:GOOGLE_APPLICATION_CREDENTIALS:file \
            -- firebase deploy --only hosting --project your-project-id
        env:
          MYSECRETS_TOKEN: ${{ secrets.MYSECRETS_TOKEN }}
          MYSECRETS_API_URL: https://your-mock.vercel.app
```

Only `MYSECRETS_TOKEN` lives in GitHub Secrets. The Firebase service account JSON lives on your backend.

## Local development of the CLI itself

```bash
npm install
node bin/mysecrets-cli --help
node bin/mysecrets-cli run -s foo:BAR -- echo "BAR=$BAR"
```

Run tests against your deployed mock server:

```bash
export MYSECRETS_TOKEN=your-mock-token
export MYSECRETS_API_URL=https://your-mock.vercel.app

mysecrets-cli export -s firebase-sa:FIREBASE_SA
```

## Exit codes

- `0` — success
- Non-zero — propagated from the child process when using `run`, or `1` on any CLI error

## Known MVP limitations

- One token, no scoping (any token can fetch any secret it has access to on the backend)
- No caching — every call hits the backend
- No retries on transient network errors
- Bearer token over HTTPS only (don't point this at an `http://` backend in production)
- `export` does not support file-type secrets
