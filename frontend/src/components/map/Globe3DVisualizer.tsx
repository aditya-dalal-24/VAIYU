import React, { useEffect, useRef, useState } from 'react';
import type { Cyclone, Prediction } from '../../types';
import { Wind, RotateCw, ZoomIn, ZoomOut, Navigation } from 'lucide-react';

interface Globe3DProps {
  cyclone?: Cyclone;
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

  const [projectionMode, setProjectionMode] = useState<'3d' | '2d'>('3d');
  const [autoRotate, setAutoRotate] = useState(true);
  const [showWind, setShowWind] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [particleDensity] = useState<number>(700);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const defaultCyclone: Cyclone = {
    id: 'cyclone-biparjoy',
    name: 'Cyclone Biparjoy',
    basin: 'Arabian Sea',
    seasonYear: 2023,
    status: 'ACTIVE',
    latestObservation: {
      observedAt: new Date().toISOString(),
      lat: 19.4,
      long: 67.8,
      windSpeedKmh: 165,
      pressureHpa: 954,
      intensityCategory: 'VSCS'
    }
  };

  const activeCyclone = cyclone || defaultCyclone;

  // Target coordinates for camera interpolation
  const latestObs = activeCyclone.latestObservation;
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
  }, [activeCyclone.id, cycloneLat, cycloneLon]);

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

    // Detailed High-Resolution Earth Landmass Polygons with Realistic Coastlines
    const landmasses: Array<Array<[number, number]>> = [
      // Indian Subcontinent & South Asia
      [[8.1, 77.5], [8.8, 78.1], [10.2, 79.8], [11.9, 79.8], [13.1, 80.3], [15.8, 80.9], [17.7, 83.3], [19.8, 85.8], [21.5, 87.1], [22.5, 88.4], [22.0, 91.4], [20.8, 92.4], [16.0, 94.2], [14.0, 98.0], [9.8, 98.6], [6.2, 100.2], [4.2, 103.4], [1.3, 104.2], [3.1, 101.4], [6.2, 99.6], [10.0, 99.2], [13.2, 100.0], [13.5, 100.6], [10.5, 98.6], [15.0, 97.8], [19.5, 95.8], [20.2, 92.6], [21.5, 89.5], [23.5, 87.0], [25.0, 89.0], [26.0, 91.8], [27.5, 96.0], [28.5, 97.5], [25.0, 94.5], [23.0, 91.5], [23.8, 88.5], [21.5, 87.0], [19.5, 84.8], [16.5, 82.0], [14.0, 80.1], [11.0, 79.8], [9.5, 79.0], [8.1, 77.5]],
      [[8.1, 77.5], [10.0, 75.8], [12.0, 75.2], [15.4, 73.8], [18.9, 72.8], [20.5, 72.9], [22.2, 69.5], [22.5, 70.0], [23.5, 68.3], [24.8, 68.2], [24.0, 67.5], [25.2, 66.5], [25.4, 62.5], [25.2, 60.5], [27.0, 56.5], [29.8, 48.5], [30.0, 50.0], [27.5, 52.0], [25.5, 57.0], [23.5, 58.5], [22.5, 59.8], [20.0, 58.5], [17.0, 54.2], [16.5, 53.0], [14.0, 48.5], [12.8, 45.0], [12.5, 43.5], [15.0, 41.2], [18.0, 38.5], [22.5, 37.0], [27.5, 35.0], [29.8, 32.5], [31.5, 34.0], [33.5, 35.5], [36.0, 36.0], [37.0, 35.5], [41.0, 28.5], [41.8, 29.0], [37.0, 36.5], [36.5, 43.5], [30.0, 48.0], [29.8, 50.0], [28.0, 51.0], [27.0, 56.0], [25.0, 57.5], [20.5, 72.8], [15.4, 73.8], [12.0, 75.2], [8.1, 77.5]],
      
      // Sri Lanka
      [[5.9, 80.5], [7.0, 79.8], [8.5, 79.8], [9.8, 80.2], [9.5, 81.8], [7.8, 81.8], [6.0, 81.1], [5.9, 80.5]],

      // East Asia, China, Korea & Russian Far East
      [[21.5, 108.0], [22.5, 113.8], [24.5, 118.5], [29.8, 122.2], [32.0, 121.2], [35.0, 119.5], [37.5, 122.5], [39.0, 124.0], [37.8, 126.5], [34.5, 126.0], [35.0, 129.0], [37.5, 129.2], [40.0, 128.5], [42.0, 130.5], [43.5, 132.0], [47.0, 138.8], [53.0, 141.0], [55.0, 137.0], [59.0, 150.0], [60.0, 160.0], [66.0, 170.0], [70.0, 178.0], [66.0, -170.0], [60.0, 165.0], [55.0, 160.0], [50.0, 155.0], [45.0, 148.0], [42.0, 132.0], [39.0, 117.5], [36.0, 120.0], [31.0, 121.5], [25.0, 119.0], [22.0, 114.0], [20.0, 110.0], [10.0, 107.0], [1.3, 104.2], [7.0, 99.5], [13.5, 100.6], [16.0, 108.0], [21.5, 108.0]],

      // Japan Islands
      [[31.0, 130.5], [32.5, 130.0], [33.8, 131.0], [34.5, 135.5], [35.5, 140.0], [38.0, 141.5], [40.8, 140.0], [41.5, 142.0], [45.5, 142.0], [44.0, 145.5], [43.0, 141.0], [41.8, 140.5], [36.5, 136.5], [34.5, 132.0], [33.0, 129.8], [31.0, 130.5]],

      // Indonesia, Philippines & SE Asia Islands
      [[5.5, 95.3], [3.0, 98.5], [-0.5, 101.5], [-3.0, 106.0], [-5.8, 105.8], [-2.0, 101.5], [2.0, 97.0], [5.5, 95.3]],
      [[-6.0, 105.8], [-6.8, 107.5], [-7.5, 110.5], [-8.2, 114.3], [-8.8, 115.5], [-8.5, 114.0], [-7.0, 108.5], [-6.0, 105.8]],
      [[4.5, 118.0], [1.5, 117.0], [-1.0, 116.5], [-3.5, 116.0], [-4.0, 114.5], [-3.0, 110.0], [1.0, 109.0], [4.5, 113.0], [7.0, 116.8], [4.5, 118.0]],
      [[18.5, 121.0], [16.0, 120.2], [14.0, 121.0], [12.5, 124.0], [9.5, 126.0], [6.0, 125.5], [8.0, 123.0], [10.0, 122.5], [14.5, 120.0], [17.5, 120.5], [18.5, 121.0]],

      // Australia, Tasmania & New Zealand
      [[-12.2, 136.8], [-15.0, 135.5], [-12.5, 130.5], [-14.5, 126.0], [-20.0, 119.0], [-22.5, 113.8], [-28.0, 114.2], [-32.0, 115.5], [-34.8, 117.8], [-35.0, 121.5], [-32.0, 128.5], [-32.5, 133.5], [-35.5, 138.5], [-38.5, 143.5], [-37.5, 149.8], [-33.0, 151.8], [-28.0, 153.5], [-23.5, 150.8], [-19.5, 147.5], [-15.5, 145.3], [-10.8, 142.5], [-14.0, 141.5], [-17.5, 140.8], [-15.5, 136.0], [-12.2, 136.8]],
      [[-40.6, 144.8], [-43.5, 147.0], [-41.0, 148.2], [-40.6, 144.8]],
      [[-34.4, 172.6], [-37.5, 178.5], [-41.3, 175.5], [-37.0, 174.5], [-34.4, 172.6]],
      [[-40.6, 172.1], [-46.6, 166.9], [-46.6, 169.8], [-41.3, 174.2], [-40.6, 172.1]],

      // Arabian Peninsula & Horn of Africa
      [[12.8, 43.2], [16.5, 53.0], [22.5, 59.8], [26.0, 56.5], [30.0, 48.0], [28.0, 50.0], [24.0, 51.5], [21.0, 39.0], [12.8, 43.2]],

      // Africa Continent
      [[35.8, -5.8], [37.2, 10.0], [33.0, 11.5], [32.0, 25.0], [31.5, 32.5], [27.5, 34.5], [22.0, 37.0], [12.5, 43.5], [11.5, 51.0], [4.0, 48.0], [-2.0, 40.5], [-11.8, 40.5], [-18.0, 36.0], [-26.0, 33.0], [-33.0, 28.0], [-34.8, 20.0], [-30.0, 17.0], [-22.0, 14.0], [-15.0, 12.0], [0.0, 9.5], [4.5, 9.5], [5.0, -3.0], [4.5, -7.5], [9.5, -13.5], [15.0, -17.5], [21.0, -17.0], [28.0, -13.0], [35.8, -5.8]],
      [[-12.0, 49.3], [-15.5, 50.5], [-25.5, 47.0], [-25.0, 44.0], [-16.0, 43.5], [-12.0, 49.3]],

      // Europe & UK
      [[36.0, -9.0], [37.0, -6.5], [36.5, -2.0], [38.0, 0.0], [42.0, 3.2], [43.5, -1.5], [46.0, -1.5], [48.5, -4.7], [49.5, -1.5], [51.0, 1.5], [53.5, 7.0], [54.5, 10.0], [57.5, 10.5], [56.0, 12.5], [60.0, 18.0], [65.0, 25.0], [70.0, 28.0], [71.0, 24.0], [62.0, 5.0], [58.0, 6.0], [54.0, 9.0], [52.0, 4.5], [51.0, 2.0], [48.5, -1.5], [43.5, -4.5], [43.5, -9.3], [36.0, -9.0]],
      [[50.0, -5.5], [51.0, 1.5], [55.0, -1.5], [58.5, -3.0], [58.5, -5.5], [55.0, -5.5], [51.5, -4.5], [50.0, -5.5]],
      [[51.5, -9.8], [54.5, -10.0], [55.0, -7.5], [52.0, -6.0], [51.5, -9.8]],

      // North America & Canada
      [[14.5, -92.5], [16.0, -95.0], [18.0, -96.0], [22.0, -97.8], [26.0, -97.2], [29.0, -94.8], [29.5, -89.5], [30.2, -88.0], [25.0, -80.5], [30.0, -81.2], [35.0, -75.5], [41.0, -72.0], [44.0, -64.0], [47.0, -53.0], [52.0, -55.5], [60.0, -64.0], [65.0, -66.0], [69.0, -114.0], [70.0, -135.0], [71.0, -156.0], [65.0, -168.0], [58.0, -158.0], [55.0, -163.0], [54.0, -166.0], [58.0, -136.0], [50.0, -125.0], [38.0, -123.0], [32.0, -117.0], [23.0, -110.0], [16.0, -98.0], [14.5, -92.5]],

      // South America
      [[11.5, -73.0], [10.5, -62.0], [5.0, -51.0], [-2.0, -44.0], [-6.0, -35.0], [-13.0, -38.5], [-23.0, -43.0], [-34.0, -53.5], [-40.0, -62.0], [-52.0, -68.0], [-55.0, -66.0], [-46.0, -75.0], [-33.0, -71.5], [-18.0, -70.5], [-12.0, -77.5], [-4.0, -81.0], [2.0, -79.0], [9.0, -79.5], [11.5, -73.0]],

      // Greenland
      [[60.0, -43.0], [65.0, -37.0], [75.0, -20.0], [81.0, -12.0], [83.0, -35.0], [76.0, -68.0], [66.0, -53.0], [60.0, -43.0]],
    ];

    // Mapped wind speed intensity color palette (COSMO Solar Warm Palette)
    const getParticleColor = (speedRatio: number) => {
      if (speedRatio < 0.25) return 'rgba(246, 241, 233, 0.75)';  // Frosted Sand
      if (speedRatio < 0.5)  return 'rgba(232, 194, 74, 0.85)';   // Warm Gold
      if (speedRatio < 0.75) return 'rgba(255, 136, 0, 0.95)';   // Solar Amber Orange
      if (speedRatio < 0.9)  return 'rgba(255, 85, 0, 0.98)';    // Volcanic Solar Red
      return 'rgba(255, 220, 180, 1)';                           // Bright High-Energy Flame
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

      const visible = z2 > -0.05;
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

      // Fading space canvas background (Warm Dark Obsidian #121110)
      ctx.fillStyle = '#121110';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (projectionMode === '3d') {
        // Outer Radial Atmosphere Glow Ring (Solar Amber Warm Sand Halo)
        const glowGrad = ctx.createRadialGradient(cx, cy, sphereRadius * zoomLevel * 0.95, cx, cy, sphereRadius * zoomLevel * 1.22);
        glowGrad.addColorStop(0, 'rgba(255, 85, 0, 0.40)');
        glowGrad.addColorStop(0.5, 'rgba(232, 194, 74, 0.18)');
        glowGrad.addColorStop(1, 'rgba(18, 17, 16, 0)');

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, sphereRadius * zoomLevel * 1.22, 0, Math.PI * 2);
        ctx.fill();

        // 3D Sphere Ocean Body (Deep Basalt Obsidian Warm Dark Gradient)
        const oceanGrad = ctx.createRadialGradient(
          cx - sphereRadius * 0.35 * zoomLevel, 
          cy - sphereRadius * 0.35 * zoomLevel, 
          10, 
          cx, 
          cy, 
          sphereRadius * zoomLevel
        );
        oceanGrad.addColorStop(0, '#262320');
        oceanGrad.addColorStop(0.65, '#1A1816');
        oceanGrad.addColorStop(1, '#121110');

        ctx.fillStyle = oceanGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, sphereRadius * zoomLevel, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 85, 0, 0.35)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Draw 3D Lat/Lon Graticule Grid Lines (Equator, Tropics, Prime Meridian)
      ctx.strokeStyle = 'rgba(246, 241, 233, 0.12)';
      ctx.lineWidth = 1;
      const graticuleLats = [-66.5, -23.5, 0, 23.5, 66.5];
      graticuleLats.forEach((lat) => {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          const pt = project(lat, lon, sphereRadius, cx, cy);
          if (pt.visible) {
            if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
            else { ctx.lineTo(pt.x, pt.y); }
          } else { started = false; }
        }
        ctx.stroke();
      });

      // Render Filled 3D Landmasses with Glowing Warm Sand & Amber Coastline Edges
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

        if (started) {
          ctx.closePath();
          // Solid Basalt Dark Slate Land Mass Fill
          ctx.fillStyle = 'rgba(38, 34, 30, 0.85)';
          ctx.fill();
          
          // Glowing Solar Amber Coastline Stroke
          ctx.strokeStyle = 'rgba(255, 136, 0, 0.85)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
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
        ctx.strokeStyle = '#FF5500';
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
        ctx.strokeStyle = 'rgba(255, 85, 0, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(centerProj.x, centerProj.y, pulseR + 8, 0, Math.PI * 2);
        ctx.stroke();

        // Pulsing Beacon Core
        ctx.fillStyle = '#FF5500';
        ctx.beginPath();
        ctx.arc(centerProj.x, centerProj.y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Storm Label Text
        ctx.fillStyle = '#F6F1E9';
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillText(`${activeCyclone.name}`, centerProj.x + 14, centerProj.y - 12);

        ctx.fillStyle = '#FF8800';
        ctx.font = 'bold 10px "Inter", sans-serif';
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

      {/* Top Right Controls Overlay - Luxury Champagne Translucent Glass styling */}
      <div className="absolute top-4 right-4 z-40 flex flex-wrap gap-2 p-1.5 rounded-2xl border border-white/90 bg-white/80 backdrop-blur-xl shadow-lg">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            autoRotate 
              ? 'bg-[#FF5500] text-white border-[#FF5500] shadow-sm' 
              : 'bg-[#F6F1E9] text-[#141414] border-[#E6DED4] hover:border-[#FF5500]'
          }`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin-slow' : ''}`} />
          <span>Auto-Spin</span>
        </button>

        <button
          onClick={() => setShowWind(!showWind)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            showWind 
              ? 'bg-[#FF5500] text-white border-[#FF5500] shadow-sm' 
              : 'bg-[#F6F1E9] text-[#141414] border-[#E6DED4] hover:border-[#FF5500]'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          <span>Wind Field</span>
        </button>

        <button
          onClick={() => setShowTrajectory(!showTrajectory)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            showTrajectory 
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
              : 'bg-[#F6F1E9] text-[#141414] border-[#E6DED4] hover:border-[#FF5500]'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Trajectory Cone</span>
        </button>

        {/* Zoom Buttons */}
        <div className="flex gap-1 border-l border-[#E6DED4] pl-2">
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
            className="p-1.5 rounded-xl bg-[#F6F1E9] hover:bg-[#E6DED4] text-[#141414] border border-[#E6DED4] transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
            className="p-1.5 rounded-xl bg-[#F6F1E9] hover:bg-[#E6DED4] text-[#141414] border border-[#E6DED4] transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Center 3D / 2D Viewport Mode Control (Exact Reference DOM Specification) */}
      <div
        className="absolute bottom-[20px] left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-white/80 border border-black/10 p-1 backdrop-blur-md shadow-md z-40"
        data-mode-control="center-viewport"
      >
        <button
          type="button"
          data-mode-btn="3d"
          onClick={() => setProjectionMode('3d')}
          aria-pressed={projectionMode === '3d'}
          className={`text-[10px] rounded-full px-3 py-1 transition-colors duration-150 font-semibold cursor-pointer ${
            projectionMode === '3d'
              ? 'bg-white text-black shadow-sm font-semibold'
              : 'text-black/60 bg-transparent hover:text-black'
          }`}
        >
          3D
        </button>
        <button
          type="button"
          data-mode-btn="2d"
          onClick={() => setProjectionMode('2d')}
          aria-pressed={projectionMode === '2d'}
          className={`text-[10px] rounded-full px-3 py-1 transition-colors duration-150 font-semibold cursor-pointer ${
            projectionMode === '2d'
              ? 'bg-white text-black shadow-sm font-semibold'
              : 'text-black/60 bg-transparent hover:text-black'
          }`}
        >
          2D
        </button>
      </div>
    </div>
  );
};
