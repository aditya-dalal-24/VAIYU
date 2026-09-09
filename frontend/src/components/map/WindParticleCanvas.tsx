import { useEffect, useRef } from "react";

export function WindParticleCanvas({ speed = 1 }: { speed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 420 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      a: Math.random() * Math.PI * 2,
      life: Math.random() * 100,
    }));

    const tick = () => {
      ctx.fillStyle = "rgba(20,14,10,0.10)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(236,198,150,0.55)";
      ctx.lineWidth = 0.8;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      for (const p of particles) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.max(30, Math.hypot(dx, dy));
        const swirl = Math.atan2(dy, dx) + Math.PI / 2 + 0.35;
        const v = (2.2 * speed * 260) / d;
        const nx = p.x + Math.cos(swirl) * v;
        const ny = p.y + Math.sin(swirl) * v;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        p.x = nx;
        p.y = ny;
        p.life -= 1;
        if (p.life < 0 || p.x < 0 || p.y < 0 || p.x > canvas.width || p.y > canvas.height) {
          p.x = Math.random() * canvas.width;
          p.y = Math.random() * canvas.height;
          p.life = 60 + Math.random() * 80;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [speed]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-[400] h-full w-full opacity-60" />;
}
