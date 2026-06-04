"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type RapierModule = typeof import("@dimforge/rapier3d-compat");
type RigidBody = import("@dimforge/rapier3d-compat").RigidBody;

type PhysicsShard = {
  body: RigidBody;
  home: THREE.Vector3;
  mesh: THREE.Mesh;
  size: THREE.Vector3;
};

type SceneHandles = {
  burst: () => void;
  reset: () => void;
  squeeze: () => void;
};

const shardColors = [0x4b261d, 0x683121, 0xbdf4ca, 0xcce6fb, 0xf7f5eb];

function seed(index: number) {
  return Math.abs(Math.sin(index * 71.34 + 9.17) * 13758.37 % 1);
}

function makeShardGeometry(index: number) {
  const sides = 4 + (index % 3);
  const radius = 0.18 + seed(index * 3) * 0.14;
  const vertices: number[] = [0, 0, 0.025];
  const indices: number[] = [];

  for (let side = 0; side < sides; side += 1) {
    const angle = (side / sides) * Math.PI * 2 + seed(index * 11 + side) * 0.36;
    const pointRadius = radius * (0.74 + seed(index * 13 + side) * 0.46);
    vertices.push(
      Math.cos(angle) * pointRadius,
      Math.sin(angle) * pointRadius * (0.68 + seed(index + side) * 0.28),
      0.025,
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

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(64, 64, 1, 64, 64, 60);
    gradient.addColorStop(0, "rgba(255,255,246,1)");
    gradient.addColorStop(0.22, "rgba(234,255,214,0.9)");
    gradient.addColorStop(0.72, "rgba(139,236,197,0.28)");
    gradient.addColorStop(1, "rgba(139,236,197,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCrackLine(points: Array<[number, number]>, color: number) {
  const radius = 1.58;
  const projected = points.map(([x, y]) => {
    const z = Math.sqrt(Math.max(0.01, radius * radius - x * x - y * y));
    return new THREE.Vector3(x, y, z);
  });
  const curve = new THREE.CatmullRomCurve3(projected);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.012, 6, false),
    new THREE.MeshBasicMaterial({
      color,
      opacity: 0.9,
      transparent: true,
    }),
  );
}

export default function HsjVer2RapierExperience() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const [mode, setMode] = useState("대기");
  const [bursts, setBursts] = useState(0);
  const [rapierReady, setRapierReady] = useState(false);

  const playPop = useCallback(() => {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    gain.connect(audioContext.destination);

    const noiseBuffer = audioContext.createBuffer(
      1,
      Math.floor(audioContext.sampleRate * 0.28),
      audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const fade = 1 - index / data.length;
      data[index] = (Math.random() * 2 - 1) * fade * fade;
    }

    const noise = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    noise.buffer = noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(1.8, now);
    noise.connect(filter);
    filter.connect(gain);
    noise.start(now);
    noise.stop(now + 0.28);

    [0, 0.055, 0.12].forEach((delay, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(520 + index * 310, now + delay);
      oscillator.connect(gain);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 0.055);
    });

    window.setTimeout(() => {
      void audioContext.close();
    }, 550);
  }, []);

  const handleBurst = useCallback(() => {
    handlesRef.current?.burst();
    playPop();
    setMode("물리 파열");
    setBursts((current) => current + 1);
  }, [playPop]);

  const handleSqueeze = useCallback(() => {
    handlesRef.current?.squeeze();
    setMode("압착");
  }, []);

  const handleReset = useCallback(() => {
    handlesRef.current?.reset();
    setMode("대기");
    setBursts(0);
  }, []);

  useEffect(() => {
    const currentMount = mountRef.current;

    if (!currentMount) {
      return;
    }

    const mount: HTMLDivElement = currentMount;

    let disposed = false;
    let animationId = 0;
    let world: InstanceType<RapierModule["World"]> | null = null;
    let RAPIER: RapierModule | null = null;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x111416, 8, 18);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    camera.position.set(0, 0.25, 8.4);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x111416, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.width = "100%";
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    const ballGroup = new THREE.Group();
    const thumbGroup = new THREE.Group();
    scene.add(root);
    root.add(ballGroup, thumbGroup);

    const innerMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.75,
      clearcoatRoughness: 0.14,
      color: 0xbef7cf,
      emissive: 0x163225,
      emissiveIntensity: 0.14,
      roughness: 0.24,
      transmission: 0.1,
    });
    const innerBall = new THREE.Mesh(
      new THREE.SphereGeometry(1.38, 64, 42),
      innerMaterial,
    );
    innerBall.scale.set(1.04, 0.98, 0.9);
    ballGroup.add(innerBall);

    const shellMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      color: 0xdff4ff,
      ior: 1.45,
      opacity: 0.28,
      roughness: 0.04,
      transparent: true,
      transmission: 0.65,
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.62, 72, 48), shellMaterial);
    shell.scale.set(1.05, 0.98, 0.92);
    ballGroup.add(shell);

    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.014, 8, 96),
      new THREE.MeshBasicMaterial({
        color: 0xf4fbff,
        opacity: 0.45,
        transparent: true,
      }),
    );
    seam.rotation.x = 0.08;
    ballGroup.add(seam);

    const cracks = [
      makeCrackLine(
        [
          [-1.02, 0.42],
          [-0.68, 0.19],
          [-0.2, 0.04],
          [0.32, -0.26],
          [0.86, -0.54],
        ],
        0x9df0bf,
      ),
      makeCrackLine(
        [
          [-0.34, 0.98],
          [-0.2, 0.54],
          [0.05, 0.1],
          [0.18, -0.46],
        ],
        0x78bfff,
      ),
      makeCrackLine(
        [
          [-0.88, -0.56],
          [-0.48, -0.38],
          [0.02, -0.36],
          [0.42, -0.1],
        ],
        0xbaf8d0,
      ),
    ];
    cracks.forEach((crack) => ballGroup.add(crack));

    const skinMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.18,
      color: 0xf0ba91,
      roughness: 0.64,
    });
    const nailMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.82,
      color: 0xf5cbd7,
      roughness: 0.18,
    });
    const thumbGeometry = new THREE.SphereGeometry(0.52, 32, 20);
    const nailGeometry = new THREE.SphereGeometry(0.22, 24, 12);

    const leftThumb = new THREE.Mesh(thumbGeometry, skinMaterial);
    leftThumb.position.set(-0.6, -0.88, 1.42);
    leftThumb.rotation.set(-0.08, 0.38, -0.4);
    leftThumb.scale.set(0.62, 1.06, 0.28);
    thumbGroup.add(leftThumb);

    const rightThumb = new THREE.Mesh(thumbGeometry, skinMaterial);
    rightThumb.position.set(0.6, -0.88, 1.42);
    rightThumb.rotation.set(-0.08, -0.38, 0.4);
    rightThumb.scale.set(0.62, 1.06, 0.28);
    thumbGroup.add(rightThumb);

    const leftNail = new THREE.Mesh(nailGeometry, nailMaterial);
    leftNail.position.set(-0.66, -0.57, 1.68);
    leftNail.rotation.set(-0.16, 0.42, -0.42);
    leftNail.scale.set(1, 0.62, 0.18);
    thumbGroup.add(leftNail);

    const rightNail = new THREE.Mesh(nailGeometry, nailMaterial);
    rightNail.position.set(0.66, -0.57, 1.68);
    rightNail.rotation.set(-0.16, -0.42, 0.42);
    rightNail.scale.set(1, 0.62, 0.18);
    thumbGroup.add(rightNail);

    const glowTexture = makeGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      opacity: 0.88,
      transparent: true,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.set(0.62, 0.74, 1.82);
    glow.scale.set(0.54, 0.54, 0.54);
    scene.add(glow);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.15, 64),
      new THREE.MeshBasicMaterial({
        color: 0x0d1013,
        opacity: 0.35,
        transparent: true,
      }),
    );
    floor.position.set(0, -2.28, 0);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(170 * 3);
    for (let index = 0; index < 170; index += 1) {
      const offset = index * 3;
      starPositions[offset] = (Math.random() - 0.5) * 16;
      starPositions[offset + 1] = (Math.random() - 0.5) * 10;
      starPositions[offset + 2] = -Math.random() * 12 - 1;
    }
    starsGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const stars = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({
        color: 0xd8edf3,
        opacity: 0.42,
        size: 0.018,
        transparent: true,
      }),
    );
    scene.add(stars);

    const keyLight = new THREE.DirectionalLight(0xe9f9ff, 3.5);
    keyLight.position.set(3.5, 4.2, 4);
    scene.add(keyLight);

    const mintLight = new THREE.PointLight(0x9fffc7, 10, 9);
    mintLight.position.set(-1.8, 0.3, 3.2);
    scene.add(mintLight);

    const fillLight = new THREE.HemisphereLight(0xd7f5ff, 0x2d1712, 1.5);
    scene.add(fillLight);

    const shards: PhysicsShard[] = [];
    const pointer = new THREE.Vector2();
    const startTime = performance.now();
    let previousTime = startTime;
    let squeeze = 0.16;
    let burstEnergy = 0;

    function resize() {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const isMobile = width < 640;

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(0, isMobile ? 0.26 : 0.2, isMobile ? 9.7 : 8.2);
      camera.updateProjectionMatrix();
      root.scale.setScalar(isMobile ? 0.7 : 1);
      root.position.set(0, isMobile ? -0.04 : -0.1, 0);
    }

    function syncMeshToBody(shard: PhysicsShard) {
      const translation = shard.body.translation();
      const rotation = shard.body.rotation();
      shard.mesh.position.set(translation.x, translation.y, translation.z);
      shard.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }

    function resetPhysics() {
      if (!RAPIER) {
        return;
      }

      burstEnergy = 0;
      squeeze = 0.16;
      shards.forEach((shard, index) => {
        shard.body.setTranslation(shard.home, true);
        shard.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        shard.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        shard.body.setRotation(
          {
            w: Math.cos(index * 0.04),
            x: 0,
            y: 0,
            z: Math.sin(index * 0.04),
          },
          true,
        );
        shard.body.sleep();
        syncMeshToBody(shard);
      });
    }

    function burstPhysics() {
      if (!RAPIER) {
        return;
      }

      burstEnergy = 1;
      squeeze = 1;
      shards.forEach((shard, index) => {
        shard.body.wakeUp();
        const direction = shard.home.clone().normalize();
        const impulse = {
          x: direction.x * (2.4 + seed(index) * 1.8),
          y: direction.y * (1.3 + seed(index * 2) * 1.4) + 1.2,
          z: 1.6 + seed(index * 3) * 1.8,
        };
        shard.body.applyImpulse(impulse, true);
        shard.body.applyTorqueImpulse(
          {
            x: (seed(index * 5) - 0.5) * 1.4,
            y: (seed(index * 7) - 0.5) * 1.4,
            z: (seed(index * 9) - 0.5) * 1.8,
          },
          true,
        );
      });
    }

    async function setupPhysics() {
      const rapier = await import("@dimforge/rapier3d-compat");
      await rapier.init();

      if (disposed) {
        return;
      }

      RAPIER = rapier;
      world = new rapier.World({ x: 0, y: -4.8, z: 0 });
      world.timestep = 1 / 60;

      const ballBody = world.createRigidBody(
        rapier.RigidBodyDesc.fixed().setTranslation(0, -0.04, 0.18),
      );
      world.createCollider(
        rapier.ColliderDesc.ball(1.34).setRestitution(0.38).setFriction(0.85),
        ballBody,
      );

      const floorBody = world.createRigidBody(
        rapier.RigidBodyDesc.fixed().setTranslation(0, -2.22, 0),
      );
      world.createCollider(
        rapier.ColliderDesc.cuboid(4.8, 0.08, 4.8).setRestitution(0.35).setFriction(0.8),
        floorBody,
      );

      for (let index = 0; index < 46; index += 1) {
        const angle = (index / 46) * Math.PI * 2 + seed(index) * 0.28;
        const ring = index % 4;
        const radius = 1.5 + ring * 0.13 + seed(index * 3) * 0.12;
        const y = Math.sin(angle * 1.6 + ring) * 0.88 + (ring - 1.5) * 0.18;
        const home = new THREE.Vector3(
          Math.cos(angle) * radius,
          y,
          1.2 + seed(index * 7) * 0.34,
        );
        const size = new THREE.Vector3(
          0.2 + seed(index * 11) * 0.14,
          0.14 + seed(index * 13) * 0.1,
          0.035,
        );
        const material = new THREE.MeshPhysicalMaterial({
          clearcoat: 0.72,
          color: shardColors[index % shardColors.length],
          metalness: 0.02,
          roughness: 0.24,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(makeShardGeometry(index), material);
        mesh.position.copy(home);
        mesh.rotation.set(seed(index) * Math.PI, seed(index * 2) * Math.PI, angle);
        mesh.scale.setScalar(0.9 + seed(index * 17) * 0.45);
        root.add(mesh);

        const body = world.createRigidBody(
          rapier.RigidBodyDesc.dynamic()
            .setTranslation(home.x, home.y, home.z)
            .setRotation({
              w: Math.cos(angle / 2),
              x: 0,
              y: 0,
              z: Math.sin(angle / 2),
            })
            .setLinearDamping(0.55)
            .setAngularDamping(0.36),
        );
        world.createCollider(
          rapier.ColliderDesc.cuboid(size.x, size.y, size.z)
            .setDensity(0.55)
            .setFriction(0.72)
            .setRestitution(0.64),
          body,
        );

        shards.push({ body, home, mesh, size });
      }

      resetPhysics();
      handlesRef.current = {
        burst: burstPhysics,
        reset: resetPhysics,
        squeeze: () => {
          squeeze = 0.88;
          burstEnergy = Math.max(burstEnergy, 0.36);
        },
      };
      setRapierReady(true);
    }

    function animate() {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      const delta = Math.min(0.033, (now - previousTime) / 1000);
      previousTime = now;

      if (world) {
        world.timestep = delta;
        world.step();
        shards.forEach(syncMeshToBody);
      }

      root.rotation.y +=
        (pointer.x * 0.13 + Math.sin(elapsed * 0.36) * 0.07 - root.rotation.y) *
        0.035;
      root.rotation.x += (pointer.y * 0.08 - root.rotation.x) * 0.035;
      stars.rotation.y += 0.0005;

      innerBall.scale.lerp(
        new THREE.Vector3(1.04 + squeeze * 0.06, 0.98 - squeeze * 0.07, 0.9),
        0.08,
      );
      shell.scale.lerp(
        new THREE.Vector3(1.05 + squeeze * 0.05, 0.98 - squeeze * 0.06, 0.92),
        0.08,
      );
      cracks.forEach((crack, index) => {
        crack.scale.setScalar(1 + squeeze * 0.02 + burstEnergy * (0.03 + index * 0.01));
      });

      leftThumb.position.x += (-0.52 - squeeze * 0.14 - leftThumb.position.x) * 0.08;
      rightThumb.position.x += (0.52 + squeeze * 0.14 - rightThumb.position.x) * 0.08;
      leftNail.position.x += (-0.58 - squeeze * 0.14 - leftNail.position.x) * 0.08;
      rightNail.position.x += (0.58 + squeeze * 0.14 - rightNail.position.x) * 0.08;
      glow.material.opacity = 0.7 + Math.sin(elapsed * 3.2) * 0.12 + burstEnergy * 0.1;
      mintLight.intensity = 9 + Math.sin(elapsed * 2.2) * 1.2 + burstEnergy * 3;

      squeeze += (0.16 - squeeze) * 0.022;
      burstEnergy *= 0.988;

      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
    }

    function handleCanvasClick() {
      burstPhysics();
      playPop();
      setMode("물리 파열");
      setBursts((current) => current + 1);
    }

    resize();
    animate();
    void setupPhysics();

    window.addEventListener("resize", resize);
    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("click", handleCanvasClick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("click", handleCanvasClick);
      handlesRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      innerBall.geometry.dispose();
      innerMaterial.dispose();
      shell.geometry.dispose();
      shellMaterial.dispose();
      seam.geometry.dispose();
      if (Array.isArray(seam.material)) {
        seam.material.forEach((material) => material.dispose());
      } else {
        seam.material.dispose();
      }
      cracks.forEach((crack) => {
        crack.geometry.dispose();
        if (Array.isArray(crack.material)) {
          crack.material.forEach((material) => material.dispose());
        } else {
          crack.material.dispose();
        }
      });
      thumbGeometry.dispose();
      nailGeometry.dispose();
      skinMaterial.dispose();
      nailMaterial.dispose();
      glowTexture.dispose();
      glowMaterial.dispose();
      floor.geometry.dispose();
      if (Array.isArray(floor.material)) {
        floor.material.forEach((material) => material.dispose());
      } else {
        floor.material.dispose();
      }
      starsGeometry.dispose();
      shards.forEach((shard) => {
        shard.mesh.geometry.dispose();
        if (Array.isArray(shard.mesh.material)) {
          shard.mesh.material.forEach((material) => material.dispose());
        } else {
          shard.mesh.material.dispose();
        }
      });
      world?.free();
    };
  }, [playPop]);

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#111416] pt-16 max-sm:pt-24">
      <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />

      <div className="pointer-events-none absolute inset-x-0 top-16 z-10 mx-auto flex w-[min(1180px,calc(100%-32px))] items-start justify-between gap-5 py-8 max-md:flex-col max-sm:top-24 max-sm:py-6">
        <div className="pointer-events-auto max-w-[640px] max-sm:max-w-[300px]">
          <p className="mb-3 text-sm font-extrabold uppercase text-[#8ee6d1]">
            RAPIER PHYSICS
          </p>
          <h1 className="text-5xl font-extrabold leading-none text-[#fff8ec] sm:text-7xl lg:text-8xl">
            njjey.ver
          </h1>
        </div>

        <div className="pointer-events-auto fixed bottom-4 left-1/2 grid w-[min(320px,calc(100vw-32px))] -translate-x-1/2 gap-3 rounded-lg border border-white/12 bg-[#121821]/88 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-md sm:static sm:w-[370px] sm:translate-x-0 sm:bg-[#121821]/78">
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <StatusValue label="엔진" value={rapierReady ? "Rapier" : "로딩"} />
            <StatusValue label="파열" value={`${bursts}`} />
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-2">
            <button
              className="min-h-11 min-w-0 rounded-md border border-white/12 bg-[#22303b] px-2 text-xs font-extrabold text-[#f7f2e8] transition hover:bg-[#2b3d49] disabled:opacity-60 sm:px-3 sm:text-sm"
              disabled={!rapierReady}
              onClick={handleSqueeze}
              type="button"
            >
              압착
            </button>
            <button
              className="min-h-11 min-w-0 rounded-md bg-[#f0c96e] px-2 text-xs font-extrabold text-[#191611] transition hover:bg-[#ffe19a] disabled:opacity-60 sm:px-3 sm:text-sm"
              disabled={!rapierReady}
              onClick={handleBurst}
              type="button"
            >
              파열
            </button>
            <button
              className="min-h-11 min-w-0 rounded-md border border-white/12 bg-[#22303b] px-2 text-xs font-extrabold text-[#f7f2e8] transition hover:bg-[#2b3d49] disabled:opacity-60 sm:px-3 sm:text-sm"
              disabled={!rapierReady}
              onClick={handleReset}
              type="button"
            >
              리셋
            </button>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-[#b9c9cf]">
            현재 상태: <span className="text-[#fff8ec]">{mode}</span>
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
