import {expect,it} from 'vitest';
import {photoPaintRect} from './galleryOpening';

it('keeps the same image ratio while an inline cover crop expands',()=>{
  const source=photoPaintRect({left:20,top:100,width:300,height:200},1600,900,'cover');
  const destination=photoPaintRect({left:60,top:40,width:1200,height:800},1600,900,'contain');
  expect(source.left).toBeLessThan(20);
  expect(source.height).toBe(200);
  expect(destination).toEqual({left:60,top:102.5,width:1200,height:675});
  for(const progress of [0,.2,.5,.8,1]){
    const width=source.width+(destination.width-source.width)*progress;
    const height=source.height+(destination.height-source.height)*progress;
    expect(width/height).toBeCloseTo(1600/900,8);
  }
});
it('contains a portrait photo without stretching or cropping it',()=>{
  const rect=photoPaintRect({left:10,top:20,width:1000,height:800},900,1600,'contain');
  expect(rect).toEqual({left:285,top:20,width:450,height:800});
});
it('preserves the current inline object position in the starting crop',()=>{
  const left=photoPaintRect({left:10,top:20,width:300,height:200},1600,900,'cover',0,0);
  const right=photoPaintRect({left:10,top:20,width:300,height:200},1600,900,'cover',1,1);
  expect(left.left).toBe(10);
  expect(right.left+right.width).toBeCloseTo(310);
});
