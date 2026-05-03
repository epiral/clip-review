import { useState, useEffect } from "react";
import * as api from "../api";
import type { KPIndex, Stats } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MASTERY_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "空白", color: "bg-destructive" },
  1: { label: "学过", color: "bg-warning" },
  2: { label: "能回忆", color: "bg-[oklch(0.7_0.12_80)]" },
  3: { label: "能应用", color: "bg-success/50" },
  4: { label: "能反转", color: "bg-success" },
  5: { label: "能教", color: "bg-primary" },
};

export default function DeckDetail() {
  const deckId = window.location.hash.split("/")[1];
  const [kps, setKPs] = useState<KPIndex[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!deckId) return;
    api.findKPs(deckId).then(setKPs);
    api.getStats(deckId).then(setStats);
  }, [deckId]);

  if (!kps || !stats) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;
  if (kps.length === 0) return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
      <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
        <span className="text-lg">←</span> 返回
      </a>
      <div className="p-6 text-center text-muted-foreground">暂无数据</div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <span className="text-lg">←</span> 返回
          </a>
          <h1 className="text-3xl font-bold tracking-tight">{stats.deck}</h1>
          <p className="text-muted-foreground text-sm">
            共 {stats.total_kp} 个知识点 · 今日需复习 {stats.due_today} 个
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button size="lg" variant="outline" className="flex-1 sm:flex-none" onClick={() => window.location.hash = "graph"}>
            知识网络
          </Button>
          <Button size="lg" className="flex-1 sm:flex-none shadow-sm" onClick={() => window.location.hash = "review"}>
            开始复习 ({stats.due_today})
          </Button>
        </div>
      </div>

      {/* Mastery Distribution */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">掌握度分布</h2>
        <Card className="shadow-sm border-none bg-muted/30">
          <CardContent className="pt-4 space-y-4">
            {/* Stacked Bar */}
            <div className="flex h-3 w-full rounded-full overflow-hidden bg-secondary">
              {Object.entries(stats.mastery_distribution).map(([level, count]) => {
                const width = stats.total_kp > 0 ? (Number(count) / stats.total_kp) * 100 : 0;
                if (width === 0) return null;
                return (
                  <div
                    key={level}
                    className={cn(MASTERY_MAP[Number(level)].color, "transition-all duration-500")}
                    style={{ width: `${width}%` }}
                    title={`${MASTERY_MAP[Number(level)].label}: ${count}`}
                  />
                );
              })}
            </div>
            {/* Legend */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Object.entries(MASTERY_MAP).map(([level, { label, color }]) => (
                <div key={level} className="flex flex-col items-center sm:items-start gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("size-2 rounded-full", color)} />
                    <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{label}</span>
                  </div>
                  <span className="text-xs font-bold pl-3.5">
                    {stats.mastery_distribution[level as unknown as keyof typeof stats.mastery_distribution] || 0}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* KP List */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">知识点列表</h2>
        <div className="grid gap-3">
          {kps.map((kp) => (
            <a key={kp.id} href={`#kp/${kp.id}`} className="block group">
              <Card className="relative overflow-hidden hover:shadow-md transition-all duration-200 ring-1 ring-foreground/10 group-hover:ring-primary/40 min-h-[44px]">
                <div 
                  className={cn("absolute left-0 top-0 bottom-0 w-[3px]", MASTERY_MAP[kp.mastery].color)} 
                />
                <CardContent className="flex items-center justify-between p-4 py-3">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-base group-hover:text-primary transition-colors">
                      {kp.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{kp.flashcard_count} 卡片 · {kp.question_count} 题</span>
                      {kp.depends_on.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/50">
                          ← {kp.depends_on.map(depId => kps.find(k => k.id === depId)?.title ?? depId).join("、")}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                      {MASTERY_MAP[kp.mastery].label}
                    </span>
                    {kp.due_count > 0 && (
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-full">
                        {kp.due_count} 待复习
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
