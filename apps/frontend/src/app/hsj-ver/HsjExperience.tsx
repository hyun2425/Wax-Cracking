"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type FragmentBody = {
  home: THREE.Vector3;
  mesh: THREE.Mesh;
  spin: THREE.Vector3;
  velocity: THREE.Vector3;
};

type SceneHandles = {
  burst: () => void;
  freeze: () => void;
  reset: () => void;
};

const fragmentColors = [0xf5e2b8, 0x9bd66a, 0x8ac7e8, 0xd7a948, 0xf08aa9];

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
    masterGain.gain.exponentialRampToValueAtTime(0.35, now + 0.012);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    masterGain.connect(audioContext.destination);

    const highPass = audioContext.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.setValueAtTime(1400, now);
    highPass.Q.setValueAtTime(0.72, now);
    highPass.connect(masterGain);

    const crackleTimes = [0, 0.018, 0.042, 0.071, 0.105, 0.148, 0.205, 0.292];

    crackleTimes.forEach((delay, index) => {
      const duration = 0.04 + (index % 3) * 0.018;
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
      bandPass.frequency.setValueAtTime(2600 + index * 420, now + delay);
      bandPass.Q.setValueAtTime(3.2, now + delay);
      grainGain.gain.setValueAtTime(0.0001, now + delay);
      grainGain.gain.exponentialRampToValueAtTime(
        0.22 + index * 0.018,
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

    [0.035, 0.13, 0.24].forEach((delay, index) => {
      const oscillator = audioContext.createOscillator();
      const clickGain = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(1800 + index * 520, now + delay);
      clickGain.gain.setValueAtTime(0.0001, now + delay);
      clickGain.gain.exponentialRampToValueAtTime(0.09, now + delay + 0.004);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.055);
      oscillator.connect(clickGain);
      clickGain.connect(highPass);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 0.06);
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
    scene.fog = new THREE.Fog(0x0f1217, 7, 18);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 0.3, 8.4);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x0f1217, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.width = "100%";
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.85,
      clearcoatRoughness: 0.22,
      color: 0x8fd0e8,
      metalness: 0.08,
      roughness: 0.35,
      transmission: 0.08,
    });
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.58, 8),
      coreMaterial,
    );
    core.castShadow = true;
    root.add(core);

    const innerGlow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.38, 4),
      new THREE.MeshBasicMaterial({
        color: 0xf7d47e,
        transparent: true,
        opacity: 0.2,
      }),
    );
    root.add(innerGlow);

    const crackGroup = new THREE.Group();
    root.add(crackGroup);
    const crackMaterial = new THREE.LineBasicMaterial({
      color: 0xfff2c7,
      transparent: true,
      opacity: 0.76,
    });

    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const radius = 1.63;
      const start = new THREE.Vector3(
        Math.cos(angle) * 0.14,
        Math.sin(angle * 1.7) * 0.18,
        radius,
      );
      const mid = new THREE.Vector3(
        Math.cos(angle) * 0.55,
        Math.sin(angle * 1.35) * 0.48,
        radius - 0.08,
      );
      const end = new THREE.Vector3(
        Math.cos(angle) * (1.04 + (index % 3) * 0.12),
        Math.sin(angle) * (0.78 + (index % 4) * 0.08),
        radius - 0.18,
      );
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, mid, end]),
        crackMaterial,
      );
      line.rotation.x = -0.3 + (index % 5) * 0.12;
      line.rotation.y = -0.45 + (index % 7) * 0.12;
      crackGroup.add(line);
    }

    const fragments: FragmentBody[] = [];
    const fragmentGeometry = new THREE.TetrahedronGeometry(0.16, 0);

    for (let index = 0; index < 46; index += 1) {
      const phi = Math.acos(1 - 2 * ((index + 0.5) / 46));
      const theta = index * 2.399963229728653;
      const home = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi) * 1.9,
        Math.sin(theta) * Math.sin(phi) * 1.9,
        Math.cos(phi) * 1.9,
      );
      const material = new THREE.MeshStandardMaterial({
        color: fragmentColors[index % fragmentColors.length],
        metalness: 0.05,
        roughness: 0.48,
      });
      const mesh = new THREE.Mesh(fragmentGeometry, material);
      mesh.position.copy(home);
      mesh.rotation.set(index * 0.41, index * 0.29, index * 0.17);
      mesh.scale.setScalar(0.65 + (index % 5) * 0.11);
      root.add(mesh);
      fragments.push({
        home,
        mesh,
        spin: new THREE.Vector3(
          0.015 + (index % 4) * 0.006,
          0.01 + (index % 5) * 0.005,
          0.013 + (index % 6) * 0.004,
        ),
        velocity: new THREE.Vector3(),
      });
    }

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(360 * 3);
    for (let index = 0; index < 360; index += 1) {
      const offset = index * 3;
      starPositions[offset] = (Math.random() - 0.5) * 18;
      starPositions[offset + 1] = (Math.random() - 0.5) * 12;
      starPositions[offset + 2] = -Math.random() * 14 - 1;
    }
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xd8edf3,
        size: 0.025,
        transparent: true,
        opacity: 0.62,
      }),
    );
    scene.add(stars);

    const rimLight = new THREE.DirectionalLight(0xd9f8ff, 3.1);
    rimLight.position.set(3, 4, 5);
    scene.add(rimLight);

    const goldLight = new THREE.PointLight(0xf4c46d, 13, 12);
    goldLight.position.set(-3.5, -1.4, 3);
    scene.add(goldLight);

    const fillLight = new THREE.HemisphereLight(0xb8eaff, 0x2a1f13, 1.7);
    scene.add(fillLight);

    const pointer = new THREE.Vector2(0, 0);
    const startTime = performance.now();
    let previousTime = startTime;
    let animationId = 0;
    let burstEnergy = 0;

    function resize() {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const isMobile = width < 640;

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(0, isMobile ? 0.05 : 0.22, isMobile ? 10.6 : 8.9);
      camera.updateProjectionMatrix();
      root.scale.setScalar(isMobile ? 0.72 : 0.96);
      root.position.set(0, isMobile ? -0.08 : 0.02, 0);
    }

    function triggerBurst() {
      burstEnergy = 1;
      core.scale.setScalar(0.86);
      innerGlow.scale.setScalar(1.2);

      fragments.forEach((fragment, index) => {
        const direction = fragment.home.clone().normalize();
        const swirl = new THREE.Vector3(
          Math.sin(index * 1.7) * 0.025,
          Math.cos(index * 1.2) * 0.03,
          Math.sin(index * 0.6) * 0.02,
        );
        fragment.velocity.copy(direction.multiplyScalar(0.065 + (index % 7) * 0.009).add(swirl));
      });
    }

    function freeze() {
      burstEnergy = 0.36;
      coreMaterial.color.setHex(0x9ad8ed);
      crackMaterial.opacity = 0.92;
    }

    function reset() {
      burstEnergy = 0;
      core.scale.setScalar(1);
      innerGlow.scale.setScalar(1);
      coreMaterial.color.setHex(0x8fd0e8);
      crackMaterial.opacity = 0.76;
      fragments.forEach((fragment) => {
        fragment.mesh.position.copy(fragment.home);
        fragment.velocity.set(0, 0, 0);
      });
    }

    function animate() {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      const delta = Math.min(0.033, (now - previousTime) / 1000);
      previousTime = now;

      root.rotation.y += 0.006 + burstEnergy * 0.004;
      root.rotation.x += (pointer.y * 0.18 - root.rotation.x) * 0.035;
      root.rotation.z += (pointer.x * 0.12 - root.rotation.z) * 0.025;
      stars.rotation.y += 0.0009;

      const pulse = 1 + Math.sin(elapsed * 2.2) * 0.018;
      core.scale.lerp(
        new THREE.Vector3(pulse, pulse, pulse).multiplyScalar(1 - burstEnergy * 0.05),
        0.06,
      );
      innerGlow.rotation.y -= 0.01;
      innerGlow.material.opacity = 0.13 + Math.sin(elapsed * 3.1) * 0.05 + burstEnergy * 0.08;
      crackGroup.scale.setScalar(1 + burstEnergy * 0.045);
      crackGroup.rotation.z -= 0.003;

      fragments.forEach((fragment, index) => {
        if (burstEnergy > 0.02) {
          fragment.velocity.y -= 0.012 * delta;
          fragment.mesh.position.add(fragment.velocity);
          fragment.mesh.position.lerp(fragment.home, 0.006);
          fragment.velocity.multiplyScalar(0.987);
        } else {
          const orbit = 1 + Math.sin(elapsed * 1.5 + index) * 0.045;
          fragment.mesh.position.lerp(fragment.home.clone().multiplyScalar(orbit), 0.04);
        }

        fragment.mesh.rotation.x += fragment.spin.x + burstEnergy * 0.02;
        fragment.mesh.rotation.y += fragment.spin.y;
        fragment.mesh.rotation.z += fragment.spin.z;
      });

      goldLight.position.x = Math.sin(elapsed * 0.8) * 3.4;
      goldLight.position.y = Math.cos(elapsed * 0.7) * 1.4 - 1.1;
      burstEnergy *= 0.986;

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
      core.geometry.dispose();
      coreMaterial.dispose();
      innerGlow.geometry.dispose();
      innerGlow.material.dispose();
      crackMaterial.dispose();
      fragmentGeometry.dispose();
      fragments.forEach((fragment) => {
        const material = fragment.mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      });
      starGeometry.dispose();
    };
  }, [playCrispCrunch]);

  return (
    <section className="relative min-h-[100svh] overflow-hidden pt-16 max-sm:pt-24">
      <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />

      <div className="pointer-events-none absolute inset-x-0 top-16 z-10 mx-auto flex w-[min(1180px,calc(100%-32px))] items-start justify-between gap-5 py-8 max-md:flex-col max-sm:top-24 max-sm:py-6">
        <div className="pointer-events-auto max-w-[620px] max-sm:max-w-[260px]">
          <p className="mb-3 text-sm font-extrabold uppercase text-[#7ec9df]">
            Three.js Stage
          </p>
          <h1 className="text-5xl font-extrabold leading-none text-[#fff8ec] sm:text-7xl lg:text-8xl">
            HSJ.ver
          </h1>
        </div>

        <div className="pointer-events-auto fixed bottom-4 left-1/2 grid w-[min(280px,calc(100vw-32px))] -translate-x-1/2 gap-3 rounded-lg border border-white/12 bg-[#121821]/88 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-md sm:static sm:w-[340px] sm:translate-x-0 sm:bg-[#121821]/78">
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
      <div className="mt-1 text-xl font-extrabold text-[#fff8ec]">{value}</div>
    </div>
  );
}
