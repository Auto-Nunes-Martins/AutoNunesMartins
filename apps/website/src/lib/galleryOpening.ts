type Rect = { left: number; top: number; width: number; height: number };
type OpeningPhoto = { canvas: HTMLCanvasElement; frame: Rect; paint: Rect; width: number; height: number; radius: string };

/** The painted image keeps its aspect ratio, including the inline cover crop. */
export function photoPaintRect(frame: Rect, width: number, height: number, fit: 'cover' | 'contain', x = .5, y = .5): Rect {
  const scale = Math[fit === 'cover' ? 'max' : 'min'](frame.width / width, frame.height / height);
  const w = width * scale, h = height * scale;
  return {left:frame.left + (frame.width-w)*x, top:frame.top + (frame.height-h)*y, width:w, height:h};
}

/** Capture decoded pixels once; no new URL, download, storage write or accessible duplicate. */
export function captureOpeningPhoto(image: HTMLImageElement | null): OpeningPhoto | undefined {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !image?.complete || !image.naturalWidth ||
      image.closest<HTMLElement>('.photo-rail-track')?.dataset.moving === 'true') return;
  const frame = image.getBoundingClientRect(), style = getComputedStyle(image);
  if (!frame.width || !frame.height || frame.bottom <= 0 || frame.top >= innerHeight || style.visibility === 'hidden') return;
  const canvas = document.createElement('canvas'), scale = Math.min(1,1600 / Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width = Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height = Math.max(1,Math.round(image.naturalHeight*scale));
  const context = canvas.getContext('2d');
  if (!context) return;
  try { context.drawImage(image,0,0,canvas.width,canvas.height); } catch { return; }
  const position = style.objectPosition.split(' ').map(value => value.endsWith('%') ? parseFloat(value)/100 : .5);
  return {canvas,frame,paint:photoPaintRect(frame,image.naturalWidth,image.naturalHeight,style.objectFit==='contain'?'contain':'cover',position[0],position[1]),
    width:image.naturalWidth,height:image.naturalHeight,radius:getComputedStyle(image.closest('.vehicle-photo') ?? image).borderRadius};
}

/** A short expansion above the live image. All controls and dismissal stay immediately usable. */
export function animateGalleryOpening(dialog: HTMLDialogElement, photo?: OpeningPhoto): () => void {
  const active = () => dialog.querySelector<HTMLImageElement>('.photo-rail-slide:not([inert]) img, .viewer-stage > img');
  const found = active();
  if (!photo || !found || !dialog.open) { if(photo){photo.canvas.width=0;photo.canvas.height=0;} return () => {}; }
  const image: HTMLImageElement = found;
  const identity = image.alt;
  const frame = image.getBoundingClientRect(), dialogBox = dialog.getBoundingClientRect();
  if (!frame.width || !frame.height) {photo.canvas.width=0;photo.canvas.height=0;return () => {};}
  const destination = photoPaintRect(frame,photo.width,photo.height,'contain');
  const floating = document.createElement('div'), canvas = photo.canvas;
  floating.dataset.openingPhoto = '';
  floating.setAttribute('aria-hidden','true');
  floating.style.cssText = 'position:absolute;overflow:hidden;pointer-events:none;z-index:1;';
  canvas.style.cssText = 'position:absolute;display:block;max-width:none;max-height:none;pointer-events:none;';
  const oldOpacity = image.style.opacity, oldOverflow = dialog.style.overflow;
  image.style.opacity = '0'; dialog.style.overflow = 'visible';
  floating.append(canvas); dialog.append(floating);
  const origin = {left:photo.frame.left-dialogBox.left,top:photo.frame.top-dialogBox.top,width:photo.frame.width,height:photo.frame.height,borderRadius:photo.radius};
  const end = {left:destination.left-dialogBox.left,top:destination.top-dialogBox.top,width:destination.width,height:destination.height,borderRadius:'0px'};
  const pixels = (rect: Record<string,number|string>) => Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,typeof value==='number'?value+'px':value]));
  Object.assign(floating.style,pixels(origin));
  const canvasOrigin = {left:photo.paint.left-photo.frame.left,top:photo.paint.top-photo.frame.top,width:photo.paint.width,height:photo.paint.height};
  Object.assign(canvas.style,pixels(canvasOrigin));
  const options = {duration:220,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards' as FillMode};
  const animations = [floating.animate([pixels(origin),pixels(end)],options),canvas.animate([pixels(canvasOrigin),pixels({left:0,top:0,width:destination.width,height:destination.height})],options)] as const;
  let disposed = false, ended = false;
  const viewport = window.visualViewport;
  const viewportSize = [innerWidth,innerHeight,viewport?.width,viewport?.height,viewport?.scale];
  const resized = () => {
    const next = [innerWidth,innerHeight,viewport?.width,viewport?.height,viewport?.scale];
    if(next.some((value,index)=>Math.abs((value??0)-(viewportSize[index]??0))>(index===4?.01:.5))) cleanup();
  };
  const ready = () => image.complete && image.naturalWidth > 0 && getComputedStyle(image).visibility !== 'hidden';
  const observer = new MutationObserver(() => {
    if (!dialog.open || active() !== image || !image.isConnected || image.alt !== identity) cleanup();
    else if (ended && ready()) cleanup();
  });
  const maxWait = setTimeout(cleanup,750);
  const loaded = () => { if (ended && ready()) cleanup(); };
  function cleanup() {
    if (disposed) return;
    disposed = true; clearTimeout(maxWait); observer.disconnect();
    animations.forEach(animation=>animation.cancel());
    image.style.opacity = oldOpacity; dialog.style.overflow = oldOverflow;
    floating.remove(); canvas.width = 0; canvas.height = 0;
    for (const event of ['close','cancel','pointerdown','keydown']) dialog.removeEventListener(event,cleanup,true);
    image.removeEventListener('load',loaded); image.removeEventListener('error',cleanup);
    window.removeEventListener('resize',resized); viewport?.removeEventListener('resize',resized);
  }
  observer.observe(dialog,{subtree:true,childList:true,attributes:true,attributeFilter:['open','inert','src','style','alt']});
  for (const event of ['close','cancel','pointerdown','keydown']) dialog.addEventListener(event,cleanup,{capture:true});
  image.addEventListener('load',loaded); image.addEventListener('error',cleanup);
  window.addEventListener('resize',resized); viewport?.addEventListener('resize',resized);
  void Promise.all(animations.map(animation=>animation.finished)).then(()=>{ended=true;if(ready())cleanup();}).catch(()=>{});
  return cleanup;
}
