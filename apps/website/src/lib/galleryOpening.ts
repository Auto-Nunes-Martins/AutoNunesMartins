type Rect = { left: number; top: number; width: number; height: number };
type OpeningPhoto = { canvas: HTMLCanvasElement; source: HTMLImageElement; frame: Rect; paint: Rect; width: number; height: number; radius: string };

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
  return {canvas,source:image,frame,paint:photoPaintRect(frame,image.naturalWidth,image.naturalHeight,style.objectFit==='contain'?'contain':'cover',position[0],position[1]),
    width:image.naturalWidth,height:image.naturalHeight,radius:getComputedStyle(image.closest('.vehicle-photo') ?? image).borderRadius};
}

/** A short expansion above the live image. All controls and dismissal stay immediately usable. */
export function animateGalleryOpening(dialog: HTMLDialogElement, photo?: OpeningPhoto, closing = false, onfinish?: () => void): () => void {
  const finish = onfinish;
  let completed = false;
  onfinish = () => { if (!completed) { completed = true; finish?.(); } };
  const active = () => dialog.querySelector<HTMLImageElement>('.photo-rail-slide:not([inert]):not(.rail-contact) img, .viewer-stage > img');
  const found = active();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.open) {
    if (photo) { photo.canvas.width = 0; photo.canvas.height = 0; }
    onfinish?.();
    return () => {};
  }
  if (!photo || !found || (window.visualViewport?.scale ?? 1) > 1.01 ||
      (closing && found.closest<HTMLElement>('.photo-rail-track')?.dataset.moving === 'true')) {
    if (photo) { photo.canvas.width = 0; photo.canvas.height = 0; }
    const fade = dialog.animate(closing ? [{opacity:1},{opacity:0}] : [{opacity:0},{opacity:1}], {duration:160});
    const backdrop = fadeBackdrop(dialog, closing, 160);
    let cancelled = false;
    void fade.finished.then(() => { if (!cancelled) { onfinish?.(); fade.cancel(); backdrop.cancel(); } }).catch(() => {});
    return () => { cancelled = true; fade.cancel(); backdrop.cancel(); };
  }
  const image: HTMLImageElement = found;
  const identity = image.alt;
  const frame = image.getBoundingClientRect(), dialogBox = dialog.getBoundingClientRect();
  if (!frame.width || !frame.height) {photo.canvas.width=0;photo.canvas.height=0;onfinish();return () => {};}
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
  Object.assign(floating.style,pixels(closing ? end : origin));
  const canvasOrigin = {left:photo.paint.left-photo.frame.left,top:photo.paint.top-photo.frame.top,width:photo.paint.width,height:photo.paint.height};
  const canvasEnd = {left:0,top:0,width:destination.width,height:destination.height};
  Object.assign(canvas.style,pixels(closing ? canvasEnd : canvasOrigin));
  const options = {duration:closing ? 240 : 360,easing:'cubic-bezier(.22,.75,.18,1)',fill:'forwards' as FillMode};
  // The inline photo remains underneath: blend into it on return instead of
  // carrying a fully opaque duplicate all the way back to its crop.
  const frameKeys = [{...pixels(origin),opacity:closing ? 0 : 1},{...pixels(end),opacity:1}], paintKeys = [pixels(canvasOrigin),pixels(canvasEnd)];
  const animations = [
    floating.animate(closing ? frameKeys.reverse() : frameKeys,options),
    canvas.animate(closing ? paintKeys.reverse() : paintKeys,options),
    // Opacity has its own linear clock: the fast spatial easing must not make
    // the photo almost solid in the first quarter of the opening.
    ...(!closing ? [
      canvas.animate([{opacity:.08},{opacity:1}], {...options,easing:'linear'}),
      // Suppress the matching inline image while it could visually fill in
      // the translucent layer; restore it gradually behind the dark backdrop.
      photo.source.animate([
        {opacity:1,offset:0},{opacity:0,offset:.18},
        {opacity:0,offset:.65},{opacity:1,offset:1},
      ], {...options,easing:'linear'}),
    ] : []),
    fadeBackdrop(dialog, closing, options.duration),
    ...Array.from(dialog.querySelectorAll<HTMLElement>('.viewer-heading, .viewer-thumbnails, .viewer-stage > .viewer-controls button')).map(control =>
      control.animate(closing ? [{opacity:getComputedStyle(control).opacity},{opacity:0}] : [{opacity:0},{opacity:getComputedStyle(control).opacity}], options)),
  ];
  let disposed = false, ended = false;
  const viewport = window.visualViewport;
  const viewportSize = [innerWidth,innerHeight,viewport?.width,viewport?.height,viewport?.scale];
  const resized = () => {
    const next = [innerWidth,innerHeight,viewport?.width,viewport?.height,viewport?.scale];
    if(next.some((value,index)=>Math.abs((value??0)-(viewportSize[index]??0))>(index===4?.01:.5))) { if (closing) onfinish?.(); cleanup(); }
  };
  const ready = () => image.complete && image.naturalWidth > 0 && getComputedStyle(image).visibility !== 'hidden';
  const observer = new MutationObserver(() => {
    if (!dialog.open || active() !== image || !image.isConnected || image.alt !== identity) { if (closing && dialog.open) onfinish?.(); cleanup(); }
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
    for (const event of interruptEvents) dialog.removeEventListener(event,cleanup,true);
    image.removeEventListener('load',loaded); image.removeEventListener('error',cleanup);
    window.removeEventListener('resize',resized); viewport?.removeEventListener('resize',resized);
    if (closing) onfinish?.();
  }
  observer.observe(dialog,{subtree:true,childList:true,attributes:true,attributeFilter:['open','inert','src','style','alt']});
  const interruptEvents = closing ? ['close'] : ['close','cancel','pointerdown','keydown'];
  for (const event of interruptEvents) dialog.addEventListener(event,cleanup,{capture:true});
  image.addEventListener('load',loaded); image.addEventListener('error',cleanup);
  window.addEventListener('resize',resized); viewport?.addEventListener('resize',resized);
  void Promise.all(animations.map(animation=>animation.finished)).then(()=>{ended=true;if(closing) { onfinish?.(); cleanup(); } else if(ready())cleanup();}).catch(()=>{});
  return cleanup;
}

function fadeBackdrop(dialog: HTMLDialogElement, closing: boolean, duration: number) {
  return dialog.animate(closing ? [{opacity:1},{opacity:0}] : [{opacity:0},{opacity:1}], {
    duration, easing:'ease-out', fill:'forwards', pseudoElement:'::backdrop',
  });
}

/** Resolve the current inline slide, so navigating in the viewer returns to the same photo. */
export function animateGalleryClosing(dialog: HTMLDialogElement, image: HTMLImageElement | null, onfinish: () => void) {
  return animateGalleryOpening(dialog, captureOpeningPhoto(image), true, onfinish);
}
