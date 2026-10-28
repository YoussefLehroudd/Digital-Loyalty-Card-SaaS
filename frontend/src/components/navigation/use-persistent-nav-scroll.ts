"use client";
import {useCallback,useEffect,useLayoutEffect,useRef} from "react";

type Direction="x"|"y";
const lastOffsets=new Map<string,number>();
const keyFor=(id:string,axis:Direction)=>`loyvance:nav:${axis}:${id}`;
function readOffset(id:string,axis:Direction){
  const key=keyFor(id,axis);
  if(lastOffsets.has(key))return lastOffsets.get(key)!;
  try{
    const value=Number(window.sessionStorage.getItem(key));
    return Number.isFinite(value)?value:0;
  }catch{return 0;}
}
function writeOffset(id:string,axis:Direction,offset:number){
  const key=keyFor(id,axis);
  lastOffsets.set(key,offset);
  try{window.sessionStorage.setItem(key,String(offset));}catch{/* Optional storage. */}
}
/**
 * Restore scroll on navigation and refresh, even when the per-page dashboard
 * sidebar remounts. Keep the current offset in memory during swipes/wheel moves
 * and persist once scrolling settles. Never auto-jump to the selected link.
 */
export function usePersistentNavScroll(id:string,route:string,axis:Direction="y"){
  const ref=useRef<HTMLElement|null>(null);
  const timeoutRef=useRef<number|null>(null);
  const saveNow=useCallback(()=>{
    const node=ref.current;
    if(!node||!id)return;
    if(timeoutRef.current!==null){window.clearTimeout(timeoutRef.current);timeoutRef.current=null;}
    const offset=axis==="x"?node.scrollLeft:node.scrollTop;
    writeOffset(id,axis,offset);
  },[id,axis]);
  const onScroll=useCallback(()=>{
    const node=ref.current;
    if(!node||!id)return;
    lastOffsets.set(keyFor(id,axis),axis==="x"?node.scrollLeft:node.scrollTop);
    if(timeoutRef.current!==null)window.clearTimeout(timeoutRef.current);
    timeoutRef.current=window.setTimeout(()=>{saveNow();},160);
  },[id,axis,saveNow]);
  useLayoutEffect(()=>{
    const node=ref.current;
    if(!node||!id)return;
    const offset=readOffset(id,axis);
    if(axis==="x")node.scrollLeft=offset;
    else node.scrollTop=offset;
  },[id,route,axis]);
  useEffect(()=>()=>{
    if(timeoutRef.current!==null)window.clearTimeout(timeoutRef.current);
    // When route replacement unmounts the sidebar, retain the latest position.
    const node=ref.current;
    if(node&&id)writeOffset(id,axis,axis==="x"?node.scrollLeft:node.scrollTop);
  },[id,axis]);
  return {ref,onScroll,onClickCapture:saveNow};
}
