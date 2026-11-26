import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { cameraPose, framingPoints, OVERVIEW_DIRECTION } from '../src/camera';
import { EXAMPLE_ROOM } from '../src/geometry';
describe('Tight accepted overview: targeted math/static checks, not browser validation', () => {
  it('preserves the exact accepted viewing direction, not an interior camera', () => {
    for (const aspect of [0.7, 1.196, 1.4, 1.8, 3]) {
      const p = cameraPose('analysis', aspect, EXAMPLE_ROOM);
      expect(
        p.position
          .clone()
          .sub(p.target)
          .normalize()
          .distanceTo(new Vector3(0.82, 0.64, 1.28).normalize()),
      ).toBeLessThan(1e-12);
      expect(p.fov).toBe(28);
    }
  });
  it('fits the shell/base and whole 0–1.8m canopy / 25–65% envelope into safe pixel bounds', () => {
    for (const [w, h, top, bottom] of [
      [984, 446, 54, 8],
      [612, 446, 54, 8],
      [790, 313, 54, 8],
      [388, 240, 8, 12],
      [720, 320, 54, 8],
    ]) {
      const aspect = w / h,
        p = cameraPose('analysis', aspect, EXAMPLE_ROOM, {
          width: w,
          height: h,
          topInsetPx: top,
          bottomInsetPx: bottom,
        }),
        c = new PerspectiveCamera(p.fov, aspect, 0.1, 500);
      c.position.copy(p.position);
      c.lookAt(p.target);
      c.updateMatrixWorld();
      for (const point of framingPoints(EXAMPLE_ROOM)) {
        const q = point.clone().project(c);
        expect(q.x).toBeGreaterThan(p.safeBounds.left);
        expect(q.x).toBeLessThan(p.safeBounds.right);
        expect(q.y).toBeGreaterThan(p.safeBounds.bottom);
        expect(q.y).toBeLessThan(p.safeBounds.top);
        expect(q.z).toBeGreaterThan(0);
        expect(q.z).toBeLessThan(1);
      }
    }
  });
  it('finite poses and exact direction at narrow/invalid aspect inputs', () => {
    for (const a of [0.1, 0.4, 0.7, 1, 2.5, 0, NaN, Infinity]) {
      const p = cameraPose('analysis', a, EXAMPLE_ROOM);
      expect(
        [...p.position.toArray(), ...p.target.toArray(), p.fov, p.maxDistance].every(
          Number.isFinite,
        ),
      ).toBe(true);
      expect(
        p.position.clone().sub(p.target).normalize().distanceTo(OVERVIEW_DIRECTION),
      ).toBeLessThan(1e-12);
    }
  });
  it('keeps living-space reference points in the frame without moving them', () => {
    for (const a of [0.7, 1.196, 1.8]) {
      const p = cameraPose('analysis', a, EXAMPLE_ROOM),
        c = new PerspectiveCamera(p.fov, a, 0.1, 500);
      c.position.copy(p.position);
      c.lookAt(p.target);
      c.updateMatrixWorld();
      for (const point of [
        [-1.91, 0.7, 0],
        [-0.05, 0.52, -0.1],
        [0, 1.5, -3],
      ]) {
        const q = new Vector3(...(point as [number, number, number])).project(c);
        expect(Math.abs(q.x)).toBeLessThan(1);
        expect(Math.abs(q.y)).toBeLessThan(1);
      }
    }
  });
  it('static resize guard respects user Orbit input and date tick never refits', () => {
    const text = readFileSync(new URL('../src/components/Scene.tsx', import.meta.url), 'utf8');
    const compact = text.replace(/\s+/g, '');
    expect(compact).toContain("controls.addEventListener('start',markManual)");
    expect(compact).toContain('if(!manualCamera)fitCamera()');
    const source = ts.createSourceFile(
      'Scene.tsx',
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let tickBody = '';
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'tick' && node.body)
        tickBody = node.body.getText(source);
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(tickBody).not.toBe('');
    expect(tickBody.replace(/\s+/g, '')).not.toContain('fitCamera()');
    expect(compact).toContain('reset.current=fitCamera');
  });
  it('retains only overview reset/fullscreen and no interior switch', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    expect(app.replace(/\s+/g, '')).toContain("constcameraView='analysis'asconst");
    expect(app).toContain('复位全景相机');
    expect(app).not.toContain('setCameraView');
    expect(app).not.toContain('室内观察');
  });
});
