import * as THREE from './vendor/three.module.js';

// An intentionally small, entirely procedural world. No asset downloads or
// random layout changes: every visit shows the same connected career islands.
export function createWorld() {
  const group = new THREE.Group();
  group.name = 'Gokul — systems archipelago';
  const palette = {
    terrain: '#122b35', top: '#244850', mint: '#8ff5c2',
    lavender: '#a0a1ff', peach: '#ffbd92', white: '#e9fff6',
    blue: '#75cce8', dark: '#0b202b', gold: '#ffd68a',
  };
  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.66, metalness: 0.18, flatShading: true, ...extra,
  });
  const materials = {
    terrain: standard(palette.terrain),
    rock: standard('#193942'),
    top: standard(palette.top),
    bevel: standard('#37626a', { metalness: 0.35 }),
    white: standard(palette.white, { roughness: 0.32 }),
    dark: standard(palette.dark),
    mint: standard(palette.mint, { emissive: palette.mint, emissiveIntensity: 0.18 }),
    lavender: standard(palette.lavender, { emissive: palette.lavender, emissiveIntensity: 0.22 }),
    peach: standard(palette.peach),
    gold: standard(palette.gold, { metalness: 0.45 }),
    blue: standard('#206080', { metalness: 0.6, roughness: 0.3 }),
    light: new THREE.MeshBasicMaterial({ color: palette.mint }),
  };
  const floaters = [];
  const rotators = [];
  const collected = new Set();
  const beacons = [];
  let seed = 8741;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (parent, width, height, depth, material, x = 0, y = 0, z = 0) =>
    mesh(new THREE.BoxGeometry(width, height, depth), material, parent, x, y, z);
  const sphere = (parent, radius, material, x = 0, y = 0, z = 0, detail = 1) =>
    mesh(new THREE.IcosahedronGeometry(radius, detail), material, parent, x, y, z);
  const ring = (parent, radius, tube, material, x = 0, y = 0, z = 0) =>
    mesh(new THREE.TorusGeometry(radius, tube, 5, 48), material, parent, x, y, z);
  const line = (parent, points, color, opacity = 1, loop = false) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    const object = loop ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
    parent.add(object);
    return object;
  };
  const horizontalRing = (parent, radius, color, y, opacity = 1) => {
    const points = Array.from({ length: 72 }, (_, i) => {
      const angle = i / 72 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    });
    return line(parent, points, color, opacity, true);
  };

  function island(x, z, radius = 2.35, color = palette.mint) {
    const land = new THREE.Group();
    land.position.set(x, 0, z);
    group.add(land);
    // The upper face is exactly y=0; the taper gives the island a carved edge.
    mesh(new THREE.CylinderGeometry(radius, radius - 0.08, 0.26, 6), materials.top, land, 0, -0.13);
    mesh(new THREE.CylinderGeometry(radius - 0.08, radius + 0.08, 0.17, 6), materials.bevel, land, 0, -0.345);
    const rock = mesh(new THREE.CylinderGeometry(radius + 0.04, radius * 0.67, 1.18, 6), materials.terrain, land, 0, -1.02);
    rock.rotation.y = 0.04;
    const tip = mesh(new THREE.ConeGeometry(radius * 0.77, 1.7, 5), materials.rock, land, -0.12, -2.17, 0.08);
    tip.rotation.z = Math.PI;
    tip.rotation.y = 0.24;
    const edge = Array.from({ length: 6 }, (_, i) => {
      const angle = i * Math.PI / 3;
      return new THREE.Vector3(Math.sin(angle) * radius, 0.015, Math.cos(angle) * radius);
    });
    line(land, edge, color, 0.8, true);
    // Exposed fragments add scale without a large geometry or texture budget.
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.14 + random() * 0.5;
      const size = 0.17 + random() * 0.15;
      const fragment = sphere(land, size, i === 0 ? materials.bevel : materials.rock,
        Math.sin(angle) * (radius + 0.12), -0.8 - random() * 0.7,
        Math.cos(angle) * (radius + 0.12), 0);
      fragment.scale.set(0.8, 1.8, 1);
      fragment.rotation.set(random(), random(), random());
    }
    return land;
  }

  const stationDefs = [
    { x: -8, z: 3, color: palette.peach, name: 'Flytta · edge intelligence' },
    { x: -4, z: -4, color: palette.lavender, name: 'Pramati · deep learning' },
    { x: 3, z: -5, color: palette.blue, name: 'Accenture · applied ML' },
    { x: 8, z: 1, color: palette.mint, name: 'Plena · multi-agent systems' },
    { x: 2, z: 6, color: palette.mint, name: 'LaunchAI · agent harnesses' },
  ];
  const hub = island(0, 0, 1.72);
  hub.name = 'Central systems hub';
  horizontalRing(hub, 1.29, palette.mint, 0.022, 0.65);
  horizontalRing(hub, 1.08, palette.mint, 0.026, 0.25);
  const hubCore = mesh(new THREE.CylinderGeometry(0.67, 0.77, 0.12, 8), materials.bevel, hub, 0, 0.06);
  const hubMarker = ring(hub, 0.57, 0.025, materials.light, 0, 0.13);
  hubMarker.rotation.x = Math.PI / 2;
  hubCore.name = 'Return platform';

  // Paths are genuine geometry, so they remain legible from an oblique camera.
  for (const [index, definition] of stationDefs.entries()) {
    const end = new THREE.Vector3(definition.x, 0.035, definition.z);
    const direction = end.clone().setY(0).normalize();
    const start = direction.clone().multiplyScalar(1.7).setY(0.035);
    const finish = end.clone().addScaledVector(direction, -2.2);
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    const bend = start.clone().lerp(finish, 0.5).addScaledVector(side, index % 2 ? 0.42 : -0.42);
    const curve = new THREE.QuadraticBezierCurve3(start, bend, finish);
    line(group, curve.getPoints(36), definition.color, 0.48);
    for (let step = 0; step < 6; step++) {
      const t = (step + 0.5) / 6;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const stone = box(group, 0.48, 0.075, 0.24, materials.terrain, point.x, -0.02, point.z);
      stone.rotation.y = Math.atan2(tangent.x, tangent.z);
      const detail = box(group, 0.15, 0.012, 0.035, materials.light, point.x, 0.024, point.z);
      detail.rotation.y = stone.rotation.y;
    }
  }

  const stations = stationDefs.map((definition, index) => {
    const land = island(definition.x, definition.z, 2.35, definition.color);
    land.name = definition.name;
    const beaconMaterial = standard(definition.color, {
      emissive: definition.color, emissiveIntensity: 1.3, roughness: 0.25,
    });
    const beaconRoot = new THREE.Group();
    beaconRoot.position.set(-0.02, 0, 1.65);
    land.add(beaconRoot);
    const plinth = mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.09, 6), materials.bevel, beaconRoot, 0, 0.045);
    plinth.name = 'Evidence marker';
    const beacon = sphere(beaconRoot, 0.16, beaconMaterial, 0, 0.38, 0);
    const marker = ring(beaconRoot, 0.28, 0.022, beaconMaterial, 0, 0.35);
    marker.rotation.x = Math.PI / 2;
    const completionRing = ring(beaconRoot, 0.37, 0.035, materials.gold, 0, 0.1);
    completionRing.rotation.x = Math.PI / 2;
    completionRing.visible = false;
    beacons.push({ beacon, marker, completionRing });
    floaters.push({ object: beacon, y: 0.38, amount: 0.065, phase: index });
    return {
      position: new THREE.Vector3(definition.x, 0, definition.z),
      group: land, beacon, color: definition.color,
    };
  });

  // 01 — A mobile inference rover and cargo: the origin in edge ML.
  {
    const parent = stations[0].group;
    const rover = new THREE.Group();
    rover.position.set(-0.15, 0, -0.2);
    rover.rotation.y = -0.35;
    parent.add(rover);
    box(rover, 1.55, 0.4, 0.87, materials.peach, 0, 0.43);
    box(rover, 0.76, 0.43, 0.82, materials.white, 0.12, 0.84);
    box(rover, 0.56, 0.24, 0.027, materials.dark, 0.12, 0.87, 0.425);
    box(rover, 0.56, 0.24, 0.027, materials.dark, 0.12, 0.87, -0.425);
    box(rover, 0.1, 0.11, 0.54, materials.mint, -0.81, 0.5);
    box(rover, 0.16, 0.12, 0.76, materials.dark, -0.78, 0.31);
    for (const x of [-0.5, 0.5]) for (const z of [-0.48, 0.48]) {
      const tire = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.18, 10), materials.dark, rover, x, 0.25, z);
      tire.rotation.x = Math.PI / 2;
      const hubcap = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.19, 8), materials.bevel, rover, x, 0.25, z);
      hubcap.rotation.x = Math.PI / 2;
    }
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), materials.bevel, rover, 0.16, 1.21);
    const sensor = sphere(rover, 0.13, materials.mint, 0.16, 1.39);
    const scan = ring(rover, 0.33, 0.014, materials.light, 0.16, 1.39);
    scan.rotation.x = Math.PI / 2;
    rotators.push({ object: scan, axis: 'z', speed: 0.18 });
    sensor.name = 'On-device vision';
    for (const [x, z, size] of [[1.1, -0.65, 0.52], [1.12, 0.06, 0.42], [-0.9, -1.1, 0.36]]) {
      box(parent, size, size, size, materials.peach, x, size / 2, z);
      box(parent, size + 0.01, 0.05, size + 0.01, materials.white, x, size * 0.64, z);
    }
    const inference = horizontalRing(parent, 1.5, palette.peach, 0.03, 0.3);
    inference.name = 'Edge inference field';
  }

  // 02 — A suspended neural structure: language, vision, and knowledge.
  {
    const parent = stations[1].group;
    mesh(new THREE.CylinderGeometry(0.94, 1.1, 0.15, 8), materials.bevel, parent, 0, 0.075, -0.2);
    const network = new THREE.Group();
    network.position.set(0, 1.14, -0.2);
    parent.add(network);
    const nodes = [];
    for (let layer = 0; layer < 3; layer++) {
      for (let row = 0; row < 3; row++) {
        const point = new THREE.Vector3((layer - 1) * 0.76, (row - 1) * 0.55, Math.sin(row + layer) * 0.32);
        nodes.push(point);
        sphere(network, layer === 1 ? 0.14 : 0.115,
          layer === 1 ? materials.white : materials.lavender, point.x, point.y, point.z);
      }
    }
    const connections = [];
    for (let layer = 0; layer < 2; layer++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      connections.push(nodes[layer * 3 + a], nodes[(layer + 1) * 3 + b]);
    }
    network.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(connections),
      new THREE.LineBasicMaterial({ color: palette.lavender, transparent: true, opacity: 0.56 })));
    const shell = ring(network, 1.24, 0.018, materials.lavender);
    shell.rotation.y = Math.PI / 3;
    const outer = ring(network, 1.39, 0.012, materials.lavender);
    outer.rotation.set(0.3, -0.7, 0.6);
    rotators.push({ object: network, axis: 'y', speed: 0.12 });
    floaters.push({ object: network, y: 1.14, amount: 0.1, phase: 0.6 });
    for (let i = 0; i < 3; i++) box(parent, 0.42, 0.09, 0.32,
      i === 1 ? materials.lavender : materials.white, (i - 1) * 0.55, 0.05, 0.95);
  }

  // 03 — Large photovoltaic wings make the satellite legible at world scale.
  {
    const parent = stations[2].group;
    horizontalRing(parent, 1.65, palette.blue, 0.025, 0.5);
    const satellite = new THREE.Group();
    satellite.position.set(0, 1.12, -0.22);
    satellite.rotation.set(0.1, 0.3, -0.16);
    parent.add(satellite);
    box(satellite, 0.62, 0.65, 0.68, materials.gold);
    box(satellite, 0.68, 0.35, 0.72, materials.white, 0, 0.08);
    box(satellite, 3.3, 0.06, 0.1, materials.bevel, 0, 0.02);
    for (const side of [-1, 1]) {
      const x = side * 1.13;
      box(satellite, 1.46, 0.07, 0.91, materials.white, x, 0.02);
      box(satellite, 1.36, 0.025, 0.81, materials.blue, x, 0.069);
      const grid = [];
      for (let i = -2; i <= 2; i++) {
        grid.push(new THREE.Vector3(x + i * 0.225, 0.086, -0.4), new THREE.Vector3(x + i * 0.225, 0.086, 0.4));
      }
      for (const z of [-0.135, 0.135]) grid.push(new THREE.Vector3(x - 0.68, 0.087, z), new THREE.Vector3(x + 0.68, 0.087, z));
      satellite.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid),
        new THREE.LineBasicMaterial({ color: '#8ac1d7', transparent: true, opacity: 0.7 })));
    }
    const dish = mesh(new THREE.ConeGeometry(0.25, 0.18, 12, 1, true), materials.white, satellite, 0, 0.5);
    dish.rotation.x = Math.PI;
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.37, 6), materials.mint, satellite, 0, 0.68);
    sphere(satellite, 0.055, materials.mint, 0, 0.88);
    floaters.push({ object: satellite, y: 1.12, amount: 0.13, phase: 1.8 });
    rotators.push({ object: satellite, axis: 'y', speed: -0.07 });
    const orbit = new THREE.Group();
    orbit.position.set(0, 0.85, -0.2);
    orbit.rotation.set(0.62, 0.2, 0.2);
    parent.add(orbit);
    const orbitRing = ring(orbit, 1.91, 0.014, materials.lavender);
    sphere(orbit, 0.09, materials.mint, 1.91);
    orbitRing.name = 'Physics-informed orbit';
    rotators.push({ object: orbit, axis: 'z', speed: 0.14 });
  }

  function littleRobot(parent, x, z, colorMaterial, scale = 1) {
    const robot = new THREE.Group();
    robot.position.set(x, 0, z);
    robot.scale.setScalar(scale);
    parent.add(robot);
    mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.37, 8), colorMaterial, robot, 0, 0.27);
    box(robot, 0.48, 0.36, 0.37, materials.white, 0, 0.65);
    box(robot, 0.34, 0.13, 0.025, materials.dark, 0, 0.67, 0.195);
    box(robot, 0.22, 0.04, 0.03, materials.mint, 0, 0.67, 0.214);
    mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.16, 5), colorMaterial, robot, 0, 0.9);
    sphere(robot, 0.055, materials.mint, 0, 1);
    return robot;
  }

  // 04 — Five visibly separate specialists, with the orchestration in view.
  {
    const parent = stations[3].group;
    const agents = new THREE.Group();
    agents.position.z = -0.18;
    parent.add(agents);
    const points = [];
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const x = Math.sin(angle) * 1.13;
      const z = Math.cos(angle) * 1.13;
      const robot = littleRobot(agents, x, z, i % 2 ? materials.lavender : materials.mint, 0.74);
      robot.rotation.y = angle + Math.PI;
      points.push(new THREE.Vector3(x, 0.07, z));
      line(agents, [new THREE.Vector3(x, 0.1, z), new THREE.Vector3(0, 0.1, 0)], palette.mint, 0.62);
      horizontalRing(robot, 0.4, palette.mint, 0.028, 0.4);
    }
    line(agents, points, palette.mint, 0.3, true);
    mesh(new THREE.CylinderGeometry(0.4, 0.47, 0.17, 8), materials.bevel, agents, 0, 0.085);
    const orchestrator = sphere(agents, 0.27, materials.lavender, 0, 0.55);
    const routing = ring(agents, 0.43, 0.019, materials.light, 0, 0.55);
    routing.rotation.x = 0.9;
    floaters.push({ object: orchestrator, y: 0.55, amount: 0.09, phase: 3 });
    rotators.push({ object: routing, axis: 'y', speed: 0.3 });
  }

  // 05 — A layered harness portal, with nested guardrails around the core.
  {
    const parent = stations[4].group;
    mesh(new THREE.CylinderGeometry(1.06, 1.2, 0.15, 8), materials.bevel, parent, 0, 0.075, -0.28);
    horizontalRing(parent, 1.48, palette.mint, 0.026, 0.45);
    const portal = new THREE.Group();
    portal.position.set(0, 1.32, -0.28);
    portal.rotation.y = -0.25;
    parent.add(portal);
    const outer = ring(portal, 1.08, 0.09, materials.white);
    const inner = ring(portal, 0.91, 0.033, materials.mint, 0, 0, 0.03);
    const gimbal = new THREE.Group();
    portal.add(gimbal);
    const cross = ring(gimbal, 0.72, 0.037, materials.lavender);
    cross.rotation.y = Math.PI / 2.7;
    const cross2 = ring(gimbal, 0.72, 0.022, materials.mint);
    cross2.rotation.x = Math.PI / 2.7;
    const core = sphere(portal, 0.33, standard(palette.mint, {
      emissive: palette.mint, emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.2,
    }));
    core.name = 'Deterministic execution core';
    outer.name = 'Harness';
    inner.name = 'Guardrails';
    for (const side of [-1, 1]) {
      box(parent, 0.21, 0.64, 0.37, materials.white, side * 0.82, 0.4, -0.28);
      box(parent, 0.22, 0.08, 0.39, materials.mint, side * 0.82, 0.67, -0.28);
    }
    rotators.push({ object: gimbal, axis: 'y', speed: 0.22 });
    rotators.push({ object: core, axis: 'y', speed: -0.25 });
    floaters.push({ object: portal, y: 1.32, amount: 0.055, phase: 4 });
  }

  // The application owns the avatar's translation, heading and navigation.
  const avatar = new THREE.Group();
  avatar.name = 'Explorer';
  avatar.position.set(0, 0.4, 0);
  group.add(avatar);
  mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.25, 8), materials.white, avatar, 0, 0.04);
  const head = box(avatar, 0.39, 0.27, 0.3, materials.white, 0, 0.28);
  head.name = 'Explorer head';
  box(avatar, 0.28, 0.11, 0.025, materials.dark, 0, 0.29, 0.16);
  for (const x of [-0.075, 0.075]) box(avatar, 0.045, 0.04, 0.03, materials.mint, x, 0.3, 0.178);
  for (const x of [-0.24, 0.24]) sphere(avatar, 0.075, materials.white, x, 0.07);
  mesh(new THREE.ConeGeometry(0.09, 0.18, 7), materials.mint, avatar, 0, -0.17).rotation.z = Math.PI;
  const explorerRing = ring(avatar, 0.28, 0.015, materials.light, 0, -0.1);
  explorerRing.rotation.x = Math.PI / 2;

  // Capture base angles so animations are stable regardless of frame rate.
  for (const rotation of rotators) rotation.base = rotation.object.rotation[rotation.axis];

  function animate(time, reduced = false) {
    if (reduced) {
      for (const floating of floaters) floating.object.position.y = floating.y;
      for (const rotation of rotators) rotation.object.rotation[rotation.axis] = rotation.base;
      return;
    }
    for (const floating of floaters) {
      floating.object.position.y = floating.y + Math.sin(time * 1.1 + floating.phase) * floating.amount;
    }
    for (const rotation of rotators) {
      rotation.object.rotation[rotation.axis] = rotation.base + time * rotation.speed;
    }
    beacons.forEach(({ beacon, marker }, index) => {
      if (!collected.has(index)) marker.rotation.z = time * 0.2 + index;
      beacon.rotation.y = time * 0.25;
    });
  }

  function setCollected(index) {
    if (!beacons[index] || collected.has(index)) return;
    collected.add(index);
    const { beacon, marker, completionRing } = beacons[index];
    beacon.material.color.set(palette.gold);
    beacon.material.emissive.set(palette.gold);
    beacon.material.emissiveIntensity = 0.35;
    beacon.scale.setScalar(0.8);
    marker.visible = false;
    completionRing.visible = true;
  }

  return { group, stations, avatar, animate, setCollected };
}
