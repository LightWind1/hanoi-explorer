import GlobalState, { useGlobal } from "../state/GlobalState";
import { pegLabel } from "./Visualizer";

// --------- MoveList ---------
export default function MoveList() {
  const gs = useGlobal();
  const { moves } = gs;
  const stepIndex = gs.stepIndex;

  if (!moves || moves.length === 0) {
    return <div className="bg-white rounded-2xl shadow p-5 text-sm text-gray-600">当前层数较大或尚未生成步骤。将层数设置为不超过 12，并点击“生成/更新”即可查看完整步骤表。</div>;
  }

  // 新增复制函数
  const copyAllSteps = () => {
    const text = moves.map((m, i) => `${i + 1}. ${pegLabel(m.from, gs)} -> ${pegLabel(m.to, gs)}`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('步骤已复制到剪贴板！');
      })
      .catch(() => {
        alert('复制失败，请手动复制。');
      });
  };

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">步骤列表（最优解）</h3>
        <div className="text-xs text-gray-500">点击任意行可跳转到该步</div>
        <button onClick={copyAllSteps} className="text-xs px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            一键复制
          </button>
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
                <td className="px-3 py-2">{pegLabel(m.from,gs)}</td>
                <td className="px-3 py-2">{pegLabel(m.to,gs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}