// Isolated browser fixtures. Generated files are retained; no application/Storage writes.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';
const root = process.cwd(),
  output = path.join(root, 'apps/crm/.svelte-kit');
await mkdir(output, { recursive: true });
const directory = await mkdtemp(path.join(output, 'responsive-reuse-'));
const source = await readFile(
  path.join(root, 'apps/website/src/lib/assets/optimized/home-v5/curves-wide-3840.webp'),
);
const widths = [320, 384, 800, 1280, 1600, 2560],
  bodies = new Map(
    await Promise.all(
      widths.map(async (width) => [
        width,
        await sharp(source)
          .resize({ width, height: Math.round(width / 1.2), fit: 'cover' })
          .webp({ quality: 84, effort: 6, smartSubsample: true })
          .toBuffer(),
      ]),
    ),
  );
let requests = [];
bodies.set(
  200,
  await sharp(source)
    .resize({ width: 200, height: 167, fit: 'cover' })
    .webp({ quality: 84 })
    .toBuffer(),
);
const fixture = `import {createPublicGallerySession} from '@website/publicGallerySession';
import {publicGalleryPhoto} from '@website/publicGalleryPhoto';
import {publicThumbnail,createThumbnailSession} from '@website/publicThumbnail';
import {vehiclePhotoSet,detailPhotoSizes} from '@website/vehiclePhotoSources';
import {reusablePhoto} from '@crm/reusablePhoto';
import {captureCardPhoto} from '@website/cardPhotoPreview';
const version='a'.repeat(64),src='/viaturas/fixture-abcdef123456/photos/0?v='+version;
const vehicle={slug:'fixture-abcdef123456',photos:[src],photoDimensions:[{version,width:2400,height:2000}]};
const session=createPublicGallerySession(vehicle),thumbs=createThumbnailSession(vehicle.slug,[version]);
const inline=document.querySelector('#inline'),thumb=document.querySelector('#thumb');
for(const node of [inline,thumb]){node.sizes=detailPhotoSizes;node.srcset=vehiclePhotoSet(src);node.src=src+'&w=1600';}
publicThumbnail(thumb,{session:thumbs,index:0,src:src+'&w=1600',srcset:vehiclePhotoSet(src),sizes:detailPhotoSizes});
publicGalleryPhoto(inline,{session,src});
const photo={url:'/signed/master.webp',width:2400,height:2000,variants:[320,384,800,1280,1600,2560].map(width=>({url:'/signed/'+width+'.webp',width,height:Math.round(width/1.2)}))};
const crm=document.querySelector('#crm-inline'),crmThumb=document.querySelector('#crm-thumb');
reusablePhoto(crm,{photo});reusablePhoto(crmThumb,{photo});
let close;
document.querySelector('#open').onclick=()=>{const node=document.createElement('img');document.querySelector('#viewer').append(node);close=publicGalleryPhoto(node,{session,src,fullscreen:true});};
document.querySelector('#open-crm').onclick=()=>{const node=document.createElement('img');document.querySelector('#viewer').append(node);close=reusablePhoto(node,{photo,fullscreen:true});};
document.querySelector('#close').onclick=()=>{close?.destroy();document.querySelector('#viewer').replaceChildren();};
window.fixture={session,src,denied:()=>createPublicGallerySession({...vehicle,photos:[]}).read(src),changed:()=>createPublicGallerySession({...vehicle,photos:[src.replace(version,'b'.repeat(64))]}).read(src)};
window.fixture.handoff=()=>{captureCardPhoto(thumb);const parent=document.createElement('div');parent.style.cssText='position:relative;width:60vw;height:35vw';const image=document.createElement('img');image.style.cssText='width:100%;height:100%;object-fit:cover';parent.append(image);document.body.append(parent);const fresh=createPublicGallerySession(vehicle);const action=publicGalleryPhoto(image,{src,session:{...fresh,read:async(...args)=>{await new Promise(r=>setTimeout(r,250));return fresh.read(...args);}}});window.fixture.closeHandoff=()=>{action.destroy();parent.remove();};};
window.fixture.small=()=>{const version='c'.repeat(64),src='/viaturas/small-abcdef123456/photos/0?v='+version,session=createPublicGallerySession({slug:'small-abcdef123456',photos:[src],photoDimensions:[{version,width:200,height:167}]});const image=document.createElement('img');document.querySelector('#viewer').append(image);close=publicGalleryPhoto(image,{session,src,fullscreen:true});};
window.ready=true;`;
await writeFile(path.join(directory, 'client.js'), fixture);
await writeFile(
  path.join(directory, 'index.html'),
  `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><style>#inline,#crm-inline{width:60vw;height:35vw;object-fit:cover}#thumb,#crm-thumb{width:96px;height:64px}#viewer{position:fixed;inset:0;background:#111;pointer-events:none}#viewer:empty{display:none}#viewer img{width:100%;height:100%;object-fit:contain}button{position:relative;z-index:10}</style><img id="inline"><img id="thumb"><section data-photo-resolution-group><div class="photo-preview" style="width:60vw"><img id="crm-inline"></div><img id="crm-thumb"></section><button id="open">Public fullscreen</button><button id="open-crm">CRM fullscreen</button><button id="close">Close</button><div id="viewer"></div><script type="module" src="/client.js"></script></body></html>`,
);
let vite, browser;
const results = [];
try {
  vite = await createServer({
    configFile: false,
    root: directory,
    resolve: {
      alias: {
        $lib: path.join(root, 'apps/website/src/lib'),
        '@website': path.join(root, 'apps/website/src/lib'),
        '@crm': path.join(root, 'apps/crm/src/lib'),
      },
    },
    plugins: [
      {
        name: 'photo-fixture',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = new URL(req.url, 'http://fixture');
            let width;
            if (url.pathname.startsWith('/viaturas/') && url.pathname.includes('/photos/'))
              width = Number(url.searchParams.get('w') || 1600);
            else if (url.pathname.startsWith('/signed/'))
              width = url.pathname.includes('master')
                ? 2560
                : Number(url.pathname.match(/\d+/)?.[0]);
            else return next();
            if (url.pathname.includes('/small-')) width = 200;
            const body = bodies.get(width);
            if (!body) {
              res.statusCode = 404;
              res.end();
              return;
            }
            requests.push({
              scope: url.pathname.startsWith('/signed/') ? 'crm' : 'public',
              width,
              bytes: body.length,
            });
            res.setHeader('content-type', 'image/webp');
            res.setHeader(
              'x-photo-version',
              (url.pathname.includes('/small-') ? 'c' : 'a').repeat(64),
            );
            res.setHeader('cache-control', 'private, max-age=3600');
            res.setHeader('content-length', body.length);
            setTimeout(() => res.end(body), width >= 1280 ? 350 : 0);
          });
        },
      },
    ],
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
    logLevel: 'error',
  });
  await vite.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [profile, width, height, dpr] of [
    ['desktop', 1024, 900, 1],
    ['mobile', 390, 844, 2],
    ['desktop-dpr15', 1280, 900, 1.5],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      }),
      page = await context.newPage(),
      errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.message));
    requests = [];
    await page.goto('http://127.0.0.1:' + vite.httpServer.address().port);
    await page.waitForFunction(
      () =>
        window.ready &&
        ['inline', 'thumb', 'crm-inline', 'crm-thumb'].every((id) => {
          const i = document.getElementById(id);
          return i.complete && i.naturalWidth > 0;
        }),
    );
    await page.waitForTimeout(400);
    const initial = requests.splice(0),
      pixels = await page.locator('#inline,#thumb,#crm-inline,#crm-thumb').evaluateAll((nodes) =>
        nodes.map((n) => ({
          id: n.id,
          width: n.naturalWidth,
          src: n.currentSrc.startsWith('blob:') ? 'blob' : n.currentSrc.split('/').pop(),
        })),
      );
    assert.equal(pixels[0].width, pixels[1].width, 'public main/thumbnail resolution');
    assert.equal(pixels[2].width, pixels[3].width, 'CRM main/thumbnail resolution');
    await page.evaluate(() => window.fixture.handoff());
    await page.waitForSelector('[data-card-photo-preview]');
    await page.waitForTimeout(100);
    assert.equal(
      await page.locator('[data-card-photo-preview]').count(),
      1,
      'decoded card pixels stay visible during acquisition',
    );
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator('[data-card-photo-preview]').count(),
      0,
      'preview removed after decode',
    );
    await page.evaluate(() => window.fixture.closeHandoff());
    assert.equal(requests.splice(0).length, 0, 'same-version handoff reuses retained bytes');
    for (const id of ['open', 'open-crm']) {
      await page.click('#' + id);
      await page.waitForFunction(() => {
        const i = document.querySelector('#viewer img');
        return i?.complete && i.naturalWidth > 0;
      });
      await page.evaluate(() => {
        window.blankFrames = 0;
        window.watching = true;
        function frame() {
          const i = document.querySelector('#viewer img');
          if (
            i &&
            (!i.complete || !i.naturalWidth) &&
            !document.querySelector('[data-photo-preview]')
          )
            window.blankFrames++;
          if (window.watching) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => (window.watching = false));
      assert.equal(
        await page.evaluate(() => window.blankFrames),
        0,
        'decoded replacement never paints empty',
      );
      const effective = await page.locator('#viewer img').evaluate((n) => n.naturalWidth),
        transfers = requests.splice(0);
      results.push({ profile, view: id, initial, pixels, effective, transfers });
      await page.click('#close');
      await page.click('#' + id);
      await page.waitForTimeout(100);
      await page.click('#close');
      assert.equal(requests.splice(0).length, 0, 'reopening reuses the same resolution');
    }
    assert.equal(
      await page.evaluate(() => window.fixture.denied()),
      undefined,
      'new authorization cannot use prior pixels',
    );
    assert.equal(
      await page.evaluate(() => window.fixture.changed()),
      undefined,
      'a stale version cannot borrow prior pixels',
    );
    requests = [];
    await page.evaluate(() => window.fixture.small());
    await page.waitForFunction(() => document.querySelector('#viewer img')?.naturalWidth === 200);
    await page.waitForTimeout(400);
    assert.equal(
      requests.length,
      1,
      'small native master does not trigger a pointless larger download',
    );
    await page.click('#close');
    await page.setViewportSize({ width: width + 180, height });
    await page.waitForTimeout(600);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const destination = path.join(root, 'docs/measurements/responsive-reuse-2026-10-30');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'reuse-browser.json'), JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify(
      results.map((r) => ({
        profile: r.profile,
        view: r.view,
        effective: r.effective,
        transfers: r.transfers.map((t) => t.width),
      })),
    ),
  );
} finally {
  await browser?.close();
  await vite?.close();
}
