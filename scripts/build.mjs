import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const name of ['index.html','src','public'])await cp(name,'dist/'+name,{recursive:true});
console.log('Static production files ready in dist/');
