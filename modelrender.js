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
    antialias: window.devicePixelRatio < 2,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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

  let resizeFrame = 0;
  const scheduleResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      resize();
    });
  };

  window.addEventListener('resize', scheduleResize, { passive: true });

  if ('ResizeObserver' in window) {
    const stageObserver = new ResizeObserver(scheduleResize);
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
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animationFrame = 0;
  let stageVisible = true;
  let lastContrastCheck = 0;

  function updateResetColour(now) {
    if (!resetButton || now - lastContrastCheck < 100) return;
    lastContrastCheck = now;

    const canvasRect = canvas.getBoundingClientRect();
    const buttonRect = resetButton.getBoundingClientRect();
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    let overModel = false;

    for (let sampleY = 0.25; sampleY <= 0.75 && !overModel; sampleY += 0.25) {
      for (let sampleX = 0.25; sampleX <= 0.75 && !overModel; sampleX += 0.25) {
        const cssX = buttonRect.left + buttonRect.width * sampleX;
        const cssY = buttonRect.top + buttonRect.height * sampleY;

        if (
          cssX < canvasRect.left ||
          cssX >= canvasRect.right ||
          cssY < canvasRect.top ||
          cssY >= canvasRect.bottom
        ) continue;

        const glX = Math.floor(
          (cssX - canvasRect.left) * gl.drawingBufferWidth / canvasRect.width
        );
        const glY = Math.floor(
          (canvasRect.bottom - cssY) * gl.drawingBufferHeight / canvasRect.height
        );

        gl.readPixels(glX, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        overModel = pixel[3] > 16;
      }
    }

    resetButton.classList.toggle('is-over-model', overModel);
  }

  function animate() {
    animationFrame = requestAnimationFrame(animate);

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

    if (!dragging && !prefersReducedMotion.matches) {
      yaw += SETTINGS.AUTO_ROTATE_SPEED * delta;
    }
    root.rotation.z = 0;

    renderer.render(scene, camera);
    updateResetColour(performance.now());
    updateResetContrast(performance.now());
  }

  function startAnimation() {
    if (animationFrame || document.hidden || !stageVisible) return;
    clock.getDelta();
    animate();
  }

  function stopAnimation() {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAnimation();
    else startAnimation();
  });

  if ('IntersectionObserver' in window) {
    const stageObserver = new IntersectionObserver(([entry]) => {
      stageVisible = entry.isIntersecting;
      if (stageVisible) startAnimation();
      else stopAnimation();
    });
    stageObserver.observe(stage);
  }

  startAnimation();
}