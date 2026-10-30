import { spawn } from 'node:child_process';
import path from 'node:path';
import { projectRoot } from './write-car-image-manifest.mjs';
import { watchCarImages } from './watch-car-images.mjs';

const watcher = await watchCarImages();
const angular = spawn(
  process.execPath,
  [path.join(projectRoot, 'node_modules/@angular/cli/bin/ng.js'), ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    watcher.close();
    angular.kill(signal);
  });
}
angular.once('error', (error) => {
  watcher.close();
  console.error(error.message);
  process.exitCode = 1;
});
angular.once('exit', (code, signal) => {
  watcher.close();
  process.exitCode = code ?? (signal ? 1 : 0);
});
