// Actual service/route I/O in disposable directories; never private config/providers.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {compileFunction}=require('node:vm'),{createRequire}=require('node:module');
const filename=path.join(__dirname,'googlePhotos.js');
const source=fs.readFileSync(filename,'utf8');
const bytes=Buffer.from('Fixture media bytes');
function fixture(t,{serviceSource=source,onOpen=()=>{},disableDeadline=false,fetchImpl=async()=>({ok:true,arrayBuffer:async()=>bytes,headers:{get:()=> 'image/jpeg'}})}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lumina-media-containment-'));
  const media=path.join(directory,'google_photos_media'),cache=path.join(directory,'google_photos_cache.json');
  fs.mkdirSync(media);fs.writeFileSync(cache,'[]');
  const calls=[],io=[],warnings=[],descriptors=new Map(),timers=new Set();
  const schedule=(fn,delay)=>{
    const timer=setTimeout(()=>{timers.delete(timer);fn();},delay===15000?(disableDeadline?10000:40):delay);
    timers.add(timer);return timer;
  };
  const cancel=timer=>{clearTimeout(timer);timers.delete(timer);};
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
    ['module','require','__dirname','process','fetch','console','setTimeout','clearTimeout'],{filename})(
    moduleFixture,name=>name==='fs'?fixtureFs:name==='../config/env.js'
      ?{readEnvVar:()=>'',persistEnvVars:()=>assert.fail('Unexpected credential write')}:nativeRequire(name),
    __dirname,{env:{NODE_ENV:'isolated-media-fixture',LUMINA_GOOGLE_PHOTOS_CACHE_PATH:cache}},
    (...args)=>{calls.push(args);return fetchImpl(...args);},
    {log(){},warn:(...args)=>warnings.push(args),error(){}},schedule,cancel);
  t.after(()=>{
    try{assert.equal(timers.size,0,'Content timers released');assert.equal(descriptors.size,0,'Owned descriptors released');}
    finally{timers.forEach(clearTimeout);descriptors.forEach((_file,fd)=>fs.closeSync(fd));fs.rmSync(directory,{recursive:true,force:true});}
  });
  return {...moduleFixture.exports,directory,media,cache,calls,io,warnings,descriptors,timers};
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

// Actual public entrypoints, with only the owned15s content timer shortened.
const remoteItem=(f,id)=>fs.writeFileSync(f.cache,JSON.stringify([{id,googleBaseUrl:'https://fixture.test/content'}]));
const response=body=>({ok:true,headers:{get:()=> 'image/jpeg'},arrayBuffer:async()=>body});
for(const stage of ['headers','body']){
  test(`proxy HTTP bounds stalled ${stage}, ignores late success and recovers next request`,{timeout:5000},async t=>{
    let release,signal,attempts=0,lateBodyReads=0;
    const held=new Promise(resolve=>{release=resolve;});
    const f=fixture(t,{fetchImpl:async(_url,options)=>{
      signal=options.signal;
      if(++attempts>1)return response(bytes);
      if(stage==='headers'){await held;return {...response(bytes),arrayBuffer:async()=>{lateBodyReads++;return bytes;}};}
      return {...response(bytes),arrayBuffer:()=>held.then(()=>bytes)};
    }});
    remoteItem(f,'bounded');const request=await proxyServer(t,f);
    const first=await request('bounded');assert.equal(first.status,502);assert.match(first.body.toString(),/deadline/);
    assert(signal.aborted);assert.equal(f.timers.size,0);release();
    await new Promise(setImmediate);assert.equal(lateBodyReads,0,'Late headers do not start body consumption');assert(!fs.existsSync(path.join(f.media,'bounded.jpg')),'No late cache write');
    const recovered=await request('bounded');assert.equal(recovered.status,200);assert.deepEqual(recovered.body,bytes);
    assert.deepEqual(fs.readFileSync(path.join(f.media,'bounded.jpg')),bytes);
  });
}
test('late rejecting body is observed after deadline without poisoning cache',{timeout:5000},async t=>{
  let rejectBody;
  const f=fixture(t,{fetchImpl:async()=>({...response(bytes),arrayBuffer:()=>new Promise((_,reject)=>{rejectBody=reject;})})});
  remoteItem(f,'late');await assert.rejects(f.fetchMediaItemBytes('late'),/deadline/);
  rejectBody(new Error('Late fixture rejection'));await new Promise(setImmediate);
  assert(!fs.existsSync(path.join(f.media,'late.jpg')));assert.equal(f.timers.size,0);
});
for(const kind of ['empty','reject','http']){
  test(`proxy ${kind} content is not successful/cacheable and identical next request recovers`,{timeout:5000},async t=>{
    let first=true;const f=fixture(t,{fetchImpl:async()=>{
      if(!first)return response(bytes);first=false;
      if(kind==='http')return {ok:false,status:503};
      if(kind==='reject')return {...response(bytes),arrayBuffer:async()=>{throw null;}};
      return response(Buffer.alloc(0));
    }});remoteItem(f,'retry');const request=await proxyServer(t,f);
    fs.writeFileSync(path.join(f.media,'retry.jpg'),'');
    const failed=await request('retry');assert.equal(failed.status,502);assert.notEqual(failed.headers['cache-control'],'private, max-age=300');
    assert.equal(fs.statSync(path.join(f.media,'retry.jpg')).size,0);
    const ok=await request('retry');assert.equal(ok.status,200);assert.deepEqual(ok.body,bytes);
    assert.equal(f.timers.size,0);
  });
}
for(const kind of ['headers','body','empty','reject','http']){
  test(`downloader ${kind} failure continues next item; empty local file recovers on next trigger`,{timeout:5000},async t=>{
    let release;const held=new Promise(resolve=>{release=resolve;});let first=true;
    const f=fixture(t,{fetchImpl:async()=>{
      if(!first)return response(bytes);first=false;
      if(kind==='headers'){await held;return response(bytes);}
      if(kind==='body')return {...response(bytes),arrayBuffer:()=>held.then(()=>bytes)};
      if(kind==='http')return {ok:false,status:403};
      if(kind==='reject')return {...response(bytes),arrayBuffer:async()=>{throw new Error('Fixture body rejected');}};
      return response(Buffer.alloc(0));
    }});
    fs.writeFileSync(path.join(f.media,'failed.jpg'),'');
    const items=[{id:'failed',googleBaseUrl:'https://fixture.test/failed'},{id:'later',googleBaseUrl:'https://fixture.test/later'}];
    await f.downloadSyncMediaItems(items);assert.deepEqual(fs.readFileSync(path.join(f.media,'later.jpg')),bytes);
    assert.equal(fs.statSync(path.join(f.media,'failed.jpg')).size,0);release();await new Promise(setImmediate);
    assert.equal(fs.statSync(path.join(f.media,'failed.jpg')).size,0,'Late completion cannot write');
    await f.downloadSyncMediaItems(items);assert.deepEqual(fs.readFileSync(path.join(f.media,'failed.jpg')),bytes);
    assert.equal(f.calls.length,3,'Nonempty local hit skips network');assert.equal(f.timers.size,0);
  });
}
for(const stage of ['headers','body']){
 test(`native fetch cancels stalled ${stage} at proxy HTTP entrypoint`,{timeout:5000},async t=>{
  let closed;const peerClosed=new Promise(resolve=>{closed=resolve;});
  const upstream=http.createServer((req,res)=>{
    if(req.url==='/warm'){res.end('warm');return;}
    req.on('close',closed);
    if(stage==='body'){res.writeHead(200,{'Content-Type':'image/jpeg'});res.write('partial');}
  });
  t.after(async()=>{const done=new Promise(resolve=>upstream.close(resolve));upstream.closeAllConnections();await done;});
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${upstream.address().port}`;
  await (await fetch(url+'/warm')).arrayBuffer(); // Warm before the measured operation.
  let signal;
  const f=fixture(t,{fetchImpl:(_url,options)=>{signal=options.signal;return fetch(url+'/stall',options);}});
  remoteItem(f,'native');const request=await proxyServer(t,f);
  assert.equal((await request('native')).status,502);assert(signal.aborted);
  let timer;
  try{await Promise.race([peerClosed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Peer did not close')),1000);})]);}
  finally{clearTimeout(timer);}
  assert(!fs.existsSync(path.join(f.media,'native.jpg')));assert.equal(f.timers.size,0);
 });
}
test('negative control: removing the deadline leaves real proxy request pending and permits late write',{timeout:5000},async t=>{
  let release;const held=new Promise(resolve=>{release=resolve;});
  const f=fixture(t,{disableDeadline:true,fetchImpl:async()=>({...response(bytes),arrayBuffer:()=>held.then(()=>bytes)})});
  remoteItem(f,'negative');const request=await proxyServer(t,f);let settled=false;
  const pending=request('negative').then(value=>{settled=true;return value;});
  await new Promise(resolve=>setTimeout(resolve,90));assert.equal(settled,false,'Disabled deadline must fail prompt502 oracle');
  release();assert.equal((await pending).status,200);assert(fs.existsSync(path.join(f.media,'negative.jpg')));
});

for(const kind of ['empty','body']){
 test(`final Picker content attempt rejects ${kind} without a byte cache write`,{timeout:5000},async t=>{
  let requests=0,release;const held=new Promise(resolve=>{release=resolve;});
  const f=fixture(t,{fetchImpl:async url=>{
    if(url.startsWith('https://photospicker.googleapis.com/'))return {ok:true,json:async()=>({mediaItems:[{id:'final',baseUrl:'https://fixture.test/refreshed'}]})};
    if(++requests===1)return {ok:false,status:403};
    return kind==='empty'?response(Buffer.alloc(0)):{...response(bytes),arrayBuffer:()=>held.then(()=>bytes)};
  }});
  fs.writeFileSync(f.cache,JSON.stringify([{id:'final',googleBaseUrl:'https://fixture.test/original',googleBaseUrlFetchedAt:Date.now(),googlePickerSessionId:'fixture-session'}]));
  const request=await proxyServer(t,f);const failed=await request('final');assert.equal(failed.status,502);
  assert.match(failed.body.toString(),kind==='empty'?/Empty/:/deadline/);release();await new Promise(setImmediate);
  assert(!fs.existsSync(path.join(f.media,'final.jpg')));assert.equal(requests,2);assert.equal(f.timers.size,0);
 });
}
test('negative control: disabled downloader deadline blocks next item until late bytes are released',{timeout:5000},async t=>{
 let release;const held=new Promise(resolve=>{release=resolve;});let attempts=0;
 const f=fixture(t,{disableDeadline:true,fetchImpl:async()=>++attempts===1?{...response(bytes),arrayBuffer:()=>held.then(()=>bytes)}:response(bytes)});
 const pending=f.downloadSyncMediaItems([{id:'blocked',googleBaseUrl:'https://fixture.test/blocked'},{id:'later',googleBaseUrl:'https://fixture.test/later'}]);
 await new Promise(resolve=>setTimeout(resolve,90));assert.equal(attempts,1);assert(!fs.existsSync(path.join(f.media,'later.jpg')));
 release();await pending;assert.equal(attempts,2);assert(fs.existsSync(path.join(f.media,'blocked.jpg')));
});
test('negative control: removed empty-content guard makes HTTP succeed and caches zero bytes',{timeout:5000},async t=>{
 const noEmptyGuard=source.replace("if (!buffer.length) throw new Error('Empty Google Photos media content');",'');
 assert.notEqual(noEmptyGuard,source);
 const f=fixture(t,{serviceSource:noEmptyGuard,fetchImpl:async()=>response(Buffer.alloc(0))});remoteItem(f,'empty');
 const request=await proxyServer(t,f);assert.equal((await request('empty')).status,200);
 assert.equal(fs.statSync(path.join(f.media,'empty.jpg')).size,0);
});
