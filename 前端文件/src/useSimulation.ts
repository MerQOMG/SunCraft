import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import {networkErrorMessage} from './analysisCopy';
import type { TransportConfig } from './api';
import type { Parameters, Simulation } from './model';
export function useSimulation(parameters:Parameters,config:TransportConfig,paused:boolean,retry:number){
 const [snapshot,setSnapshot]=useState<{data:Simulation;parameters:Parameters;source:string}|null>(null);const [pending,setPending]=useState(true);const [error,setError]=useState('');const sequence=useRef(0),lastStart=useRef(-Infinity);
 const source=JSON.stringify(config);
 useEffect(()=>{const id=++sequence.current;const ctrl=new AbortController();setError('');setPending(true);if(paused)return()=>ctrl.abort();
 const timer=setTimeout(()=>{lastStart.current=performance.now();api.simulate(parameters,config,ctrl.signal).then(data=>{if(id===sequence.current&&!ctrl.signal.aborted){setSnapshot({data,parameters,source});setPending(false)}}).catch(err=>{if(!ctrl.signal.aborted&&id===sequence.current){setError(networkErrorMessage(err));setPending(false)}})},Math.max(0,80-(performance.now()-lastStart.current)));
 return()=>{clearTimeout(timer);ctrl.abort()}
 },[parameters,config,paused,retry,source]);
 const current=snapshot?.source===source?snapshot:null;
 // Guard during the render before effects have had a chance to run.
 const stale=!!current&&(current.parameters!==parameters||paused);
 return {result:current?.data??null,pending:pending||stale,stale,error,snapshot:current};
}
