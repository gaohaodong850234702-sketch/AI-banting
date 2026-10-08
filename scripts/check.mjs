import {readdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
for(const dir of ['src','backend','scripts'])for(const file of await readdir(dir))if(/\.(mjs|js)$/.test(file))execFileSync(process.execPath,['--check',dir+'/'+file]);execFileSync(process.execPath,['--check','server.mjs']);console.log('Syntax checks passed');
