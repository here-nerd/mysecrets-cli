const { Command } = require('commander');

const { runCommand } = require('./run');
const { exportCommand } = require('./export');

const program = new Command();

program.enablePositionalOptions();

program
  .name('mysecrets-cli')
  .description('Fetch secrets from your mysecrets backend and inject into processes or CI/CD.')
  .version('0.1.0');

program
  .command('run')
  .description('Fetch secrets and run a command with them set as env vars')
  .option('-s, --secret <spec>', 'secret spec: <id>:<envVar>[:value|file] (repeatable)', collect, [])
  .option('--api-url <url>', 'backend URL (or MYSECRETS_API_URL env var)')
  .option('--token <token>', 'auth token (or MYSECRETS_TOKEN env var)')
  .argument('<command...>', 'command to run; use `--` to separate from CLI flags')
  .passThroughOptions()
  .action((command, options) => runCommand(command, options));

program
  .command('export')
  .description('Fetch secrets and print KEY=value lines to stdout')
  .option('-s, --secret <spec>', 'secret spec: <id>:<envVar> (repeatable)', collect, [])
  .option('--api-url <url>', 'backend URL (or MYSECRETS_API_URL env var)')
  .option('--token <token>', 'auth token (or MYSECRETS_TOKEN env var)')
  .option('--format <format>', "output format: 'github' (default) or 'shell'", 'github')
  .action((options) => exportCommand(options));

function collect(value, previous) {
  return previous.concat([value]);
}

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`mysecrets-cli: ${err.message}\n`);
  process.exit(1);
});
