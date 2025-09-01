import { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import html2canvas from "html2canvas";
import JSZip from "jszip";

// ==========================================
// Hanoi Explorer
// 功能：
// - 层数输入、最少步数、步骤列表、播放控制
// - 单步导出 PNG、批量导出 ZIP（包含 step-0.png）
// - 箭头为弯曲贝塞尔曲线并带箭头头部；可显示/隐藏、调色、调粗细
// - 播放速度倍率（0.5x-3x）、暂停/继续
// ==========================================

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* <header className="px-6 py-8 border-b bg-white sticky top-0 z-10">
        <h1 className="text-3xl font-bold tracking-tight">汉诺塔 · 最终版</h1>
        <p className="text-sm text-gray-600 mt-2">完整功能：播放、导出、箭头可定制。直接运行即可。</p>
      </header> */}
      <main className="p-6 max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4">
          <ControlPanel />
        </div>
        <div className="xl:col-span-8">
          <Visualizer />
        </div>
      </main>
      <footer className="p-6 text-center text-xs text-gray-500">© {new Date().getFullYear()} Hanoi Explorer</footer>
    </div>
  );
}

type Move = { from: number; to: number };
type Point = { x: number; y: number };


// --------- Global state (simple event bus) ----------
const GlobalState = {
  n: 4,
  setN(n: number) { this.n = n; emit(); },
  moves: [] as Move[],
  setMoves(m: Move[]) { this.moves = m; emit(); },
  playing: false,
  setPlaying(p: boolean) { this.playing = p; emit(); },
  baseMs: 600, // base ms per step at 1x
  setBaseMs(ms: number) { this.baseMs = ms; emit(); },
  speedMultiplier: 1,
  setSpeedMultiplier(m: number) { this.speedMultiplier = m; emit(); },
  stepIndex: 0,
  setStepIndex(i: number) { this.stepIndex = i; emit(); },
  showArrow: true,
  setShowArrow(b: boolean) { this.showArrow = b; emit(); },
  arrowColor: "#ff0000",
  setArrowColor(c: string) { this.arrowColor = c; emit(); },
  arrowWidth: 2,
  setArrowWidth(w: number) { this.arrowWidth = w; emit(); },
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((fn) => fn()); }

const useGlobal = (() => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((v) => v + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); }; // 用 {} 包裹，返回 void
  }, []);
  return GlobalState;
});

// --------- Utilities ---------
function bigintPow2(n: number) { return 1n << BigInt(n); }
function minMovesBigInt(n: number) { return n < 0 ? 0n : bigintPow2(n) - 1n; }
function formatBigInt(n: bigint | number) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

function generateMoves(n: number, from: number, to: number, aux: number, acc: Move[]) {
  if (n <= 0) return;
  generateMoves(n - 1, from, aux, to, acc);
  acc.push({ from, to });
  generateMoves(n - 1, aux, to, from, acc);
}

function getStateAfterKMoves(n: number, moves: Move[], k: number):number[][] {
  const state = [Array.from({ length: n }, (_, i) => n - i), [], []];
  const steps = Math.max(0, Math.min(moves.length, k));
  for (let i = 0; i < steps; i++) {
    const { from, to } = moves[i];
    const d = state[from].pop();
    if (d !== undefined) state[to].push(d);
  }
  return state;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a"); a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); }

// --------- ControlPanel ---------
function ControlPanel() {
  const gs = useGlobal();
  const [inputN, setInputN] = useState(gs.n);

  const stepsStr = useMemo(() => formatBigInt(minMovesBigInt(inputN)), [inputN]);
  const canPlay = inputN <= 12;

  const applyN = () => {
    let n = Math.max(1, Math.min(64, Math.floor(inputN)));
    GlobalState.setN(n); GlobalState.setPlaying(false); GlobalState.setStepIndex(0);
    if (n <= 12) { 
      const acc: Move[] = []; 
      generateMoves(n, 0, 2, 1, acc); 
      GlobalState.setMoves(acc); 
    } else { 
      GlobalState.setMoves([]); 
    }
  };

  useEffect(() => { applyN(); }, []);

  return (
    <div className="bg-white rounded-2xl shadow p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium">层数（n）</label>
        <input type="number" min={1} max={64} value={inputN} onChange={(e) => setInputN(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2" />
        <div className="text-xs text-gray-500 mt-1">动画上限：12 层（超过只显示步数）</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-xl">
          <div className="text-sm text-gray-600">最少步数</div>
          <div className="text-2xl font-semibold mt-1">{stepsStr}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl">
          <div className="text-sm text-gray-600">是否可演示</div>
          <div className={`text-2xl font-semibold mt-1 ${canPlay ? 'text-emerald-600' : 'text-amber-600'}`}>{canPlay ? '可播放' : '仅显示步数'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={applyN} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">生成/更新</button>
        <button onClick={() => { GlobalState.setPlaying(false); GlobalState.setStepIndex(0); }} className="px-4 py-2 rounded-xl bg-gray-200">重置</button>
      </div>

      <div className="pt-2 border-t" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm">显示箭头</label>
          <input type="checkbox" checked={gs.showArrow} onChange={(e) => GlobalState.setShowArrow(e.target.checked)} />
        </div>

        <div>
          <label className="text-sm">箭头颜色</label>
          <input type="color" value={gs.arrowColor} onChange={(e) => GlobalState.setArrowColor(e.target.value)} className="ml-2" />
        </div>

        <div>
          <label className="text-sm">箭头粗细（px）</label>
          <input type="range" min={1} max={6} value={gs.arrowWidth} onChange={(e) => GlobalState.setArrowWidth(Number(e.target.value))} />
          <div className="text-xs text-gray-500">当前：{gs.arrowWidth}px</div>
        </div>

        <div>
          <label className="text-sm">播放速度倍率（0.5x - 3x）</label>
          <input type="range" min={0.5} max={3} step={0.1} value={gs.speedMultiplier} onChange={(e) => GlobalState.setSpeedMultiplier(Number(e.target.value))} />
          <div className="text-xs text-gray-500">当前：{gs.speedMultiplier.toFixed(1)}x</div>
        </div>
      </div>

      <HowItWorks />
    </div>
  );
}

function HowItWorks() {
  return (
    <details className="rounded-xl bg-gray-50 p-3 text-sm">
      <summary className="cursor-pointer">原理说明</summary>
      <div className="mt-2 text-gray-600">递归移动：移动 n 层需先移动 n-1 层至辅助柱，再移动底层，最后移动 n-1 层到目标柱。最少步数为 2^n - 1。</div>
    </details>
  );
}

// --------- Visualizer (with curved arrow) ---------
function Visualizer() {
  const gs = useGlobal();
  const { n, moves, playing } = gs;
  const stepIndex = gs.stepIndex;
  const containerRef = useRef(null);
  const pegRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  const [pegPos, setPegPos] = useState([{x:0,y:0},{x:0,y:0},{x:0,y:0}]);

  const pegs = useMemo(() => getStateAfterKMoves(n, moves, stepIndex), [n, moves, stepIndex]);

  // compute peg positions for arrow rendering
  useEffect(() => {
    function update() {
      const container = containerRef.current;
      if (!container) return;
      const rect = (container as HTMLElement).getBoundingClientRect();
      const pos: Point[] = pegRefs.map((r) => {
        const el = r.current;
        if (!el) return { x: rect.left + rect.width * 0.16, y: rect.top + 40 };
        const rrect = el.getBoundingClientRect();
        // use top center of peg area
        return { x: rrect.left + rrect.width / 2 - rect.left, y: rrect.top - rect.top + 8 };
      });
      setPegPos(pos);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [pegs]);

  // playback effect using speedMultiplier
  useEffect(() => {
    if (!playing) return;
    if (!moves || moves.length === 0) return;
    if (gs.stepIndex >= moves.length) { GlobalState.setPlaying(false); return; }
    const effectiveMs = Math.max(20, gs.baseMs / gs.speedMultiplier);
    const t = setTimeout(() => { GlobalState.setStepIndex(Math.min(gs.stepIndex + 1, moves.length)); }, effectiveMs);
    return () => clearTimeout(t);
  }, [playing, gs.stepIndex, moves, gs.baseMs, gs.speedMultiplier]);

  const onPrev = () => { GlobalState.setPlaying(false); GlobalState.setStepIndex(Math.max(0, gs.stepIndex - 1)); };
  const onNext = () => { GlobalState.setPlaying(false); GlobalState.setStepIndex(Math.min(moves.length, gs.stepIndex + 1)); };
  const onTogglePlay = () => { if (!moves || moves.length === 0) return; if (gs.stepIndex >= moves.length) GlobalState.setStepIndex(0); GlobalState.setPlaying(!playing); };

  // export current step PNG
  const exportCurrentPng = async () => {
    const node = containerRef.current;
    if (!node) return;
    // ensure arrow visibility follows setting
    const canvas = await html2canvas(node);
    downloadDataUrl(canvas.toDataURL('image/png'), `step-${gs.stepIndex}.png`);
  };

  // export all steps to ZIP (include step-0)
  const exportAllZip = async () => {
    const node = containerRef.current;
    if (!node) return;
    const zip = new JSZip();
    const prevPlaying = gs.playing; const prevIndex = gs.stepIndex;
    GlobalState.setPlaying(false);
    for (let k = 0; k <= (moves ? moves.length : 0); k++) {
      GlobalState.setStepIndex(k);
      // allow DOM update
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 60));
      const cnode = containerRef.current;
      if (!cnode) continue;
      try {
        const canvas = await html2canvas(cnode);
        const data = canvas.toDataURL('image/png').split(',')[1];
        zip.file(`step-${k}.png`, data, { base64: true });
      } catch (e) { console.warn('capture failed', e); }
    }
    GlobalState.setStepIndex(prevIndex); GlobalState.setPlaying(prevPlaying);
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'hanoi-steps.zip');
  };

  const currentMove: Move | null = moves && moves.length
  ? gs.stepIndex < moves.length ? moves[gs.stepIndex] : null
  : null;
  const progress = moves && moves.length ? Math.min(1, gs.stepIndex / moves.length) : 0;

  // helper to build curved path between two peg positions inside container
  // const buildPath = (p1: Point, p2: Point, curvature = 0.45) => {
  //   // p1/p2 are relative to container (x,y)
  //   const dx = p2.x - p1.x;
  //   const dy = p2.y - p1.y;
  //   const mx = p1.x + dx / 2;
  //   // control point above the pegs, negative dy to lift
  //   const controlY = Math.min(p1.y, p2.y) - Math.abs(dx) * curvature - 20;
  //   return `M ${p1.x},${p1.y} Q ${mx},${controlY} ${p2.x},${p2.y}`;
  // };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            层数：<span className="font-medium text-gray-900">{n}</span>； 最少步数：<span className="font-medium text-gray-900">{formatBigInt(minMovesBigInt(n))}</span>
            {moves && moves.length > 0 && (<><span className="mx-2">|</span> 当前步：<span className="font-medium">{Math.min(gs.stepIndex, moves.length)} / {moves.length}</span></>)}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onPrev} className="px-3 py-2 rounded-xl bg-gray-200">上一步</button>
            <button onClick={onTogglePlay} className={`px-4 py-2 rounded-xl ${gs.playing ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>{gs.playing ? '暂停' : '播放'}</button>
            <button onClick={onNext} className="px-3 py-2 rounded-xl bg-gray-200">下一步</button>
            <button onClick={() => { GlobalState.setPlaying(false); GlobalState.setStepIndex(0); }} className="px-3 py-2 rounded-xl bg-gray-200">回到开始</button>
            <button onClick={exportCurrentPng} className="px-3 py-2 rounded-xl bg-indigo-600 text-white">导出当前步图片</button>
            <button onClick={exportAllZip} className="px-3 py-2 rounded-xl bg-teal-600 text-white">批量导出 ZIP</button>
          </div>
        </div>

        <div className="mt-4 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div id="hanoi-visual" ref={containerRef} className="relative bg-white rounded-2xl shadow p-6">
        <div className="grid grid-cols-3 gap-4 h-[360px]">
          {[0,1,2].map((peg, idx) => (
            <div key={peg} ref={pegRefs[idx]} className="relative rounded-xl bg-gradient-to-b from-gray-50 to-gray-100 border flex items-end justify-center p-3">
              <div className="absolute bottom-3 h-3/4 w-1.5 bg-gray-400 rounded-full" />
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-300 rounded-b-xl" />

              <div className="w-full flex flex-col items-center gap-1 pb-2">
                <AnimatePresence initial={false}>
                  {pegs[peg].slice().reverse().map((size) => (
                    <motion.div key={`${peg}-${size}`} layout initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ type:'spring', stiffness:400, damping:30 }} className="h-6 rounded-full shadow-sm flex items-center justify-center text-xs font-medium text-white" style={{ width: `${diskWidth(size,n)}px`, background: `hsl(${(size*37)%360} 70% 50%)` }}>{size}</motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="absolute top-2 left-2 text-xs text-gray-500">{pegLabel(peg)}</div>
            </div>
          ))}
        </div>

        {/* SVG arrow layer: uses absolute coordinates relative to containerRef */}
        {gs.showArrow && currentMove && (
          <svg className="absolute inset-0 pointer-events-none">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L9,4 L0,8 z" fill={gs.arrowColor} />
              </marker>
            </defs>
            {(() => {
              const p1 = pegPosSafe(pegPos, 0, currentMove ? currentMove.from : 0);
              const p2 = pegPosSafe(pegPos, 1, currentMove ? currentMove.to : 2);
              const d = buildSvgPath(p1, p2);
              return <path d={d} stroke={gs.arrowColor} strokeWidth={gs.arrowWidth} fill="none" strokeLinecap="round" markerEnd="url(#arrowhead)" />;
            })()}
          </svg>
        )}
      </div>

      <MoveList />
    </div>
  );
}

// helper: peg positions array might be empty at first; provide safe fallback
function pegPosSafe(pegPos: Point[], fallbackIndex: number, idx: number): Point {
  if (!pegPos || !pegPos[idx] || typeof pegPos[idx].x !== 'number') 
    return { x: (fallbackIndex+1)*100, y: 40 };
  return pegPos[idx];
}

function buildSvgPath(p1: Point, p2: Point) {
  // ensure numbers
  const x1 = Math.round(p1.x);
  const y1 = Math.round(p1.y + 8); // a little below top
  const x2 = Math.round(p2.x);
  const y2 = Math.round(p2.y + 8);
  const mx = Math.round((x1 + x2) / 2);
  // calculate a control point above the pegs to make an arch
  let controlY = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.35 - 20;
  // --- IMPORTANT FIX ---
  // Prevent the control point from going above the visible area of the visual container
  // (this caused the curve to extend under the header / buttons). Clamp it to a small
  // top margin so the curve stays inside the visual box.
  const MIN_TOP_MARGIN = 12; // px from top of container
  if (controlY < MIN_TOP_MARGIN) controlY = MIN_TOP_MARGIN;
  return `M ${x1} ${y1} Q ${mx} ${Math.round(controlY)} ${x2} ${y2}`;
}

function diskWidth(size:number, n:number) {
  const minW = 40; const maxW = 180; if (n <= 1) return maxW; return minW + ((size - 1) * (maxW - minW)) / (n - 1);
}

function pegLabel(p: number) { return p === 0 ? 'A' : p === 1 ? 'B' : 'C'; }

// --------- MoveList ---------
function MoveList() {
  const gs = useGlobal();
  const { moves } = gs;
  const stepIndex = gs.stepIndex;

  if (!moves || moves.length === 0) {
    return <div className="bg-white rounded-2xl shadow p-5 text-sm text-gray-600">当前层数较大或尚未生成步骤。将层数设置为不超过 12，并点击“生成/更新”即可查看完整步骤表。</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">步骤列表（最优解）</h3>
        <div className="text-xs text-gray-500">点击任意行可跳转到该步</div>
      </div>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-left"><th className="px-3 py-2 w-20">#</th><th className="px-3 py-2">从</th><th className="px-3 py-2">到</th></tr>
          </thead>
          <tbody>
            {moves.map((m, i) => (
              <tr key={i} className={`border-t cursor-pointer ${i < stepIndex ? 'bg-emerald-50/50' : i === stepIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}`} onClick={() => { GlobalState.setPlaying(false); GlobalState.setStepIndex(i+1); }}>
                <td className="px-3 py-2 tabular-nums">{i+1}</td>
                <td className="px-3 py-2">{pegLabel(m.from)}</td>
                <td className="px-3 py-2">{pegLabel(m.to)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------- light tests (console) ---------
(function runLightTests(){ 
  try { console.assert(minMovesBigInt(1).toString()==='1'); 
    console.assert(minMovesBigInt(2).toString()==='3'); 
    const mv: Move[]=[]; generateMoves(3,0,2,1,mv); 
    const s0=getStateAfterKMoves(3,mv,0); 
    console.assert(s0[0].length===3 && s0[1].length===0 && s0[2].length===0); 
  } catch(e){
     console.warn('test fail',e); 
    } })();
