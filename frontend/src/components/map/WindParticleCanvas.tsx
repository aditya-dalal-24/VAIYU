import React, { useEffect, useRef } from 'react';

interface WindParticleCanvasProps {
  centerLat: number;
  centerLong: number;
  maxWindSpeedKph: number;
  isActive: boolean;
}

interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  speed: number;
}

export const WindParticleCanvas: React.FC<WindParticleCanvasProps> = ({
  centerLat,
  centerLong,
  maxWindSpeedKph,
  isActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to parent container
    const resizeCanvas = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle field properties
    const PARTICLE_COUNT = 350;
    const particles: Particle[] = [];

    // Screen center mapping coordinates
    const getScreenCenter = () => ({
      cx: canvas.width / 2,
      cy: canvas.height / 2
    });

    const createParticle = (): Particle => {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        age: 0,
        maxAge: 40 + Math.random() * 60,
        speed: 1 + Math.random() * 2
      };
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle());
    }

    // Color gradient based on wind speed intensity (earth.nullschool style)
    const getWindColor = (speedRatio: number) => {
      if (speedRatio < 0.25) return 'rgba(56, 189, 248, 0.8)'; // Cyan
      if (speedRatio < 0.5) return 'rgba(52, 211, 153, 0.85)'; // Emerald
      if (speedRatio < 0.75) return 'rgba(251, 191, 36, 0.9)'; // Amber
      if (speedRatio < 0.9) return 'rgba(248, 113, 113, 0.95)'; // Rose Red
      return 'rgba(192, 132, 252, 1)'; // Electric Purple (Eye/Core)
    };

    const render = () => {
      // Create trailing fading stream effect
      ctx.fillStyle = 'rgba(11, 15, 25, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { cx, cy } = getScreenCenter();
      const scale = Math.min(canvas.width, canvas.height) / 4;

      particles.forEach((p, idx) => {
        // Calculate vector field relative to cyclone center (counter-clockwise vortex in NH)
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
        const angle = Math.atan2(dy, dx);

        // Counter-clockwise swirl angle + inward spiral component
        const swirlAngle = angle - Math.PI / 2 + 0.25; 
        
        // Intensity decreases with distance from eyewall
        const normalizedDist = dist / scale;
        const intensity = Math.exp(-normalizedDist * 0.8) * (maxWindSpeedKph / 180);
        
        // Velocity vector components (u, v)
        const u = Math.cos(swirlAngle) * (2.5 + intensity * 3);
        const v = Math.sin(swirlAngle) * (2.5 + intensity * 3);

        const nextX = p.x + u * p.speed;
        const nextY = p.y + v * p.speed;

        // Draw particle vector line segment
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nextX, nextY);
        ctx.strokeStyle = getWindColor(Math.min(1, intensity * 0.8 + 0.2));
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Advance particle position
        p.x = nextX;
        p.y = nextY;
        p.age++;

        // Reset out-of-bounds or aged particles
        if (p.age > p.maxAge || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          particles[idx] = createParticle();
        }
      });

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [centerLat, centerLong, maxWindSpeedKph, isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 opacity-90"
    />
  );
};

