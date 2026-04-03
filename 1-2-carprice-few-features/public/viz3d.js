/**
 * 3D-визуализация: оси X — пробег, Y — цена, Z — объём двигателя.
 * Плоскость ŷ = w₁·x + w₂·v + b как четырёхугольник в (x, v).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const ACCENT = 0x3dd6c6;
const PLANE = 0xf4a261;
const GRID = 0x5a6d82;

let rootEl;
let scene;
let camera;
let renderer;
let controls;
let rafId = 0;
let pointsObj = null;
let planeMesh = null;
let gridHelper = null;
let axesGroup = null;

function predY(x, v, w1, w2, b) {
  return w1 * x + w2 * v + b;
}

function computeBounds(points, w1, w2, b) {
  let xMin = 0;
  let xMax = 35;
  let vMin = 0.8;
  let vMax = 3.5;
  let yMin = 0;
  let yMax = 4.5;

  if (points.length) {
    xMin = xMax = points[0].x;
    vMin = vMax = points[0].v;
    yMin = yMax = points[0].y;
    for (const p of points) {
      xMin = Math.min(xMin, p.x);
      xMax = Math.max(xMax, p.x);
      vMin = Math.min(vMin, p.v);
      vMax = Math.max(vMax, p.v);
      yMin = Math.min(yMin, p.y);
      yMax = Math.max(yMax, p.y);
    }
  }

  const padX = Math.max(0.5, (xMax - xMin) * 0.08);
  const padV = Math.max(0.08, (vMax - vMin) * 0.12);
  const padY = Math.max(0.1, (yMax - yMin) * 0.1);
  xMin -= padX;
  xMax += padX;
  vMin -= padV;
  vMax += padV;
  yMin -= padY;
  yMax += padY;

  const corners = [
    predY(xMin, vMin, w1, w2, b),
    predY(xMax, vMin, w1, w2, b),
    predY(xMax, vMax, w1, w2, b),
    predY(xMin, vMax, w1, w2, b),
  ];
  for (const cy of corners) {
    yMin = Math.min(yMin, cy);
    yMax = Math.max(yMax, cy);
  }

  return { xMin, xMax, vMin, vMax, yMin, yMax };
}

function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const m = child.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  });
}

function buildPoints(points) {
  const n = points.length;
  if (!n) return null;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.v;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: ACCENT,
    size: 0.14,
    sizeAttenuation: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.95,
  });
  return new THREE.Points(geom, mat);
}

function buildPlane(w1, w2, b, B) {
  const y00 = predY(B.xMin, B.vMin, w1, w2, b);
  const y10 = predY(B.xMax, B.vMin, w1, w2, b);
  const y11 = predY(B.xMax, B.vMax, w1, w2, b);
  const y01 = predY(B.xMin, B.vMax, w1, w2, b);

  const geom = new THREE.BufferGeometry();
  const verts = new Float32Array([
    B.xMin,
    y00,
    B.vMin,
    B.xMax,
    y10,
    B.vMin,
    B.xMax,
    y11,
    B.vMax,
    B.xMin,
    y01,
    B.vMax,
  ]);
  geom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geom.setIndex([0, 1, 2, 0, 2, 3]);
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: PLANE,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
    metalness: 0.1,
    roughness: 0.75,
  });
  return new THREE.Mesh(geom, mat);
}

function fitCamera(B) {
  const cx = (B.xMin + B.xMax) / 2;
  const cy = (B.yMin + B.yMax) / 2;
  const cz = (B.vMin + B.vMax) / 2;
  const dx = B.xMax - B.xMin;
  const dy = B.yMax - B.yMin;
  const dz = B.vMax - B.vMin;
  const size = Math.max(dx, dy, dz, 1);
  const dist = size * 2.2;

  camera.position.set(cx + dist * 0.75, cy + dist * 0.55, cz + dist * 0.85);
  controls.target.set(cx, cy, cz);
  camera.near = Math.max(0.01, dist / 200);
  camera.far = dist * 50;
  camera.updateProjectionMatrix();
  controls.update();
}

function animate() {
  rafId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  if (!rootEl || !renderer || !camera) return;
  const w = rootEl.clientWidth;
  const h = rootEl.clientHeight;
  if (w < 1 || h < 1) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function init(root) {
  rootEl = root;
  if (!rootEl) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121820);

  const w = rootEl.clientWidth || 640;
  const h = rootEl.clientHeight || 420;
  camera = new THREE.PerspectiveCamera(50, w / h, 0.05, 500);
  camera.position.set(28, 6, 22);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  rootEl.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0x8b9aab, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(4, 12, 6);
  scene.add(dir);

  const ro = new ResizeObserver(onResize);
  ro.observe(rootEl);

  cancelAnimationFrame(rafId);
  animate();
}

function sync() {
  const LRLOGIC = window.LRLOGIC;
  if (!LRLOGIC || !scene || !rootEl) return;

  const points = LRLOGIC.points;
  const w1 = LRLOGIC.w1;
  const w2 = LRLOGIC.w2;
  const b = LRLOGIC.b;
  const B = computeBounds(points, w1, w2, b);

  if (planeMesh) {
    scene.remove(planeMesh);
    disposeObject3D(planeMesh);
    planeMesh = null;
  }
  planeMesh = buildPlane(w1, w2, b, B);
  scene.add(planeMesh);

  if (pointsObj) {
    scene.remove(pointsObj);
    disposeObject3D(pointsObj);
    pointsObj = null;
  }
  const pts = buildPoints(points);
  if (pts) {
    pointsObj = pts;
    pointsObj.renderOrder = 2;
    scene.add(pointsObj);
  }

  if (gridHelper) {
    scene.remove(gridHelper);
    gridHelper.geometry.dispose();
    const gm = gridHelper.material;
    if (Array.isArray(gm)) gm.forEach((m) => m.dispose());
    else gm.dispose();
    gridHelper = null;
  }
  const gx = Math.max(B.xMax - B.xMin, 1);
  const gz = Math.max(B.vMax - B.vMin, 0.5);
  gridHelper = new THREE.GridHelper(Math.max(gx, gz) * 1.2, 14, GRID, GRID);
  gridHelper.position.set((B.xMin + B.xMax) / 2, B.yMin - (B.yMax - B.yMin) * 0.02, (B.vMin + B.vMax) / 2);
  scene.add(gridHelper);

  if (axesGroup) {
    scene.remove(axesGroup);
    disposeObject3D(axesGroup);
    axesGroup = null;
  }
  const arm = Math.min(B.xMax - B.xMin, B.yMax - B.yMin, B.vMax - B.vMin) * 0.35;
  axesGroup = new THREE.Group();
  axesGroup.position.set(B.xMin, B.yMin, B.vMin);
  const ah = new THREE.AxesHelper(Math.max(arm, 0.8));
  axesGroup.add(ah);
  scene.add(axesGroup);

  fitCamera(B);
  onResize();
}

window.CarPrice3DViz = {
  init,
  sync,
};

const mount = document.getElementById("viz3dRoot");
if (mount) {
  init(mount);
  if (window.LRLOGIC) sync();
}
