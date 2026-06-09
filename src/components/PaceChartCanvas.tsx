import { useEffect, useRef, useState } from 'react';
import { StrategyType } from '../types';
import { getSegmentPace, formatPace, formatTime } from '../utils';

interface PaceChartCanvasProps {
  totalDistance: number;
  basePaceSeconds: number;
  strategy: StrategyType;
  interval: number;
}

export default function PaceChartCanvas({
  totalDistance,
  basePaceSeconds,
  strategy,
  interval,
}: PaceChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    km: number;
    pace: string;
    time: string;
    visible: boolean;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = 224 * dpr; // 56rem height is 224px
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `224px`;
      draw();
    };

    const draw = (lx?: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // Deep tactical grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 40; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 20; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const paddingLeft = w < 480 ? 40 : 56;
      const paddingRight = w < 480 ? 20 : 36;
      const paddingTop = 32;
      const paddingBottom = 32;
      const chartWidth = w - paddingLeft - paddingRight;
      const chartHeight = h - paddingTop - paddingBottom;

      // Handle raw state empty / invalid values
      if (totalDistance <= 0 || basePaceSeconds <= 0) {
        // Outline skeleton shoe carbon wing outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.15, h * 0.45);
        ctx.bezierCurveTo(w * 0.22, h * 0.15, w * 0.5, h * 0.15, w * 0.65, h * 0.45);
        ctx.bezierCurveTo(w * 0.78, h * 0.52, w * 0.88, h * 0.62, w * 0.95, h * 0.82);
        ctx.lineTo(w * 0.05, h * 0.82);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'italic 700 12px "Space Grotesk"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('[ COLOQUE DISTANCIA Y RITMO PARA RENDERIZAR VUELO ]', w / 2, h / 2 + 10);
        return;
      }

      // Generate accurate points
      const marks: number[] = [];
      let currentMark = interval;
      while (currentMark < totalDistance) {
        marks.push(currentMark);
        currentMark += interval;
      }
      if (totalDistance - (currentMark - interval) > 0.001) {
        marks.push(totalDistance);
      }

      let lastMark = 0;
      const paces: number[] = [];
      const times: number[] = [];
      let cumulativeTime = 0;

      marks.forEach((mark) => {
        const segmentDistance = mark - lastMark;
        const segmentPace = getSegmentPace(lastMark, mark, totalDistance, basePaceSeconds, strategy);
        cumulativeTime += segmentPace * segmentDistance;
        paces.push(segmentPace);
        times.push(cumulativeTime);
        lastMark = mark;
      });

      const maxPace = Math.max(...paces, basePaceSeconds * 1.08);
      const minPace = Math.min(...paces, basePaceSeconds * 0.92);
      let paceRange = maxPace - minPace;
      if (paceRange === 0) paceRange = 10;

      const plotPoints = marks.map((mark, i) => {
        const x = paddingLeft + (i / Math.max(1, marks.length - 1)) * chartWidth;
        const y = paddingTop + chartHeight - ((paces[i] - minPace) / paceRange) * chartHeight;
        return { x, y, paceVal: paces[i], km: mark, cumulativeTime: times[i] };
      });

      // Render Y-Axis line & labels
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, paddingTop);
      ctx.lineTo(paddingLeft, h - paddingBottom);
      ctx.stroke();

      const yDivs = 4;
      for (let i = 0; i <= yDivs; i++) {
        const yGrid = paddingTop + (i / yDivs) * chartHeight;
        const paceAtY = minPace + ((yDivs - i) / yDivs) * paceRange;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.moveTo(paddingLeft, yGrid);
        ctx.lineTo(w - paddingRight, yGrid);
        ctx.stroke();

        ctx.fillStyle = '#7E8694';
        ctx.font = '700 9px "JetBrains Mono"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatPace(paceAtY), paddingLeft - 8, yGrid);
      }

      // Draw Strategy Line (Volts/Neon lime)
      ctx.beginPath();
      ctx.moveTo(plotPoints[0].x, plotPoints[0].y);
      for (let i = 0; i < plotPoints.length - 1; i++) {
        const xc = (plotPoints[i].x + plotPoints[i + 1].x) / 2;
        const yc = (plotPoints[i].y + plotPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(plotPoints[i].x, plotPoints[i].y, xc, yc);
      }
      ctx.lineTo(plotPoints[plotPoints.length - 1].x, plotPoints[plotPoints.length - 1].y);

      ctx.strokeStyle = '#CCFF00';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Shadow overlay under the curve
      ctx.lineTo(plotPoints[plotPoints.length - 1].x, h - paddingBottom);
      ctx.lineTo(plotPoints[0].x, h - paddingBottom);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
      gradient.addColorStop(0, 'rgba(204, 255, 0, 0.12)');
      gradient.addColorStop(1, 'rgba(204, 255, 0, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Plot check-gate dots
      plotPoints.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FF2A54';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Plot X-Axis labels
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 9px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      plotPoints.forEach((pt, i) => {
        if (plotPoints.length > 12 && i % Math.ceil(plotPoints.length / 8) !== 0 && i !== plotPoints.length - 1) {
          return;
        }
        ctx.fillText(`${pt.km.toFixed(1)}K`, pt.x, h - paddingBottom + 8);
      });

      // Hover feedback overlay logic
      if (lx !== undefined && lx >= paddingLeft && lx <= w - paddingRight) {
        const closest = plotPoints.reduce((prev, curr) => {
          return Math.abs(curr.x - lx) < Math.abs(prev.x - lx) ? curr : prev;
        });

        // Vertical laser pointer
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#FF2A54';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(closest.x, paddingTop);
        ctx.lineTo(closest.x, h - paddingBottom);
        ctx.stroke();
        ctx.restore();

        // Highlight circle
        ctx.beginPath();
        ctx.arc(closest.x, closest.y, 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#FF2A54';
        ctx.lineWidth = 2;
        ctx.stroke();

        setHoverData({
          x: closest.x,
          y: closest.y,
          km: closest.km,
          pace: formatPace(closest.paceVal),
          time: formatTime(closest.cumulativeTime),
          visible: true,
        });
      } else {
        setHoverData(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      draw(lx);
    };

    const handleMouseLeave = () => {
      draw();
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [totalDistance, basePaceSeconds, strategy, interval]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden select-none">
      <canvas ref={canvasRef} className="block w-full cursor-crosshair bg-black" />
      
      {/* Absolute high-tech custom tooltip frame in HTML for crystal sharp rendering */}
      {hoverData && hoverData.visible && (
        <div
          className="absolute pointer-events-none z-30 bg-black border border-neon-lime p-2 text-[10px] font-mono text-white tracking-tight leading-none shadow-xl transition-all duration-75"
          style={{
            left: `${Math.min(
              canvasRef.current ? canvasRef.current.clientWidth - 110 : 200,
              Math.max(5, hoverData.x - 55)
            )}px`,
            top: `${Math.max(5, hoverData.y - 75)}px`,
            width: '110px',
          }}
        >
          <div className="text-zinc-500 text-[8px] mb-1">// DIST: {hoverData.km.toFixed(2)}K</div>
          <div className="font-bold text-neon-lime mb-0.5">RITMO: {hoverData.pace}</div>
          <div className="font-semibold text-crimson-x">ACUM: {hoverData.time}</div>
        </div>
      )}
    </div>
  );
}
