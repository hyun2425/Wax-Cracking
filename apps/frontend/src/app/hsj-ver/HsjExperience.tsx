"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type FragmentBody = {
  home: THREE.Vector3;
  mesh: THREE.Mesh;
  spin: THREE.Vector3;
  velocity: THREE.Vector3;
};

type PlateBody = {
  home: THREE.Vector3;
  mesh: THREE.Mesh;
  normal: THREE.Vector3;
  spin: THREE.Vector3;
};

type SceneHandles = {
  burst: () => void;
  freeze: () => void;
  reset: () => void;
};

const fragmentColors = [0x4a241a, 0xb9f0c8, 0xafd8f8, 0xf5d1e2, 0xf4f7ed];

function seeded(index: number) {
  return Math.sin(index * 127.1 + 31.7) * 43758.5453 % 1;
}

function positiveSeed(index: number) {
  return Math.abs(seeded(index));
}

function makePlateGeometry(index: number, radius: number) {
  const sides = 4 + (index % 3);
  const vertices: number[] = [0, 0, 0.018];
  const indices: number[] = [];

  for (let side = 0; side < sides; side += 1) {
    const angle =
      (side / sides) * Math.PI * 2 + positiveSeed(index * 10 + side) * 0.42;
    const pointRadius = radius * (0.74 + positiveSeed(index * 17 + side) * 0.42);
    vertices.push(
      Math.cos(angle) * pointRadius,
      Math.sin(angle) * pointRadius * (0.74 + (index % 2) * 0.18),
      0.018,
    );
  }

  for (let side = 1; side <= sides; side += 1) {
    indices.push(0, side, side === sides ? 1 : side + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function spherePoint(x: number, y: number, radius: number) {
  const z = Math.sqrt(Math.max(0.01, radius * radius - x * x - y * y));
  return new THREE.Vector3(x, y, z);
}

function makeSurfaceTube(
  points: Array<[number, number]>,
  radius: number,
  color: number,
  tubeRadius: number,
) {
  const projected = points.map(([x, y]) => spherePoint(x, y, radius));
  const curve = new THREE.CatmullRomCurve3(projected);
  const geometry = new THREE.TubeGeometry(curve, 16, tubeRadius, 6, false);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
  });
  return new THREE.Mesh(geometry, material);
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255,255,246,1)");
    gradient.addColorStop(0.25, "rgba(229,255,213,0.84)");
    gradient.addColorStop(0.68, "rgba(146,230,205,0.28)");
    gradient.addColorStop(1, "rgba(146,230,205,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function HsjExperience() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const [mode, setMode] = useState("빙결");
  const [hits, setHits] = useState(0);

  const playCrispCrunch = useCallback(() => {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.33, now + 0.012);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    masterGain.connect(audioContext.destination);

    const highPass = audioContext.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.setValueAtTime(950, now);
    highPass.Q.setValueAtTime(0.82, now);
    highPass.connect(masterGain);

    const crackleTimes = [0, 0.012, 0.033, 0.067, 0.098, 0.142, 0.208, 0.29];

    crackleTimes.forEach((delay, index) => {
      const duration = 0.045 + (index % 3) * 0.018;
      const buffer = audioContext.createBuffer(
        1,
        Math.floor(audioContext.sampleRate * duration),
        audioContext.sampleRate,
      );
      const data = buffer.getChannelData(0);

      for (let sample = 0; sample < data.length; sample += 1) {
        const fade = 1 - sample / data.length;
        data[sample] = (Math.random() * 2 - 1) * fade * fade;
      }

      const noise = audioContext.createBufferSource();
      const bandPass = audioContext.createBiquadFilter();
      const grainGain = audioContext.createGain();
      noise.buffer = buffer;
      bandPass.type = "bandpass";
      bandPass.frequency.setValueAtTime(1800 + index * 360, now + delay);
      bandPass.Q.setValueAtTime(2.9, now + delay);
      grainGain.gain.setValueAtTime(0.0001, now + delay);
      grainGain.gain.exponentialRampToValueAtTime(
        0.18 + index * 0.018,
        now + delay + 0.005,
      );
      grainGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + delay + duration,
      );
      noise.connect(bandPass);
      bandPass.connect(grainGain);
      grainGain.connect(highPass);
      noise.start(now + delay);
      noise.stop(now + delay + duration);
    });

    [0.045, 0.18, 0.31].forEach((delay, index) => {
      const oscillator = audioContext.createOscillator();
      const clickGain = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(1180 + index * 430, now + delay);
      clickGain.gain.setValueAtTime(0.0001, now + delay);
      clickGain.gain.exponentialRampToValueAtTime(0.075, now + delay + 0.004);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.064);
      oscillator.connect(clickGain);
      clickGain.connect(highPass);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 0.07);
    });

    window.setTimeout(() => {
      void audioContext.close();
    }, 850);
  }, []);

  const handleBurst = useCallback(() => {
    handlesRef.current?.burst();
    playCrispCrunch();
    setHits((current) => current + 1);
    setMode("파열");
  }, [playCrispCrunch]);

  const handleFreeze = useCallback(() => {
    handlesRef.current?.freeze();
    setMode("빙결");
  }, []);

  const handleReset = useCallback(() => {
    handlesRef.current?.reset();
    setHits(0);
    setMode("재생성");
  }, []);

  useEffect(() => {
    const currentMount = mountRef.current;

    if (!currentMount) {
      return;
    }

    const mount: HTMLDivElement = currentMount;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x101317, 7, 16);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    camera.position.set(0, 0.12, 8.2);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x101317, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.width = "100%";
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    const ballGroup = new THREE.Group();
    const crackGroup = new THREE.Group();
    const thumbGroup = new THREE.Group();
    scene.add(root);
    root.add(ballGroup, crackGroup, thumbGroup);

    const innerMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.55,
      clearcoatRoughness: 0.16,
      color: 0xb7f2c9,
      emissive: 0x183b2a,
      emissiveIntensity: 0.16,
      metalness: 0.02,
      roughness: 0.28,
      sheen: 0.45,
      transmission: 0.12,
    });
    const innerCore = new THREE.Mesh(
      new THREE.SphereGeometry(1.46, 64, 48),
      innerMaterial,
    );
    innerCore.scale.set(1.02, 0.98, 0.9);
    ballGroup.add(innerCore);

    const gelMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.9,
      color: 0xc2f0dc,
      ior: 1.25,
      metalness: 0,
      opacity: 0.78,
      roughness: 0.18,
      transparent: true,
      transmission: 0.22,
    });
    const gelOpening = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 32, 20),
      gelMaterial,
    );
    gelOpening.position.set(0, -0.22, 1.34);
    gelOpening.scale.set(1.12, 0.58, 0.18);
    ballGroup.add(gelOpening);

    const capsuleMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      color: 0xdff4ff,
      ior: 1.45,
      metalness: 0,
      opacity: 0.3,
      roughness: 0.04,
      transparent: true,
      transmission: 0.62,
    });
    const capsule = new THREE.Mesh(
      new THREE.SphereGeometry(1.68, 72, 48),
      capsuleMaterial,
    );
    capsule.scale.set(1.03, 0.98, 0.92);
    ballGroup.add(capsule);

    const seamMaterial = new THREE.MeshBasicMaterial({
      color: 0xf2fbff,
      opacity: 0.48,
      transparent: true,
    });
    const seam = new THREE.Mesh(new THREE.TorusGeometry(1.67, 0.012, 8, 96), seamMaterial);
    seam.rotation.x = 0.06;
    ballGroup.add(seam);

    const tabMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      color: 0xf3fbff,
      opacity: 0.42,
      roughness: 0.08,
      transparent: true,
      transmission: 0.45,
    });
    const tabGeometry = new THREE.BoxGeometry(0.28, 0.15, 0.05);
    const topTab = new THREE.Mesh(tabGeometry, tabMaterial);
    topTab.position.set(-0.18, 1.68, 0.34);
    topTab.rotation.z = -0.55;
    ballGroup.add(topTab);
    const sideTab = new THREE.Mesh(tabGeometry, tabMaterial);
    sideTab.position.set(1.66, -0.2, 0.28);
    sideTab.rotation.z = 0.42;
    ballGroup.add(sideTab);

    const plateMaterials = [
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.92,
        clearcoatRoughness: 0.08,
        color: 0x4a241a,
        metalness: 0.02,
        roughness: 0.22,
      }),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.82,
        color: 0x6b3322,
        roughness: 0.2,
      }),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.78,
        color: 0xc8f2d1,
        roughness: 0.24,
      }),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.85,
        color: 0xcfe5fb,
        opacity: 0.78,
        roughness: 0.16,
        transparent: true,
      }),
    ];
    const plates: PlateBody[] = [];

    for (let index = 0; index < 42; index += 1) {
      const band = index % 7;
      const x = (positiveSeed(index * 11) - 0.5) * 2.85;
      const y = (positiveSeed(index * 13 + 4) - 0.5) * 2.55;

      if (x * x + y * y > 2.36 || (Math.abs(x) < 0.42 && y < 0.3 && y > -0.82)) {
        continue;
      }

      const normal = spherePoint(x, y, 1.72).normalize();
      const home = normal.clone().multiplyScalar(1.73);
      const plate = new THREE.Mesh(
        makePlateGeometry(index, 0.22 + positiveSeed(index * 19) * 0.16),
        plateMaterials[band === 0 ? 2 : band === 1 ? 3 : index % 2],
      );
      plate.position.copy(home);
      plate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      plate.rotateZ(positiveSeed(index * 23) * Math.PI);
      ballGroup.add(plate);
      plates.push({
        home,
        mesh: plate,
        normal,
        spin: new THREE.Vector3(
          0.002 + positiveSeed(index * 29) * 0.008,
          0.002 + positiveSeed(index * 31) * 0.008,
          0.006 + positiveSeed(index * 37) * 0.01,
        ),
      });
    }

    const crackMeshes = [
      makeSurfaceTube(
        [
          [-1.22, 0.46],
          [-0.78, 0.2],
          [-0.38, 0.05],
          [0.1, -0.2],
          [0.64, -0.43],
        ],
        1.75,
        0x9df0bf,
        0.016,
      ),
      makeSurfaceTube(
        [
          [-0.3, 1.02],
          [-0.18, 0.52],
          [0.08, 0.12],
          [0.48, -0.3],
          [0.84, -0.92],
        ],
        1.75,
        0x9df0bf,
        0.014,
      ),
      makeSurfaceTube(
        [
          [-0.92, -0.62],
          [-0.52, -0.44],
          [-0.08, -0.36],
          [0.4, -0.12],
        ],
        1.75,
        0xb6f7cf,
        0.013,
      ),
      makeSurfaceTube(
        [
          [0.48, 0.78],
          [0.3, 0.48],
          [0.2, 0.15],
          [0.16, -0.2],
        ],
        1.75,
        0x6bb6ff,
        0.014,
      ),
      makeSurfaceTube(
        [
          [0.82, 0.35],
          [0.52, 0.2],
          [0.28, -0.02],
          [0.02, -0.24],
        ],
        1.75,
        0xb6f7cf,
        0.012,
      ),
    ];
    crackMeshes.forEach((mesh) => crackGroup.add(mesh));

    const fragments: FragmentBody[] = [];
    for (let index = 0; index < 34; index += 1) {
      const angle = (index / 34) * Math.PI * 2 + positiveSeed(index) * 0.2;
      const radius = 1.9 + positiveSeed(index * 7) * 0.44;
      const home = new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.83,
        0.28 + positiveSeed(index * 5) * 0.66,
      );
      const material = new THREE.MeshStandardMaterial({
        color: fragmentColors[index % fragmentColors.length],
        metalness: 0.02,
        roughness: 0.32,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(makePlateGeometry(index + 100, 0.14), material);
      mesh.position.copy(home);
      mesh.rotation.set(index * 0.33, index * 0.19, angle);
      mesh.scale.setScalar(0.78 + positiveSeed(index * 3) * 0.72);
      root.add(mesh);
      fragments.push({
        home,
        mesh,
        spin: new THREE.Vector3(
          0.014 + positiveSeed(index * 2) * 0.016,
          0.01 + positiveSeed(index * 4) * 0.014,
          0.012 + positiveSeed(index * 6) * 0.016,
        ),
        velocity: new THREE.Vector3(),
      });
    }

    const skinMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.2,
      color: 0xf1b98f,
      roughness: 0.62,
    });
    const nailMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.75,
      color: 0xf7c9d3,
      roughness: 0.22,
    });
    const thumbGeometry = new THREE.SphereGeometry(0.52, 32, 20);
    const nailGeometry = new THREE.SphereGeometry(0.22, 24, 12);

    const leftThumb = new THREE.Mesh(thumbGeometry, skinMaterial);
    leftThumb.position.set(-0.58, -0.83, 1.46);
    leftThumb.rotation.set(-0.08, 0.38, -0.4);
    leftThumb.scale.set(0.62, 1.05, 0.28);
    thumbGroup.add(leftThumb);

    const rightThumb = new THREE.Mesh(thumbGeometry, skinMaterial);
    rightThumb.position.set(0.58, -0.83, 1.46);
    rightThumb.rotation.set(-0.08, -0.38, 0.4);
    rightThumb.scale.set(0.62, 1.05, 0.28);
    thumbGroup.add(rightThumb);

    const leftNail = new THREE.Mesh(nailGeometry, nailMaterial);
    leftNail.position.set(-0.64, -0.52, 1.72);
    leftNail.rotation.set(-0.16, 0.42, -0.42);
    leftNail.scale.set(1, 0.62, 0.18);
    thumbGroup.add(leftNail);

    const rightNail = new THREE.Mesh(nailGeometry, nailMaterial);
    rightNail.position.set(0.64, -0.52, 1.72);
    rightNail.rotation.set(-0.16, -0.42, 0.42);
    rightNail.scale.set(1, 0.62, 0.18);
    thumbGroup.add(rightNail);

    const glowTexture = makeGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      color: 0xffffff,
      map: glowTexture,
      opacity: 0.9,
      transparent: true,
    });
    const shineOne = new THREE.Sprite(glowMaterial);
    shineOne.position.set(-0.54, 0.55, 1.94);
    shineOne.scale.set(0.52, 0.52, 0.52);
    scene.add(shineOne);
    const shineTwo = new THREE.Sprite(glowMaterial.clone());
    shineTwo.position.set(0.62, 0.88, 1.88);
    shineTwo.scale.set(0.4, 0.4, 0.4);
    scene.add(shineTwo);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(150 * 3);
    for (let index = 0; index < 150; index += 1) {
      const offset = index * 3;
      starPositions[offset] = (Math.random() - 0.5) * 16;
      starPositions[offset + 1] = (Math.random() - 0.5) * 10;
      starPositions[offset + 2] = -Math.random() * 12 - 1;
    }
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xd8edf3,
        size: 0.018,
        transparent: true,
        opacity: 0.42,
      }),
    );
    scene.add(stars);

    const rimLight = new THREE.DirectionalLight(0xe0f7ff, 3.4);
    rimLight.position.set(3, 4, 5);
    scene.add(rimLight);

    const keyLight = new THREE.PointLight(0xf9ffe9, 14, 10);
    keyLight.position.set(-3.5, 1.3, 3.4);
    scene.add(keyLight);

    const mintLight = new THREE.PointLight(0x9fffc7, 9, 8);
    mintLight.position.set(1.8, -1.3, 2.7);
    scene.add(mintLight);

    const fillLight = new THREE.HemisphereLight(0xd3f7ff, 0x2d1712, 1.55);
    scene.add(fillLight);

    const pointer = new THREE.Vector2(0, 0);
    const startTime = performance.now();
    let previousTime = startTime;
    let animationId = 0;
    let burstEnergy = 0;
    let squeeze = 0.2;

    function resize() {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const isMobile = width < 640;

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(0, isMobile ? 0.1 : 0.16, isMobile ? 9.8 : 8.1);
      camera.updateProjectionMatrix();
      root.scale.setScalar(isMobile ? 0.68 : 0.98);
      root.position.set(0, isMobile ? -0.03 : -0.12, 0);
    }

    function triggerBurst() {
      burstEnergy = 1;
      squeeze = 1;
      innerCore.scale.set(1.1, 0.86, 0.82);
      gelOpening.scale.set(1.28, 0.78, 0.22);

      fragments.forEach((fragment, index) => {
        const direction = fragment.home.clone().normalize();
        const swirl = new THREE.Vector3(
          Math.sin(index * 1.7) * 0.032,
          Math.cos(index * 1.2) * 0.026,
          0.025 + Math.sin(index) * 0.012,
        );
        fragment.velocity.copy(
          direction.multiplyScalar(0.055 + (index % 7) * 0.008).add(swirl),
        );
      });
    }

    function freeze() {
      burstEnergy = 0.42;
      squeeze = 0.7;
      innerMaterial.color.setHex(0xc7f8d7);
      gelMaterial.color.setHex(0xd1fae8);
      capsuleMaterial.opacity = 0.38;
    }

    function reset() {
      burstEnergy = 0;
      squeeze = 0.15;
      innerMaterial.color.setHex(0xb7f2c9);
      gelMaterial.color.setHex(0xc2f0dc);
      capsuleMaterial.opacity = 0.3;
      fragments.forEach((fragment) => {
        fragment.mesh.position.copy(fragment.home);
        fragment.velocity.set(0, 0, 0);
      });
      plates.forEach((plate) => {
        plate.mesh.position.copy(plate.home);
      });
    }

    function animate() {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      const delta = Math.min(0.033, (now - previousTime) / 1000);
      previousTime = now;

      root.rotation.y +=
        (pointer.x * 0.12 + Math.sin(elapsed * 0.35) * 0.08 - root.rotation.y) *
        0.035;
      root.rotation.x += (pointer.y * 0.08 - root.rotation.x) * 0.035;
      stars.rotation.y += 0.0006;

      const pulse = 1 + Math.sin(elapsed * 2.1) * 0.012;
      const targetCoreScale = new THREE.Vector3(
        pulse + squeeze * 0.07,
        pulse - squeeze * 0.08,
        0.9 - squeeze * 0.03,
      );
      innerCore.scale.lerp(targetCoreScale, 0.08);
      capsule.scale.lerp(
        new THREE.Vector3(1.03 + squeeze * 0.05, 0.98 - squeeze * 0.07, 0.92),
        0.07,
      );
      gelOpening.scale.lerp(
        new THREE.Vector3(1.12 + squeeze * 0.22, 0.58 + squeeze * 0.14, 0.18),
        0.08,
      );

      crackGroup.scale.setScalar(1 + burstEnergy * 0.035);
      crackGroup.rotation.z = Math.sin(elapsed * 0.7) * 0.015;

      leftThumb.position.x += (-0.48 - squeeze * 0.13 - leftThumb.position.x) * 0.08;
      rightThumb.position.x += (0.48 + squeeze * 0.13 - rightThumb.position.x) * 0.08;
      leftNail.position.x += (-0.54 - squeeze * 0.13 - leftNail.position.x) * 0.08;
      rightNail.position.x += (0.54 + squeeze * 0.13 - rightNail.position.x) * 0.08;
      thumbGroup.position.y = Math.sin(elapsed * 1.2) * 0.012;

      plates.forEach((plate, index) => {
        const lift = burstEnergy * (0.04 + (index % 5) * 0.01);
        const target = plate.home.clone().add(plate.normal.clone().multiplyScalar(lift));
        plate.mesh.position.lerp(target, 0.06);
        plate.mesh.rotation.z += burstEnergy * plate.spin.z;
      });

      fragments.forEach((fragment, index) => {
        if (burstEnergy > 0.02) {
          fragment.velocity.y -= 0.008 * delta;
          fragment.mesh.position.add(fragment.velocity);
          fragment.mesh.position.lerp(fragment.home, 0.004);
          fragment.velocity.multiplyScalar(0.988);
        } else {
          const orbit = 1 + Math.sin(elapsed * 1.35 + index) * 0.035;
          fragment.mesh.position.lerp(fragment.home.clone().multiplyScalar(orbit), 0.035);
        }

        fragment.mesh.rotation.x += fragment.spin.x + burstEnergy * 0.018;
        fragment.mesh.rotation.y += fragment.spin.y;
        fragment.mesh.rotation.z += fragment.spin.z;
      });

      shineOne.material.opacity = 0.76 + Math.sin(elapsed * 3.4) * 0.12;
      shineTwo.material.opacity = 0.66 + Math.cos(elapsed * 2.7) * 0.12;
      keyLight.position.x = Math.sin(elapsed * 0.62) * 2.4 - 0.8;
      mintLight.intensity = 8.2 + Math.sin(elapsed * 2.4) * 1.2 + burstEnergy * 2.6;
      squeeze += (0.16 - squeeze) * 0.018;
      burstEnergy *= 0.987;

      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
    }

    function handleCanvasClick() {
      triggerBurst();
      playCrispCrunch();
      setHits((current) => current + 1);
      setMode("파열");
    }

    resize();
    animate();
    handlesRef.current = { burst: triggerBurst, freeze, reset };

    window.addEventListener("resize", resize);
    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("click", handleCanvasClick);

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("click", handleCanvasClick);
      handlesRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      innerCore.geometry.dispose();
      innerMaterial.dispose();
      gelOpening.geometry.dispose();
      gelMaterial.dispose();
      capsule.geometry.dispose();
      capsuleMaterial.dispose();
      seam.geometry.dispose();
      seamMaterial.dispose();
      tabGeometry.dispose();
      tabMaterial.dispose();
      plateMaterials.forEach((material) => material.dispose());
      plates.forEach((plate) => plate.mesh.geometry.dispose());
      crackMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      });
      fragments.forEach((fragment) => {
        fragment.mesh.geometry.dispose();
        const material = fragment.mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      });
      thumbGeometry.dispose();
      nailGeometry.dispose();
      skinMaterial.dispose();
      nailMaterial.dispose();
      glowTexture.dispose();
      glowMaterial.dispose();
      if (!Array.isArray(shineTwo.material)) {
        shineTwo.material.dispose();
      }
      starGeometry.dispose();
    };
  }, [playCrispCrunch]);

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#101317] pt-16 max-sm:pt-24">
      <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />

      <div className="pointer-events-none absolute inset-x-0 top-16 z-10 mx-auto flex w-[min(1180px,calc(100%-32px))] items-start justify-between gap-5 py-8 max-md:flex-col max-sm:top-24 max-sm:py-6">
        <div className="pointer-events-auto max-w-[620px] max-sm:max-w-[280px]">
          <p className="mb-3 text-sm font-extrabold uppercase text-[#83d7e8]">
            WAX PPU BALL
          </p>
          <h1 className="text-5xl font-extrabold leading-none text-[#fff8ec] sm:text-7xl lg:text-8xl">
            HSJ.ver
          </h1>
        </div>

        <div className="pointer-events-auto fixed bottom-4 left-1/2 grid w-[min(300px,calc(100vw-32px))] -translate-x-1/2 gap-3 rounded-lg border border-white/12 bg-[#121821]/88 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-md sm:static sm:w-[340px] sm:translate-x-0 sm:bg-[#121821]/78">
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <StatusValue label="모드" value={mode} />
            <StatusValue label="파열" value={`${hits}`} />
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-2">
            <button
              className="min-h-11 min-w-0 rounded-md border border-white/12 bg-[#22303b] px-2 text-xs font-extrabold text-[#f7f2e8] transition hover:bg-[#2b3d49] sm:px-3 sm:text-sm"
              onClick={handleFreeze}
              type="button"
            >
              빙결
            </button>
            <button
              className="min-h-11 min-w-0 rounded-md bg-[#f0c96e] px-2 text-xs font-extrabold text-[#191611] transition hover:bg-[#ffe19a] sm:px-3 sm:text-sm"
              onClick={handleBurst}
              type="button"
            >
              파열
            </button>
            <button
              className="min-h-11 min-w-0 rounded-md border border-white/12 bg-[#22303b] px-2 text-xs font-extrabold text-[#f7f2e8] transition hover:bg-[#2b3d49] sm:px-3 sm:text-sm"
              onClick={handleReset}
              type="button"
            >
              재생성
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.06] p-3">
      <div className="text-xs font-extrabold text-[#9fb3bd]">{label}</div>
      <div className="mt-1 break-words text-xl font-extrabold text-[#fff8ec]">
        {value}
      </div>
    </div>
  );
}
