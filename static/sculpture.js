/** A small, locally rendered sculpture. Its five details also open career chapters. */
export async function mountSculpture(container, { reducedMotion = false, onSelect = () => {}, interactive = true } = {}) {
  const THREE = await import('./vendor/three.module.js');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4.25, 4.25, 4.25, -4.25, 0.1, 70);
  camera.position.set(0, 1.4, 14);
  camera.lookAt(0, -0.1, 0);
  const disposables = [];
  const own = value => { disposables.push(value); return value; };

  // Studio softboxes are painted locally, then prefiltered once. Wide dark bands
  // give the metal its shape; narrow white panels become long silver highlights.
  const environmentCanvas = document.createElement('canvas');
  environmentCanvas.width = 1024;
  environmentCanvas.height = 512;
  const studio = environmentCanvas.getContext('2d');
  const gradient = studio.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#f8f8f6');
  gradient.addColorStop(0.30, '#c9cbd0');
  gradient.addColorStop(0.49, '#303337');
  gradient.addColorStop(0.58, '#121417');
  gradient.addColorStop(0.76, '#9b9ea4');
  gradient.addColorStop(1, '#efeeeb');
  studio.fillStyle = gradient;
  studio.fillRect(0, 0, 1024, 512);
  studio.fillStyle = '#ffffff';
  studio.fillRect(60, 35, 160, 290);
  studio.fillRect(660, 12, 250, 200);
  studio.fillRect(390, 260, 48, 190);
  studio.fillStyle = '#0c0e11';
  studio.fillRect(260, 0, 100, 365);
  studio.fillRect(935, 180, 65, 290);
  const studioTexture = own(new THREE.CanvasTexture(environmentCanvas));
  studioTexture.mapping = THREE.EquirectangularReflectionMapping;
  studioTexture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = own(pmrem.fromEquirectangular(studioTexture));
  scene.environment = environment.texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x38383b, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(-4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 2);
  rim.position.set(6, 2, -3);
  scene.add(rim);

  const sculpture = new THREE.Group();
  sculpture.position.y = 0.25;
  scene.add(sculpture);
  const chrome = own(new THREE.MeshPhysicalMaterial({
    color: 0xd6d8dc, metalness: 1, roughness: 0.17,
    clearcoat: 0.5, clearcoatRoughness: 0.18, envMapIntensity: 1.25,
  }));
  const knot = new THREE.Mesh(own(new THREE.TorusKnotGeometry(2, 0.55, 224, 28, 2, 3)), chrome);
  knot.rotation.set(0.25, -0.2, 0.55);
  sculpture.add(knot);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d');
  const shade = shadowContext.createRadialGradient(64, 64, 8, 64, 64, 64);
  shade.addColorStop(0, 'rgba(18,20,19,.2)');
  shade.addColorStop(0.45, 'rgba(18,20,19,.08)');
  shade.addColorStop(1, 'rgba(18,20,19,0)');
  shadowContext.fillStyle = shade;
  shadowContext.fillRect(0, 0, 128, 128);
  const shadowTexture = own(new THREE.CanvasTexture(shadowCanvas));
  const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(6.8, 3.4)), own(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -3.15, 0);
  scene.add(shadow);

  const markers = [];
  const pickTargets = [];
  const markerGeometry = own(new THREE.SphereGeometry(0.085, 16, 12));
  const pickGeometry = own(new THREE.SphereGeometry(0.29, 10, 8));
  const invisible = own(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const activeMaterial = own(new THREE.MeshStandardMaterial({ color: 0xc3ed68, roughness: 0.35, metalness: 0.15, emissive: 0x617b27, emissiveIntensity: 0.25 }));
  const dormantMaterial = own(new THREE.MeshStandardMaterial({ color: 0x73766b, roughness: 0.55, metalness: 0.1 }));
  for (let index = 0; index < (interactive ? 5 : 0); index++) {
    const angle = -Math.PI * 0.35 + index * Math.PI * 2 / 5;
    const marker = new THREE.Mesh(markerGeometry, index === 0 ? activeMaterial : dormantMaterial);
    marker.position.set(Math.cos(angle) * 3.65, Math.sin(angle) * 3.22 + 0.2, 1.2);
    marker.userData.index = index;
    scene.add(marker);
    markers.push(marker);
    const pick = new THREE.Mesh(pickGeometry, invisible);
    pick.position.copy(marker.position);
    pick.userData.index = index;
    scene.add(pick);
    pickTargets.push(pick);
  }

  let paused = false;
  let visible = true;
  let destroyed = false;
  let animationFrame = 0;
  let previousTime = 0;
  let elapsed = 0;
  let targetFocus = 0;
  let currentFocus = 0;
  let pointerX = 0;
  let pointerY = 0;
  let smoothedX = 0;
  let smoothedY = 0;
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const canAnimate = () => !destroyed && !paused && visible && !document.hidden && !reducedMotion;

  function draw() {
    renderer.render(scene, camera);
  }
  function schedule() {
    if (!animationFrame && canAnimate()) animationFrame = requestAnimationFrame(tick);
  }
  function tick(time) {
    animationFrame = 0;
    if (!canAnimate()) { previousTime = 0; return; }
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    elapsed += delta;
    const easing = 1 - Math.exp(-delta * 3.5);
    smoothedX += (pointerX - smoothedX) * easing;
    smoothedY += (pointerY - smoothedY) * easing;
    currentFocus += (targetFocus - currentFocus) * easing;
    sculpture.rotation.set(smoothedY * 0.09, elapsed * 0.075 + currentFocus * 0.18 + smoothedX * 0.13, 0);
    sculpture.position.y = 0.25 + Math.sin(elapsed * 0.6) * 0.07;
    markers.forEach((marker, index) => {
      marker.scale.setScalar(marker.material === activeMaterial ? 1.22 + Math.sin(elapsed * 1.7) * 0.08 : 1);
    });
    draw();
    schedule();
  }
  function stop() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    previousTime = 0;
  }
  function syncAnimation() {
    if (canAnimate()) schedule();
    else stop();
  }
  function resize() {
    if (destroyed) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight || width);
    const aspect = width / height;
    const view = aspect < 1 ? 4.25 / aspect : 4.25;
    camera.left = -view * aspect;
    camera.right = view * aspect;
    camera.top = view;
    camera.bottom = -view;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    draw();
  }
  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(pickTargets, false)[0];
  }
  function onPointerMove(event) {
    if (event.pointerType === 'touch') return;
    const hit = locate(event);
    canvas.style.cursor = hit ? 'pointer' : '';
    if (!reducedMotion && !paused) {
      pointerX = pointer.x;
      pointerY = pointer.y;
    }
  }
  function onPointerLeave() {
    pointerX = pointerY = 0;
    canvas.style.cursor = '';
  }
  function onClick(event) {
    const hit = locate(event);
    if (hit) onSelect(hit.object.userData.index);
  }
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
  canvas.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', syncAnimation);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    syncAnimation();
  }, { rootMargin: '60px' });
  intersectionObserver.observe(container);
  resize();
  schedule();

  return {
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      syncAnimation();
      draw();
    },
    setPaused(value) {
      paused = Boolean(value);
      syncAnimation();
    },
    focus(index) {
      const selected = Math.max(0, Math.min(4, Math.round(Number(index) || 0)));
      targetFocus = selected;
      markers.forEach((marker, markerIndex) => {
        marker.material = markerIndex === selected ? activeMaterial : dormantMaterial;
        marker.scale.setScalar(markerIndex === selected ? 1.28 : 1);
      });
      if (reducedMotion || paused) {
        currentFocus = targetFocus;
        sculpture.rotation.y = elapsed * 0.075 + currentFocus * 0.18;
      }
      draw();
    },
    destroy() {
      destroyed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', syncAnimation);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
      scene.environment = null;
      disposables.forEach(resource => resource.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
