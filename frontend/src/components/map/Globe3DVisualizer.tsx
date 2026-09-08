import React, { useEffect, useRef, useState } from 'react';
import type { Cyclone, Prediction } from '../../types';
import { Wind, RotateCw, ZoomIn, ZoomOut, Navigation, Sparkles } from 'lucide-react';

interface Globe3DProps {
  cyclone: Cyclone;
  prediction?: Prediction;
  height?: string;
  onSelectCyclone?: (c: Cyclone) => void;
}

interface Particle3D {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
  speed: number;
}

export const Globe3DVisualizer: React.FC<Globe3DProps> = ({
  cyclone,
  prediction,
  height = '650px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Projection Mode: '3d' for 3D Globe, '2d' for Equirectangular Planar Map
  const [projectionMode, setProjectionMode] = useState<'3d' | '2d'>('3d');
  const [autoRotate, setAutoRotate] = useState(true);
  const [showWind, setShowWind] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showOverlayMenu, setShowOverlayMenu] = useState(false);
  const [particleDensity, setParticleDensity] = useState<number>(700);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Target coordinates for camera interpolation
  const latestObs = cyclone.latestObservation;
  const cycloneLat = latestObs ? latestObs.lat : 19.4;
  const cycloneLon = latestObs ? latestObs.long : 67.8;

  // Camera rotation state (in radians)
  const rotationRef = useRef({ rotX: 0.25, rotY: -1.2 });
  const targetRotationRef = useRef({ rotX: 0.25, rotY: -1.2 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Smoothly rotate globe to face selected cyclone coordinates
  useEffect(() => {
    if (cycloneLat && cycloneLon) {
      targetRotationRef.current = {
        rotY: -cycloneLon * (Math.PI / 180) - Math.PI / 2,
        rotX: cycloneLat * (Math.PI / 180) * 0.45,
      };
    }
  }, [cyclone.id, cycloneLat, cycloneLon]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize 3D particles on spherical coordinates
    const particles: Particle3D[] = [];
    const initParticles = () => {
      particles.length = 0;
      for (let i = 0; i < particleDensity; i++) {
        particles.push({
          lat: (Math.random() - 0.5) * 160,
          lon: (Math.random() - 0.5) * 360,
          age: Math.floor(Math.random() * 50),
          maxAge: 40 + Math.random() * 60,
          speed: 0.8 + Math.random() * 1.5,
        });
      }
    };
    initParticles();

    // High-precision Continent Coastline Polygons
    const landmasses: Array<Array<[number, number]>> = [
      // Indian Subcontinent & Bay of Bengal / Arabian Coast
      [[8.2, 77.5], [10, 79.8], [13, 80.2], [16, 82.2], [19.8, 85.8], [21.5, 87.2], [22.5, 88.5], [22, 91.5], [20, 92.8], [15, 94], [10, 98], [6, 95], [8.2, 77.5]],
      [[8.2, 77.5], [11.5, 75.8], [15.4, 73.8], [19, 72.8], [22.2, 69.5], [23.5, 68.2], [25, 67], [24, 62], [25.5, 57], [22.5, 59.5], [17, 54], [12.5, 43.5], [15, 41], [27, 35], [30, 32.5]],
      // Sri Lanka
      [[5.9, 80.5], [9.8, 80.2], [9.5, 81.8], [6.8, 81.8], [5.9, 80.5]],
      // Arabian Peninsula & Persian Gulf
      [[12.5, 43.5], [15, 53], [24, 57.5], [26.5, 56.2], [30, 48], [28, 50], [24, 51.5], [20, 40], [12.5, 43.5]],
      // East Asia & Japan
      [[22, 108], [31, 122], [37, 122.5], [40, 124], [45, 135], [55, 137], [60, 160], [45, 145], [35, 140], [22, 114], [10, 107], [1, 104], [22, 108]],
      [[31, 130], [35, 135], [41, 140], [45, 145], [43, 141], [35, 139], [33, 131], [31, 130]],
      // Africa
      [[35, -5.8], [37, 10], [32, 31], [27, 34.5], [12, 43.5], [10.5, 51], [-12, 40.5], [-26, 33], [-34.8, 20], [-30, 17], [-15, 12], [4.5, 9.5], [5, -3], [15, -17], [35, -5.8]],
      // Australia & New Zealand
      [[-12, 130], [-15, 145], [-25, 153], [-37, 150], [-38, 140], [-32, 115], [-22, 114], [-14, 126], [-12, 130]],
      [[-34.4, 172.6], [-37.5, 178.5], [-41.3, 175.5], [-34.4, 172.6]],
      [[-40.6, 172.1], [-46.6, 166.9], [-46.6, 169.8], [-41.3, 174.2], [-40.6, 172.1]],
      // Europe & UK
      [[36, -9], [43.5, -9.3], [44, -1.5], [48.5, -4.7], [51, 1.5], [54, 8.5], [57, 8.5], [60, 20], [60, 30], [45, 35.5], [40, 23], [36.5, 23], [38, 15.5], [36, -9]],
      // Americas (North & South)
      [[10, -75], [-5, -35], [-23, -42], [-34, -53], [-55, -66], [-46, -75], [-18, -70], [0, -80], [10, -75]],
      [[15, -90], [25, -80], [30, -81], [45, -64], [60, -64], [70, -130], [60, -165], [55, -165], [50, -125], [30, -115], [15, -90]],
    ];

    // Mapped wind speed intensity color palette
    const getParticleColor = (speedRatio: number) => {
      if (speedRatio < 0.25) return 'rgba(56, 189, 248, 0.85)';  // Cyan
      if (speedRatio < 0.5)  return 'rgba(52, 211, 153, 0.9)';   // Emerald
      if (speedRatio < 0.75) return 'rgba(251, 191, 36, 0.95)';  // Amber
      if (speedRatio < 0.9)  return 'rgba(248, 113, 113, 0.98)';  // Rose Red
      return 'rgba(216, 180, 254, 1)';                           // Electric Purple
    };

    // 3D Spherical Orthographic Projection Engine
    const project3D = (lat: number, lon: number, radius: number, cx: number, cy: number) => {
      const { rotX, rotY } = rotationRef.current;
      const phi = lat * (Math.PI / 180);
      const lambda = lon * (Math.PI / 180);

      // Spherical coordinates
      const x0 = Math.cos(phi) * Math.sin(lambda);
      const y0 = Math.sin(phi);
      const z0 = Math.cos(phi) * Math.cos(lambda);

      // Rotate around Y axis (longitude rotation)
      const x1 = x0 * Math.cos(rotY) + z0 * Math.sin(rotY);
      const y1 = y0;
      const z1 = -x0 * Math.sin(rotY) + z0 * Math.cos(rotY);

      // Rotate around X axis (latitude tilt)
      const x2 = x1;
      const y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
      const z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX);

      const visible = z2 > 0;
      const px = cx + x2 * radius * zoomLevel;
      const py = cy - y2 * radius * zoomLevel;

      return { x: px, y: py, z: z2, visible };
    };

    // 2D Equirectangular Planar Projection
    const project2D = (lat: number, lon: number, width: number, height: number) => {
      const px = ((lon + 180) / 360) * width;
      const py = ((90 - lat) / 180) * height;
      return { x: px, y: py, z: 1, visible: true };
    };

    const project = (lat: number, lon: number, radius: number, cx: number, cy: number) => {
      if (projectionMode === '3d') {
        return project3D(lat, lon, radius, cx, cy);
      } else {
        return project2D(lat, lon, canvas.width, canvas.height);
      }
    };

    // Main Animation Render Loop
    const render = () => {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const sphereRadius = Math.min(canvas.width, canvas.height) * 0.38;

      // Smooth camera interpolation towards target cyclone coordinates
      if (!isDraggingRef.current) {
        rotationRef.current.rotX += (targetRotationRef.current.rotX - rotationRef.current.rotX) * 0.05;
        rotationRef.current.rotY += (targetRotationRef.current.rotY - rotationRef.current.rotY) * 0.05;

        if (autoRotate) {
          targetRotationRef.current.rotY += 0.0015;
        }
      }

      // Fading space canvas background
      ctx.fillStyle = 'rgba(3, 5, 11, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (projectionMode === '3d') {
        // Outer Radial Atmosphere Glow Ring
        const glowGrad = ctx.createRadialGradient(cx, cy, sphereRadius * zoomLevel * 0.95, cx, cy, sphereRadius * zoomLevel * 1.18);
        glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
        glowGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.2)');
        glowGrad.addColorStop(1, 'rgba(3, 5, 11, 0)');

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, sphereRadius * zoomLevel * 1.18, 0, Math.PI * 2);
        ctx.fill();

        // 3D Sphere Ocean Body
        const oceanGrad = ctx.createRadialGradient(cx - sphereRadius * 0.35, cy - sphereRadius * 0.35, 10, cx, cy, sphereRadius * zoomLevel);
        oceanGrad.addColorStop(0, '#1E3E58');
        oceanGrad.addColorStop(0.65, '#132C42');
        oceanGrad.addColorStop(1, '#0B1B2B');

        ctx.fillStyle = oceanGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, sphereRadius * zoomLevel, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(124, 147, 160, 0.25)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Draw 3D Lat/Lon Graticule Grid Lines (Equator, Tropics, Prime Meridian)
      ctx.strokeStyle = 'rgba(124, 147, 160, 0.12)';
      ctx.lineWidth = 1;
      const graticuleLats = [-66.5, -23.5, 0, 23.5, 66.5];
      graticuleLats.forEach((lat) => {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 5) {
          const pt = project(lat, lon, sphereRadius, cx, cy);
          if (pt.visible) {
            if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
            else { ctx.lineTo(pt.x, pt.y); }
          } else { started = false; }
        }
        ctx.stroke();
      });

      // Draw Continent Coastlines
      ctx.strokeStyle = '#5A8AA3';
      ctx.lineWidth = 1.6;
      landmasses.forEach((poly) => {
        ctx.beginPath();
        let started = false;
        poly.forEach(([lat, lon]) => {
          const pt = project(lat, lon, sphereRadius, cx, cy);
          if (pt.visible) {
            if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
            else { ctx.lineTo(pt.x, pt.y); }
          } else { started = false; }
        });
        ctx.stroke();
      });

      // Render 3D Spherical Wind Vector Particles
      if (showWind) {
        particles.forEach((p, idx) => {
          const dLat = cycloneLat - p.lat;
          const dLon = cycloneLon - p.lon;
          const dist = Math.sqrt(dLat * dLat + dLon * dLon) + 0.01;

          // Trade Winds + Northern Hemisphere Cyclone Swirl
          let vLat = 0.05 * Math.sin((p.lon * Math.PI) / 180);
          let vLon = 0.25;

          if (dist < 38) {
            const intensity = Math.exp(-dist / 16) * 2.0;
            vLat = (-dLon * 0.16 + dLat * 0.06) * intensity;
            vLon = (dLat * 0.16 + dLon * 0.06) * intensity;
          }

          const nextLat = p.lat + vLat * p.speed;
          const nextLon = p.lon + vLon * p.speed;

          const p1 = project(p.lat, p.lon, sphereRadius, cx, cy);
          const p2 = project(nextLat, nextLon, sphereRadius, cx, cy);

          if (p1.visible && p2.visible) {
            const speedRatio = Math.min(1, Math.sqrt(vLat * vLat + vLon * vLon) * 3);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = getParticleColor(speedRatio);
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.stroke();
          }

          p.lat = nextLat;
          p.lon = nextLon;
          p.age++;

          if (p.age > p.maxAge || p.lat > 85 || p.lat < -85 || p.lon > 180 || p.lon < -180) {
            particles[idx] = {
              lat: (Math.random() - 0.5) * 160,
              lon: (Math.random() - 0.5) * 360,
              age: 0,
              maxAge: 40 + Math.random() * 60,
              speed: 0.8 + Math.random() * 1.5,
            };
          }
        });
      }

      // Render Predicted Trajectory Path on Globe
      if (showTrajectory && prediction?.trajectory) {
        ctx.strokeStyle = '#C084FC';
        ctx.lineWidth = 2.8;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();

        let started = false;
        const pts = [{ lat: cycloneLat, lon: cycloneLon }, ...prediction.trajectory.map(t => ({ lat: t.lat, lon: t.long }))];
        pts.forEach(pt => {
          const projected = project(pt.lat, pt.lon, sphereRadius, cx, cy);
          if (projected.visible) {
            if (!started) { ctx.moveTo(projected.x, projected.y); started = true; }
            else { ctx.lineTo(projected.x, projected.y); }
          } else { started = false; }
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Render Active Cyclone 3D Radar Beacon Marker
      const centerProj = project(cycloneLat, cycloneLon, sphereRadius, cx, cy);
      if (centerProj.visible) {
        const time = Date.now() * 0.003;
        const pulseR = 12 + Math.sin(time * 3) * 4;

        // Outer Radar Pulse Ring
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(centerProj.x, centerProj.y, pulseR + 8, 0, Math.PI * 2);
        ctx.stroke();

        // Pulsing Beacon Core
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(centerProj.x, centerProj.y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Storm Label Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillText(`${cyclone.name}`, centerProj.x + 14, centerProj.y - 12);

        ctx.fillStyle = '#F59E0B';
        ctx.font = '10px "Inter", sans-serif';
        ctx.fillText(`${latestObs?.windSpeedKmh || 165} km/h | ${latestObs?.pressureHpa || 954} hPa`, centerProj.x + 14, centerProj.y + 2);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, [cyclone, prediction, projectionMode, autoRotate, showWind, showTrajectory, particleDensity, zoomLevel, cycloneLat, cycloneLon, latestObs]);

  // Mouse Drag handlers for 3D Globe Rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;

    const sensitivity = 0.005;
    targetRotationRef.current.rotY += dx * sensitivity;
    targetRotationRef.current.rotX += dy * sensitivity;

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoomLevel((z) => Math.max(0.6, Math.min(2.5, z + delta)));
  };

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl glass-panel group select-none"
      style={{ height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 3D Canvas Visualizer */}
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing block" />

      {/* Earth.nullschool Style Bottom-Left Overlay Menu Button */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2">
        <button
          onClick={() => setShowOverlayMenu(!showOverlayMenu)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-950/90 text-white font-mono text-xs font-bold border border-indigo-500/40 hover:bg-indigo-600 transition-all shadow-2xl backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>earth</span>
        </button>

        <span className="text-[11px] font-mono text-gray-400 glass-panel px-3 py-1.5 rounded-lg border border-white/10 hidden sm:inline-block">
          Drag to rotate 3D globe | Scroll to zoom
        </span>
      </div>

      {/* Expandable Earth Control Matrix Drawer */}
      {showOverlayMenu && (
        <div className="absolute bottom-16 left-4 z-50 glass-panel p-4 rounded-2xl border border-white/10 w-80 space-y-4 shadow-2xl backdrop-blur-xl">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="font-mono font-bold text-xs text-indigo-300 uppercase tracking-wider">Earth Control Matrix</span>
            <button onClick={() => setShowOverlayMenu(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
          </div>

          {/* Projection Mode Switcher */}
          <div className="space-y-1">
            <span className="text-[11px] text-gray-400 font-mono block">Map Projection Mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setProjectionMode('3d')}
                className={`py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
                  projectionMode === '3d'
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                3D Globe Sphere
              </button>
              <button
                onClick={() => setProjectionMode('2d')}
                className={`py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
                  projectionMode === '2d'
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                2D Equirectangular
              </button>
            </div>
          </div>

          {/* Density & Zoom Slider */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-300 font-mono">
              <span>Particle Density</span>
              <span className="text-indigo-400">{particleDensity}</span>
            </div>
            <input
              type="range"
              min="200"
              max="1200"
              step="100"
              value={particleDensity}
              onChange={(e) => setParticleDensity(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Top Right Controls Overlay */}
      <div className="absolute top-4 right-4 z-40 flex flex-wrap gap-2 glass-panel p-2 rounded-xl border border-white/10">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            autoRotate ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin-slow' : ''}`} />
          <span>Auto-Spin</span>
        </button>

        <button
          onClick={() => setShowWind(!showWind)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showWind ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          <span>Wind Field</span>
        </button>

        <button
          onClick={() => setShowTrajectory(!showTrajectory)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showTrajectory ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Trajectory Cone</span>
        </button>

        {/* Zoom Buttons */}
        <div className="flex gap-1 border-l border-white/10 pl-2">
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
