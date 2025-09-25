import React, { useEffect, useRef, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const canvasWidth = 800
const canvasHeight = 800

// Simple RNG helper
const randInt = (max: number) => Math.floor(Math.random() * max);

// Colors: 0-3 light blue → dark blue, 4+ red
const COLORS = ["#89c5fd", "#3a80ec", "#0229bf", "#080b6c", "#ff0000"];

type Mode = "target" | "random";
type InitMode = "random" | "zeros";

function initGrid(N: number, initMode: InitMode): Uint8Array {
  const arr = new Uint8Array(N * N);
  if (initMode === "random") {
    for (let i = 0; i < arr.length; i++) arr[i] = randInt(4);
  } else {
    arr.fill(0);
  }
  return arr;
}

function drawGrid(canvas: HTMLCanvasElement, grid: Uint8Array, N: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const cell = Math.floor(Math.min(width, height) / N) || 2;
  const xOffset = Math.floor((width - cell * N) / 2);
  const yOffset = Math.floor((height - cell * N) / 2);

  ctx.clearRect(0, 0, width, height);

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = grid[r * N + c];
      ctx.fillStyle = COLORS[Math.min(v, 4)];
      ctx.fillRect(xOffset + c * cell, yOffset + r * cell, cell, cell);
    }
  }
}

function stepOnce(grid: Uint8Array, N: number, pick?: { r: number; c: number }) {
  const idx = (r: number, c: number) => r * N + c;

  const r0 = pick ? pick.r : randInt(N);
  const c0 = pick ? pick.c : randInt(N);
  const q: number[] = [];
  grid[idx(r0, c0)]++;
  if (grid[idx(r0, c0)] >= 4) q.push(idx(r0, c0));

  let topples = 0;
  let grainsLost = 0;
  const affected = new Set<number>();

  while (q.length) {
    const p = q.pop()!;
    const r = Math.floor(p / N);
    const c = p % N;
    const v = grid[p];
    if (v < 4) continue;

    const toppleTimes = Math.floor(v / 4);
    if (toppleTimes === 0) continue;

    topples += toppleTimes;
    grid[p] = v - 4 * toppleTimes;
    affected.add(p);

    const nbrs: [number, number][] = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];

    for (const [nr, nc] of nbrs) {
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) {
        const pi = idx(nr, nc);
        grid[pi] += toppleTimes;
        if (grid[pi] >= 4) q.push(pi);
        affected.add(pi);
      } else {
        grainsLost += toppleTimes;
      }
    }
  }

  return { topples, cellsAffected: affected.size, grainsLost };
}

export default function Abelian() {
  const [N, setN] = useState<number>(64);
  const [initMode, setInitMode] = useState<InitMode>("random");
  const [grid, setGrid] = useState<Uint8Array>(() => initGrid(32, "random"));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<number>(30);

  const [mode, setMode] = useState<Mode>("target");
  const [targetX, setTargetX] = useState<number>(32);
  const [targetY, setTargetY] = useState<number>(32);

  const [stats, setStats] = useState({
    steps: 0,
    totalTopples: 0,
    totalGrainsLost: 0,
    lastTopples: 0,
    lastCells: 0,
    lastLost: 0,
  });

  // Time series of average grid value per step
  const [series, setSeries] = useState<Array<{ step: number; avg: number }>>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawGrid(canvas, grid, N);
  }, [grid, N]);

  const reset = () => {
    setGrid(initGrid(N, initMode));
    setStats({ steps: 0, totalTopples: 0, totalGrainsLost: 0, lastTopples: 0, lastCells: 0, lastLost: 0 });
    setSeries([]);
  };

  useEffect(() => {
    reset();
    setTargetX((x) => Math.min(Math.max(0, x), N - 1));
    setTargetY((y) => Math.min(Math.max(0, y), N - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N, initMode]);

  const doStep = (pick?: { r: number; c: number }) => {
    setGrid((prev) => {
      const next = new Uint8Array(prev);
      const { topples, cellsAffected, grainsLost } = stepOnce(next, N, pick);


      // Update stats
      setStats((s) => ({
        steps: s.steps + 1,
        totalTopples: s.totalTopples + topples,
        totalGrainsLost: s.totalGrainsLost + grainsLost,
        lastTopples: topples,
        lastCells: cellsAffected,
        lastLost: grainsLost,
      }));


      // Compute average height and append to time series
      let sum = 0;
      for (let i = 0; i < next.length; i++) sum += next[i];
      const avg = sum / (N * N);
      setSeries((arr) => {
        const step = (arr.at(-1)?.step || 0) + 1;
        const updated = [...arr, { step, avg }];
        return updated.length > 2000 ? updated.slice(updated.length - 2000) : updated;
      });


      return next;
    });
  };

  useEffect(() => {
    if (!running) return;
    const stepInterval = 1000 / Math.max(1, speed);

    const tick = (t: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = t;
      const dt = t - lastTimeRef.current;
      lastTimeRef.current = t;
      accRef.current += dt;
      while (accRef.current >= stepInterval) {
        const pick = mode === "target" ? { r: targetY, c: targetX } : undefined;
        doStep(pick);
        accRef.current -= stepInterval;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTimeRef.current = 0;
      accRef.current = 0;
    };
  }, [running, speed, mode, targetX, targetY]);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cell = Math.floor(Math.min(canvas.width, canvas.height) / N) || 2;
    const xOffset = Math.floor((canvas.width - cell * N) / 2);
    const yOffset = Math.floor((canvas.height - cell * N) / 2);

    const c = Math.floor((x - xOffset) / cell);
    const r = Math.floor((y - yOffset) / cell);
    if (r >= 0 && r < N && c >= 0 && c < N) {
      doStep({ r, c });
    }
  };

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const pickForMode = mode === "target" ? { r: targetY, c: targetX } : undefined;

  return (
    <section className="w-full p-6 flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Abelian Sandpile</h2>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span>N:</span>
          <input
            type="number"
            min={1}
            max={512}
            step={1}
            value={N}
            onChange={(e) => setN(clamp(Number(e.target.value) || 1, 1, 512))}
            className="border rounded px-2 py-1 w-24"
          />
        </label>

        <div className="flex items-center gap-2 ml-2">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="init"
              value="random"
              checked={initMode === "random"}
              onChange={() => setInitMode("random")}
            />
            <span>Random start</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="init"
              value="zeros"
              checked={initMode === "zeros"}
              onChange={() => setInitMode("zeros")}
            />
            <span>All zeros start</span>
          </label>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="mode"
              value="random"
              checked={mode === "random"}
              onChange={() => setMode("random")}
            />
            <span>Random drops</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="target"
              checked={mode === "target"}
              onChange={() => setMode("target")}
            />
            <span>Targeted </span>

            <span>  X:</span>
            <input
              type="number"
              min={0}
              max={N - 1}
              value={targetX}
              onChange={(e) =>
                setTargetX(clamp(Number(e.target.value) || 0, 0, N - 1))
              }
              className="border rounded px-2 py-1 w-20 disabled:bg-gray-100 disabled:text-gray-500"
              title="Column index (0-based)"
              disabled={mode !== "target"}
            />

            <span>  Y:</span>
            <input
              type="number"
              min={0}
              max={N - 1}
              value={targetY}
              onChange={(e) =>
                setTargetY(clamp(Number(e.target.value) || 0, 0, N - 1))
              }
              className="border rounded px-2 py-1 w-20 disabled:bg-gray-100 disabled:text-gray-500"
              title="Row index (0-based)"
              disabled={mode !== "target"}
            />
          </label>
        </div>

        <button
          onClick={() => setRunning((v) => !v)}
          className={`px-3 py-2 rounded text-white ${running ? "bg-rose-600" : "bg-emerald-600"}`}
        >
          {running ? "Pause" : "Start"}
        </button>

        <button onClick={() => doStep(pickForMode)} className="px-3 py-2 rounded bg-slate-700 text-white">
          Step
        </button>

        <button onClick={reset} className="px-3 py-2 rounded bg-slate-200">
          Reset
        </button>

        <label className="flex items-center gap-2 ml-4">
          <span>Speed:</span>
          <input
            type="range"
            min={1}
            max={300}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <span className="tabular-nums w-12 text-right">{speed} /s</span>
        </label>

        <div className="ml-auto text-sm opacity-70">
          Click any cell to drop once at that location
        </div>
      </div>

      <div className="w-full h-[80vh] rounded-lg border overflow-hidden bg-white">
        <canvas ref={canvasRef} onClick={onCanvasClick} className="w-full h-full cursor-crosshair" />
      </div>

      {/* Time series: average grid value 
      <div style={{ width: canvasWidth, height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="step" tick={{ fontSize: 12 }} label={{ value: "Step", position: "insideBottomRight", offset: -4 }} />
            <YAxis domain={[1.5, 2.5]} tick={{ fontSize: 12 }} label={{ value: "Avg height", angle: -90, position: "insideLeft" }} />
            <Tooltip formatter={(v: number) => (typeof v === 'number' ? v.toFixed(3) : v)} labelFormatter={(s) => `Step ${s}`} />
            <Line type="monotone" dataKey="avg" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      */}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="opacity-60">Steps:</span> <span className="tabular-nums">{stats.steps}</span>
        </div>
        <div>
          <span className="opacity-60">Last topples:</span> <span className="tabular-nums">{stats.lastTopples}</span>
        </div>
        <div>
          <span className="opacity-60">Last cascade size:</span> <span className="tabular-nums">{stats.lastCells}</span>
        </div>
        <div>
          <span className="opacity-60">Total topples:</span> <span className="tabular-nums">{stats.totalTopples}</span>
        </div>
        <div>
          <span className="opacity-60">Last grains lost:</span> <span className="tabular-nums">{stats.lastLost}</span>
        </div>
        <div>
          <span className="opacity-60">Total grains lost:</span> <span className="tabular-nums">{stats.totalGrainsLost}</span>
        </div>
      </div>
    </section>
  );
}
