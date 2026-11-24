    import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SETTINGS = {
  MODEL_URL: './porsche/scene.gltf',
  CANVAS_SCALE: 10,
  AUTO_ROTATE_SPEED: 0.45,
  DRAG_SENSITIVITY: 0.008,
  MAX_TILT: 1.35,
  DEFAULT_YAW: -0.15,
  DEFAULT_PITCH: 0.35,
  ENABLE_DRAG: true
};

const canvas = document.getElementById('modelcanvas');
const stage = document.querySelector('.machine__stage');
const loadingEl = document.getElementById('modelLoading');

if (canvas && stage) init();

function init() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);
  camera.position.set(0, 0, 30);
  const MIN_ZOOM = 0.65;
  const MAX_ZOOM = 2.2;
  const ZOOM_STEP = 0.12;

  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);
  scene.add(root);

  scene.add(new THREE.HemisphereLight(0xd7e8ff, 0x090b10, 1.2));

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-8, 10, 14);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8adfff, 1.4);
  fill.position.set(10, 2, 8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xff66a8, 1.1);
  rim.position.set(-10, -5, -8);
  scene.add(rim);

  let modelReady = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let yaw = SETTINGS.DEFAULT_YAW;
  let pitch = SETTINGS.DEFAULT_PITCH;
  root.rotation.y = yaw;
  root.rotation.x = pitch;

  new GLTFLoader().load(
    SETTINGS.MODEL_URL,
    (gltf) => {
      model.add(gltf.scene);
      normalizeModel(model);
      modelReady = true;
      fitCamera();
      if (loadingEl) loadingEl.classList.add('is-off');
    },
    undefined,
    (error) => {
      console.error('[model] failed to load', SETTINGS.MODEL_URL, error);
      if (loadingEl) loadingEl.textContent = 'MODEL UNAVAILABLE';
    }
  );

  function normalizeModel(target) {
    target.updateWorldMatrix(true, true);

    target.traverse((object) => {
      if (!object.isMesh) return;
      object.frustumCulled = false;

      if (object.material) {
        object.material = object.material.clone();

        if (object.material.envMapIntensity !== undefined) {
          object.material.envMapIntensity = 1.25;
        }
      }
    });

    const box = new THREE.Box3().setFromObject(target);
    const size = box.getSize(new THREE.Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z);

    if (!largestDimension) return;

    target.scale.setScalar(SETTINGS.CANVAS_SCALE / largestDimension);
    target.updateWorldMatrix(true, true);

    target.position.sub(
      new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3())
    );

    target.updateWorldMatrix(true, true);
  }

  function fitCamera() {
    if (!modelReady && !model.children.length) return;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const distanceByHeight =
      (size.y / 2) / Math.tan(verticalFov / 2);

    const distanceByWidth =
      (size.x / 2) /
      (Math.tan(verticalFov / 2) * camera.aspect);

    const fill = window.innerWidth < 720 ? 0.94 : 0.72;

    camera.position.set(
      0,
      0,
      Math.max(distanceByHeight, distanceByWidth) / fill + size.z / 2
    );

    camera.lookAt(0, 0, 0);
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 720 ? 42 : 34;
    camera.updateProjectionMatrix();

    if (modelReady) fitCamera();
  }

  window.addEventListener('resize', resize, { passive: true });

  if ('ResizeObserver' in window) {
    const stageObserver = new ResizeObserver(resize);
    stageObserver.observe(canvas);
  }

  resize();

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();

    const direction = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const nextZoom = THREE.MathUtils.clamp(
      camera.zoom + direction,
      MIN_ZOOM,
      MAX_ZOOM
    );

    camera.zoom = nextZoom;
    camera.updateProjectionMatrix();
  }, { passive: false });

  const resetButton = document.getElementById('modelReset');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      const icon = resetButton.querySelector('img');
      if (icon) {
        icon.classList.remove('is-spinning');
        void icon.offsetWidth;
        icon.classList.add('is-spinning');
      }

      yaw = SETTINGS.DEFAULT_YAW;
      pitch = SETTINGS.DEFAULT_PITCH;
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      fitCamera();
    });
  }

  if (SETTINGS.ENABLE_DRAG) {
    canvas.addEventListener('pointerdown', (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return;

      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;

      yaw += deltaX * SETTINGS.DRAG_SENSITIVITY;
      pitch += deltaY * SETTINGS.DRAG_SENSITIVITY;

      pitch = THREE.MathUtils.clamp(
        pitch,
        -SETTINGS.MAX_TILT,
        SETTINGS.MAX_TILT
      );

      lastX = event.clientX;
      lastY = event.clientY;
    });

    const stopDragging = (event) => {
      dragging = false;
      canvas.style.cursor = 'grab';

      if (event && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener('pointerup', stopDragging);
    canvas.addEventListener('pointercancel', stopDragging);

    canvas.addEventListener('pointerleave', () => {
      dragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.style.cursor = 'grab';
  }

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    root.rotation.y = THREE.MathUtils.lerp(
      root.rotation.y,
      yaw,
      0.16
    );

    root.rotation.x = THREE.MathUtils.lerp(
      root.rotation.x,
      pitch,
      0.16
    );

    if (!dragging) {
      yaw += SETTINGS.AUTO_ROTATE_SPEED * delta;
    }
    root.rotation.z = 0;

    renderer.render(scene, camera);
  }

  animate();
}