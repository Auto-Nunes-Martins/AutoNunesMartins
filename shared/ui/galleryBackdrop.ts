/** Close only a click that begins and ends on empty backdrop, never an image drag. */
export function galleryBackdrop(dialog: HTMLDialogElement) {
  let start: {x:number;y:number} | undefined;
  function outsideImage(event:MouseEvent) {
    const target=event.target as Element;
    if(target.closest('.viewer-controls,button'))return false;
    const image=dialog.querySelector('img');if(!image||!image.naturalWidth)return target===dialog;
    if(target!==dialog&&target!==image)return false;
    const rect=image.getBoundingClientRect(),scale=Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight);
    const width=image.naturalWidth*scale,height=image.naturalHeight*scale,left=rect.left+(rect.width-width)/2,top=rect.top+(rect.height-height)/2;
    return event.clientX<left||event.clientX>left+width||event.clientY<top||event.clientY>top+height;
  }
  const down=(event:PointerEvent)=>{start=event.button===0&&outsideImage(event)?{x:event.clientX,y:event.clientY}:undefined;};
  const cancel=()=>{start=undefined;};
  const click=(event:MouseEvent)=>{if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<6&&outsideImage(event)){event.preventDefault();event.stopPropagation();dialog.close();}start=undefined;};
  dialog.addEventListener('pointerdown',down);dialog.addEventListener('pointercancel',cancel);dialog.addEventListener('click',click);
  return{destroy(){dialog.removeEventListener('pointerdown',down);dialog.removeEventListener('pointercancel',cancel);dialog.removeEventListener('click',click);}};
}
