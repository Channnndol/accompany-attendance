// Serve a self-contained document: no render-blocking CSS or dependent script
// requests can leave mobile Safari waiting on a partially downloaded release.
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
fs.mkdirSync(path.join(root,'out'),{recursive:true});
for(const name of ['style.css','extras.css','startup.js','roster.js','app.js'])fs.copyFileSync(path.join(root,name),path.join(root,'out',name));
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'</style>');
html=html.replace('<link rel="stylesheet" href="extras.css">',()=>'<style>'+fs.readFileSync(path.join(root,'extras.css'),'utf8')+'</style>');
for(const name of ['startup.js','roster.js','app.js'])html=html.replace('<script src="'+name+'"></script>',()=>'<script>'+fs.readFileSync(path.join(root,name),'utf8')+'</script>');
if(/<script[^>]+\bsrc=|<link[^>]+rel="stylesheet"/i.test(html))throw new Error('Published HTML must not depend on external startup assets.');
fs.writeFileSync(path.join(root,'out','index.html'),html);
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist','AccompanyAttendance.html'),html);
console.log('Self-contained site HTML and standalone download built.');

fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs','index.html'),html);
fs.writeFileSync(path.join(root,'docs','.nojekyll'),'');
