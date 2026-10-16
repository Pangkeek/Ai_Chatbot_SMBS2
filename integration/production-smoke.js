import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withTestSchema } from './postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { openDatabase as openSqlite } from '../scripts/sqlite/database.js';
import { seedDemo as seedSqlite, demoPassword } from '../tests/fixtures/sqlite-seed.js';
import { backupSqlite, sha256 } from '../scripts/backup-sqlite.js';
import { transferSqlite } from '../scripts/sqlite/transfer.js';
import { seedDemo } from '../src/lib/seed.js';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function start(config, overrides = {}, readiness = { path: '/api/health', status: 200 }){
  const port=await freePort();let logs='';
  const child=fork(new URL('./fixtures/production-server.js',import.meta.url),[],{
    env:{...process.env,DATABASE_URL:config.connectionString,DB_SCHEMA:config.schema,DB_SSL_MODE:'disable',
      NODE_ENV:'production',LINE_WORKER_ENABLED:'false',APP_MAINTENANCE_MODE:'false',PORT:String(port),...overrides},stdio:['ignore','pipe','pipe','ipc'],
  });
  child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});
  const base=`http://127.0.0.1:${port}`;
  async function stop(){
    if(child.exitCode!==null||child.signalCode!==null)return;
    const exit=once(child,'exit');if(process.platform==='win32')child.send({signal:'SIGTERM'});else child.kill('SIGTERM');
    let timer;
    try{const [code]=await Promise.race([exit,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Production shutdown timeout')),18000);})]);assert.equal(code,143);}
    finally{clearTimeout(timer);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
  }
  try{
    const deadline=Date.now()+12000;
    for(;;){if(child.exitCode!==null)throw new Error('Production server exited before health');
      try{if((await fetch(base+readiness.path,{signal:AbortSignal.timeout(1000)})).status===readiness.status)break;}catch{}
      if(Date.now()>deadline)throw new Error('Production health timeout');await sleep(50);
    }
    return {base,stop,logs:()=>logs};
  }catch(error){if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');throw error;}
}

test('production CLI uses PORT, preserves imported accounts and API writes across restarts, and enforces tenant/owner/session restrictions',async()=>withTestSchema(async({db,config})=>{
  const dir=mkdtempSync(join(tmpdir(),'production-smoke-'));let sqlite,server;
  try{
    // Only this task-owned temporary source and random test schema are written.
    sqlite=openSqlite(join(dir,'source.sqlite'));await seedSqlite(sqlite);
    const snapshot=await backupSqlite({source:join(dir,'source.sqlite'),outputDir:join(dir,'backups')});sqlite.close();sqlite=null;
    const hash=await sha256(snapshot.manifest.snapshot);
    await migratePostgresql({config});
    const transfer={config,sourcePath:snapshot.manifest.snapshot,outputDir:join(dir,'reports')};
    await transferSqlite({...transfer,mode:'dry-run'});await transferSqlite({...transfer,mode:'import'});
    assert.equal((await transferSqlite({...transfer,mode:'verify'})).manifest.status,'passed');
    assert.equal(await sha256(snapshot.manifest.snapshot),hash);
    server=await start(config);
    const call=async(method,path,body,token)=>{
      const response=await fetch(server.base+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},
        ...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(4000)});
      const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null};
    };
    for(const path of ['/','/app','/docs','/api/health','/health','/openapi.json'])assert.equal((await fetch(server.base+path)).status,200,path);
    assert.equal((await call('GET','/api/v1/users/me')).status,401);
    const coffee=await call('POST','/api/v1/auth/login',{email:'coffee@example.test',password:demoPassword});assert.equal(coffee.status,200);
    const token=coffee.body.data.access_token;
    assert.equal((await call('GET','/api/v1/shops/shop-coffee',undefined,token)).status,200);
    assert.equal((await call('GET','/api/v1/shops/shop-flower',undefined,token)).status,404);
    const created=await call('POST','/api/v1/auth/register',{email:'smoke@example.test',password:'SmokePass!2026',name:'Smoke Owner'});assert.equal(created.status,201);
    const owner=created.body.data.access_token;
    const shop=await call('POST','/api/v1/shops',{name:'ร้านทดสอบ production',description:'smoke',opening_hours:'09:00-17:00',persona:'สุภาพ'},owner);assert.equal(shop.status,201);
    const base=`/api/v1/shops/${shop.body.data.id}`;
    const knowledge=await call('POST',base+'/knowledge',{kind:'faq',title:'เวลาเปิด',content:'09:00-17:00',status:'published'},owner);assert.equal(knowledge.status,201);
    assert.equal((await call('PATCH',base+'/knowledge/'+knowledge.body.data.id,{content:'10:00-18:00'},owner)).status,200);
    const conversation=await call('POST',base+'/conversations',{channel:'web',customer_external_id:'smoke-customer',customer_name:'ลูกค้า'},owner);assert.equal(conversation.status,201);
    const conversationPath=base+'/conversations/'+conversation.body.data.id;
    const message=await call('POST',conversationPath+'/messages',{role:'customer',content:'ทดสอบ 🌿'},owner);assert.equal(message.status,201);
    assert.equal((await call('POST',conversationPath+'/messages',{role:'agent',content:'blocked while bot active'},owner)).status,409);
    assert.equal((await call('PATCH',conversationPath,{bot_mode:'human'},owner)).status,200);
    assert.equal((await call('POST',conversationPath+'/messages',{role:'agent',content:'เจ้าหน้าที่ตอบ'},owner)).status,201);
    assert.equal((await call('PATCH',conversationPath,{status:'closed'},owner)).status,200);
    assert.equal((await call('POST',conversationPath+'/messages',{role:'customer',content:'closed'},owner)).status,409);
    await db.query("INSERT INTO shop_memberships(shop_id,user_id,role,created_at) VALUES($1,$2,'agent',clock_timestamp())",[shop.body.data.id,coffee.body.data.user.id]);
    assert.equal((await call('GET',base,undefined,token)).status,200);
    assert.equal((await call('POST',base+'/knowledge',{kind:'faq',title:'blocked',content:'blocked',status:'published'},token)).status,403);
    const before=(await db.query('SELECT count(*) FROM line_events')).rows[0].count;
    assert.equal((await fetch(server.base+base+'/line/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'})).status,404);
    assert.equal((await db.query('SELECT count(*) FROM line_events')).rows[0].count,before);
    const logs=server.logs();await server.stop();server=null;
    // Start the production release again: existing data and sessions must persist.
    server=await start(config);
    assert.equal((await call('GET',base,undefined,owner)).status,200);
    const messages=await call('GET',conversationPath+'/messages',undefined,owner);assert.equal(messages.status,200);
    assert.deepEqual(messages.body.data.map(row=>row.content),['ทดสอบ 🌿','เจ้าหน้าที่ตอบ']);
    assert.equal((await call('GET',base+'/knowledge/'+knowledge.body.data.id,undefined,owner)).body.data.content,'10:00-18:00');
    assert.equal((await call('DELETE',base+'/knowledge/'+knowledge.body.data.id,undefined,owner)).status,204);
    await db.query("UPDATE sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",[coffee.body.data.user.id]);
    assert.equal((await call('GET','/api/v1/users/me',undefined,token)).status,401);
    for(const secret of [config.connectionString,demoPassword,token,owner])assert.ok(!(logs+server.logs()).includes(secret));
    assert.equal((await db.query('SELECT count(*) FROM line_jobs')).rows[0].count,'0');
  }finally{await server?.stop();sqlite?.close();rmSync(dir,{recursive:true,force:true});}
}));

test('production maintenance preserves health, blocks malformed APIs and worker startup, and clears after restart', async () => withTestSchema(async ({db, config}) => {
  await migratePostgresql({config});
  await seedDemo(db);
  await db.query("INSERT INTO line_events VALUES ('maintenance-event','shop-coffee','message',NULL,'received',now())");
  await db.query("INSERT INTO line_jobs(job_id,shop_id,event_id,payload) VALUES ('maintenance-job','shop-coffee','maintenance-event',$1)",
    [{source:{userId:'maintenance-customer'},message:{text:'ร้านเปิดกี่โมง'},replyToken:'test-only'}]);
  let server;
  try {
    server = await start(config, {APP_MAINTENANCE_MODE:'true',LINE_WORKER_ENABLED:'true'});
    for (const path of ['/health','/api/health']) {
      const response = await fetch(server.base+path);
      assert.equal(response.status,200);
      assert.equal((await response.json()).data.database,'ok');
    }
    for (const [method,path] of [['POST','/api/v1/auth/register'],['POST','/api/v1/shops/shop-coffee/line/webhook'],['POST','/api/v1/shops/shop-coffee/line/simulate'],['GET','/api/v1/shops'],['DELETE','/api/v1/shops/shop-coffee'],['OPTIONS','/api/v1/shops']]) {
      const response=await fetch(server.base+path,{method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:'{bad'}:{})});
      assert.equal(response.status,503,path);
      assert.equal(response.headers.get('retry-after'),'60');
      const body=await response.json();
      assert.equal(body.error.code,'MAINTENANCE_MODE');
      assert.equal(body.request_id,response.headers.get('x-request-id'));
      assert.equal(response.headers.get('cache-control'),'no-store');
    }
    await sleep(1200);
    const job=(await db.query("SELECT status,attempts FROM line_jobs WHERE job_id='maintenance-job'")).rows[0];
    assert.deepEqual(job,{status:'pending',attempts:0});
    assert.equal((await db.query('SELECT count(*) FROM users')).rows[0].count,'2');
    assert.equal((await db.query('SELECT count(*) FROM messages')).rows[0].count,'4');
    await server.stop(); server=null;
    server=await start(config);
    assert.equal((await fetch(server.base+'/api/v1/shops')).status,401);
    const login=await fetch(server.base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'coffee@example.test',password:demoPassword})});
    assert.equal(login.status,200);
    await server.stop(); server=null;
    server=await start(config,{APP_MAINTENANCE_MODE:'true',LINE_WORKER_ENABLED:'true',DATABASE_URL:''},{path:'/api/v1/shops',status:503});
    const blocked=await fetch(server.base+'/api/v1/shops');
    assert.equal((await blocked.json()).error.code,'MAINTENANCE_MODE');
    for(const path of ['/health','/api/health']) {
      const response=await fetch(server.base+path);
      assert.equal(response.status,503);
      assert.equal((await response.json()).error.code,'DATABASE_UNAVAILABLE');
    }
    assert.ok(!server.logs().includes('RUNTIME_UNAVAILABLE'));
  } finally { await server?.stop(); }
}));
