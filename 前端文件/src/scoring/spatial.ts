import type {LinkTarget} from './report';
export interface SpatialOwner {key:string;target:LinkTarget}
export interface SpatialState {hover:SpatialOwner|null;focus:SpatialOwner|null}
export type SpatialAction={type:'hover'|'focus';key:string;target:LinkTarget}|{type:'leave'|'blur';key:string}|{type:'clear'};
export const EMPTY_SPATIAL:SpatialState={hover:null,focus:null};
/** Keyboard focus owns the annotation until blur; pointer/reflow cannot steal it. */
export function spatialReducer(state:SpatialState,action:SpatialAction):SpatialState {
 switch(action.type){
  case 'hover':return {...state,hover:{key:action.key,target:action.target}};
  case 'focus':return {...state,focus:{key:action.key,target:action.target}};
  case 'leave':return state.hover?.key===action.key?{...state,hover:null}:state;
  case 'blur':return state.focus?.key===action.key?{...state,focus:null}:state;
  case 'clear':return state.hover||state.focus?EMPTY_SPATIAL:state;
 }
}
export const spatialTarget=(state:SpatialState)=>state.focus?.target??state.hover?.target??null;
/** Mirrors mobile CSS equations; a minimum canvas no longer collides with vh-based controls. */
export function mobileWorkspaceLayout(height:number){
 const canvas=Math.min(340,Math.max(240,height*.47-100));
 const canvasTop=119,canvasBottom=canvasTop+canvas,scoreTop=canvasBottom+10;
 return {canvasTop,canvasHeight:canvas,canvasBottom,scoreTop,scoreBottom:scoreTop+54,tabsTop:scoreTop+64,panelTop:scoreTop+116};
}
