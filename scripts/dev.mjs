import { spawn } from 'node:child_process';

const processes = [
  ['server', 'npm', ['run', 'dev', '--workspace', 'server']],
  ['client', 'npm', ['run', 'dev', '--workspace', 'client']],
];

const children = processes.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
    }
  });

  return child;
});

const shutdown = () => {
  for (const child of children) {
    child.kill('SIGTERM');
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
