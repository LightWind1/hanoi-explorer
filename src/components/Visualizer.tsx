import { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import GlobalState, { useGlobal } from "../state/GlobalState";
import type { Move, Point , Snapshot } from "../state/Types";

import { formatBigInt, minMovesBigInt ,getStateAfterKMoves} from "../utils/hanoi";
import MoveList from "./MoveList";


// --------- Visualizer (with curved arrow) ---------
export default function Visualizer() {
  const gs = useGlobal();
  const { n, moves, playing } = gs;
  const stepIndex = gs.stepIndex;
  const containerRef = useRef(null);
  const pegRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  const [pegPos, setPegPos] = useState([{x:0,y:0},{x:0,y:0},{x:0,y:0}]);

  const pegs = useMemo(() => {
    if (gs.snapshots && gs.snapshots.length) return gs.snapshots[Math.min(stepIndex, gs.snapshots.length - 1)];
    return getStateAfterKMoves(n, moves, stepIndex, gs.startPeg || 0);
  }, [n, moves, stepIndex, gs.snapshots, gs.startPeg]);

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
                    <motion.div 
                      key={`${peg}-${size}`} 
                      layout initial={{ opacity:0, y:10 }} 
                      animate={{ opacity:1, y:0 }} 
                      exit={{ opacity:0 }} 
                      transition={{ type:'spring', stiffness:400, damping:30 }} 
                      className="h-6 rounded-full shadow-sm flex items-center justify-center text-xs font-medium text-white" 
                      style={{
                         width: `${diskWidth(size,n)}px`, 
                         background: GlobalState.diskColors[size] || "#888" // 默认灰色
                  }}>{size}</motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="absolute top-2 left-2 text-xs text-gray-500">{pegLabel(peg,gs)}</div>
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

      <MoveList/>
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

export function pegLabel(i: number, gs: typeof GlobalState): string  { 
  return gs.pegNames[i] || ["左", "中", "右"][i];

}

