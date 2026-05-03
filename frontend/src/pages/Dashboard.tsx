import { useState, useEffect } from "react";
import * as api from "../api";
import type { Deck, Stats } from "../api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.findDecks().then(setDecks);
    api.getStats().then(setStats);
  }, []);

  if (!decks || !stats) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;
  if (decks.length === 0) return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8 animate-fade-in">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">复习</h1>
      </header>
      <div className="p-6 text-center text-muted-foreground">暂无数据</div>
    </div>
  );

  // Calculate mastery percentage
  const masteryCount = (Number(stats.mastery_distribution["4"] || 0) + Number(stats.mastery_distribution["5"] || 0));
  const masteryPercent = stats.total_kp > 0 ? Math.round((masteryCount / stats.total_kp) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8 animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">复习</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="rounded-full px-3 text-xs" onClick={() => window.location.hash = "graph"}>
            知识网络
          </Button>
          <Button size="sm" className="rounded-full px-5" onClick={() => window.location.hash = "review"}>
            开始复习
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="待复习" value={stats.due_today} valueColor="text-primary" />
        <StatCard label="知识点" value={stats.total_kp} />
        <StatCard 
          label="掌握率" 
          value={`${masteryPercent}%`} 
          extra={<CircularProgress percent={masteryPercent} size={32} />}
        />
      </section>

      {/* Deck List */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">学习集</h2>
        <div className="grid gap-3">
          {decks.map((deck) => (
            <a
              key={deck.id}
              href={`#deck/${deck.id}`}
              className="group block transition-all duration-200 hover:-translate-y-0.5"
            >
              <Card className="relative overflow-hidden border-none bg-card/50 ring-1 ring-border group-hover:ring-primary/30 group-hover:shadow-md min-h-[44px]">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="font-semibold group-hover:text-primary transition-colors">{deck.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{deck.description}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {deck.tags.map((tag) => (
                        <span key={tag} className="text-[10px] h-4 px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground uppercase font-bold tracking-tight inline-flex items-center">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold leading-none">{stats.total_kp}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-medium">Items</div>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </section>

      {/* Weak Points */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">需要加强</h2>
        <div className="grid gap-2">
          {stats.weakest_kps.length > 0 ? (
            stats.weakest_kps.map((kp) => (
              <a 
                key={kp.id} 
                href={`#kp/${kp.id}`}
                className="group flex items-center justify-between rounded-xl p-3 bg-muted/30 ring-1 ring-border hover:bg-muted/50 transition-all min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <MasteryBadge level={kp.mastery} />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm group-hover:text-primary transition-colors">{kp.title}</span>
                    {!kp.depends_on_met && (
                      <span className="text-[10px] text-destructive font-bold uppercase flex items-center gap-1 mt-0.5">
                        <span className="size-1 rounded-full bg-destructive animate-pulse" />
                        前置未掌握
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground/40 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </a>
            ))
          ) : (
            <div className="text-center py-8 bg-muted/20 rounded-2xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">干得漂亮！目前没有明显的薄弱环节，继续保持。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, valueColor, extra }: { label: string, value: string | number, valueColor?: string, extra?: React.ReactNode }) {
  return (
    <Card className="border-none bg-card/50 ring-1 ring-border shadow-sm">
      <CardContent className="p-5 flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className={cn("text-4xl font-bold tracking-tighter leading-none", valueColor || "text-foreground")}>
            {value}
          </p>
        </div>
        {extra}
      </CardContent>
    </Card>
  );
}

function CircularProgress({ percent, size = 32 }: { percent: number, size?: number }) {
  const radius = (size / 2) - 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-muted/30"
          strokeWidth="3"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-primary transition-all duration-700 ease-in-out"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
    </div>
  );
}

function MasteryBadge({ level }: { level: number }) {
  const labels = ["空白", "学过", "能回忆", "能应用", "能反转", "能教"];
  
  const variants: Record<number, string> = {
    0: "bg-destructive text-destructive-foreground",
    1: "bg-warning text-warning-foreground",
    2: "bg-warning/20 text-warning ring-1 ring-warning/30",
    3: "bg-success/20 text-success ring-1 ring-success/30",
    4: "bg-success text-success-foreground",
    5: "bg-primary text-primary-foreground",
  };

  return (
    <span className={cn(
      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight shrink-0",
      variants[level] || "bg-muted text-muted-foreground"
    )}>
      {labels[level]}
    </span>
  );
}
