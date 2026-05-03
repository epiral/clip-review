import { useState, useEffect } from "react";
import * as api from "../api";
import type { KPDetail as KPDetailType, KPIndex } from "../api";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Markdown } from "../components/Markdown";

const MASTERY_LABELS = ["空白", "学过", "能回忆", "能应用", "能反转", "能教"];
const MASTERY_STYLES = [
  "border border-destructive/30 text-destructive",
  "border border-warning/30 text-warning-foreground",
  "border border-yellow-300/40 text-yellow-700",
  "border border-emerald-300/40 text-emerald-700",
  "border border-success/30 text-success",
  "border border-primary/30 text-primary",
];

export default function KPDetail() {
  const kpId = window.location.hash.split("/")[1];
  const [kp, setKP] = useState<KPDetailType | null>(null);
  const [allKPs, setAllKPs] = useState<KPIndex[] | null>(null);
  const [flashcardsOpen, setFlashcardsOpen] = useState(true);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  useEffect(() => {
    if (!kpId) return;
    api.get<KPDetailType>(kpId).then(setKP);
    api.findKPs().then(setAllKPs);
  }, [kpId]);

  if (!kp || !allKPs) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 animate-fade-in">
      {/* Header */}
      <div className="pb-6 mb-8 border-b border-border/50">
        <a
          href={`#deck/${kp.deck_id}`}
          className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 mb-4"
        >
          ← 返回
        </a>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{kp.title}</h1>
          <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0", MASTERY_STYLES[kp.mastery])}>
            {MASTERY_LABELS[kp.mastery]}
          </span>
        </div>
        <DepGraph kpId={kp.id} dependsOn={kp.depends_on} allKPs={allKPs} />
        {kp.source && (
          <div className="text-[10px] text-muted-foreground/40 mt-2">{kp.source}</div>
        )}
      </div>

      {/* Body */}
      <div className="mb-8">
        <Markdown className="prose text-[15px] leading-[1.9] text-foreground/85">{kp.body}</Markdown>
      </div>

      {(kp.flashcards.length > 0 || kp.questions.length > 0) && (
        <button
          onClick={() => window.location.hash = `practice/${kp.id}`}
          className="w-full mb-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          开始练习（{kp.flashcards.length} 卡片 + {kp.questions.length} 题）
        </button>
      )}

      <hr className="border-border/30 mb-8" />

      {/* Flashcards */}
      <Section
        title="抽认卡"
        count={kp.flashcards.length}
        open={flashcardsOpen}
        onToggle={() => setFlashcardsOpen(!flashcardsOpen)}
      >
        <div className="space-y-1 divide-y divide-border/20">
          {kp.flashcards.map((fc) => (
            <div key={fc.id} className="py-4 first:pt-0">
              <Markdown className="prose font-medium text-[15px] text-foreground/90">{fc.front}</Markdown>
              <Markdown className="prose text-sm text-muted-foreground/70 mt-1">{fc.back}</Markdown>
              <div className="text-[10px] text-muted-foreground/30 mt-2">
                {new Date(fc.due).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Questions */}
      <Section
        title="测试问题"
        count={kp.questions.length}
        open={questionsOpen}
        onToggle={() => setQuestionsOpen(!questionsOpen)}
      >
        <div className="space-y-1 divide-y divide-border/20">
          {kp.questions.map((q) => (
            <div key={q.id} className="py-4 first:pt-0">
              <div className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-1.5">
                {q.type === "judge" ? "判断分析" : q.type === "produce" ? "阐述论证" : q.type}
              </div>
              <Markdown className="prose font-medium text-[15px] leading-snug text-foreground/90">{q.prompt}</Markdown>
              <div className="mt-3 pl-3 border-l-2 border-border/30 text-sm text-muted-foreground/60 leading-relaxed">
                <Markdown className="prose">{q.answer}</Markdown>
              </div>
              <div className="text-[10px] text-muted-foreground/30 mt-2">
                {new Date(q.due).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, count, open, onToggle, children }: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left py-2 mb-3 text-xs font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors group uppercase tracking-wider"
      >
        <ChevronDown
          size={14}
          className={cn("transition-transform", !open && "-rotate-90")}
        />
        <span>{title}</span>
        <span className="text-muted-foreground/40">({count})</span>
      </button>
      <div className={cn("collapsible-content", open ? "expanded" : "collapsed")}>
        {children}
      </div>
    </div>
  );
}

function DepGraph({ kpId, dependsOn, allKPs }: { kpId: string; dependsOn: string[]; allKPs: KPIndex[] }) {
  const upstream = dependsOn
    .map(id => allKPs.find(k => k.id === id))
    .filter(Boolean);
  const downstream = allKPs.filter(k => k.depends_on.includes(kpId));

  if (upstream.length === 0 && downstream.length === 0) return null;

  return (
    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/60 flex-wrap">
      {upstream.length > 0 && (
        <>
          {upstream.map((dep, i) => (
            <span key={dep!.id}>
              {i > 0 && <span className="text-muted-foreground/30 mx-0.5">·</span>}
              <a href={`#kp/${dep!.id}`} className="hover:text-primary transition-colors">
                {dep!.title}
              </a>
            </span>
          ))}
          <span className="text-muted-foreground/30">→</span>
        </>
      )}
      <span className="font-semibold text-foreground/60">当前</span>
      {downstream.length > 0 && (
        <>
          <span className="text-muted-foreground/30">→</span>
          {downstream.map((dep, i) => (
            <span key={dep.id}>
              {i > 0 && <span className="text-muted-foreground/30 mx-0.5">·</span>}
              <a href={`#kp/${dep.id}`} className="hover:text-primary transition-colors">
                {dep.title}
              </a>
            </span>
          ))}
        </>
      )}
    </div>
  );
}
