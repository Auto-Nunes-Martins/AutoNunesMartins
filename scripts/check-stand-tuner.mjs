// Development-only facade controls against the running local website. No saved data writes.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 for(const [width,height]of[[2560,1440],[1920,1080],[390,844]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  await page.goto('http://localhost:5173');await page.waitForFunction(()=>!document.querySelector('[data-theme-command]')?.disabled);await page.waitForTimeout(300);await page.getByRole('button',{name:'Ajustar fundo +',exact:true}).click();
  const panel=page.getByRole('complementary',{name:'Ajustar fundo da opção 1'});await panel.waitFor();
  const layer=page.locator('[data-stand-image="1"]');
  const geometry=()=>layer.locator('img').evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y};});
  const initial=await geometry();
  for(const [label,value,key]of[['Zoom','75','width'],['Posição horizontal','35','x'],['Posição vertical','40','y'],['Largura','110','width'],['Altura','110','height']]){
   const before=await geometry(),areaBefore=await layer.boundingBox();await panel.getByRole('spinbutton',{name:`${label} em percentagem`,exact:true}).fill(value);await page.waitForTimeout(100);
   const after=await geometry();if(['Zoom','Posição horizontal','Posição vertical'].includes(label))assert(Math.abs(after[key]-before[key])>1,`${width} ${label} changes rendered facade`);
   if(['Largura','Altura'].includes(label)){const areaAfter=await layer.boundingBox();assert(Math.abs(areaAfter[key]-areaBefore[key])>1,`${width} ${label} changes backdrop area`);}
   assert.equal(await panel.getByRole('slider',{name:label,exact:true}).inputValue(),value);
  }
  await panel.getByRole('button',{name:'Imagem 2 · Segundo stand',exact:true}).click();assert.equal(await panel.getByRole('spinbutton',{name:'Zoom em percentagem',exact:true}).inputValue(),'84');
  await panel.getByRole('button',{name:'Imagem 1 · Stand original',exact:true}).click();assert.equal(await panel.getByRole('spinbutton',{name:'Zoom em percentagem',exact:true}).inputValue(),'75');
  await panel.getByRole('button',{name:'Copiar configuração',exact:true}).click();const config=JSON.parse(await panel.getByRole('textbox',{name:'Configuração actual',exact:true}).inputValue());assert.equal(config.images[0].zoom,75);assert.equal(config.images[0].horizontal,35);
  await panel.getByRole('button',{name:'Repor ajustes iniciais',exact:true}).click();await page.waitForTimeout(150);const reset=await geometry();for(const key of Object.keys(initial))assert(Math.abs(initial[key]-reset[key])<1,`${width} restores ${key}`);
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'no page overflow');
  await page.screenshot({path:`.cache/stand-framing/tuner-${width}.png`});await page.close();console.log(`PASS ${width}: geometry controls, per-image values, export, reset and bounds`);
 }
}finally{await browser.close();}
