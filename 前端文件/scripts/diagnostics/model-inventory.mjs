// Pure geometry inventory. No browser, WebGL renderer, screenshot or GPU timing.
import * as T from 'three';
import {fineInterior} from '../../src/modeling/interior.ts';
import {fineWindow} from '../../src/modeling/window.ts';
import {meshInventory} from '../../src/modeling/construction.ts';
import {windowGeometry} from '../../src/model.ts';
const fabric=new T.MeshPhysicalMaterial({color:'#cfc8bb',roughness:.95}),walnut=new T.MeshStandardMaterial({color:'#80664b'}),dark=new T.MeshStandardMaterial({color:'#343735'}),metal=new T.MeshStandardMaterial({color:'#79807b'});
const start=performance.now();const interior=fineInterior({fabric,walnut,dark,metal}),window=fineWindow();window.update(windowGeometry(.45),0);const root=new T.Group();root.add(interior,window.group);
const components={};for(const child of interior.children)components[child.name+'-'+Object.keys(components).length]=meshInventory(child);components.window=meshInventory(window.group);
console.log(JSON.stringify({scope:'Only new fine interior assets + window detailing; NOT full scene or measured draw calls/fps',components,total:meshInventory(root),geometryBuildMs:Number((performance.now()-start).toFixed(2))},null,2));
