import {
  Mesh,
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  WebGLRenderTarget,
  HalfFloatType,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LIGHTING } from './lighting.ts';
export function aoSize(w: number, h: number) {
  const scale = Math.min(1, LIGHTING.aoMaxDimension / Math.max(w, h, 1));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}
export function contributesToAO(mesh: Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((m) => m.colorWrite && !m.transparent);
}
/** Actual normal/depth-based small-radius AO. Not a vignette, shadow map or physics result. */
export class RoomContactAO extends GTAOPass {
  constructor(scene: Scene, camera: PerspectiveCamera) {
    super(scene, camera, 1, 1);
    this.blendIntensity = LIGHTING.aoIntensity;
    this.updateGtaoMaterial({
      radius: LIGHTING.aoRadius_m,
      thickness: 0.06,
      distanceExponent: 1,
      distanceFallOff: 1,
      scale: 1,
      samples: 12,
      screenSpaceRadius: false,
    });
    this.updatePdMaterial({ samples: 8, radius: 5, rings: 2, normalPhi: 8, depthPhi: 3 });
  }
  override setSize(w: number, h: number) {
    const size = aoSize(w, h);
    super.setSize(size.width, size.height);
  }
  override render(
    renderer: WebGLRenderer,
    write: WebGLRenderTarget,
    read: WebGLRenderTarget,
    delta = 0,
    mask = false,
  ) {
    // A normal override would otherwise turn invisible cutaway/shadow proxies into opaque walls.
    // Only this G-buffer pass excludes them; the preceding beauty pass still renders solar shadows.
    const excluded: Mesh[] = [],
      previous = this.scene.overrideMaterial;
    this.scene.traverse((o) => {
      if (o instanceof Mesh && o.visible && !contributesToAO(o)) {
        excluded.push(o);
        o.visible = false;
      }
    });
    try {
      super.render(renderer, write, read, delta, mask);
    } finally {
      excluded.forEach((o) => (o.visible = true));
      this.scene.overrideMaterial = previous;
    }
  }
  override dispose() {
    super.dispose();
    this.gtaoMaterial.dispose();
    this.blendMaterial.dispose();
    this.depthTexture.dispose();
  }
}
export function contactPipeline(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
  const target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      samples: Math.min(2, renderer.capabilities.maxSamples),
    }),
    composer = new EffectComposer(renderer, target),
    beauty = new RenderPass(scene, camera),
    ao = new RoomContactAO(scene, camera),
    output = new OutputPass();
  composer.addPass(beauty);
  composer.addPass(ao);
  composer.addPass(output);
  return {
    resize: (w: number, h: number) => composer.setSize(w, h),
    render: (heat: boolean) => {
      ao.enabled = !heat;
      composer.render();
    },
    dispose: () => {
      ao.dispose();
      output.dispose();
      beauty.dispose();
      composer.dispose();
    },
  };
}
