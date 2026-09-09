import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import earthMap from "@/assets/earth-map.jpg";
import { useCyclone } from "@/state/cyclone-store";
import type { Cyclone } from "@/types/cyclone";

const R = 1;

function toVec(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function spiralTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, size / 2);
  glow.addColorStop(0, "rgba(255,255,255,0.0)");
  glow.addColorStop(0.12, "rgba(255,236,214,0.55)");
  glow.addColorStop(0.55, "rgba(226,168,110,0.30)");
  glow.addColorStop(1, "rgba(180,110,60,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  for (let arm = 0; arm < 5; arm++) {
    ctx.beginPath();
    for (let t = 0; t < 220; t++) {
      const a = arm * ((Math.PI * 2) / 5) + t * 0.035;
      const r = 14 + t * 0.95;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(255,245,232,0.42)";
    ctx.lineCap = "round";
    ctx.stroke();
  }
  // eye
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(60,36,22,0.85)";
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function Vortex({ lat, lon, intensity }: { lat: number; lon: number; intensity: number }) {
  const tex = useMemo(() => spiralTexture(), []);
  const ref = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => toVec(lat, lon, R + 0.012), [lat, lon]);
  const size = 0.14 + (intensity / 260) * 0.16;

  useFrame((_, dt) => {
    if (inner.current) inner.current.rotation.z -= dt * 0.55;
    if (ref.current) {
      const s = 1 + Math.sin(performance.now() / 700) * 0.03;
      ref.current.scale.setScalar(s);
    }
  });

  return (
    <group position={pos} onUpdate={(self) => self.lookAt(0, 0, 0)}>
      <group ref={ref}>
        <mesh ref={inner} rotation={[Math.PI, 0, 0]}>
          <planeGeometry args={[size * 2, size * 2]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.95} />
        </mesh>
        <mesh position={[0, 0, -0.001]}>
          <circleGeometry args={[size * 1.35, 48]} />
          <meshBasicMaterial color="#e2a86e" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function TangentCircle({
  lat,
  lon,
  radiusKm,
  color,
  opacity,
}: {
  lat: number;
  lon: number;
  radiusKm: number;
  color: string;
  opacity: number;
}) {
  const pos = useMemo(() => toVec(lat, lon, R + 0.004), [lat, lon]);
  const r = Math.max(0.01, radiusKm / 6371);
  return (
    <group position={pos} onUpdate={(self) => self.lookAt(0, 0, 0)}>
      <mesh>
        <circleGeometry args={[r, 48]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Earth() {
  const texture = useLoader(THREE.TextureLoader, earthMap);
  return (
    <>
      <mesh>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={0.95} metalness={0} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R + 0.0015, 36, 36]} />
        <meshBasicMaterial color="#7a5535" wireframe transparent opacity={0.07} />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[R, 48, 48]} />
        <meshBasicMaterial color="#d9b487" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

function Scene({ cyclone }: { cyclone: Cyclone }) {
  const { layers, prediction, focusHour, setFocusHour, cameraNonce, compareId } = useCyclone();
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const [auto, setAuto] = useState(true);
  const { camera } = useThree();
  const target = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    const lat = cyclone.lat !== 0 || cyclone.lon !== 0 ? cyclone.lat : 15.0;
    const lon = cyclone.lat !== 0 || cyclone.lon !== 0 ? cyclone.lon : 75.0;
    target.current = toVec(lat, lon, 2.7);
  }, [cyclone.lat, cyclone.lon, cameraNonce]);

  useFrame(() => {
    if (target.current) {
      camera.position.lerp(target.current, 0.06);
      camera.lookAt(0, 0, 0);
      if (camera.position.distanceTo(target.current) < 0.02) target.current = null;
    }
  });

  const revealed = prediction.status === "idle" ? cyclone.forecast : cyclone.forecast.filter((f) => prediction.revealedHours.includes(f.hour));
  const visibleForecast = layers.prediction ? revealed : [];

  const histPoints = useMemo(
    () => cyclone.track.map((p) => toVec(p.lat, p.lon, R + 0.008).toArray() as [number, number, number]),
    [cyclone],
  );
  const forecastLine = useMemo(() => {
    const pts = [toVec(cyclone.lat, cyclone.lon, R + 0.008), ...visibleForecast.map((f) => toVec(f.lat, f.lon, R + 0.008))];
    return pts.map((p) => p.toArray() as [number, number, number]);
  }, [cyclone, visibleForecast]);

  const compare = compareId ? cyclone.historical.find((h) => h.id === compareId) : null;

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 2, 4]} intensity={1.2} />
      <Earth />

      {layers.history && histPoints.length > 1 ? (
        <Line points={histPoints} color="#4a3020" lineWidth={1.6} />
      ) : null}

      {forecastLine.length > 1 ? (
        <Line points={forecastLine} color="#c2703c" lineWidth={1.8} dashed dashSize={0.02} gapSize={0.015} />
      ) : null}

      {layers.corridor
        ? visibleForecast.map((f) => (
            <TangentCircle key={`c-${f.hour}`} lat={f.lat} lon={f.lon} radiusKm={f.confidenceRadiusKm} color="#c2703c" opacity={0.13} />
          ))
        : null}

      {layers.risk ? (
        <TangentCircle
          lat={cyclone.forecast[cyclone.forecast.length - 1]?.lat ?? cyclone.lat}
          lon={cyclone.forecast[cyclone.forecast.length - 1]?.lon ?? cyclone.lon}
          radiusKm={cyclone.risk.score * 6}
          color={cyclone.risk.level === "LOW" ? "#7d8b5f" : "#b23a2a"}
          opacity={0.16}
        />
      ) : null}

      {compare ? (
        <Line
          points={compare.track.map((p) => toVec(p.lat, p.lon, R + 0.01).toArray() as [number, number, number])}
          color="#8a6a4a"
          lineWidth={1.4}
          dashed
          dashSize={0.03}
          gapSize={0.02}
        />
      ) : null}

      {visibleForecast.map((f) => (
        <group key={f.hour} position={toVec(f.lat, f.lon, R + 0.014)}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              setFocusHour(focusHour === f.hour ? null : f.hour);
            }}
          >
            <sphereGeometry args={[0.012, 16, 16]} />
            <meshBasicMaterial color={focusHour === f.hour ? "#b23a2a" : "#3b2a1e"} />
          </mesh>
          <Html center distanceFactor={3.2} zIndexRange={[10, 0]}>
            <div
              onClick={() => setFocusHour(focusHour === f.hour ? null : f.hour)}
              className="pointer-events-auto -translate-y-6 cursor-pointer select-none whitespace-nowrap rounded-full border border-border bg-card/90 px-2 py-0.5 font-display text-[9px] uppercase tracking-[0.14em] text-foreground"
            >
              +{f.hour}H
            </div>
            {focusHour === f.hour ? (
              <div className="pointer-events-none mt-1 w-40 -translate-x-0 rounded-lg border border-border bg-card/95 p-2 text-left">
                <p className="font-display text-[10px] uppercase tracking-[0.14em]">+{f.hour} hours</p>
                <p className="mt-1 text-[11px]">
                  {f.lat.toFixed(1)}°N {f.lon.toFixed(1)}°E
                </p>
                <p className="text-[11px] text-muted-foreground">Confidence ±{f.confidenceRadiusKm} km</p>
                <p className="text-[11px] text-muted-foreground">{f.windKph} km/h · {f.intensityTrend}</p>
              </div>
            ) : null}
          </Html>
        </group>
      ))}

      {cyclone.lat !== 0 || cyclone.lon !== 0 ? (
        <>
          <Vortex lat={cyclone.lat} lon={cyclone.lon} intensity={cyclone.windKph} />
          <group position={toVec(cyclone.lat, cyclone.lon, R + 0.02)}>
            <Html center distanceFactor={3}>
              <div className="pointer-events-none -translate-y-16 whitespace-nowrap text-center">
                <div className="mx-auto mb-1 h-2 w-2 rounded-full bg-destructive" />
                <p className="font-display text-[10px] uppercase tracking-[0.18em] text-ink">Cyclone {cyclone.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {cyclone.lat.toFixed(1)}°N {cyclone.lon.toFixed(1)}°E · {cyclone.windKph > 0 ? `${cyclone.windKph} km/h` : "Monitoring"}
                </p>
              </div>
            </Html>
          </group>
        </>
      ) : null}

      <OrbitControls
        ref={controls}
        enablePan={false}
        autoRotate={auto}
        autoRotateSpeed={0.35}
        minDistance={1.6}
        maxDistance={5}
        onStart={() => setAuto(false)}
      />
    </>
  );
}

export default function Globe3D() {
  const { cyclone } = useCyclone();
  return (
    <Canvas camera={{ position: [0, 0, 3.2], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <Scene cyclone={cyclone} />
    </Canvas>
  );
}
