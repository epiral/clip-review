#!/usr/bin/env bun
import { Clip, command, handler, serveIPC, z } from "@pinixai/core";
import {
  openDB,
  createDeck, getDeck, findDecks, updateDeck, deleteDeck,
  createKP, getKP, findKPs, updateKP, deleteKP, getKPDetail,
  createFlashcard, getFlashcard, updateFlashcard, deleteFlashcard,
  createQuestion, getQuestion, updateQuestion, deleteQuestion,
  getDueItems, recordReview, getStats, detectType,
} from "./src/db";

class ReviewClip extends Clip {
  name = "review";
  domain = "间隔重复复习 — 知识点、抽认卡、问题。所有文本字段（body, front, back, prompt, answer）支持 Markdown 和 LaTeX：行内公式 $x^2$，块级公式 $$\\int_a^b f(x)\\,dx$$";
  patterns = [
    "create(type=kp) → create(type=flashcard) ║ create(type=question)",
    "find(type=kp, deck=X) → get(id) ║ get(id)",
    "due(deck=X) → record(id) ║ record(id)",
    "stats(deck=X) → find(type=kp, deck=X)",
  ];

  entities = {
    deck: z.object({
      id: z.string(), name: z.string(), description: z.string(), tags: z.array(z.string()),
    }).describe("学习集合，按主题分组知识点"),
    knowledge_point: z.object({
      id: z.string(), deck_id: z.string(), title: z.string(), mastery: z.number(),
      depends_on: z.array(z.string()),
    }).describe("原子知识单元，可设置前置依赖"),
    flashcard: z.object({
      id: z.string(), kp_id: z.string(), front: z.string(), back: z.string(),
    }).describe("正反面抽认卡，轻量回忆练习"),
    question: z.object({
      id: z.string(), kp_id: z.string(), type: z.string(), prompt: z.string(),
    }).describe("深度练习题，支持 recall/produce/judge/solve"),
  };

  @command("创建实体（deck/kp/flashcard/question）")
  create = handler(
    z.object({
      type: z.enum(["deck", "kp", "flashcard", "question"]).describe("实体类型"),
      name: z.string().optional().describe("deck 名称"),
      description: z.string().optional().describe("deck 描述"),
      tags: z.string().optional().describe("deck 标签，逗号分隔"),
      deck: z.string().optional().describe("deck ID（创建 kp 时必填）"),
      title: z.string().optional().describe("kp 标题"),
      body: z.string().optional().describe("kp 内容，支持 Markdown + LaTeX（$行内$ $$块级$$）"),
      depends_on: z.string().optional().describe("前置知识点 ID，逗号分隔"),
      source: z.string().optional().describe("来源（memex link / agent session）"),
      kp: z.string().optional().describe("知识点 ID（创建 flashcard/question 时必填）"),
      front: z.string().optional().describe("抽认卡正面，支持 Markdown + LaTeX"),
      back: z.string().optional().describe("抽认卡背面，支持 Markdown + LaTeX"),
      prompt: z.string().optional().describe("问题题目，支持 Markdown + LaTeX"),
      answer: z.string().optional().describe("问题参考答案，支持 Markdown + LaTeX"),
      question_type: z.string().optional().describe("问题类型：recall/produce/judge/solve"),
    }),
    z.any(),
    async (input) => {
      const db = openDB();
      switch (input.type) {
        case "deck":
          if (!input.name) throw new Error("--name is required for deck");
          return createDeck(db, input.name, input.description, input.tags?.split(",").map((t) => t.trim()).filter(Boolean));
        case "kp":
          if (!input.deck) throw new Error("--deck is required for kp");
          if (!input.title) throw new Error("--title is required for kp");
          return createKP(db, input.deck, input.title, input.body, input.depends_on?.split(",").map((s) => s.trim()).filter(Boolean), input.source || undefined);
        case "flashcard":
          if (!input.kp) throw new Error("--kp is required for flashcard");
          if (!input.front) throw new Error("--front is required for flashcard");
          if (!input.back) throw new Error("--back is required for flashcard");
          return createFlashcard(db, input.kp, input.front, input.back);
        case "question":
          if (!input.kp) throw new Error("--kp is required for question");
          if (!input.prompt) throw new Error("--prompt is required for question");
          if (!input.answer) throw new Error("--answer is required for question");
          return createQuestion(db, input.kp, input.prompt, input.answer, input.question_type);
      }
    },
  );

  @command("获取实体详情（kp 内联 flashcard/question）")
  get = handler(
    z.object({
      id: z.string().describe("实体 ID（dk_/kp_/fc_/q_ 前缀）"),
    }),
    z.any(),
    async ({ id }) => {
      const db = openDB();
      const type = detectType(id);
      switch (type) {
        case "deck": return getDeck(db, id);
        case "kp": return getKPDetail(db, id);
        case "flashcard": return getFlashcard(db, id);
        case "question": return getQuestion(db, id);
      }
    },
  );

  @command("搜索实体列表（索引，不含详情内容）")
  find = handler(
    z.object({
      type: z.enum(["deck", "kp", "flashcard", "question"]).describe("实体类型"),
      deck: z.string().optional().describe("按 deck 过滤（仅 kp）"),
      query: z.string().optional().describe("关键词搜索（仅 kp）"),
    }),
    z.any(),
    async (input) => {
      const db = openDB();
      switch (input.type) {
        case "deck": return findDecks(db);
        case "kp": return findKPs(db, input.deck, input.query);
        default:
          throw new Error("find only supports type=deck or type=kp; use get --id for flashcard/question");
      }
    },
  );

  @command("修改实体属性")
  update = handler(
    z.object({
      id: z.string().describe("实体 ID"),
      name: z.string().optional().describe("deck 名称"),
      description: z.string().optional().describe("deck 描述"),
      tags: z.string().optional().describe("deck 标签，逗号分隔"),
      title: z.string().optional().describe("kp 标题"),
      body: z.string().optional().describe("kp 内容"),
      mastery: z.number().optional().describe("kp 掌握度 0-5"),
      source: z.string().optional().describe("kp 来源"),
      depends_on: z.string().optional().describe("kp 前置依赖，逗号分隔"),
      front: z.string().optional().describe("flashcard 正面"),
      back: z.string().optional().describe("flashcard 背面"),
      prompt: z.string().optional().describe("question 题目"),
      answer: z.string().optional().describe("question 答案"),
      question_type: z.string().optional().describe("question 类型"),
    }),
    z.any(),
    async (input) => {
      const db = openDB();
      const type = detectType(input.id);
      switch (type) {
        case "deck":
          return updateDeck(db, input.id, {
            name: input.name || undefined, description: input.description,
            tags: input.tags?.split(",").map((t) => t.trim()).filter(Boolean),
          });
        case "kp":
          return updateKP(db, input.id, {
            title: input.title || undefined, body: input.body, mastery: input.mastery, source: input.source || undefined,
            depends_on: input.depends_on?.split(",").map((s) => s.trim()).filter(Boolean),
          });
        case "flashcard":
          return updateFlashcard(db, input.id, { front: input.front, back: input.back });
        case "question":
          return updateQuestion(db, input.id, { prompt: input.prompt, answer: input.answer, type: input.question_type });
      }
    },
  );

  @command("删除实体（kp 级联删除其 flashcard/question）")
  delete = handler(
    z.object({
      id: z.string().describe("实体 ID"),
    }),
    z.any(),
    async ({ id }) => {
      const db = openDB();
      const type = detectType(id);
      switch (type) {
        case "deck": return deleteDeck(db, id);
        case "kp": return deleteKP(db, id);
        case "flashcard": return deleteFlashcard(db, id);
        case "question": return deleteQuestion(db, id);
      }
    },
  );

  @command("获取待复习队列（完全水合，拿到直接呈现）")
  due = handler(
    z.object({
      deck: z.string().optional().describe("按 deck 过滤"),
      type: z.enum(["flashcard", "question"]).optional().describe("只要卡片或只要题"),
      limit: z.number().optional().describe("最大返回数量，默认 50"),
    }),
    z.any(),
    async (input) => getDueItems(openDB(), input.deck, input.type, input.limit ?? 50),
  );

  @command("记录复习结果（更新 SRS 状态 + 掌握度）")
  record = handler(
    z.object({
      id: z.string().describe("flashcard 或 question ID"),
      rating: z.number().min(1).max(4).describe("1=忘了 2=模糊 3=记住 4=轻松"),
      time_spent: z.number().optional().describe("用时（秒）"),
    }),
    z.any(),
    async (input) => recordReview(openDB(), input.id, input.rating, input.time_spent),
  );

  @command("复习进度统计（掌握度分布 + 待复习数 + 薄弱项）")
  stats = handler(
    z.object({
      deck: z.string().optional().describe("按 deck 过滤"),
    }),
    z.any(),
    async (input) => getStats(openDB(), input.deck),
  );
}

if (import.meta.main) {
  await new ReviewClip().start();
}
