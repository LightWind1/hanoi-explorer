import GlobalState from "../state/GlobalState";
import type { Move, Snapshot } from "../state/Types";


import JSZip from "jszip";

export function bigintPow2(n: number) { return 1n << BigInt(n); }
export function minMovesBigInt(n: number) { return n < 0 ? 0n : bigintPow2(n) - 1n; }
export function formatBigInt(n: bigint | number) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

export function generateMoves(n: number, from: number, to: number, aux: number, acc: Move[]) {
  if (n <= 0) return;
  generateMoves(n - 1, from, aux, to, acc);
  acc.push({ from, to });
  generateMoves(n - 1, aux, to, from, acc);
}
export function generateMovesAuto(n: number, startPeg: number, endPeg: number): Move[] {
  const acc: Move[] = [];
  if (n <= 0) return acc;
  const aux = [0, 1, 2].find(x => x !== startPeg && x !== endPeg)!;
  GlobalState.setMiddlePeg(aux)//更新过渡柱子序号
  generateMoves(n, startPeg, endPeg, aux, acc);
  return acc;
}
// 生成包含 step-0 的快照数组
export function computeSnapshots(n: number, moves: Move[], startPeg = 0): Snapshot[] {
  const snapshots: Snapshot[] = [];
  const state: number[][] = [[], [], []];
  state[startPeg] = Array.from({ length: n }, (_, i) => n - i);
  snapshots.push(state.map(s => s.slice()));
  for (let i = 0; i < moves.length; i++) {
    const { from, to } = moves[i];
    const d = state[from].pop();
    if (d !== undefined) state[to].push(d);
    snapshots.push(state.map(s => s.slice()));
  }
  return snapshots;
}


// n计算n步以后的位置
export function getStateAfterKMoves(n: number, moves: Move[], k: number,startPeg: number = 0):number[][] {
   // 初始化三个柱子
  const state: number[][] = [[], [], []];

  // 把所有盘子放到用户指定的起点柱子
  for (let i = n; i >= 1; i--) {
    state[startPeg].push(i);
  }
  // 执行前 k 步
  const steps = Math.max(0, Math.min(moves.length, k));
  for (let i = 0; i < steps; i++) {
    const { from, to } = moves[i];
    const disk = state[from].pop();
    if (disk !== undefined) {
      state[to].push(disk);
    }
  }
  return state;
}


export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a"); a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); }

// ---------------------- Canvas-based snapshot renderer (used for ZIP export) ----------------------
export async function exportSnapshotsAsZip(snapshots: Snapshot[], moves: Move[], gs: any) {
  if (!snapshots || snapshots.length === 0) return;
  const zip = new JSZip();
  const W = 900; const H = 360;

  function drawSnapshotToCanvas(snapshot: Snapshot, moveIndex: number) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    // background
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // draw base plate
    ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, H - 40, W, 40);
    // peg centers
    const xs = [W * 0.16, W * 0.5, W * 0.84];
    // draw pegs
    xs.forEach((x) => {
      ctx.fillStyle = '#6b7280'; ctx.fillRect(x - 6, H - 280, 12, 240);
    });
    // draw disks
    snapshot.forEach((pegArr, pegIdx) => {
      pegArr.slice().forEach((size, idxFromBottom) => {
        const diskIdx = idxFromBottom; // bottom=0
        const w = diskWidth(size, gs.n);
        const h = 22;
        const x = xs[pegIdx] - w / 2;
        const y = H - 48 - diskIdx * (h + 2) - h + 6; // stack from bottom
        ctx.fillStyle = (gs.diskColors && gs.diskColors[size]) ? gs.diskColors[size] : `hsl(${(size*37)%360} 70% 50%)`;
        roundRect(ctx, x, y, w, h, 8, true, false);
        // label
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(size), xs[pegIdx], y + h/2);
      });
    });
    // draw arrow for upcoming move (moves[moveIndex] if exists)
    const upcoming = moves && moves.length > 0 ? moves[moveIndex] : null;
    if (upcoming) {
      const from = upcoming.from; const to = upcoming.to;
      const p1x = xs[from]; const p1y = H - 280 - 8 + 30; // near top of peg
      const p2x = xs[to]; const p2y = H - 280 - 8 + 30;
      // control point
      const mx = (p1x + p2x) / 2; const controlY = Math.min(p1y, p2y) - Math.abs(p2x - p1x) * 0.35 - 20;
      // curve
      ctx.strokeStyle = gs.arrowColor || '#ff0000'; ctx.lineWidth = gs.arrowWidth || 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.quadraticCurveTo(mx, controlY, p2x, p2y); ctx.stroke();
      // draw arrowhead
      drawArrowHead(ctx, p1x, p1y, p2x, p2y, mx, controlY, gs.arrowColor || '#ff0000');
    }

    return canvas;
  }

  for (let k = 0; k < snapshots.length; k++) {
    const c = drawSnapshotToCanvas(snapshots[k], k);
    const data = c.toDataURL('image/png').split(',')[1];
    zip.file(`step-${k}.png`, data, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'hanoi-steps.zip');
}

function roundRect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number, fill:boolean, stroke:boolean){
  if (r === undefined) r = 5; if (r > w/2) r = w/2; if (r > h/2) r = h/2;
  ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
  if (fill) ctx.fill(); if (stroke) ctx.stroke();
}
// TODO 注释了x1 y1
function drawArrowHead(ctx: CanvasRenderingContext2D, _x1:number, _y1:number, x2:number, y2:number, cx:number, cy:number, color:string){
  // compute tangent at end of quadratic curve to place triangle
  // approximate derivative at t=1: 2*(P2 - C)
  const dx = x2 - cx; const dy = y2 - cy; const len = Math.hypot(dx, dy) || 1; const ux = dx/len; const uy = dy/len;
  const size = 8;
  // base point
  const bx = x2 - ux * size; const by = y2 - uy * size;
  // perpendicular
  const px = -uy; const py = ux;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(bx + px*size*0.6, by + py*size*0.6); ctx.lineTo(bx - px*size*0.6, by - py*size*0.6); ctx.closePath(); ctx.fill();
}



export function diskWidth(size:number, n:number) {
  const minW = 40; const maxW = 180; if (n <= 1) return maxW; return minW + ((size - 1) * (maxW - minW)) / (n - 1);
}

export function pegLabel(i: number, gs: typeof GlobalState): string  { 
  return gs.pegNames[i] || ["左", "中", "右"][i];

}

// ---------------------- light tests ----------------------
(function runLightTests(){
  try {
    console.assert(minMovesBigInt(1).toString()==='1');
    console.assert(minMovesBigInt(2).toString()==='3');
    const mv: Move[] = [];
    generateMoves(3,0,2,1,mv);
    const s0 = getStateAfterKMoves(3,mv,0,0);
    console.assert(s0[0].length===3 && s0[1].length===0 && s0[2].length===0, '初始应在 A');
    // B->C
    const mv2: Move[] = generateMovesAuto(2,1,2);
    const snaps = computeSnapshots(2,mv2,1);
    console.assert(snaps.length === mv2.length + 1, '快照数量应比 moves 多 1');
  } catch(e) { console.warn('test fail', e); }
})();
