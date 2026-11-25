import {describe,it,expect} from 'vitest';
import {PerspectiveCamera,Vector3,MathUtils} from 'three';
import {readFileSync} from 'node:fs';
import {cameraPose} from '../src/camera';
describe('User-selected original overview only (not screenshot validation)',()=>{
 it('preserves the original full-room camera formula exactly',()=>{for(const aspect of [.7,1.196,1.4,1.8]){const p=cameraPose('analysis',aspect),v=35*Math.PI/360,d=3.85/Math.sin(Math.min(v,Math.atan(Math.tan(v)*aspect)));expect(p.fov).toBe(35);expect(p.position.distanceTo(new Vector3(.82,.64,1.28).normalize().multiplyScalar(d).add(new Vector3(0,1.05,0)))).toBeLessThan(1e-10)}});
 it('uses the accepted overview pitch rather than the rejected frontal camera',()=>{const p=cameraPose('analysis',1.2),pitch=MathUtils.radToDeg(Math.asin(p.position.clone().sub(p.target).normalize().y));expect(pitch).toBeGreaterThan(15);expect(pitch).toBeLessThan(30);expect(p.position.x).toBeGreaterThan(3)});
 it('keeps major furniture and window centres within the reference frame',()=>{for(const aspect of [.7,1.196,1.8]){const p=cameraPose('analysis',aspect),c=new PerspectiveCamera(p.fov,aspect,.1,100);c.position.copy(p.position);c.lookAt(p.target);c.updateMatrixWorld();for(const point of [[-1.91,.7,0],[-.05,.52,-.1],[0,1.5,-3]]){const q=new Vector3(...point as [number,number,number]).project(c);expect(Math.abs(q.x)).toBeLessThan(1);expect(Math.abs(q.y)).toBeLessThan(1);expect(q.z).toBeGreaterThan(0);expect(q.z).toBeLessThan(1)}}});
 it('retains the same spatial target at any aspect ratio',()=>{for(const a of [.7,1,2.5])expect(cameraPose('analysis',a).target.toArray()).toEqual([0,1.05,0])});
 it('provides finite poses for narrow or invalid sizes',()=>{for(const aspect of [.1,.4,.7,1,2.5,0,NaN,Infinity]){const p=cameraPose('analysis',aspect);expect([...p.position.toArray(),...p.target.toArray(),p.fov,p.maxDistance].every(Number.isFinite)).toBe(true)}});
 it('exposes only overview reset/fullscreen, not interior switching',()=>{const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');expect(app).toContain("const cameraView='analysis' as const");expect(app).toContain('复位全景相机');expect(app).not.toContain('setCameraView');expect(app).not.toContain('室内观察')});
});
