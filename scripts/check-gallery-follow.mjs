// Built public website + in-memory raster/API fixtures. No real CRM, DB or Storage.
// PowerShell: $env:PLAYWRIGHT_CHANNEL='chrome'; node scripts/check-gallery-follow.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
const root='.cache/gallery-follow';await mkdir(root,{recursive:true});
const items=[20,2,1,0].map(count=>({brand:'Teste',model:'Galeria '+count,slug:`galeria-${count}-abcdef123456`,year:2022,fuel:'DIESEL',mileage:20000,price:'20000.00',currency:'EUR',description:null,transmission:null,availability:'AVAILABLE',photos:Array.from({length:count},(_,i)=>`/api/public/vehicles/galeria-${count}-abcdef123456/photos/${i}`)}));
const images=await Promise.all([[1800,1200],[900,1600],[600,600]].map(([width,height])=>sharp({create:{width,height,channels:3,background:'#495d70'}}).png().toBuffer()));
const catalog={items,total:4,page:1,pageSize:30,totalPages:1,facets:{brands:[{value:'Teste',count:4}],models:[],fuels:[],transmissions:[],year:{min:2022,max:2022},mileage:{min:20000,max:20000},price:{min:'20000.00',max:'20000.00'}}};
const api=createServer((req,res)=>{
 const path=new URL(req.url,'http://fixture').pathname.replace('/api/public/vehicles','');
 if(path.includes('/photos/')){res.writeHead(200,{'content-type':'image/png'});res.end(images[Number(path.split('/').at(-1))%3]);return;}
 const data=path==='/brands'?catalog.facets.brands:path==='/homepage-highlights'?{configured:true,items:[]}:path.endsWith('/related')?[]:items.find(v=>path===`/${v.slug}`)??catalog;
 res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data));
});
const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;};
let child,browser;const results=[];
try{
 const backend=await listen(api),probe=createServer(),port=await listen(probe);await new Promise(resolve=>probe.close(resolve));const origin=`http://127.0.0.1:${port}`;
 child=spawn(process.execPath,['build/index.js'],{cwd:'apps/website',stdio:'pipe',env:{...process.env,PORT:String(port),HOST:'127.0.0.1',ORIGIN:origin,INTERNAL_BACKEND_URL:`http://127.0.0.1:${backend}`,SITE_NOINDEX:'true'}});
 let ready=false;for(let i=0;i<100;i++){try{await fetch(origin);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}assert(ready);
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const page=await browser.newPage({reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://images.unsplash.com/**',route=>route.abort());
 const strip=page.locator('.detail-thumbnails'),buttons=strip.locator('button');
 const geometry=()=>strip.evaluate(node=>{
  const horizontal=getComputedStyle(node).flexDirection.startsWith('row'),box=node.getBoundingClientRect(),style=getComputedStyle(node);
  const start=(horizontal?box.left+node.clientLeft:box.top+node.clientTop)+parseFloat(horizontal?style.paddingLeft:style.paddingTop);
  const end=(horizontal?box.left+node.clientLeft+node.clientWidth:box.top+node.clientTop+node.clientHeight)-parseFloat(horizontal?style.paddingRight:style.paddingBottom);
  return{horizontal,start,end,position:horizontal?node.scrollLeft:node.scrollTop,max:horizontal?node.scrollWidth-node.clientWidth:node.scrollHeight-node.clientHeight,items:[...node.querySelectorAll('button')].map(button=>{const b=button.getBoundingClientRect();return{start:horizontal?b.left:b.top,end:horizontal?b.right:b.bottom,selected:button.getAttribute('aria-pressed')==='true'};})};
 });
 const visible=(g,index)=>g.items[index].start>=g.start-1.5&&g.items[index].end<=g.end+1.5;
 const checkEdges=async()=>{const edges=await page.locator('.detail-thumbnails-frame').evaluate(el=>({before:getComputedStyle(el,'::before').content,after:getComputedStyle(el,'::after').content,background:getComputedStyle(el.querySelector('.detail-thumbnails')).backgroundImage,corners:getComputedStyle(el.closest('.vehicle-gallery')).borderRadius,clip:getComputedStyle(el.closest('.vehicle-gallery')).overflow}));assert.equal(edges.before,'none');assert.equal(edges.after,'none');assert.equal(edges.background,'none');assert.equal(edges.corners,'5px');assert.equal(edges.clip,'hidden');};
 const check=async(index,direction=0)=>{await page.waitForFunction(index=>document.querySelectorAll('.detail-thumbnails button')[index]?.getAttribute('aria-pressed')==='true',index);await page.waitForTimeout(50);const g=await geometry();assert(visible(g,index),`Selected ${index+1} fully visible: ${JSON.stringify(g)}`);const next=index+direction;if(direction&&g.items[next]&&Math.max(g.items[index].end,g.items[next].end)-Math.min(g.items[index].start,g.items[next].start)<=g.end-g.start)assert(visible(g,next),'neighbour visible when pair fits');await checkEdges(g);return g;};
 for(const [width,height]of [[1440,1000],[1440,600],[2560,1440],[390,844],[844,390]]){
  await page.setViewportSize({width,height});await page.goto(origin+`/viaturas/${items[0].slug}`);await buttons.nth(19).waitFor();await page.waitForTimeout(100);
  const pageY=await page.evaluate(()=>scrollY);let last=await check(0);
  const stripWidth=(await strip.boundingBox()).width;if(width>701)assert(Math.abs(stripWidth-(Math.max(104,Math.min(152,width*.10))-4))<1,'vertical strip reduced by four pixels');else{assert(stripWidth<=width,'mobile strip stays within viewport');assert(Math.abs((await buttons.first().boundingBox()).width-112)<1);}
  for(let i=1;i<20;i++){const still=[i,i+1].every(index=>!last.items[index]||(last.items[index].start>=last.start&&last.items[index].end<=last.end));await page.locator('.photo-next').evaluate(el=>el.click());const next=await check(i,1);assert(next.position>=last.position-1);if(still)assert(Math.abs(next.position-last.position)<1);last=next;}
  await page.locator('.photo-next').evaluate(el=>el.click());await check(19);assert(await page.locator('.photo-next').isDisabled());
  for(let i=18;i>=0;i--){await page.locator('.photo-previous').evaluate(el=>el.click());const next=await check(i,-1);assert(next.position<=last.position+1);last=next;}
  assert(await page.locator('.photo-previous').isDisabled());
  await strip.evaluate(node=>node.scrollTo({left:node.scrollWidth,top:node.scrollHeight,behavior:'instant'}));await page.waitForTimeout(80);assert.equal(await buttons.first().getAttribute('aria-pressed'),'true');
  await checkEdges(await geometry());
  await buttons.nth(13).evaluate(el=>el.click());await check(13,1);assert.equal(await page.evaluate(()=>scrollY),pageY,'only strip scrolls');
  await page.setViewportSize({width:width>701?width:844,height:Math.max(420,height-150)});await page.waitForTimeout(100);await check(13,1);
  await page.setViewportSize({width,height});await page.waitForTimeout(100);await check(13,1);
  await page.locator('.vehicle-photo').evaluate(el=>{el.focus({preventScroll:true});el.click();});const dialog=page.locator('.gallery-dialog');await dialog.waitFor();
  let controlPositions;
  for(const index of [0,1]){
   await page.keyboard.press(index?'ArrowRight':'ArrowLeft');await page.waitForTimeout(50);
   await page.waitForFunction(()=>{const img=document.querySelector('.gallery-dialog img');return img?.complete&&img.naturalWidth>0;});
   const picture=await dialog.locator('img').evaluate(img=>{const r=img.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,fit:getComputedStyle(img).objectFit};});
   const viewport=page.viewportSize(),bounds=await dialog.boundingBox();assert(Math.abs(bounds.x+bounds.width/2-viewport.width/2)<1);assert(Math.abs(bounds.y+bounds.height/2-viewport.height/2)<1);
   const area=(w,h)=>{const scale=Math.min(w/picture.naturalWidth,h/picture.naturalHeight);return picture.naturalWidth*picture.naturalHeight*scale*scale;};
   const oldWidth=viewport.width<=600?viewport.width-104:Math.min(1500,viewport.width-24)-120,oldHeight=viewport.width<=600?viewport.height-113:Math.min(1000,viewport.height-24)-113;
   assert(area(picture.width,picture.height)>area(oldWidth,oldHeight),'larger than original viewer');assert(area(picture.width,picture.height)<area(viewport.width-24,viewport.height-24),'smaller than maximized viewer');
   assert.equal(picture.fit,'contain');assert(bounds.x>=16&&bounds.y>=12&&bounds.x+bounds.width<=viewport.width-16+1&&bounds.y+bounds.height<=viewport.height-12+1);
   for(const name of ['Fechar fotografia','Fotografia anterior','Fotografia seguinte']){const control=dialog.getByRole('button',{name,exact:true});assert.equal(await control.count(),1);const b=await control.boundingBox();assert(b.width>=44&&b.height>=44);assert(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1);}
   const positions=await dialog.locator('.viewer-controls button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return{x:r.x,y:r.y};}));
   if(controlPositions)for(let i=0;i<positions.length;i++){assert(Math.abs(positions[i].x-controlPositions[i].x)<1&&Math.abs(positions[i].y-controlPositions[i].y)<1,'controls stable across portrait/landscape');}controlPositions=positions;
  }
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));}
  await dialog.locator('img').click();assert(await dialog.evaluate(el=>el.open));await dialog.locator('.viewer-controls p').click();assert(await dialog.evaluate(el=>el.open));
  const imageBox=await dialog.locator('img').boundingBox();await page.mouse.move(imageBox.x+imageBox.width/2,imageBox.y+imageBox.height/2);await page.mouse.down();await page.mouse.move(4,4,{steps:6});await page.mouse.up();assert(await dialog.evaluate(el=>el.open),'image drag to backdrop does not dismiss');
  await page.screenshot({path:`${root}/viewer-${width}x${height}.png`});await page.keyboard.press('Escape');assert(await page.locator('.vehicle-photo').evaluate(el=>el===document.activeElement));
  const scrollBefore=await page.evaluate(()=>scrollY);await page.locator('.vehicle-photo').evaluate(el=>{el.focus({preventScroll:true});el.click();});await dialog.waitFor();await page.mouse.click(4,4);await page.waitForFunction(()=>!document.querySelector('.gallery-dialog').open);assert(await page.locator('.vehicle-photo').evaluate(el=>el===document.activeElement));assert.equal(await page.evaluate(()=>scrollY),scrollBefore,'backdrop restores page position');
  results.push({width,height,axis:last.horizontal?'horizontal':'vertical',manyPhotos:true,dialog:true});console.log(`PASS ${width}x${height}: following, both directions, manual scroll, direct selection, resize and expanded viewer`);
 }
 for(const count of [2,1,0]){const vehicle=items.find(item=>item.photos.length===count);await page.goto(origin+`/viaturas/${vehicle.slug}`);await page.locator('.vehicle-photo').waitFor();if(count===2){await buttons.nth(1).waitFor();await buttons.nth(1).click();assert.equal((await geometry()).position,0);}else{assert.equal(await strip.count(),0);assert.equal(await page.locator('.photo-next').count(),0);}if(!count)assert(await page.locator('.vehicle-photo').isDisabled());console.log(`PASS ${count} photos`);}
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:600});await page.goto(origin+`/viaturas/${items[0].slug}`);await buttons.nth(19).waitFor();
 await buttons.evaluateAll(async items=>{for(const i of [12,2,18,6,19]){items[i].click();await new Promise(resolve=>setTimeout(resolve,12));}});await page.waitForTimeout(300);await check(19,1);const settled=(await geometry()).position;await page.waitForTimeout(250);assert(Math.abs((await geometry()).position-settled)<1,'no stale animation');
 await buttons.first().evaluate(el=>el.click());await page.waitForTimeout(40);
 await strip.evaluate(node=>{node.dispatchEvent(new WheelEvent('wheel',{deltaY:100}));node.scrollTo({left:0,top:100,behavior:'instant'});});
 const manualPosition=(await geometry()).position;await page.waitForTimeout(250);assert(Math.abs((await geometry()).position-manualPosition)<1,'manual scroll cancels ongoing animation');assert.equal(await buttons.first().getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);await writeFile(`${root}/report.json`,JSON.stringify({results,errors,fixtureOnly:true},null,2));console.log('PASS smooth rapid selection cancels obsolete motion; no browser errors');
}finally{await browser?.close();if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}await new Promise(resolve=>api.close(resolve));}
