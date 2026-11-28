import { coat, finished, mapPart, metricUV, surfaceOf } from '../modeling/surfaceUV';
import { heatmapColor, dateHeatmapColor, showCurrentHeat } from '../heatmap';
import type { DateHeatmap, HeatMode } from '../dateHeatmap';
import type { SolarFrame } from '../annual';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Parameters, Season, Simulation } from '../model';
import { shadeGeometry, RENDER_FLOOR_Y } from '../geometry';
import type { RoomGeometry } from '../geometry';
import { solarNoon } from '../solar';
import { FINISH, VISUAL_CONSTRUCTION } from '../shading';
import { materialTextures } from '../materials';
import { fineInterior } from '../modeling/interior';
import { fineWindow } from '../modeling/window';
import { meshInventory } from '../modeling/construction';
import { cameraPose } from '../camera';
import type { CameraView } from '../camera';
import type { LinkTarget } from '../scoring/report';
import { LIGHTING, lightingBudget, kelvinColor } from '../lighting';
import { contactPipeline } from '../contactAO';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
interface Props {
  solarFrame?: SolarFrame;
  room: RoomGeometry | null;
  highlight: LinkTarget | null;
  cameraView: CameraView;
  parameters: Parameters;
  season: Season;
  heat: boolean;
  heatMode: HeatMode;
  dateHeat: DateHeatmap | null;
  result: Simulation | null;
  resetToken: number;
  resultCurrent: boolean;
  onReady: () => void;
}
let areaLightingReady = false;
type Live = Pick<
  Props,
  | 'parameters'
  | 'season'
  | 'heat'
  | 'heatMode'
  | 'dateHeat'
  | 'result'
  | 'resultCurrent'
  | 'highlight'
  | 'solarFrame'
>;
export default function Scene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    live = useRef<Live>(props),
    reset = useRef<() => void>(() => {}),
    ready = useRef(props.onReady),
    cameraView = useRef(props.cameraView);
  live.current = props;
  cameraView.current = props.cameraView;
  const [failure, setFailure] = useState('');
  useEffect(() => {
    reset.current();
  }, [props.resetToken, props.cameraView]);
  useEffect(() => {
    const contract = props.room;
    if (!contract) return;
    const room: RoomGeometry = contract;
    setFailure('');
    const W = room.width_m,
      D = room.depth_m,
      H = room.height_m,
      F = RENDER_FLOOR_Y,
      ww = room.window_width_m,
      facade = -D / 2;
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      const gl = renderer.getContext();
      if (!gl || (typeof gl.isContextLost === 'function' && gl.isContextLost())) {
        renderer.dispose();
        renderer.domElement.remove();
        throw new Error('webgl-unusable');
      }
    } catch {
      setFailure('当前浏览器无法启用 WebGL，参数与剖面仍可使用。请开启硬件加速后重试。');
      return;
    }
    const contextLost = (e: Event) => {
      e.preventDefault();
      setFailure('3D 渲染上下文已丢失，请刷新页面。参数与 SVG 剖面仍可使用。');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = LIGHTING.exposure;
    renderer.setClearColor(0xeeeae2, 0);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(9.3, 7.4, 10.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.05, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 3.8;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.minPolarAngle = 0.24;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    let applySection = () => {};
    let manualCamera = false;
    const markManual = () => {
      manualCamera = true;
      el.dataset.cameraMode = 'manual';
    };
    controls.addEventListener('start', markManual);
    const fitCamera = () => {
      const aspect = Math.max(el.clientWidth / Math.max(el.clientHeight, 1), 0.1),
        workspaceWidth = el.closest('.workspace')!.clientWidth,
        mobile = workspaceWidth <= 760,
        pose = cameraPose(cameraView.current, aspect, room, {
          width: el.clientWidth,
          height: el.clientHeight,
          topInsetPx: mobile ? 8 : 54,
          bottomInsetPx: mobile ? 12 : 8,
        });
      manualCamera = false;
      el.dataset.cameraMode = 'auto-fit';
      el.dataset.cameraFit = JSON.stringify({
        fov: pose.fov,
        aspect,
        safeBounds: pose.safeBounds,
        projectedBounds: pose.projectedBounds,
      });
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      camera.fov = pose.fov;
      camera.far = Math.max(100, pose.maxDistance + 20);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      controls.maxDistance = pose.maxDistance;
      controls.target.copy(pose.target);
      camera.position.copy(pose.position);
      controls.update();
      controls.enableDamping = damping;
      applySection();
      el.dataset.cameraView = cameraView.current;
      renderer.shadowMap.needsUpdate = true;
    };
    reset.current = fitCamera;
    const maps = materialTextures(renderer.capabilities.getMaxAnisotropy());
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(environment, 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = LIGHTING.environment;
    environment.dispose();
    pmrem.dispose();
    const plaster = finished('plaster'),
      trim = finished('trim'),
      oak = maps.floor(W, D),
      walnut = finished('walnut', 0xffffff, 'walnut-joinery', 'wood');
    const fabric = coat(
      new THREE.MeshPhysicalMaterial({
        color: '#f3eee3',
        roughness: 1,
        specularIntensity: 0.23,
        sheen: 0.16,
        sheenRoughness: 0.85,
        sheenColor: new THREE.Color('#e8dfca'),
      }),
      'linen',
      'original',
    );
    const dark = finished('rubber', '#4a4e49'),
      metal = finished('powder', '#a2a69c', 'coated-louvers', 'metres', { metalness: 0.12 });
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    function box(
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
      parent: THREE.Object3D = scene,
      radius = 0,
    ) {
      const g = radius
        ? new RoundedBoxGeometry(w, h, d, 5, radius)
        : new THREE.BoxGeometry(w, h, d);
      mapPart(g, m);
      geometries.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    function plasterBox(w: number, h: number, d: number, x: number, y: number, z: number) {
      const mesh = box(w, h, d, x, y, z, plaster);
      metricUV(mesh.geometry, mesh.position);
      return mesh;
    }
    function cylinder(
      rt: number,
      rb: number,
      h: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
      parent: THREE.Object3D = scene,
    ) {
      const g = new THREE.CylinderGeometry(rt, rb, h, 40);
      mapPart(g, m);
      geometries.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    const sun = new THREE.DirectionalLight('#fff8e9', 4.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 50;
    sun.shadow.normalBias = 0.006;
    sun.shadow.bias = -0.00008;
    sun.shadow.radius = 1.5;
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);
    scene.add(sun.target);
    // Aperture-origin diffuse light, then bounded first-bounce surfaces. No fake direct sun patches.
    if (!areaLightingReady) {
      RectAreaLightUniformsLib.init();
      areaLightingReady = true;
    }
    const windowLight = new THREE.RectAreaLight(kelvinColor(LIGHTING.skyKelvin), 1, ww, 1.6);
    windowLight.position.set(0, 1.5, -2.96);
    windowLight.lookAt(0, 1.5, 0);
    scene.add(windowLight);
    const floorBounce = new THREE.RectAreaLight('#f0dfc7', 0.2, 5.1, 5.6);
    floorBounce.position.set(0, 0.075, 0);
    floorBounce.up.set(0, 0, 1);
    floorBounce.lookAt(0, 3, 0);
    scene.add(floorBounce);
    const northBounce = new THREE.RectAreaLight('#f4f1e8', 0.2, 5.2, 2.7);
    northBounce.position.set(0, 1.5, 2.94);
    northBounce.lookAt(0, 1.5, 0);
    scene.add(northBounce);
    // Ideal engine geometry uses finished floor=0; the decorative floor finish is world F.
    box(W + 0.25, 0.22, D + 0.25, 0, -0.16, 0, finished('plinth', '#c1b9ab'));
    box(W, 0.09, D, 0, -0.005, 0, finished('walnut', '#e5d7c5', 'platform-edge', 'wood'));
    const floorGeo = new THREE.PlaneGeometry(W, D),
      floorUV = floorGeo.attributes.uv.clone();
    for (let i = 0; i < floorUV.count; i++)
      floorUV.setXY(i, floorUV.getX(i) * W, floorUV.getY(i) * D);
    floorGeo.setAttribute('uv1', floorUV);
    geometries.push(floorGeo);
    const floor = new THREE.Mesh(floorGeo, oak);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = F;
    floor.receiveShadow = true;
    scene.add(floor);
    const shadowOnly = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const roof = box(W + 0.16, 0.12, D, 0, H + F + 0.06, 0, shadowOnly);
    box(W + 0.16, H, 0.12, 0, H / 2 + F, D / 2 + 0.06, shadowOnly);
    const eastWall = box(0.12, H, D, W / 2 + 0.06, H / 2 + F, 0, shadowOnly);
    applySection = () => {
      roof.material = shadowOnly;
      eastWall.material = shadowOnly;
    };
    plasterBox(0.16, H, D, -W / 2 - 0.08, H / 2 + F, 0);
    box(0.04, 0.105, D, -W / 2 + 0.02, 0.0935, 0, trim, scene, 0.003);
    box(0.008, 0.008, D, -W / 2 + 0.044, 0.151, 0, dark);
    // Plaster/frame thickness is decorative, not an extra occluder in the ideal aperture model.
    const pier = (W - ww) / 2;
    for (const sign of [-1, 1]) {
      const x = sign * (ww / 2 + pier / 2);
      const visible = plasterBox(pier, H, 0.16, x, H / 2 + F, facade - 0.08);
      visible.castShadow = false;
      box(pier, H, 0.0001, x, H / 2 + F, facade - 0.00005, shadowOnly);
    }
    const upper = plasterBox(ww, 1, 0.16, 0, 2.8, facade - 0.08),
      lower = plasterBox(ww, 1, 0.16, 0, 0.2, facade - 0.08);
    upper.castShadow = lower.castShadow = false;
    const upperOptical = box(ww, 1, 0.0001, 0, 2.8, facade - 0.00005, shadowOnly),
      lowerOptical = box(ww, 1, 0.0001, 0, 0.2, facade - 0.00005, shadowOnly);
    const frame = new THREE.Group();
    scene.add(frame);
    const frameSides = [-ww / 2, ww / 2].map((x) =>
      box(0.055, 1, 0.1, x, 1.5, facade, shadowOnly, frame),
    );
    const frameTop = box(ww + 0.1, 0.055, 0.12, 0, 2.5, facade, shadowOnly, frame),
      frameBottom = box(ww + 0.1, 0.055, 0.14, 0, 0.5, facade, shadowOnly, frame);
    const mullions = [-ww / 6, ww / 6].map((x) =>
      box(0.035, 1, 0.07, x, 1.5, facade, shadowOnly, frame),
    );
    const glass = box(
      ww,
      1,
      0.012,
      0,
      1.5,
      facade - 0.02,
      new THREE.MeshPhysicalMaterial({
        color: '#d4dfdd',
        transparent: true,
        opacity: 0.085,
        roughness: 0.065,
        metalness: 0,
        ior: 1.5,
        specularIntensity: 0.75,
        depthWrite: false,
      }),
    );
    glass.receiveShadow = false;
    const sill = box(ww + 0.2, 0.065, 0.35, 0, 0.5, facade + 0.03, trim);
    [...frameSides, ...mullions, frameTop, frameBottom, glass, sill].forEach(
      (m) => (m.castShadow = false),
    );
    // Canopy underside is exactly at head, no setback, hidden at D=0.
    const overhang = box(W, 0.12, 1, 0, 2.7, facade, metal);
    const capacity = Math.ceil((H - room.sill_m) / room.slat_pitch_m);
    const louvers = Array.from({ length: capacity }, () => {
      const mesh = box(
        ww,
        VISUAL_CONSTRUCTION.bladeThickness_m,
        room.slat_chord_m,
        0,
        1.5,
        facade,
        metal,
        scene,
        0.0025,
      );
      mesh.castShadow = false;
      return mesh;
    });
    const louverOptics = Array.from({ length: capacity }, () => {
      const g = new THREE.PlaneGeometry(ww, room.slat_chord_m);
      geometries.push(g);
      const m = new THREE.Mesh(g, shadowOnly);
      m.castShadow = true;
      scene.add(m);
      return m;
    });
    const refined = fineInterior({ fabric, walnut, dark, metal });
    scene.add(refined);
    // Selection outline is an analysis annotation, not a light/emissive patch; it casts no shadows.
    const [near, far] = room.sofa_depth_range_m;
    const sofaBounds = new THREE.Box3(
      new THREE.Vector3(-room.sofa_width_m / 2, F + 0.012, near - D / 2),
      new THREE.Vector3(room.sofa_width_m / 2, F + 0.04, far - D / 2),
    );
    const sofaHint = new THREE.Box3Helper(sofaBounds, new THREE.Color('#6d9a8a'));
    const hintMaterial = sofaHint.material as THREE.LineBasicMaterial;
    hintMaterial.transparent = true;
    hintMaterial.opacity = 0.85;
    hintMaterial.depthWrite = false;
    hintMaterial.toneMapped = false;
    sofaHint.visible = false;
    sofaHint.renderOrder = 5;
    scene.add(sofaHint);
    geometries.push(sofaHint.geometry);
    materials.push(hintMaterial);
    const windowDetails = fineWindow(room);
    scene.add(windowDetails.group);
    // Low media cabinet on the cutaway east wall; TV faces the sofa.
    box(0.48, 0.34, 3.3, 2.31, 0.32, -0.2, walnut, scene, 0.018);
    for (let z = -1.5; z < 1.3; z += 0.73) box(0.016, 0.25, 0.012, 2.045, 0.35, z, dark);
    const cabinetBottom = 0.15,
      footH = cabinetBottom - F + 0.002;
    for (let z = -1.55; z < 1.3; z += 2.7)
      box(0.35, footH, 0.07, 2.3, F + footH / 2 - 0.001, z, dark);
    const tvRear = finished('rear', 0xffffff, 'matte-graphite-tv-rear', 'rear');
    box(0.038, 0.9, 1.65, 2.31, 0.965, -0.5, tvRear, scene, 0.012);
    const screen = box(
      0.008,
      0.81,
      1.54,
      2.286,
      0.972,
      -0.5,
      new THREE.MeshPhysicalMaterial({
        color: '#263332',
        roughness: 0.17,
        metalness: 0,
        clearcoat: 0.36,
        clearcoatRoughness: 0.13,
      }),
      scene,
      0.008,
    );
    screen.castShadow = false;
    box(0.23, 0.025, 0.4, 2.3, 0.5025, -0.5, dark);
    // Walnut side table, ceramic lamp and architectural artwork.
    cylinder(0.3, 0.3, 0.06, -1.98, 0.58, -2.35, walnut);
    cylinder(0.09, 0.13, 0.52, -1.98, 0.29, -2.35, walnut);
    cylinder(
      0.11,
      0.14,
      0.23,
      -1.98,
      0.72,
      -2.35,
      finished('clay', '#d3c7ac', 'lamp-stoneware', 'wrap'),
    );
    const shadeG = new THREE.ConeGeometry(0.26, 0.32, 48, 1, true);
    geometries.push(shadeG);
    const shadeMat = finished('lampCloth', 0xffffff, 'woven-lampshade', 'wrap', {
      side: THREE.DoubleSide,
    });
    mapPart(shadeG, shadeMat);
    const lamp = new THREE.Mesh(shadeG, shadeMat);
    lamp.position.set(-1.98, 1, -2.35);
    scene.add(lamp);
    box(0.055, 1.13, 0.91, -2.66, 1.9, 0.3, walnut);
    box(0.015, 0.99, 0.77, -2.62, 1.9, 0.3, finished('paper', '#faf1dd'));
    const art = box(
      0.02,
      0.58,
      0.32,
      -2.601,
      1.88,
      0.17,
      finished('paper', '#ae7756'),
      scene,
      0.12,
    );
    art.rotation.x = 0.18;
    box(0.025, 0.19, 0.4, -2.59, 1.56, 0.4, finished('paper', '#879584'));
    // Curtain stacks sit to the sides, not over the variable window.
    const curtain = finished('curtain', 0xffffff, 'curtain-linen', 'wrap');
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++)
        cylinder(0.045, 0.045, 2.65, side * (ww / 2 + 0.05 + i * 0.02), 1.51, -2.83, curtain);
    box(5.15, 0.045, 0.045, 0, 2.91, -2.81, dark);
    // Display base and north arrow are intentionally outside the room envelope.
    const ground = box(
      200,
      0.05,
      200,
      0,
      -0.33,
      0,
      new THREE.ShadowMaterial({ color: '#454844', opacity: 0.2 }),
    );
    ground.castShadow = false;
    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = heatCanvas.height = 384;
    const hc = heatCanvas.getContext('2d')!;
    const heatTex = new THREE.CanvasTexture(heatCanvas);
    heatTex.colorSpace = THREE.SRGBColorSpace;
    heatTex.flipY = true;
    const heatMat = new THREE.MeshBasicMaterial({
      map: heatTex,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const heatMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), heatMat);
    geometries.push(heatMesh.geometry);
    heatMesh.rotation.x = -Math.PI / 2;
    heatMesh.position.set(0, FINISH.rugTop_m + 0.005, 0);
    heatMesh.renderOrder = 1;
    scene.add(heatMesh);
    const dressed = new Set<THREE.MeshStandardMaterial>();
    const shadedFinishes = new Map<THREE.MeshStandardMaterial, number>();
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || dressed.has(material)) continue;
        const surface = surfaceOf(material);
        if (surface) {
          maps.apply(material, surface.finish);
          dressed.add(material);
          // The graphite back faces away from the opening. Keep its broad satin reflection
          // and the waxy leaf response in shade, sampled from the existing room environment.
          const response = surface.finish === 'rear' ? 4 : surface.finish === 'leaf' ? 2.4 : 1;
          if (response > 1) {
            material.envMap = env.texture;
            shadedFinishes.set(material, response);
          }
        }
      }
    });
    const inventory = meshInventory(scene);
    el.dataset.modelInventory = JSON.stringify(inventory);
    let post: ReturnType<typeof contactPipeline> | null = null;
    try {
      if (renderer.extensions.has('EXT_color_buffer_float'))
        post = contactPipeline(renderer, scene, camera);
    } catch {
      post = null;
    }
    el.dataset.contactAO = post ? 'geometry-depth-gtao' : 'unavailable';
    let mappedSill = -1,
      mappedHead = -1,
      mappedDepth = -1;
    let lastGrid: Simulation['heatmap_grid'] | undefined,
      lastKey = '',
      frameId = 0,
      visible = true,
      needsRender = true;
    controls.addEventListener('change', () => {
      needsRender = true;
    });
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      renderer.setSize(w, h, false);
      post?.resize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needsRender = true;
      if (!manualCamera) fitCamera();
    });
    observer.observe(el);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible && !frameId) {
        needsRender = true;
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    function tick() {
      if (!visible) {
        frameId = 0;
        return;
      }
      frameId = requestAnimationFrame(tick);
      const {
        parameters: p,
        season,
        heat,
        heatMode,
        dateHeat,
        result,
        resultCurrent,
        highlight,
        solarFrame,
      } = live.current;
      if (sofaHint.visible !== (highlight === 'sofa')) {
        sofaHint.visible = highlight === 'sofa';
        needsRender = true;
        el.dataset.analysisHighlight = highlight ?? 'none';
      }
      const key = JSON.stringify([
        p,
        season,
        solarFrame ?? (resultCurrent ? result?.solar_angles : null),
      ]);
      if (key !== lastKey) {
        lastKey = key;
        needsRender = true;
        renderer.shadowMap.needsUpdate = true;
        const geometry = shadeGeometry(p, room),
          win = geometry.window;
        [upper, upperOptical].forEach((m) => {
          m.scale.y = H - win.top;
          m.position.y = F + (H + win.top) / 2;
        });
        [lower, lowerOptical].forEach((m) => {
          m.scale.y = win.sill;
          m.position.y = F + win.sill / 2;
        });
        frameTop.position.y = F + win.top;
        frameBottom.position.y = F + win.sill;
        sill.position.y = F + win.sill - 0.04;
        [...frameSides, ...mullions, glass].forEach((m) => {
          m.scale.y = win.height;
          m.position.y = F + win.center;
        });
        overhang.visible = geometry.canopy.visible;
        overhang.scale.z = Math.max(0.000001, geometry.canopy.depth);
        overhang.position.set(0, F + win.top + 0.06, facade - geometry.canopy.depth / 2);
        if (win.sill !== mappedSill || win.top !== mappedHead) {
          for (const wall of [upper, lower]) metricUV(wall.geometry, wall.position, wall.scale);
          mappedSill = win.sill;
          mappedHead = win.top;
        }
        if (mappedDepth !== geometry.canopy.depth) {
          metricUV(overhang.geometry, overhang.position, overhang.scale);
          mappedDepth = geometry.canopy.depth;
        }
        louvers.forEach((m, i) => {
          const b = geometry.blades[i];
          m.visible = louverOptics[i].visible = !!b;
          if (!b) return;
          m.position.set(0, F + b.centerHeight, facade + b.centerDepth);
          m.rotation.x = -geometry.angle;
          const optical = louverOptics[i];
          optical.position.copy(m.position);
          optical.rotation.x = Math.PI / 2 - geometry.angle;
        });
        windowDetails.update(geometry);
        const solar =
          solarFrame ??
          solarNoon(p.latitude, season, resultCurrent ? result?.solar_angles : undefined);
        el.dataset.solarFrame = JSON.stringify(solarFrame ?? null);
        sun.position.set(solar.direction.x * 15, solar.direction.y * 15, solar.direction.z * 15);
        sun.target.position.set(0, 0, 0);
        const budget = lightingBudget(p, solarFrame ? 'annual' : season, solar.direction, room);
        scene.environmentIntensity = budget.environment;
        for (const [material, gain] of shadedFinishes)
          material.envMapIntensity = budget.environment * gain;
        sun.color.copy(budget.sunColor);
        sun.intensity = solarFrame && !solarFrame.aboveHorizon ? 0 : budget.sunIntensity;
        windowLight.height = win.height;
        windowLight.position.set(0, F + win.center, facade + 0.04);
        windowLight.lookAt(0, F + win.center, 0);
        windowLight.color.copy(kelvinColor(LIGHTING.skyKelvin));
        windowLight.intensity = budget.portal;
        floorBounce.intensity = budget.floorBounce;
        northBounce.intensity = budget.northBounce;
        renderer.toneMappingExposure = budget.exposure;
        el.dataset.lightingApproximation = JSON.stringify({
          skyVisibility: budget.skyFraction,
          environment: budget.environment,
          skyKelvin: LIGHTING.skyKelvin,
          portal: budget.portal,
          sunIntensity: sun.intensity,
          floorBounce: budget.floorBounce,
          northBounce: budget.northBounce,
          exposure: budget.exposure,
        });
      }
      const grid = heatMode === 'date' ? dateHeat?.grid : result?.heatmap_grid;
      const showHeat = showCurrentHeat(heat, !!grid, resultCurrent);
      if (heatMesh.visible !== showHeat) needsRender = true;
      heatMesh.visible = showHeat;
      el.dataset.heatmapMode = heatMode;
      el.dataset.heatmapDate = showHeat && heatMode === 'date' ? (dateHeat?.date ?? '') : '';
      if (showHeat && grid && grid !== lastGrid) {
        needsRender = true;
        lastGrid = grid;
        el.dataset.heatmapSummary = JSON.stringify(
          heatMode === 'date' && dateHeat
            ? {
                date: dateHeat.date,
                max: dateHeat.max,
                mean: dateHeat.mean,
                directArea: dateHeat.directAreaFraction,
                southIncident: dateHeat.southIncident,
              }
            : { mean: grid.flat().reduce((sum, n) => sum + n, 0) / (grid.length * grid[0].length) },
        );
        const small = document.createElement('canvas');
        small.width = grid[0].length;
        small.height = grid.length;
        const sc = small.getContext('2d')!;
        for (let z = 0; z < small.height; z++)
          for (let x = 0; x < small.width; x++) {
            const value = grid[z][x];
            sc.fillStyle = heatMode === 'date' ? dateHeatmapColor(value) : heatmapColor(value);
            sc.fillRect(x, z, 1, 1);
          }
        hc.clearRect(0, 0, 384, 384);
        hc.imageSmoothingEnabled = true;
        hc.filter = 'blur(6px)';
        hc.drawImage(small, 0, 0, 384, 384);
        heatTex.needsUpdate = true;
      }
      controls.update();
      if (needsRender) {
        if (post) post.render(showHeat);
        else renderer.render(scene, camera);
        needsRender = false;
      }
    }
    renderer.setSize(el.clientWidth, el.clientHeight, false);
    post?.resize(el.clientWidth, el.clientHeight);
    fitCamera();
    tick();
    ready.current();
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      controls.removeEventListener('start', markManual);
      controls.dispose();
      post?.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.push(o.geometry);
          if (o instanceof THREE.InstancedMesh) o.dispose();
          const m = Array.isArray(o.material) ? o.material : [o.material];
          materials.push(...m);
        }
      });
      materials.push(plaster, shadowOnly);
      new Set(materials).forEach((m) => m.dispose());
      new Set(geometries).forEach((g) => g.dispose());
      maps.dispose();
      env.dispose();
      heatTex.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.room]);
  return (
    <div ref={host} className="scene" aria-label="固定尺寸南向精装客厅三维模型">
      {(!props.room || failure) && (
        <div className="scene-error" role="alert">
          {failure || '几何契约未同步 · 暂停三维预览，接口指标仍可查看。'}
        </div>
      )}
    </div>
  );
}
