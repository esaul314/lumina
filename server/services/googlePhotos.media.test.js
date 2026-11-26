// Actual service/route I/O in disposable directories; never private config/providers.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {compileFunction}=require('node:vm'),{createRequire}=require('node:module');
const filename=path.join(__dirname,'googlePhotos.js');
const source=fs.readFileSync(filename,'utf8');
const bytes=Buffer.from('Fixture media bytes');
function fixture(t,{serviceSource=source,onOpen=()=>{},fetchImpl=async()=>({ok:true,arrayBuffer:async()=>bytes,headers:{get:()=> 'image/jpeg'}})}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lumina-media-containment-'));
  const media=path.join(directory,'google_photos_media'),cache=path.join(directory,'google_photos_cache.json');
  fs.mkdirSync(media);fs.writeFileSync(cache,'[]');
  const calls=[],io=[],warnings=[],descriptors=new Map();
  const inside=value=>{
    const resolved=typeof value==='number'?descriptors.get(value):path.resolve(value);
    assert.ok(resolved && (resolved===directory||resolved.startsWith(directory+path.sep)),'Fixture I/O escaped disposable root');
    return resolved;
  };
  const fixtureFs={...fs};
  for(const method of ['existsSync','lstatSync','readFileSync','writeFileSync','mkdirSync','unlinkSync','readdirSync','openSync']){
    fixtureFs[method]=(...args)=>{
      const file=inside(args[0]);io.push([method,file]);
      if(method==='openSync')onOpen(file,args[1]);
      const result=fs[method](...args);
      if(method==='openSync')descriptors.set(result,file);
      return result;
    };
  }
  fixtureFs.fstatSync=fd=>{inside(fd);return fs.fstatSync(fd);};
  fixtureFs.ftruncateSync=(fd,length)=>{inside(fd);return fs.ftruncateSync(fd,length);};
  fixtureFs.closeSync=fd=>{inside(fd);try{return fs.closeSync(fd);}finally{descriptors.delete(fd);}};
  const moduleFixture={exports:{}},nativeRequire=createRequire(filename);
  compileFunction(serviceSource+"\n;tokens={accessToken:'fixture-access',expiry:Number.MAX_SAFE_INTEGER};",
    ['module','require','__dirname','process','fetch','console'],{filename})(
    moduleFixture,name=>name==='fs'?fixtureFs:name==='../config/env.js'
      ?{readEnvVar:()=>'',persistEnvVars:()=>assert.fail('Unexpected credential write')}:nativeRequire(name),
    __dirname,{env:{NODE_ENV:'isolated-media-fixture',LUMINA_GOOGLE_PHOTOS_CACHE_PATH:cache}},
    (...args)=>{calls.push(args);return fetchImpl(...args);},
    {log(){},warn:(...args)=>warnings.push(args),error(){}});
  t.after(()=>{assert.equal(descriptors.size,0,'Owned descriptors released');fs.rmSync(directory,{recursive:true,force:true});});
  return {...moduleFixture.exports,directory,media,cache,calls,io,warnings,descriptors};
}

test('proxy service refuses traversal before cache/network and leaves outside sentinel unread',async t=>{
  const f=fixture(t),sentinel=path.join(f.directory,'outside.jpg');
  fs.writeFileSync(sentinel,'Outside secret fixture');
  await assert.rejects(f.fetchMediaItemBytes('../outside'),/Invalid Google Photos media id/);
  assert.equal(f.calls.length,0);
  assert.equal(f.io.filter(([method,file])=>method==='readFileSync' && file===sentinel).length,0);
  assert.equal(fs.readFileSync(sentinel,'utf8'),'Outside secret fixture');
});

test('invalid downloader item does not escape cache or block a later valid item',async t=>{
  const f=fixture(t);
  await f.downloadSyncMediaItems([{id:'../outside-created',googleBaseUrl:'https://fixture.test/bad'},{id:'valid_1-A',googleBaseUrl:'https://fixture.test/good'}]);
  assert.equal(fs.existsSync(path.join(f.directory,'outside-created.jpg')),false);
  assert.deepEqual(fs.readFileSync(path.join(f.media,'valid_1-A.jpg')),bytes);
  assert.equal(f.calls.length,1);
});

const invalidIds=['',' ','.','..','../outside','a/b','a\\b','/absolute','C:\\outside','C:outside','%2foutside','%252e%252e%252foutside','nul\0id','a\nb','a\n','a\r','a\t','photo.jpg','café'];
for(const id of invalidIds){
  test(`opaque id rejects unsafe string ${JSON.stringify(id)} before any service effect`,async t=>{
    const f=fixture(t),before=f.io.length;
    assert.throws(()=>f.getLocalMediaFilePath(id),/Invalid Google Photos media id/);
    await assert.rejects(f.fetchMediaItemBytes(id),/Invalid Google Photos media id/);
    assert.equal(f.io.length,before);assert.equal(f.calls.length,0);
  });
}
test('unknown IDs never invoke input coercion hooks or accept scalar coercion',async t=>{
  const f=fixture(t),hook=Object.freeze({[Symbol.toPrimitive]:()=>assert.fail('ID coerced')});
  for(const id of [undefined,null,false,0,42,7n,Symbol('id'),[],{},new String('photo'),hook]){
    const before=f.io.length;
    assert.throws(()=>f.getLocalMediaFilePath(id),/Invalid Google Photos media id/);
    await assert.rejects(f.fetchMediaItemBytes(id),/Invalid Google Photos media id/);
    assert.equal(f.io.length,before);
  }
  assert.equal(f.calls.length,0);
});
test('valid opaque IDs preserve filenames and local bytes without authentication/network',async t=>{
  const f=fixture(t);
  for(const id of ['photo','A0_-z','MOCK_MEDIA_ITEM_1']){
    assert.equal(f.getLocalMediaFilePath(id),path.join(f.media,id+'.jpg'));
    fs.writeFileSync(path.join(f.media,id+'.jpg'),bytes);
    assert.deepEqual((await f.fetchMediaItemBytes(id)).buffer,bytes);
  }
  assert.equal(f.calls.length,0);
});

for(const target of ['symlink','dangling symlink','directory','hardlink']){
  test(`proxy/downloader reject ${target} before request; outside data is unchanged`,async t=>{
    const f=fixture(t),outside=path.join(f.directory,'outside.jpg'),local=path.join(f.media,'unsafe.jpg');
    fs.writeFileSync(outside,'Outside protected bytes');
    if(target==='directory')fs.mkdirSync(local);
    else if(target==='hardlink')fs.linkSync(outside,local);
    else fs.symlinkSync(target==='dangling symlink'?path.join(f.directory,'not-created.jpg'):outside,local);
    await assert.rejects(f.fetchMediaItemBytes('unsafe'),/Unsafe Google Photos local media path/);
    await f.downloadSyncMediaItems([{id:'unsafe',googleBaseUrl:'https://fixture.test/bad'},{id:'later',googleBaseUrl:'https://fixture.test/good'}]);
    assert.equal(f.calls.length,1);assert.match(f.calls[0][0],/good/);
    assert.deepEqual(fs.readFileSync(path.join(f.media,'later.jpg')),bytes);
    assert.equal(fs.readFileSync(outside,'utf8'),'Outside protected bytes');
    assert.equal(fs.existsSync(path.join(f.directory,'not-created.jpg')),false);
    assert.equal(f.descriptors.size,0);
  });
}
test('symlinked media root blocks proxy, download and orphan cleanup, then recovers',async t=>{
  const f=fixture(t),outside=path.join(f.directory,'outside-directory');
  fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'sentinel.jpg'),'Root outside bytes');
  fs.rmdirSync(f.media);fs.symlinkSync(outside,f.media,'dir');
  await assert.rejects(f.fetchMediaItemBytes('sentinel'),/Unsafe Google Photos local media path/);
  await f.downloadSyncMediaItems([{id:'created',googleBaseUrl:'https://fixture.test/image'}]);
  f.cleanOrphanedMediaFiles([]);
  assert.equal(f.calls.length,0);
  assert.deepEqual(fs.readdirSync(outside),['sentinel.jpg']);
  assert.equal(fs.readFileSync(path.join(outside,'sentinel.jpg'),'utf8'),'Root outside bytes');
  fs.unlinkSync(f.media);fs.mkdirSync(f.media);
  await f.downloadSyncMediaItems([{id:'recovered',googleBaseUrl:'https://fixture.test/image'}]);
  assert.deepEqual(fs.readFileSync(path.join(f.media,'recovered.jpg')),bytes);
});
test('target planted after fetch is revalidated before download write',async t=>{
  let f;
  f=fixture(t,{fetchImpl:async()=>{
    fs.symlinkSync(path.join(f.directory,'outside.jpg'),path.join(f.media,'late.jpg'));
    return {ok:true,arrayBuffer:async()=>bytes};
  }});
  const outside=path.join(f.directory,'outside.jpg');fs.writeFileSync(outside,'Unchanged after await');
  await f.downloadSyncMediaItems([{id:'late',googleBaseUrl:'https://fixture.test/image'}]);
  assert.equal(f.calls.length,1);assert.equal(f.warnings.length,1);
  assert.equal(fs.readFileSync(outside,'utf8'),'Unchanged after await');
});
test('proxy remote-write path revalidates a target planted during body consumption',async t=>{
  let f;
  f=fixture(t,{fetchImpl:async()=>({ok:true,headers:{get:()=> 'image/jpeg'},arrayBuffer:async()=>{
    fs.symlinkSync(path.join(f.directory,'outside.jpg'),path.join(f.media,'late.jpg'));
    return bytes;
  }})});
  const outside=path.join(f.directory,'outside.jpg');fs.writeFileSync(outside,'Outside stays intact');
  fs.writeFileSync(f.cache,JSON.stringify([{id:'late',googleBaseUrl:'https://fixture.test/image'}]));
  await assert.rejects(f.fetchMediaItemBytes('late'),/Unsafe Google Photos local media path/);
  assert.equal(f.calls.length,1);assert.equal(fs.readFileSync(outside,'utf8'),'Outside stays intact');
});
test('no-follow read rejects final-component symlink substitution without remote fallback',async t=>{
  let f,swapped=false;
  f=fixture(t,{onOpen:file=>{
    if(swapped)return;swapped=true;fs.unlinkSync(file);fs.symlinkSync(path.join(f.directory,'outside.jpg'),file);
  }});
  fs.writeFileSync(path.join(f.directory,'outside.jpg'),'Must not be read');
  fs.writeFileSync(path.join(f.media,'race.jpg'),bytes);
  await assert.rejects(f.fetchMediaItemBytes('race'),/Unsafe Google Photos local media path/);
  assert.equal(f.calls.length,0);assert.equal(f.descriptors.size,0);
});
test('descriptor validation refuses a hardlink planted at open before truncating',async t=>{
  let f;
  f=fixture(t,{onOpen:file=>fs.linkSync(path.join(f.directory,'outside.jpg'),file)});
  const outside=path.join(f.directory,'outside.jpg');fs.writeFileSync(outside,'Do not truncate');
  await f.downloadSyncMediaItems([{id:'race',googleBaseUrl:'https://fixture.test/image'}]);
  assert.equal(fs.readFileSync(outside,'utf8'),'Do not truncate');assert.equal(f.warnings.length,1);
  assert.equal(f.descriptors.size,0);
});
test('null/throwing batch items and network rejection do not stop later valid recovery',async t=>{
  let attempts=0;
  const f=fixture(t,{fetchImpl:async()=>{
    if(++attempts===1)throw null;
    return {ok:true,arrayBuffer:async()=>bytes};
  }});
  const throwing=Object.defineProperty({},'id',{get:()=>{throw new Error('Fixture bad item');}});
  await f.downloadSyncMediaItems([null,undefined,throwing,{id:'failed',googleBaseUrl:'https://fixture.test/fail'},{id:'later',googleBaseUrl:'https://fixture.test/good'}]);
  assert.equal(attempts,2);assert.equal(f.warnings.length,4);
  assert.deepEqual(fs.readFileSync(path.join(f.media,'later.jpg')),bytes);
});

async function proxyServer(t,f){
  const routesFile=path.resolve(__dirname,'../routes.js'),nativeRequire=createRequire(routesFile),moduleFixture={exports:{}};
  compileFunction(fs.readFileSync(routesFile,'utf8'),['module','require'],{filename:routesFile})(
    moduleFixture,name=>name==='./services/googlePhotos.js'?f:name==='./services/weather.js'?{}:nativeRequire(name));
  const app=require('express')();
  moduleFixture.exports({app,state:{},collections:{},getWeatherData:()=>null,setWeatherData(){}});
  const server=http.createServer(app);
  t.after(async()=>{const stopped=new Promise(resolve=>server.close(resolve));server.closeAllConnections();await stopped;});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return id=>new Promise((resolve,reject)=>{
    const request=http.get({hostname:'127.0.0.1',port:server.address().port,path:'/api/google-photos/media/'+encodeURIComponent(id)},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));
    });request.once('error',reject);
  });
}
test('actual proxy HTTP rejects encoded path vocabulary and serves a valid later ID',async t=>{
  const f=fixture(t),request=await proxyServer(t,f),outside=path.join(f.directory,'outside.jpg');
  fs.writeFileSync(outside,'HTTP outside sentinel');fs.writeFileSync(path.join(f.media,'valid.jpg'),bytes);
  for(const id of ['../outside','a\\b','/absolute','C:\\outside','%2e%2e%2foutside','%252e%252e%252foutside','nul\0id']){
    const response=await request(id);
    assert.equal(response.status,502);
    assert.match(JSON.parse(response.body).message,/Invalid Google Photos media id/);
  }
  const valid=await request('valid');assert.equal(valid.status,200);assert.deepEqual(valid.body,bytes);
  assert.equal(valid.headers['cache-control'],'private, max-age=300');
  assert.equal(f.calls.length,0);assert.equal(fs.readFileSync(outside,'utf8'),'HTTP outside sentinel');
});

const removeContainment=text=>{
  const altered=text.replace(/const getLocalMediaFilePath = [\s\S]*?\n};/,
    'const getLocalMediaFilePath = mediaItemId => path.join(MEDIA_DIR, `${mediaItemId}.jpg`);')
    .replace(/assertLocalMediaPath\((?:localFilePath|filePath)\);/g,'')
    .replace('requireLocalMediaId(mediaItemIdInput)','mediaItemIdInput')
    .replaceAll('fs.constants.O_NOFOLLOW','0');
  assert.notEqual(altered,text);return altered;
};
test('boundary-disabled negative controls demonstrably leak HTTP bytes and create an outside file',async t=>{
  const f=fixture(t,{serviceSource:removeContainment(source)}),request=await proxyServer(t,f);
  const outside=path.join(f.directory,'outside.jpg');fs.writeFileSync(outside,'Negative control bytes');
  const leaked=await request('../outside');
  assert.equal(leaked.status,200);assert.equal(leaked.body.toString(),'Negative control bytes');
  assert.throws(()=>assert.notEqual(leaked.body.toString(),'Negative control bytes'),assert.AssertionError);
  await f.downloadSyncMediaItems([{id:'../outside-created',googleBaseUrl:'https://fixture.test/image'}]);
  assert.throws(()=>assert.equal(fs.existsSync(path.join(f.directory,'outside-created.jpg')),false),assert.AssertionError);
});
