import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
//import { motion } from "framer-motion";
import { Play, Pause, RotateCw, Hash, Dice6, Download, Info, Grid, Wand2 } from "lucide-react";

// --- Helper types

type InitKind = "single" | "random" | "stripe" | "custom";

// --- Utility functions

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Convert rule number (0..255) to 8-bit mapping array, index = neighborhood bits 0..7 */
function ruleNumberToBits(rule: number): number[] {
  const bits: number[] = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) bits[i] = (rule >> i) & 1;
  return bits; // index 0 => 000, index 7 => 111
}

/** Convert mapping bits[0..7] back to rule number */
function bitsToRuleNumber(bits: number[]): number {
  let n = 0;
  for (let i = 0; i < 8; i++) if (bits[i]) n |= 1 << i;
  return n >>> 0;
}

/** Neighborhood index from (l,c,r) bits, little-endian: (r<<2)|(c<<1)|l */
function nbhIndex(l: number, c: number, r: number) {
  return (r << 2) | (c << 1) | l;
}

/** Create a boolean sum-of-products expression for bits with output 1 */
function booleanFormulaFromBits(bits: number[]): string {
  const terms: string[] = [];
  const varNames = ["L", "C", "R"];
  for (let i = 0; i < 8; i++) {
    if (bits[i] === 1) {
      // i encodes l,c,r as little-endian bits
      const l = i & 1;
      const c = (i >> 1) & 1;
      const r = (i >> 2) & 1;
      const part = [l ? "L" : "¬L", c ? "C" : "¬C", r ? "R" : "¬R"].join(" ∧ ");
      terms.push("(" + part + ")");
    }
  }
  if (terms.length === 0) return "0";
  if (terms.length === 8) return "1";
  return terms.join(" ∨ ");
}

/** Generate initial row for given kind */
function makeInitialRow(width: number, kind: InitKind, density = 0.5, custom?: number[]): number[] {
  const row = new Array(width).fill(0);
  if (kind === "single") {
    row[Math.floor(width / 2)] = 1;
  } else if (kind === "random") {
    for (let i = 0; i < width; i++) row[i] = Math.random() < density ? 1 : 0;
  } else if (kind === "stripe") {
    for (let i = 0; i < width; i++) row[i] = (i % 2 === 0) ? 1 : 0;
  } else if (kind === "custom" && custom && custom.length === width) {
    return custom.slice();
  } else {
    row[Math.floor(width / 2)] = 1;
  }
  return row;
}

/** Step function for one new row */
function nextRow(prev: number[], bits: number[], wrap: boolean): number[] {
  const n = prev.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const l = prev[(i - 1 + n) % n];
    const c = prev[i];
    const r = prev[(i + 1) % n];
    // If not wrapping, treat beyond edges as 0
    const L = wrap ? l : (i - 1 < 0 ? 0 : l);
    const R = wrap ? r : (i + 1 >= n ? 0 : r);
    const idx = nbhIndex(L, c, R);
    out[i] = bits[idx];
  }
  return out;
}

/** Download canvas as PNG */
function downloadCanvasPNG(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// --- Main component

export default function Automata() {
  // Simulation state
  const [rule, setRule] = useState<number>(110);
  const [bits, setBits] = useState<number[]>(() => ruleNumberToBits(110));
  const [width, setWidth] = useState<number>(240);
  const [rows, setRows] = useState<number>(160);
  const [wrap, setWrap] = useState<boolean>(true);
  const [cellSize, setCellSize] = useState<number>(3);
  const [initKind, setInitKind] = useState<InitKind>("single");
  const [density, setDensity] = useState<number>(0.5);
  const [running, setRunning] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(50);

  // Custom initial row editor
  const [customRow, setCustomRow] = useState<number[] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const gridRef = useRef<number[][]>([]);
  const animRef = useRef<number | null>(null);
  const lastStepRef = useRef<number>(0);

  // Derive formula and display neighborhood order
  const formula = useMemo(() => booleanFormulaFromBits(bits), [bits]);
  const prettyRuleBinary = useMemo(() => {
    // Display in order 111,110,...,000 which corresponds to indices 7..0
    return [...bits].reverse().join("");
  }, [bits]);

  // Whenever rule changes, sync bits
  useEffect(() => {
    const b = ruleNumberToBits(rule);
    setBits(b);
  }, [rule]);

  // Whenever bits change via UI, sync rule
  useEffect(() => {
    const n = bitsToRuleNumber(bits);
    if (n !== rule) setRule(n);
  }, [bits]);

  // Initialize canvas context
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctxRef.current = ctx;
  }, []);

  // Resize canvas on dimension change
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;
    c.width = width * cellSize;
    c.height = rows * cellSize;
    ctx.imageSmoothingEnabled = false;
    resetAndDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, rows, cellSize]);

  const resetAndDraw = useCallback(() => {
    // Build grid anew
    const initial = makeInitialRow(width, initKind, density, customRow || undefined);
    const g: number[][] = [initial];
    while (g.length < rows) g.push(new Array(width).fill(0));
    gridRef.current = g;
    // Clear canvas
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;
    ctx.fillStyle = "#0b1020"; // deep background
    ctx.fillRect(0, 0, c.width, c.height);
    // Draw first row
    drawRow(0, initial);
    lastStepRef.current = 0;
  }, [width, rows, initKind, density, customRow]);

  // Redraw on important param changes
  useEffect(() => {
    resetAndDraw();
  }, [wrap, bits, initKind, density, resetAndDraw]);

  const stepOnce = useCallback(() => {
    const c = canvasRef.current;
    const ctx = ctxRef.current;
    if (!c || !ctx) return;
    const g = gridRef.current;
    const t = lastStepRef.current;
    if (t >= rows - 1) return;
    const next = nextRow(g[t], bits, wrap);
    g[t + 1] = next;
    drawRow(t + 1, next);
    lastStepRef.current = t + 1;
  }, [bits, wrap, rows]);

  // Main loop
  useEffect(() => {
    if (!running) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      stepOnce();
      animRef.current = window.setTimeout(() => requestAnimationFrame(tick), speedMs) as unknown as number;
    };
    tick();
    return () => {
      stopped = true;
      if (animRef.current) {
        window.clearTimeout(animRef.current);
        animRef.current = null;
      }
    };
  }, [running, speedMs, stepOnce]);

  const drawRow = (rowIdx: number, row: number[]) => {
    const ctx = ctxRef.current;
    const c = canvasRef.current;
    if (!ctx || !c) return;
    const y = rowIdx * cellSize;
    // Draw cells
    for (let x = 0; x < row.length; x++) {
      const v = row[x];
      // Aesthetic palette: ON = light accent, OFF = dark bg gradient
      if (v) {
        ctx.fillStyle = "#7dd3fc"; // sky-300
      } else {
        // Alternate subtle stripes for visual structure
        ctx.fillStyle = (x + rowIdx) % 2 === 0 ? "#0e162b" : "#0c1426";
      }
      ctx.fillRect(x * cellSize, y, cellSize, cellSize);
    }
  };

  // Toggle a bit in the truth table panel
  const toggleBit = (i: number) => {
    const next = bits.slice();
    next[i] = next[i] ? 0 : 1;
    setBits(next);
  };

  const randomizeRule = () => {
    const b = new Array(8).fill(0).map(() => (Math.random() < 0.5 ? 0 : 1));
    setBits(b);
  };

  const seedRandom = () => {
    setInitKind("random");
    resetAndDraw();
  };

  const handleDownload = () => {
    const c = canvasRef.current;
    if (!c) return;
    downloadCanvasPNG(c, `eca-rule-${rule}.png`);
  };

  // Neighborhood glyph renderer (111..000 order)
  const NeighborhoodGlyph: React.FC<{ idx: number; out: number; onClick?: () => void }> = ({ idx, out, onClick }) => {
    const l = idx & 1;
    const c = (idx >> 1) & 1;
    const r = (idx >> 2) & 1;
    return (
      <button
        onClick={onClick}
        className={`group relative w-16 rounded-xl border border-slate-700 p-2 transition hover:border-slate-400 ${out ? "bg-cyan-700/40" : "bg-slate-800/60"}`}
        title={`Neighborhood ${r}${c}${l} → ${out}`}
      >
        <div className="flex items-center justify-center gap-[6px]">
          {[r, c, l].map((v, i) => (
            <span
              key={i}
              className={`inline-block h-4 w-4 rounded-sm ${v ? "bg-cyan-300" : "bg-slate-600"}`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-center text-xs text-slate-300">
          → <span className={`ml-1 inline-block h-3 w-3 rounded-sm ${out ? "bg-cyan-300" : "bg-slate-600"}`} />
        </div>
      </button>
    );
  };

  // Build glyphs in 111..000 visual order -> indices 7..0
  const glyphIndices = useMemo(() => [7, 6, 5, 4, 3, 2, 1, 0], []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/20 ring-1 ring-cyan-400/30">
              <Grid className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cellular Automata Rule Explorer</h1>
              <p className="text-xs text-slate-400">1‑D Elementary CA (binary, radius 1). Explore all 256 rules.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRunning((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pause" : "Play"}
            </button>
            <button
              onClick={stepOnce}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              <Wand2 className="h-4 w-4" /> Step
            </button>
            <button
              onClick={resetAndDraw}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              <RotateCw className="h-4 w-4" /> Reset
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              <Download className="h-4 w-4" /> PNG
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        {/* Canvas panel */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Hash className="h-4 w-4 text-cyan-300" />
              <span className="font-medium">Rule</span>
              <input
                type="number"
                className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={rule}
                min={0}
                max={255}
                onChange={(e) => setRule(clamp(parseInt(e.target.value || "0", 10), 0, 255))}
                title="Rule number (0–255)"
              />
              <span className="hidden sm:inline text-slate-500">binary:</span>
              <code className="rounded-md border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[11px] tracking-[0.08em]">{prettyRuleBinary}</code>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2">
                <span className="text-slate-400">Speed</span>
                <input
                  type="range"
                  min={10}
                  max={400}
                  value={speedMs}
                  onChange={(e) => setSpeedMs(parseInt(e.target.value, 10))}
                />
                <span className="tabular-nums text-slate-400">{speedMs}ms</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-slate-400">Cell</span>
                <input
                  type="range"
                  min={2}
                  max={8}
                  value={cellSize}
                  onChange={(e) => setCellSize(parseInt(e.target.value, 10))}
                />
                <span className="tabular-nums text-slate-400">{cellSize}px</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-slate-400">Width</span>
                <input
                  type="range"
                  min={60}
                  max={400}
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value, 10))}
                />
                <span className="tabular-nums text-slate-400">{width}</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-slate-400">Rows</span>
                <input
                  type="range"
                  min={60}
                  max={300}
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value, 10))}
                />
                <span className="tabular-nums text-slate-400">{rows}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={wrap}
                  onChange={(e) => setWrap(e.target.checked)}
                />
                <span className="text-slate-400">Wrap edges</span>
              </label>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <canvas ref={canvasRef} className="block w-full" style={{ imageRendering: "pixelated" }} />
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/5" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <button
              onClick={() => setRule(30)}
              className="rounded-lg border border-slate-700 px-2 py-1 transition hover:border-slate-500"
              title="Load classic chaotic Rule 30"
            >Rule 30</button>
            <button
              onClick={() => setRule(110)}
              className="rounded-lg border border-slate-700 px-2 py-1 transition hover:border-slate-500"
              title="Load Turing-complete Rule 110"
            >Rule 110</button>
            <button
              onClick={() => setRule(90)}
              className="rounded-lg border border-slate-700 px-2 py-1 transition hover:border-slate-500"
              title="Load Sierpiński-like Rule 90"
            >Rule 90</button>
            <button
              onClick={() => setRule(184)}
              className="rounded-lg border border-slate-700 px-2 py-1 transition hover:border-slate-500"
              title="Traffic flow Rule 184"
            >Rule 184</button>
            <button
              onClick={randomizeRule}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 transition hover:border-slate-500"
              title="Randomize rule mapping"
            ><Dice6 className="h-3.5 w-3.5" /> Random rule</button>
          </div>
        </section>

        {/* Side panel */}
        <aside className="space-y-6">
          {/* Truth table / mapping */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Rule mapping</h2>
              <span className="text-[11px] text-slate-400">click to toggle outputs</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {glyphIndices.map((gi) => (
                <NeighborhoodGlyph key={gi} idx={gi} out={bits[gi]} onClick={() => toggleBit(gi)} />
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Order shown: <code className="rounded bg-slate-900 px-1 py-0.5">111, 110, 101, 100, 011, 010, 001, 000</code> → outputs.
            </p>
          </section>

          {/* Initialization */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-200">Initial condition</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                <input
                  type="radio"
                  name="init"
                  className="accent-cyan-500"
                  checked={initKind === "single"}
                  onChange={() => setInitKind("single")}
                />
                <span className="text-sm text-slate-300">Single 1 (center)</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                <input
                  type="radio"
                  name="init"
                  className="accent-cyan-500"
                  checked={initKind === "random"}
                  onChange={() => setInitKind("random")}
                />
                <span className="text-sm text-slate-300">Random</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                <input
                  type="radio"
                  name="init"
                  className="accent-cyan-500"
                  checked={initKind === "stripe"}
                  onChange={() => setInitKind("stripe")}
                />
                <span className="text-sm text-slate-300">Checker/Stripe</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                <input
                  type="radio"
                  name="init"
                  className="accent-cyan-500"
                  checked={initKind === "custom"}
                  onChange={() => {
                    // Create an editable custom row (start all zeros)
                    setCustomRow(new Array(width).fill(0));
                    setInitKind("custom");
                  }}
                />
                <span className="text-sm text-slate-300">Custom row</span>
              </label>
            </div>

            {initKind === "random" && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="text-slate-400">Density</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(density * 100)}
                  onChange={(e) => setDensity(parseInt(e.target.value, 10) / 100)}
                />
                <span className="tabular-nums text-slate-400">{Math.round(density * 100)}%</span>
                <button onClick={seedRandom} className="ml-auto rounded-lg border border-slate-700 px-2 py-1 text-xs transition hover:border-slate-500">Reseed</button>
              </div>
            )}

            {initKind === "custom" && customRow && (
              <div className="mt-3">
                <CustomRowEditor
                  width={width}
                  row={customRow}
                  onChange={(r) => setCustomRow(r)}
                  onApply={() => resetAndDraw()}
                />
              </div>
            )}
          </section>

          {/* Formula */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Boolean formula</h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              f(L, C, R) = <span className="font-mono">{formula}</span>
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}

// --- Custom row editor component

const CustomRowEditor: React.FC<{
  width: number;
  row: number[];
  onChange: (row: number[]) => void;
  onApply: () => void;
}> = ({ width, row, onChange, onApply }) => {
  const cellPx = 12;
  const toggle = (i: number) => {
    const next = row.slice();
    next[i] = next[i] ? 0 : 1;
    onChange(next);
  };
  const clear = () => onChange(new Array(width).fill(0));
  const fill = () => onChange(new Array(width).fill(1));

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        <button onClick={clear} className="rounded-lg border border-slate-700 px-2 py-1 transition hover:border-slate-500">Clear</button>
        <button onClick={fill} className="rounded-lg border border-slate-700 px-2 py-1 transition hover:border-slate-500">Fill</button>
        <span className="ml-auto">Click to toggle cells</span>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-grid grid-flow-col auto-cols-max gap-[2px] rounded-xl border border-slate-800 bg-slate-950 p-2">
          {row.map((v, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`h-[${cellPx}px] w-[${cellPx}px] rounded-sm ${v ? "bg-cyan-300" : "bg-slate-700"}`}
              style={{ height: cellPx, width: cellPx }}
              title={`x=${i}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 text-right">
        <button onClick={onApply} className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-200 transition hover:border-slate-500">Apply</button>
      </div>
    </div>
  );
};
