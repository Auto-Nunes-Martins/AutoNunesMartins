// Fresh browser contexts, intercepted public reads and fixture storage only.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const origin = process.env.WEBSITE_URL || 'http://localhost:5173';
const image = await readFile('static/images/about/preparation-demo-v1-960.webp');
const output = path.resolve('.svelte-kit/saved-unavailable-review');
await mkdir(output,{recursive:true});
const ids = [0,1,2].map(n => `retry-demo-${n}-${String(n+1).padStart(12,'a')}`);
const version = 'a'.repeat(64);
const vehicle = n => ({slug:ids[n],brand:'Audi',model:`Exemplo ${n+1}`,year:2022,fuel:'GASOLINE',mileage:42000,price:'23900.00',currency:'EUR',description:null,transmission:'AUTOMATIC',availability:'AVAILABLE',photos:[`/api/public/vehicles/${ids[n]}/photos/0?v=${version}`]});
const unavailable = n => ({slug:ids[n],brand:'Audi',model:`Exemplo ${n+1}`,year:2022,photo:`/viaturas/${ids[n]}/indisponivel/foto`});
const browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
async function run(route,width,initialFailures) {
  const context=await browser.newContext({viewport:{width,height:950}});
  await context.addInitScript(({ids,route})=>{
    localStorage.setItem(route==='favoritos'?'anm-favorites-v1':'anm-comparison-v1',JSON.stringify(ids));
  },{ids,route});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let states=initialFailures?[503,503,503]:[200,503,404],requests=0,blockNewPhotos=false;
  await page.route('**/*',r=>{
    const u=new URL(r.request().url());
    assert.equal(r.request().method(),'GET');
    if(u.pathname==='/comparar/dados'){
      requests++;
      return r.fulfill({json:{items:u.searchParams.getAll('id').map(id=>{const n=ids.indexOf(id),status=states[n];return {id,status,vehicle:status===200?vehicle(n):null,...(status===200?{photoVersions:[version]}:status===404?{unavailableVehicle:unavailable(n)}:{})};})}});
    }
    if(u.pathname.endsWith('/photos/access'))return r.fulfill({json:{versions:[version]}});
    if(/\/photos\/0$/.test(u.pathname)||u.pathname.endsWith('/indisponivel/foto'))return blockNewPhotos?r.abort():r.fulfill({body:image,contentType:'image/webp',headers:{'x-photo-version':version}});
    return u.origin===origin?r.continue():r.abort();
  });
  await page.goto(`${origin}/${route}`);
  try { await page.waitForFunction(()=>document.querySelector('.favorites-grid, .comparison-board')?.getAttribute('aria-busy')==='false'); }
  catch(error) { console.error({route,width,initialFailures,errors,body:(await page.locator('body').innerText()).slice(0,1200)}); throw error; }
  const slot=n=>page.locator(`[data-selection-id="${ids[n]}"]`);
  const retry=n=>route==='favoritos'?slot(n).locator('button.retry'):page.locator(`#vehicle-${ids[n]} .retry-item`);
  const count=()=>page.evaluate(route=>JSON.parse(localStorage.getItem(route==='favoritos'?'anm-favorites-v1':'anm-comparison-v1')).length,route);
  if(initialFailures){
    assert.equal(await page.locator('#pending-favorites-title').count(),0);
    assert.equal(await page.getByRole('heading',{name:'Dados por atualizar',exact:false}).count(),0);
    assert.equal(await page.locator(route==='favoritos'?'.pending-favorite':'.retry-item').count(),route==='comparar'&&width===390?2:3);
    assert.equal(await count(),3);
    const after=requests;await page.waitForTimeout(200);assert.equal(requests,after,'no automatic retry loop');
    states=[200,503,503];await retry(0).click();
    await page.waitForFunction(({route,id})=>route==='favoritos'?!!document.querySelector(`[data-selection-id="${id}"] .vehicle-card`):!!document.querySelector(`#vehicle-${id} .price`),{route,id:ids[0]});
    assert.equal(await count(),3);
  }else{
    await slot(0).locator('img').evaluate(n=>n.decode());
    const originalPhoto=await slot(0).locator('img').evaluate(n=>{const c=document.createElement('canvas'),s=Math.min(1,640/n.naturalWidth);c.width=Math.round(n.naturalWidth*s);c.height=Math.round(n.naturalHeight*s);c.getContext('2d').drawImage(n,0,0,c.width,c.height);return c.toDataURL();});
    states=[503,503,503];blockNewPhotos=true;
    if(route==='favoritos')await page.locator('.saved-unavailable button').click();
    else await retry(1).click();
    await page.waitForFunction(({route,id})=>route==='favoritos'?!!document.querySelector(`[data-selection-id="${id}"] .pending-favorite`):!!document.querySelector(`#vehicle-${id} .retry-item`),{route,id:ids[0]});
    const identity=route==='favoritos'?slot(0):page.locator(`#vehicle-${ids[0]}`);
    assert.ok((await identity.textContent()).includes('Audi')||(await identity.textContent()).includes('Exemplo 1'));
    assert.equal(await slot(0).locator('canvas').evaluate(n=>n.toDataURL()),originalPhoto,'already decoded pixels survive blocked photo requests');
    assert.equal(await page.locator('.price').count(),0,'no stale price or active comparison data');
    assert.equal(await page.locator('.fact-group').count(),0,'all failures have no confirmed specs');
    for (const button of await page.getByRole('button',{name:/^Fechar aviso:/}).all()) await button.click();
    const main=page.locator(route==='favoritos'?'.favorites-page':'.comparison-page');
    await main.evaluate(node=>{const label=document.createElement('p');label.textContent='DEMONSTRAÇÃO · FALHA TEMPORÁRIA APÓS CARREGAMENTO';label.style.cssText='font:600 11px/1.5 Arial;color:var(--muted);padding:12px 0;letter-spacing:.08em';node.prepend(label);});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));const box=await main.boundingBox();
    const screenshot=path.join(output,`${route}-error-known-${width}.png`);
    await page.screenshot({path:screenshot,fullPage:true,clip:{x:0,y:0,width,height:Math.ceil(box.y+box.height+16)}});
    console.log('SCREENSHOT '+screenshot);
    const after=requests;await page.waitForTimeout(200);assert.equal(requests,after);
    blockNewPhotos=false;states=[503,200,503];await retry(1).click();
    await page.waitForFunction(({route,id})=>route==='favoritos'?!!document.querySelector(`[data-selection-id="${id}"] .vehicle-card`):!!document.querySelector(`#vehicle-${id} .price`),{route,id:ids[1]});
    assert.ok((await identity.textContent()).includes('Exemplo 1'),'other error keeps identity through retry');
    states=[404,200,503];await retry(0).click();
    await page.waitForFunction(({route,id})=>route==='favoritos'?!!document.querySelector(`.unavailable-list [data-selection-id="${id}"]`):document.querySelector(`#vehicle-${id}`)?.textContent.includes('Já não disponível'),{route,id:ids[0]});
    assert.equal(await count(),route==='favoritos'?2:3);
  }
  const remove=route==='favoritos'?page.locator('.pending-favorite .remove, .saved-unavailable button').first():page.locator('.remove').first();
  const before=await count();await remove.click();assert.equal(await count(),before-1);
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log(`PASS ${route} ${width}px ${initialFailures?'all failures without prior data, retry success':'session identity/photo, all failures, retry success/unavailable'}, counts, removal, no retry loop`);
  await context.close();
}
try{for(const width of [1440,390])for(const route of ['favoritos','comparar'])for(const initial of [false,true]){if(process.env.RETRY_ROUTE&&process.env.RETRY_ROUTE!==route)continue;await run(route,width,initial);}}finally{await browser.close();}
