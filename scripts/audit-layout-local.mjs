// Local-only visual audit proxy: node scripts/audit-layout-local.mjs
// Open http://localhost:5178 (upstream: 5173). Delays images 12s, fonts 1.5s,
// selection data 3s. The diagnostic is injected only into proxy responses.
import http from 'node:http';
const origin = new URL(process.env.LAYOUT_UPSTREAM || 'http://localhost:5173');
if (!['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Local upstream required');
const instrument = `<script>
window.__layoutAudit={cls:0,shifts:[],frames:[]};
let sessionScore=0,sessionStart=0,lastShift=0;
new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){
  if(e.startTime-lastShift>1000||e.startTime-sessionStart>5000){sessionScore=0;sessionStart=e.startTime;}
  lastShift=e.startTime;sessionScore+=e.value;window.__layoutAudit.cls=Math.max(window.__layoutAudit.cls,sessionScore);
  window.__layoutAudit.shifts.push({at:e.startTime,value:e.value,sources:(e.sources||[]).map(s=>({node:s.node?.className,from:s.previousRect,to:s.currentRect}))});
}}).observe({type:'layout-shift',buffered:true});
document.addEventListener('DOMContentLoaded',()=>{const start=performance.now();let last='';
  function sample(){const boxes=[...document.querySelectorAll('.vehicle-photo-stage,.vehicle-photo,.vehicle-card,.v1-feature,.favorites-grid,.comparison-board')].slice(0,12).map(e=>{const r=e.getBoundingClientRect();return {class:e.className,x:r.x,y:r.y,width:r.width,height:r.height}});
    const images=[...document.images].filter(i=>i.complete&&i.naturalWidth).length;
    const key=JSON.stringify({boxes,images});if(key!==last){window.__layoutAudit.frames.push({at:performance.now(),images,boxes});last=key;}
    if(performance.now()-start<20000)requestAnimationFrame(sample);
  }sample();});
setInterval(()=>document.documentElement.setAttribute('data-layout-audit',JSON.stringify(window.__layoutAudit)),250);
</script>`;
http.createServer((req, res) => {
  const path = req.url || '/';
  const target = new URL(path, origin);
  if (!['GET', 'HEAD'].includes(req.method || 'GET') || target.origin !== origin.origin) {
    res.writeHead(405); res.end('Read-only local audit'); return;
  }
  const delay = /\/photos\/|\.(webp|png|jpe?g|svg)(\?|$)/i.test(path) ? 12000 : /\.woff2?(\?|$)/i.test(path) ? 1500 : path.startsWith('/comparar/dados?') ? 3000 : 0;
  const upstream = http.request(target, { method: req.method, headers: { ...req.headers, host: origin.host, 'accept-encoding': 'identity', 'cache-control': 'no-cache' } }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => {
      let body = Buffer.concat(chunks);
      const headers = { ...response.headers, 'cache-control': 'no-store' };
      delete headers['content-length']; delete headers['content-encoding']; delete headers['transfer-encoding'];
      if (String(headers['content-type']).includes('text/html')) body = Buffer.from(body.toString().replace('<head>', '<head>' + instrument));
      setTimeout(() => { res.writeHead(response.statusCode || 502, headers); res.end(body); }, delay);
    });
  });
  upstream.on('error', () => { res.writeHead(502); res.end('Local upstream unavailable'); });
  req.pipe(upstream);
}).listen(5178, '127.0.0.1', () => console.log('Layout audit: http://localhost:5178 (images +12s, fonts +1.5s, selection data +3s)'));
