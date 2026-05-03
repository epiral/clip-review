import { useState, useEffect } from "react";
import * as api from "../api";
import type { KPIndex } from "../api";
import { cn } from "@/lib/utils";

const MASTERY_COLORS = [
  { bg: "bg-red-100", border: "border-red-300", ring: "ring-red-200", dot: "#ef4444" },
  { bg: "bg-orange-100", border: "border-orange-300", ring: "ring-orange-200", dot: "#f97316" },
  { bg: "bg-yellow-100", border: "border-yellow-300", ring: "ring-yellow-200", dot: "#eab308" },
  { bg: "bg-lime-100", border: "border-lime-300", ring: "ring-lime-200", dot: "#84cc16" },
  { bg: "bg-green-100", border: "border-green-300", ring: "ring-green-200", dot: "#22c55e" },
  { bg: "bg-emerald-100", border: "border-emerald-300", ring: "ring-emerald-200", dot: "#10b981" },
];

const MASTERY_LABELS = ["空白", "学过", "能回忆", "能应用", "能反转", "能教"];

interface NodePos {
  id: string;
  x: number;
  y: number;
}

function layoutNodes(kps: KPIndex[]): NodePos[] {
  // Simple layered layout based on dependency depth
  const depths: Record<string, number> = {};

  function getDepth(id: string): number {
    if (depths[id] !== undefined) return depths[id];
    const kp = kps.find(k => k.id === id);
    if (!kp || kp.depends_on.length === 0) {
      depths[id] = 0;
      return 0;
    }
    const maxParent = Math.max(...kp.depends_on.map(getDepth));
    depths[id] = maxParent + 1;
    return depths[id];
  }

  kps.forEach(kp => getDepth(kp.id));

  // Group by depth
  const layers: Record<number, string[]> = {};
  for (const [id, depth] of Object.entries(depths)) {
    if (!layers[depth]) layers[depth] = [];
    layers[depth].push(id);
  }

  const maxLayer = Math.max(...Object.keys(layers).map(Number));
  const positions: NodePos[] = [];

  for (let layer = 0; layer <= maxLayer; layer++) {
    const ids = layers[layer] || [];
    const count = ids.length;
    ids.forEach((id, i) => {
      const x = 40 + layer * 240;
      const totalHeight = (count - 1) * 100;
      const y = 150 - totalHeight / 2 + i * 100;
      positions.push({ id, x, y });
    });
  }

  return positions;
}

export default function Graph() {
  const [kps, setKPs] = useState<KPIndex[] | null>(null);

  useEffect(() => {
    api.findKPs().then(setKPs);
  }, []);

  if (!kps) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;
  if (kps.length === 0) return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-fade-in">
      <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 mb-2">← 返回</a>
      <h1 className="text-2xl font-bold tracking-tight mb-6">知识网络</h1>
      <div className="p-6 text-center text-muted-foreground">暂无数据</div>
    </div>
  );

  const positions = layoutNodes(kps);
  const nodeW = 200;
  const nodeH = 60;

  // Calculate SVG bounds
  const maxX = Math.max(...positions.map(p => p.x)) + nodeW + 40;
  const maxY = Math.max(...positions.map(p => p.y)) + nodeH + 40;
  const minY = Math.min(...positions.map(p => p.y)) - 40;
  const svgHeight = maxY - minY;

  const getPos = (id: string) => positions.find(p => p.id === id);

  // Build edges
  const edges: Array<{ from: NodePos; to: NodePos }> = [];
  for (const kp of kps) {
    const toPos = getPos(kp.id);
    if (!toPos) continue;
    for (const depId of kp.depends_on) {
      const fromPos = getPos(depId);
      if (fromPos) edges.push({ from: fromPos, to: toPos });
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 mb-2">← 返回</a>
          <h1 className="text-2xl font-bold tracking-tight">知识网络</h1>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
          {MASTERY_LABELS.map((label, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: MASTERY_COLORS[i].dot }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-card/30 ring-1 ring-border/20 p-4">
        <svg
          width={maxX}
          height={svgHeight}
          viewBox={`0 ${minY} ${maxX} ${svgHeight}`}
          className="mx-auto"
        >
          {/* Edges */}
          {edges.map(({ from, to }, i) => {
            const x1 = from.x + nodeW;
            const y1 = from.y + nodeH / 2 - minY + minY;
            const x2 = to.x;
            const y2 = to.y + nodeH / 2 - minY + minY;
            const midX = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth="1.5"
                opacity="0.4"
                markerEnd="url(#arrow)"
              />
            );
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border)" opacity="0.5" />
            </marker>
          </defs>

          {/* Nodes */}
          {positions.map(pos => {
            const kp = kps.find(k => k.id === pos.id);
            if (!kp) return null;
            const colors = MASTERY_COLORS[kp.mastery];
            return (
              <g key={pos.id}>
                <a href={`#kp/${pos.id}`}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={nodeW}
                    height={nodeH}
                    rx={12}
                    fill="var(--card)"
                    stroke={colors.dot}
                    strokeWidth="2"
                    opacity="0.95"
                    className="hover:opacity-100 transition-opacity cursor-pointer"
                  />
                  <circle
                    cx={pos.x + 16}
                    cy={pos.y + nodeH / 2}
                    r={5}
                    fill={colors.dot}
                  />
                  <text
                    x={pos.x + 28}
                    y={pos.y + nodeH / 2 - 4}
                    fontSize="12"
                    fontWeight="600"
                    fill="var(--foreground)"
                    className="select-none"
                  >
                    {kp.title.length > 18 ? kp.title.slice(0, 18) + "…" : kp.title}
                  </text>
                  <text
                    x={pos.x + 28}
                    y={pos.y + nodeH / 2 + 12}
                    fontSize="10"
                    fill="var(--muted-foreground)"
                    opacity="0.6"
                    className="select-none"
                  >
                    {MASTERY_LABELS[kp.mastery]} · {kp.due_count > 0 ? `${kp.due_count} 待复习` : "已完成"}
                  </text>
                </a>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
