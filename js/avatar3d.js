import { PRESET_SHAPES, calloutValueKey, selectionHighlights } from './config.js';
import { t } from './i18n.js';
import { selectMeasurement, state, subscribe } from './state.js';
import { $, formatMeasurement, prefersReducedMotion } from './utils.js';

const ANNOS = [
  { key: 'shoulder', region: 'shoulder' },
  { key: 'chest', region: 'chest' },
  { key: 'waist', region: 'waist' },
  { key: 'hip', region: 'hip' },
  { key: 'sleeve', region: 'arm' },
  { key: 'inseam', region: 'leg' },
];

export async function initAvatar() {
  const canvas = $('#avatarCanvas');
  const fallback = $('#viewerFallback');
  const test = document.createElement('canvas');
  const gl = test.getContext('webgl2') || test.getContext('webgl');
  if (!gl) {
    showFallback(t('viz.fallback'));
    return;
  }
  let THREE;
  let OrbitControls;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  } catch (error) {
    console.error('3D library failed', error?.message || 'error');
    showFallback(t('viz.fallback'));
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    console.error('WebGL renderer failed', error?.message || 'error');
    showFallback(t('viz.fallback'));
    return;
  }
  if (!renderer.getContext()) {
    showFallback(t('viz.fallback'));
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  camera.position.set(0.15, 1.05, 3.2);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !prefersReducedMotion();
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 5.2;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 1.65;
  controls.target.set(0, 0.95, 0);
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  scene.add(new THREE.HemisphereLight(0xf4fffb, 0xb7c9c2, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.65);
  key.position.set(2.4, 4.2, 3.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd9fff4, 0.55);
  fill.position.set(-3.2, 2.2, -1.4);
  scene.add(fill);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0xd5e2dc, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1c3330, transparent: true, opacity: 0.12, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 40), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  scene.add(shadow);

  const layer = $('#annoLayer');
  const buttons = {};
  for (const item of ANNOS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'anno';
    btn.dataset.key = item.key;
    const name = document.createElement('span');
    name.className = 'anno-name';
    const value = document.createElement('strong');
    btn.append(name, value);
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      selectMeasurement(item.key, 'avatar');
    });
    layer.append(btn);
    buttons[item.key] = btn;
  }

  let body = null;
  let pickers = [];
  let rings = [];
  let guides = [];
  let anchors = {};
  let heightLine = null;
  let builtPreset = '';
  let targetPreset = '';
  let shapeAnim = null;
  let currentShape = { chest: 1, waist: 1, hip: 1, shoulder: 1, limb: 1 };
  let shaped = [];
  let torsoMesh = null;
  let pulse = null;
  let pulsedKey = state.selectedKey;
  const disposables = { geometries: [], materials: [] };

  function clearBody() {
    shapeAnim = null;
    if (!body) return;
    scene.remove(body);
    for (const geometry of disposables.geometries) geometry.dispose();
    for (const material of disposables.materials) material.dispose();
    disposables.geometries = [];
    disposables.materials = [];
    body = null;
    pickers = [];
    rings = [];
    guides = [];
    anchors = {};
    heightLine = null;
    shaped = [];
    torsoMesh = null;
  }

  function shapeOf(preset) {
    const shape = PRESET_SHAPES[preset] || PRESET_SHAPES.regular;
    return {
      chest: shape.chest,
      waist: shape.waist,
      hip: shape.hip,
      shoulder: shape.shoulder,
      limb: shape.limb,
    };
  }

  function lerpShape(from, to, k) {
    return {
      chest: from.chest + (to.chest - from.chest) * k,
      waist: from.waist + (to.waist - from.waist) * k,
      hip: from.hip + (to.hip - from.hip) * k,
      shoulder: from.shoulder + (to.shoulder - from.shoulder) * k,
      limb: from.limb + (to.limb - from.limb) * k,
    };
  }

  function writeTorso(shape) {
    if (!torsoMesh) return;
    const next = new THREE.LatheGeometry([
      new THREE.Vector2(0.105 * shape.hip, 0),
      new THREE.Vector2(0.15 * shape.hip, 0.1),
      new THREE.Vector2(0.12 * shape.waist, 0.28),
      new THREE.Vector2(0.158 * shape.chest, 0.5),
      new THREE.Vector2(0.125 * shape.chest, 0.6),
      new THREE.Vector2(0.07, 0.7),
    ], 28);
    const dest = torsoMesh.geometry.attributes.position;
    const src = next.attributes.position.array;
    if (src.length === dest.array.length) {
      dest.array.set(src);
      dest.needsUpdate = true;
      torsoMesh.geometry.computeVertexNormals();
      torsoMesh.geometry.computeBoundingSphere();
    }
    next.dispose();
  }

  function applyShape(shape) {
    currentShape = shape;
    for (const part of shaped) {
      const mesh = part.mesh;
      if (part.kind === 'leg') {
        mesh.scale.set(shape.limb, 1, shape.limb);
        mesh.position.x = part.side * 0.095 * shape.hip;
      } else if (part.kind === 'pelvis') {
        mesh.scale.set(1.2 * shape.hip, 0.78 * shape.hip, 0.9 * shape.hip);
      } else if (part.kind === 'shoulderBar') {
        mesh.scale.set(1, shape.shoulder, 1);
      } else if (part.kind === 'arm') {
        mesh.scale.set(shape.limb, 1, shape.limb);
        mesh.position.x = part.side * 0.22 * shape.shoulder;
      } else if (part.kind === 'ring') {
        mesh.scale.setScalar(shape[part.factor]);
        part.pick.scale.setScalar(shape[part.factor]);
      } else if (part.kind === 'sleeve') {
        const x = 0.22 * shape.shoulder + 0.08;
        mesh.position.x = x;
        part.pick.position.x = x;
      }
    }
    writeTorso(shape);
  }

  function startShape(preset) {
    targetPreset = preset;
    const to = shapeOf(preset);
    if (prefersReducedMotion()) {
      applyShape(to);
      builtPreset = preset;
      shapeAnim = null;
      return;
    }
    shapeAnim = {
      from: { ...currentShape },
      to,
      start: performance.now(),
      dur: 420,
      preset,
    };
    poke(36);
  }

  function selectionBoost() {
    if (!pulse) return 1;
    const k = (performance.now() - pulse.start) / pulse.dur;
    if (k >= 1) return 1;
    return 1 + Math.sin(k * Math.PI) * 0.85;
  }

  function paintMarkers(boost) {
    for (const mesh of [...rings, ...guides]) {
      const on = selectionHighlights(state.selectedKey, mesh.userData.key);
      mesh.material.color.set(on ? 0x0b6b5c : 0x8aa399);
      mesh.material.emissive.set(on ? 0x0b6b5c : 0x000000);
      mesh.material.emissiveIntensity = on ? 0.5 * boost : 0;
    }
  }

  function track(geometry, material) {
    disposables.geometries.push(geometry);
    if (material && !disposables.materials.includes(material)) disposables.materials.push(material);
  }

  function build(preset) {
    clearBody();
    const group = new THREE.Group();
    group.frustumCulled = false;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd7e4de, roughness: 0.64, metalness: 0.04 });
    disposables.materials.push(bodyMat);
    const add = (geometry, x, y, z, rotation) => {
      track(geometry);
      const mesh = new THREE.Mesh(geometry, bodyMat);
      mesh.position.set(x, y, z);
      if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      group.add(mesh);
      return mesh;
    };
    const leftLeg = add(new THREE.CapsuleGeometry(0.058, 0.62, 6, 16), -0.095, 0.4, 0);
    const rightLeg = add(new THREE.CapsuleGeometry(0.058, 0.62, 6, 16), 0.095, 0.4, 0);
    shaped.push({ kind: 'leg', side: -1, mesh: leftLeg }, { kind: 'leg', side: 1, mesh: rightLeg });
    const pelvis = add(new THREE.SphereGeometry(0.125, 24, 16), 0, 0.76, 0);
    shaped.push({ kind: 'pelvis', mesh: pelvis });
    const torso = new THREE.LatheGeometry([
      new THREE.Vector2(0.105, 0),
      new THREE.Vector2(0.15, 0.1),
      new THREE.Vector2(0.12, 0.28),
      new THREE.Vector2(0.158, 0.5),
      new THREE.Vector2(0.125, 0.6),
      new THREE.Vector2(0.07, 0.7),
    ], 28);
    torsoMesh = add(torso, 0, 0.78, 0);
    torsoMesh.frustumCulled = false;
    const shoulderBar = add(new THREE.CapsuleGeometry(0.055, 0.28, 4, 12), 0, 1.48, 0, [0, 0, Math.PI / 2]);
    shaped.push({ kind: 'shoulderBar', mesh: shoulderBar });
    const leftArm = add(new THREE.CapsuleGeometry(0.046, 0.52, 6, 16), -0.22, 1.12, 0, [0, 0, -0.18]);
    const rightArm = add(new THREE.CapsuleGeometry(0.046, 0.52, 6, 16), 0.22, 1.12, 0, [0, 0, 0.18]);
    shaped.push({ kind: 'arm', side: -1, mesh: leftArm }, { kind: 'arm', side: 1, mesh: rightArm });
    add(new THREE.CylinderGeometry(0.046, 0.054, 0.11, 18), 0, 1.58, 0);
    const head = add(new THREE.SphereGeometry(0.105, 28, 18), 0, 1.72, 0);
    head.scale.set(0.96, 1.15, 1);

    const addRing = (x, y, z, radius, factor, region, key, rotation) => {
      const geo = new THREE.TorusGeometry(radius, 0.008, 10, 40);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8aa399, emissive: 0x000000, roughness: 0.4, metalness: 0.12 });
      track(geo, mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      mesh.userData = { key, region };
      group.add(mesh);
      rings.push(mesh);
      const pickGeo = new THREE.TorusGeometry(radius, 0.04, 6, 20);
      const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      track(pickGeo, pickMat);
      const pick = new THREE.Mesh(pickGeo, pickMat);
      pick.position.copy(mesh.position);
      pick.rotation.copy(mesh.rotation);
      pick.userData = { key, region };
      group.add(pick);
      pickers.push(pick);
      shaped.push({ kind: 'ring', factor, mesh, pick });
    };
    const flat = [Math.PI / 2, 0, 0];
    addRing(0, 1.48, 0, 0.22, 'shoulder', 'shoulder', 'shoulder', flat);
    addRing(0, 1.3, 0, 0.205, 'chest', 'chest', 'chest', flat);
    addRing(0, 1.08, 0, 0.16, 'waist', 'waist', 'waist', flat);
    addRing(0, 0.86, 0, 0.19, 'hip', 'hip', 'hip', flat);
    const addGuide = (x, y, z, length, region, key, rotation) => {
      const geo = new THREE.CylinderGeometry(0.005, 0.005, length, 8);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8aa399, emissive: 0x000000, roughness: 0.4, metalness: 0.12 });
      track(geo, mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      mesh.userData = { key, region };
      group.add(mesh);
      guides.push(mesh);
      const pickGeo = new THREE.CylinderGeometry(0.03, 0.03, length, 8);
      const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      track(pickGeo, pickMat);
      const pick = new THREE.Mesh(pickGeo, pickMat);
      pick.position.copy(mesh.position);
      pick.rotation.copy(mesh.rotation);
      pick.userData = { key, region };
      group.add(pick);
      pickers.push(pick);
      return { mesh, pick };
    };
    const sleeve = addGuide(0.3, 1.16, 0.07, 0.58, 'arm', 'sleeve', [0, 0, 0.18]);
    shaped.push({ kind: 'sleeve', mesh: sleeve.mesh, pick: sleeve.pick });
    addGuide(0.04, 0.4, 0.08, 0.74, 'leg', 'inseam');

    const lineGeo = new THREE.CylinderGeometry(0.004, 0.004, 1.74, 8);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x0b6b5c });
    track(lineGeo, lineMat);
    heightLine = new THREE.Mesh(lineGeo, lineMat);
    heightLine.position.set(0.48, 0.87, 0);
    heightLine.visible = false;
    group.add(heightLine);

    const anchor = (name, x, y, z) => {
      const obj = new THREE.Object3D();
      obj.position.set(x, y, z);
      group.add(obj);
      anchors[name] = obj;
    };
    anchor('shoulder', 0.42, 1.48, 0);
    anchor('chest', 0.46, 1.3, 0);
    anchor('waist', 0.42, 1.08, 0);
    anchor('hip', 0.46, 0.86, 0);
    anchor('sleeve', 0.58, 1.18, 0);
    anchor('inseam', 0.42, 0.5, 0);

    applyShape(shapeOf(preset));
    group.scale.setScalar(state.profile.heightCm / 170);
    scene.add(group);
    body = group;
    builtPreset = preset;
    targetPreset = preset;
  }

  function applyHighlight() {
    if (pulsedKey !== state.selectedKey) {
      pulsedKey = state.selectedKey;
      if (prefersReducedMotion()) pulse = null;
      else {
        pulse = { start: performance.now(), dur: 420 };
        poke(30);
      }
    }
    paintMarkers(selectionBoost());
    if (heightLine) heightLine.visible = state.selectedKey === 'height';
    for (const item of ANNOS) {
      const btn = buttons[item.key];
      const on = selectionHighlights(state.selectedKey, item.key);
      const displayKey = calloutValueKey(state.selectedKey, item.key);
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', String(on));
      const measure = state.measurements.find((entry) => entry.key === displayKey);
      btn.querySelector('.anno-name').textContent = displayKey === item.key ? t(`region.${item.region}`) : t(`measure.${displayKey}`);
      btn.querySelector('strong').textContent = measure ? formatMeasurement(measure.valueCm, state.profile.units) : '—';
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragThreshold = 6;
  let pressPoint = null;
  canvas.addEventListener('pointerdown', (event) => {
    pressPoint = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('click', (event) => {
    if (pressPoint) {
      const moved = Math.hypot(event.clientX - pressPoint.x, event.clientY - pressPoint.y);
      pressPoint = null;
      if (moved > dragThreshold) return;
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickers, false)[0];
    if (hit?.object.userData.key) selectMeasurement(hit.object.userData.key, 'avatar');
  });

  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  function placeLabels() {
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (!width || !height) return;
    camera.getWorldDirection(dir);
    for (const item of ANNOS) {
      const anchor = anchors[item.key];
      const btn = buttons[item.key];
      if (!anchor) continue;
      anchor.getWorldPosition(tmp);
      const toPoint = tmp.clone().sub(camera.position);
      if (toPoint.dot(dir) <= 0.05) {
        btn.hidden = true;
        continue;
      }
      const projected = tmp.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      btn.hidden = x < 8 || y < 8 || x > width - 8 || y > height - 8;
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
    }
  }

  function resize() {
    const host = $('#viewer3d');
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  let loopOn = false;
  let extra = 0;
  let interacting = false;
  let anim = null;
  function renderOnce() {
    resize();
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
  }
  function tick() {
    if (anim) {
      const k = anim.dur === 0 ? 1 : Math.min(1, (performance.now() - anim.start) / anim.dur);
      const eased = k * k * (3 - 2 * k);
      camera.position.lerpVectors(anim.from, anim.to, eased);
      controls.target.set(0, 0.95, 0);
      if (k >= 1) anim = null;
    }
    if (shapeAnim) {
      const k = Math.min(1, (performance.now() - shapeAnim.start) / shapeAnim.dur);
      const eased = k * k * (3 - 2 * k);
      applyShape(lerpShape(shapeAnim.from, shapeAnim.to, eased));
      if (k >= 1) {
        builtPreset = shapeAnim.preset;
        shapeAnim = null;
      }
    }
    if (pulse) {
      paintMarkers(selectionBoost());
      if (performance.now() - pulse.start >= pulse.dur) {
        pulse = null;
        paintMarkers(1);
      }
    }
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
    extra -= 1;
    if (!interacting && !anim && !shapeAnim && !pulse && extra <= 0) {
      renderer.setAnimationLoop(null);
      loopOn = false;
    }
  }
  function poke(frames = 40) {
    extra = Math.max(extra, frames);
    if (!loopOn) {
      loopOn = true;
      renderer.setAnimationLoop(tick);
    }
  }
  function flyTo(dest) {
    anim = {
      from: camera.position.clone(),
      to: dest.clone(),
      start: performance.now(),
      dur: prefersReducedMotion() ? 0 : 680,
    };
    poke(80);
  }
  function nudge(dTheta, dPhi) {
    const offset = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.theta += dTheta;
    sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi, 0.4, Math.PI / 1.65);
    offset.setFromSpherical(sph);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    poke();
  }
  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
    poke();
  }

  controls.addEventListener('start', () => {
    interacting = true;
    anim = null;
    poke(90);
  });
  controls.addEventListener('end', () => {
    interacting = false;
    poke(70);
  });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(0.14, 0); }
    if (event.key === 'ArrowRight') { event.preventDefault(); nudge(-0.14, 0); }
    if (event.key === 'ArrowUp') { event.preventDefault(); nudge(0, -0.08); }
    if (event.key === 'ArrowDown') { event.preventDefault(); nudge(0, 0.08); }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(0.9); }
    if (event.key === '-' || event.key === '_') { event.preventDefault(); zoom(1.1); }
  });
  function onContextLost(event) {
    event.preventDefault();
    showFallback(t('viz.contextLost'));
    renderer.setAnimationLoop(null);
    loopOn = false;
  }
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', () => {
    showFallback(t('viz.contextLost'));
  });

  const baseTarget = new THREE.Vector3(0, 0.95, 0);
  const baseViews = {
    front: new THREE.Vector3(0.15, 1.05, 3.2),
    back: new THREE.Vector3(0.15, 1.05, -3.2),
    left: new THREE.Vector3(-3.2, 1.05, 0.15),
    right: new THREE.Vector3(3.2, 1.05, 0.15),
  };
  let framedFactor = 1;
  function heightFactor() {
    return state.profile.heightCm / 170;
  }
  function scaledView(base) {
    return base.clone().sub(baseTarget).multiplyScalar(heightFactor()).add(controls.target);
  }
  function applyHeightFrame() {
    const factor = heightFactor();
    shadow.scale.setScalar(factor);
    controls.minDistance = 1.5 * factor;
    controls.maxDistance = 5.2 * factor;
    const nextTarget = new THREE.Vector3(0, 0.95 * factor, 0);
    if (Math.abs(factor - framedFactor) < 0.0001) {
      controls.target.copy(nextTarget);
      controls.update();
      return;
    }
    const previousTarget = new THREE.Vector3(0, 0.95 * framedFactor, 0);
    const offset = camera.position.clone().sub(previousTarget);
    offset.multiplyScalar(factor / framedFactor);
    offset.setLength(THREE.MathUtils.clamp(offset.length(), controls.minDistance, controls.maxDistance));
    controls.target.copy(nextTarget);
    camera.position.copy(controls.target).add(offset);
    framedFactor = factor;
    controls.update();
  }
  $('#camFront').addEventListener('click', () => flyTo(scaledView(baseViews.front)));
  $('#camBack').addEventListener('click', () => flyTo(scaledView(baseViews.back)));
  $('#camLeft').addEventListener('click', () => flyTo(scaledView(baseViews.left)));
  $('#camRight').addEventListener('click', () => flyTo(scaledView(baseViews.right)));
  $('#camReset').addEventListener('click', () => flyTo(scaledView(baseViews.front)));
  $('#zoomIn').addEventListener('click', () => zoom(0.88));
  $('#zoomOut').addEventListener('click', () => zoom(1.12));

  const host = $('#viewer3d');
  const resizeObserver = new ResizeObserver(() => { resize(); renderOnce(); });
  resizeObserver.observe(host);
  const visibility = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) poke(20);
    else {
      renderer.setAnimationLoop(null);
      loopOn = false;
    }
  }, { threshold: 0.05 });
  visibility.observe(host);

  function syncTheme() {
    const dark = state.theme === 'dark';
    floorMat.color.set(dark ? 0x1a2c28 : 0xd5e2dc);
    shadowMat.opacity = dark ? 0.35 : 0.12;
  }
  function sync() {
    if (!body) build(state.profile.preset);
    else if (targetPreset !== state.profile.preset) startShape(state.profile.preset);
    if (body) body.scale.setScalar(state.profile.heightCm / 170);
    applyHeightFrame();
    syncTheme();
    applyHighlight();
    renderOnce();
  }
  subscribe(sync);
  build(state.profile.preset);
  syncTheme();
  applyHighlight();
  resize();
  renderOnce();
  fallback.hidden = true;
  canvas.hidden = false;

  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    clearBody();
    floor.geometry.dispose();
    floorMat.dispose();
    shadow.geometry.dispose();
    shadowMat.dispose();
    renderer.dispose();
  });
}

function showFallback(message) {
  const canvas = $('#avatarCanvas');
  const fallback = $('#viewerFallback');
  const controls = $('#viewerControls');
  if (canvas) canvas.hidden = true;
  if (controls) controls.hidden = true;
  $('#annoLayer')?.replaceChildren();
  if (!fallback) return;
  fallback.hidden = false;
  fallback.textContent = message;
}
