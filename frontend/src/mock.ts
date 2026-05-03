import type { Deck, KPIndex, KPDetail, DueItem, DueResult, Stats, RecordResult } from "./api";

// --- Decks ---

export const mockDecks: Deck[] = [
  { id: "dk_cfo001", name: "CFO 财务基础", description: "联想 CFO Agent 项目补课", tags: ["finance", "lenovo"], created_at: 1777700000, updated_at: 1777800000 },
  { id: "dk_gre001", name: "GRE 词汇", description: "核心 3000 词", tags: ["english", "gre"], created_at: 1777600000, updated_at: 1777750000 },
  { id: "dk_calc01", name: "微积分", description: "MIT 18.01 笔记", tags: ["math"], created_at: 1777500000, updated_at: 1777700000 },
];

// --- Knowledge Points ---

export const mockKPs: KPIndex[] = [
  { id: "kp_rev001", deck_id: "dk_cfo001", title: "Revenue (营收)", mastery: 4, depends_on: [], flashcard_count: 2, question_count: 1, due_count: 0 },
  { id: "kp_cogs01", deck_id: "dk_cfo001", title: "COGS (销售成本)", mastery: 3, depends_on: ["kp_rev001"], flashcard_count: 2, question_count: 1, due_count: 1 },
  { id: "kp_gm001", deck_id: "dk_cfo001", title: "Gross Margin (毛利)", mastery: 2, depends_on: ["kp_rev001", "kp_cogs01"], flashcard_count: 1, question_count: 1, due_count: 2 },
  { id: "kp_pipe01", deck_id: "dk_cfo001", title: "Pipeline (销售管线)", mastery: 1, depends_on: [], flashcard_count: 2, question_count: 2, due_count: 3 },
  { id: "kp_pcon01", deck_id: "dk_cfo001", title: "Pcon (利润贡献)", mastery: 0, depends_on: ["kp_gm001"], flashcard_count: 1, question_count: 1, due_count: 2 },
  { id: "kp_whatif", deck_id: "dk_cfo001", title: "What-if 分析", mastery: 0, depends_on: ["kp_pipe01", "kp_pcon01"], flashcard_count: 0, question_count: 1, due_count: 1 },
];

// --- KP Detail ---

export const mockKPDetail: KPDetail = {
  id: "kp_pipe01",
  deck_id: "dk_cfo001",
  title: "Pipeline (销售管线)",
  body: "Pipeline 指还在谈的订单，位于 Pipeline → Backlog → Order 链路。Pipeline 是领先指标，反映未来收入潜力。\n\n词源：pipe（管道）+ line（线路）= 管道中流动的东西，比喻为正在推进中的商机。",
  mastery: 1,
  source: "memex:project_doc_rcm9kin9",
  depends_on: [],
  flashcards: [
    { id: "fc_p001", front: "Pipeline", back: "还在谈的订单，反映未来收入潜力", due: "2026-05-03T08:00:00Z" },
    { id: "fc_p002", front: "Pipeline 在链路中的位置", back: "Pipeline → Backlog → Order", due: "2026-05-04T08:00:00Z" },
  ],
  questions: [
    { id: "q_p001", type: "judge", prompt: "Revenue 涨 15%，Pipeline 缩水 30%，你给 CEO 什么建议？", answer: "说明在吃老本——当前收入增长靠消耗存量订单，新订单跟不上。需要加强销售管线建设，否则 2-3 个季度后收入会下滑。", due: "2026-05-03T08:00:00Z" },
    { id: "q_p002", type: "produce", prompt: "用 Pipeline 和 Backlog 的关系，解释为什么 Pipeline 是领先指标", answer: "Pipeline 是 Backlog 的上游——Pipeline 的变化会在几个月后反映到 Backlog，进而影响 Order 和 Revenue。所以看 Pipeline 能提前预判收入趋势。", due: "2026-05-05T08:00:00Z" },
  ],
};

// --- Due Items ---

export const mockDueItems: DueItem[] = [
  { id: "fc_p001", type: "flashcard", kp_id: "kp_pipe01", kp_title: "Pipeline (销售管线)", front: "Pipeline", back: "还在谈的订单，反映未来收入潜力", interval: 3, repetitions: 2 },
  { id: "fc_gm01", type: "flashcard", kp_id: "kp_gm001", kp_title: "Gross Margin (毛利)", front: "Gross Margin 公式", back: "Gross Margin = Revenue - COGS", interval: 1, repetitions: 1 },
  { id: "fc_cogs1", type: "flashcard", kp_id: "kp_cogs01", kp_title: "COGS (销售成本)", front: "COGS 包含哪些？", back: "直接材料 + 直接人工 + 制造费用", interval: 0, repetitions: 0 },
  { id: "q_p001", type: "question", kp_id: "kp_pipe01", kp_title: "Pipeline (销售管线)", question_type: "judge", prompt: "Revenue 涨 15%，Pipeline 缩水 30%，你给 CEO 什么建议？", answer: "说明在吃老本——当前收入增长靠消耗存量订单，新订单跟不上。需要加强销售管线建设。", interval: 0, repetitions: 0 },
  { id: "q_gm01", type: "question", kp_id: "kp_gm001", kp_title: "Gross Margin (毛利)", question_type: "produce", prompt: "为什么 ISG 业务毛利比 PC 业务低？", answer: "ISG 的解决方案定制化程度高，人力成本占比大；PC 是标准化产品，规模效应强。", interval: 1, repetitions: 1 },
];

export const mockDueResult: DueResult = {
  items: mockDueItems,
  summary: { flashcard_count: 3, question_count: 2 },
};

// --- Stats ---

export const mockStats: Stats = {
  deck: "CFO 财务基础",
  total_kp: 6,
  mastery_distribution: { "0": 2, "1": 1, "2": 1, "3": 1, "4": 1, "5": 0 },
  due_today: 9,
  weakest_kps: [
    { id: "kp_pcon01", title: "Pcon (利润贡献)", mastery: 0, depends_on_met: true },
    { id: "kp_whatif", title: "What-if 分析", mastery: 0, depends_on_met: false },
    { id: "kp_pipe01", title: "Pipeline (销售管线)", mastery: 1, depends_on_met: true },
  ],
};

// --- Record Result ---

export const mockRecordResult: RecordResult = {
  id: "fc_p001",
  type: "flashcard",
  rating: 3,
  next_due: "2026-05-07T08:00:00Z",
  new_interval: 4,
  mastery_change: { kp_id: "kp_pipe01", old: 1, new: 2 },
};
