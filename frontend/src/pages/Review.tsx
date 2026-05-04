import { useState, useEffect } from "react";
import * as api from "../api";
import type { DueItem, KPDetail } from "../api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Markdown } from "../components/Markdown";

function kpToItems(kp: KPDetail): DueItem[] {
  const fcs: DueItem[] = kp.flashcards.map(fc => ({
    id: fc.id, type: "flashcard" as const, kp_id: kp.id, kp_title: kp.title,
    front: fc.front, back: fc.back, interval: 0, repetitions: 0,
  }));
  const qs: DueItem[] = kp.questions.map(q => ({
    id: q.id, type: "question" as const, kp_id: kp.id, kp_title: kp.title,
    prompt: q.prompt, answer: q.answer, question_type: q.type, interval: 0, repetitions: 0,
  }));
  return [...fcs, ...qs];
}

export default function Review({ kpId, deckId }: { kpId?: string; deckId?: string } = {}) {
  const [items, setItems] = useState<DueItem[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (kpId) {
      api.get<KPDetail>(kpId).then(kp => setItems(kpToItems(kp)));
    } else {
      api.getDue(deckId).then(result => setItems(result.items));
    }
  }, [kpId, deckId]);

  const handleRate = (rating: number) => {
    if (!items) return;
    api.record(items[current].id, rating);
    setRevealed(false);
    if (current + 1 >= items.length) {
      setDone(true);
    } else {
      setCurrent(current + 1);
    }
  };

  if (items === null) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;

  if (done || items.length === 0) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-2">{kpId ? "练习完成" : "今日复习完成"}</h1>
        <p className="text-muted-foreground mb-8">完成了 {items.length} 个项目</p>
        <Button size="lg" onClick={() => window.location.hash = kpId ? `kp/${kpId}` : deckId ? `deck/${deckId}` : ""}>
          {kpId ? "返回知识点" : deckId ? "返回卡组" : "返回首页"}
        </Button>
      </div>
    );
  }

  const item = items[current];
  const progressPercent = ((current + 1) / items.length) * 100;

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* 顶部导航 */}
      <header className="shrink-0">
        <div className="flex items-center justify-between px-4 h-14">
          <a href={kpId ? `#kp/${kpId}` : deckId ? `#deck/${deckId}` : "#"} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            ← 返回
          </a>
          <span className="text-sm font-semibold tabular-nums">
            {current + 1} <span className="text-muted-foreground/60">/</span> {items.length}
          </span>
          <div className="w-10" /> {/* Spacer */}
        </div>
        <div className="h-[3px] w-full bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* 中间卡片区 */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-[400px] mb-8">
          <div className="text-xs font-medium text-muted-foreground/60 mb-3 tracking-wider uppercase text-center">
            {item.kp_title}
          </div>
          
          <div key={current} className="animate-fade-in">
            {item.type === "flashcard" ? (
              <FlashcardView 
                item={item} 
                revealed={revealed} 
                onReveal={() => setRevealed(true)} 
              />
            ) : (
              <QuestionView 
                item={item} 
                revealed={revealed} 
                onReveal={() => setRevealed(true)} 
              />
            )}
          </div>
        </div>
      </main>

      {/* 底部评分栏 */}
      <footer className="shrink-0 p-4 pb-[max(2rem,env(safe-area-inset-bottom,2rem))] sm:pb-10 bg-background/80 backdrop-blur-md border-t border-border/40">
        <div className="max-w-[500px] mx-auto min-h-[52px]">
          {revealed ? (
            <div className="grid grid-cols-4 gap-2 animate-slide-up">
              <RatingButton 
                label="忘了" 
                onClick={() => handleRate(1)} 
                className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20" 
              />
              <RatingButton 
                label="模糊" 
                onClick={() => handleRate(2)} 
                className="bg-warning/10 text-warning-foreground border-warning/30 hover:bg-warning/20" 
              />
              <RatingButton 
                label="记住" 
                onClick={() => handleRate(3)} 
                className="bg-success/10 text-success border-success/30 hover:bg-success/20" 
              />
              <RatingButton 
                label="轻松" 
                onClick={() => handleRate(4)} 
                className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/20" 
              />
            </div>
          ) : (
            <div className="flex items-center justify-center text-center text-sm text-muted-foreground/50 h-[52px]">
              {item.type === "flashcard" ? "点击卡片查看答案" : "写下答案后提交"}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function FlashcardView({ item, revealed, onReveal }: { item: DueItem; revealed: boolean; onReveal: () => void }) {
  return (
    <div 
      className="flip-card w-full min-h-[240px] cursor-pointer"
      onClick={!revealed ? onReveal : undefined}
    >
      <div className={`flip-card-inner rounded-2xl shadow-sm ring-1 ring-foreground/10 ${revealed ? "flipped" : ""}`}>
        {/* Front */}
        <div className="flip-card-front bg-card p-6 sm:p-8">
          <Markdown className="prose text-xl font-semibold leading-snug">{item.front ?? ""}</Markdown>
        </div>
        {/* Back */}
        <div className="flip-card-back bg-card p-6 sm:p-8 overflow-y-auto">
          <Markdown className="prose text-base font-medium mb-4 opacity-40">{item.front ?? ""}</Markdown>
          <div className="w-12 h-[1px] bg-foreground/10 mb-4" />
          <Markdown className="prose text-base text-foreground/80 leading-relaxed">{item.back ?? ""}</Markdown>
        </div>
      </div>
    </div>
  );
}

function QuestionView({ item, revealed, onReveal }: { item: DueItem; revealed: boolean; onReveal: () => void }) {
  const [userAnswer, setUserAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    onReveal();
  };

  return (
    <div className="w-full space-y-4">
      <Card className="min-h-[140px] flex flex-col justify-center p-6 bg-card rounded-2xl shadow-sm ring-1 ring-foreground/10 border-none gap-0">
        <div className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-2">
          {item.question_type || "Question"}
        </div>
        <Markdown className="prose text-lg font-medium leading-snug">{item.prompt ?? ""}</Markdown>
      </Card>

      {!submitted ? (
        <div className="space-y-3">
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="写下你的答案..."
            className="w-full min-h-[120px] p-4 rounded-2xl bg-card ring-1 ring-foreground/10 focus:ring-primary/40 focus:outline-none resize-none text-base leading-relaxed placeholder:text-muted-foreground/40 transition-all"
          />
          <Button
            className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.97]"
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
          >
            提交答案
          </Button>
          <button
            onClick={() => { setSubmitted(true); onReveal(); }}
            className="w-full text-center text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
          >
            已在脑中想好，直接看答案
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-slide-up">
          {userAnswer.trim() && (
            <Card className="p-5 bg-card rounded-2xl ring-1 ring-foreground/10 border-none gap-0">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">你的答案</div>
              <Markdown className="prose text-sm text-foreground/80 leading-relaxed">{userAnswer}</Markdown>
            </Card>
          )}
          <Card className="p-5 bg-accent/20 rounded-2xl ring-1 ring-accent/10 border-none gap-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">参考答案</div>
            <Markdown className="prose text-sm text-foreground/90 leading-relaxed">{item.answer ?? ""}</Markdown>
          </Card>
        </div>
      )}
    </div>
  );
}

function RatingButton({ label, onClick, className }: { label: string; onClick: () => void; className: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center min-h-[52px] rounded-xl border text-sm font-semibold transition-all active:scale-95 ${className}`}
    >
      {label}
    </button>
  );
}
