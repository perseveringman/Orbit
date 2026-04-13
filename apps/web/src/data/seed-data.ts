import type { DatabasePort } from '@orbit/platform-contracts';

/**
 * Seed the database with sample data that matches mock-data.ts shapes.
 * Uses raw SQL for speed — all inserts are synchronous.
 */
export function seedDatabase(db: DatabasePort): void {
  // Check if already seeded
  const existing = db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM projects');
  if (existing[0]?.cnt && existing[0].cnt > 0) return;

  const now = new Date().toISOString();

  db.transaction(() => {
    // ── Projects ────────────────────────────────────────────────────────
    const projects = [
      { id: 'proj-orbit-mvp', title: 'Orbit MVP 发布', status: 'active', description: '构建个人生产力系统核心', createdAt: '2026-03-01T09:00:00Z' },
      { id: 'proj-reading', title: '深度阅读计划', status: 'active', description: '持续学习与知识内化', createdAt: '2026-03-15T09:00:00Z' },
      { id: 'proj-health', title: '健康管理', status: 'paused', description: '身心可持续发展', createdAt: '2026-02-01T09:00:00Z' },
    ];

    for (const p of projects) {
      db.run(
        `INSERT INTO projects (id, title, description, status, created_at, updated_at, deleted_flg)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [p.id, p.title, p.description, p.status, p.createdAt, now],
      );
      db.run(
        `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
         VALUES (?, 'project', ?, 'projects', 'wiki', ?, ?, ?, 'human', 'private', ?, ?, ?, 0)`,
        [`project:${p.id}`, p.id, p.title, p.description, p.status, `seed-${p.id}`, p.createdAt, now],
      );
    }

    // ── Milestones ──────────────────────────────────────────────────────
    const milestones = [
      { id: 'ms-shell', projectId: 'proj-orbit-mvp', title: 'Shell 与导航系统', status: 'done', targetDate: '2026-04-05', description: '侧边栏导航、主题切换、页面路由全部可用' },
      { id: 'ms-task-engine', projectId: 'proj-orbit-mvp', title: '任务引擎核心', status: 'active', targetDate: '2026-04-15', description: '任务 CRUD、状态流转、专注模式全部可用' },
      { id: 'ms-review', projectId: 'proj-orbit-mvp', title: '回顾系统', status: 'planned', targetDate: '2026-04-25', description: '日回顾、周回顾、项目复盘全部可用' },
      { id: 'ms-books-q2', projectId: 'proj-reading', title: 'Q2 阅读目标', status: 'active', targetDate: '2026-06-30', description: '完成 3 本书的阅读笔记' },
      { id: 'ms-routine', projectId: 'proj-health', title: '建立晨间例程', status: 'planned', targetDate: null, description: '连续 21 天执行晨间例程' },
    ];

    for (const m of milestones) {
      db.run(
        `INSERT INTO milestones (id, project_id, title, description, target_date, status, created_at, updated_at, deleted_flg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [m.id, m.projectId, m.title, m.description, m.targetDate, m.status, now, now],
      );
      db.run(
        `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
         VALUES (?, 'milestone', ?, 'milestones', 'wiki', ?, ?, ?, 'human', 'private', ?, ?, ?, 0)`,
        [`milestone:${m.id}`, m.id, m.title, m.description, m.status, `seed-${m.id}`, now, now],
      );
      // Link milestone → project
      db.run(
        `INSERT INTO links (link_id, source_uid, target_uid, relation_type, origin, status, created_at, updated_at, deleted_flg)
         VALUES (?, ?, ?, 'belongs_to', 'human', 'active', ?, ?, 0)`,
        [`link-ms-${m.id}`, `milestone:${m.id}`, `project:${m.projectId}`, now, now],
      );
    }

    // ── Tasks ───────────────────────────────────────────────────────────
    const tasks = [
      { id: 'task-1', title: '实现侧边栏导航组件', description: '基于 HeroUI 构建可折叠侧边栏，支持多级导航。', status: 'done', projectId: 'proj-orbit-mvp', milestoneId: 'ms-shell', dueDate: '2026-04-03', focusRank: null, completedAt: '2026-04-03T16:00:00Z', createdAt: '2026-03-20T09:00:00Z', updatedAt: '2026-04-03T16:00:00Z' },
      { id: 'task-2', title: '主题切换（亮/暗）', description: '实现 light/dark 主题切换，持久化用户偏好。', status: 'done', projectId: 'proj-orbit-mvp', milestoneId: 'ms-shell', dueDate: '2026-04-04', focusRank: null, completedAt: '2026-04-04T14:00:00Z', createdAt: '2026-03-21T09:00:00Z', updatedAt: '2026-04-04T14:00:00Z' },
      { id: 'task-3', title: '构建任务列表视图', description: '实现按状态分组的任务列表和看板视图。', status: 'focused', projectId: 'proj-orbit-mvp', milestoneId: 'ms-task-engine', dueDate: '2026-04-10', focusRank: 1, completedAt: null, createdAt: '2026-04-05T09:00:00Z', updatedAt: '2026-04-09T10:00:00Z' },
      { id: 'task-4', title: '任务状态流转引擎', description: '实现有限状态机，定义任务状态间的合法流转。', status: 'ready', projectId: 'proj-orbit-mvp', milestoneId: 'ms-task-engine', dueDate: '2026-04-11', focusRank: 2, completedAt: null, createdAt: '2026-04-05T09:00:00Z', updatedAt: '2026-04-08T12:00:00Z' },
      { id: 'task-5', title: '专注模式 UI', description: '构建沉浸式单任务专注视图，包含计时器和材料面板。', status: 'scheduled', projectId: 'proj-orbit-mvp', milestoneId: 'ms-task-engine', dueDate: '2026-04-12', focusRank: 3, completedAt: null, createdAt: '2026-04-06T09:00:00Z', updatedAt: '2026-04-09T08:00:00Z' },
      { id: 'task-6', title: '快速捕获输入框', description: '实现意图解析的快速任务捕获。', status: 'captured', projectId: 'proj-orbit-mvp', milestoneId: 'ms-task-engine', dueDate: null, focusRank: null, completedAt: null, createdAt: '2026-04-08T14:00:00Z', updatedAt: '2026-04-08T14:00:00Z' },
      { id: 'task-7', title: '任务详情面板', description: '右侧滑出面板显示任务详情、子任务、材料和历史。', status: 'clarifying', projectId: 'proj-orbit-mvp', milestoneId: 'ms-task-engine', dueDate: '2026-04-13', focusRank: null, completedAt: null, createdAt: '2026-04-07T10:00:00Z', updatedAt: '2026-04-09T09:00:00Z' },
      { id: 'task-8', title: '日回顾界面', description: '构建每日回顾页面，包含完成列表和决策记录。', status: 'ready', projectId: 'proj-orbit-mvp', milestoneId: 'ms-review', dueDate: '2026-04-20', focusRank: null, completedAt: null, createdAt: '2026-04-08T09:00:00Z', updatedAt: '2026-04-08T09:00:00Z' },
      { id: 'task-9', title: '周回顾与项目复盘', description: '实现周回顾统计和项目复盘功能。', status: 'captured', projectId: 'proj-orbit-mvp', milestoneId: 'ms-review', dueDate: null, focusRank: null, completedAt: null, createdAt: '2026-04-08T09:30:00Z', updatedAt: '2026-04-08T09:30:00Z' },
      { id: 'task-10', title: '阅读《深度工作》并写笔记', description: '完成 Cal Newport 的《Deep Work》阅读，输出结构化笔记。', status: 'focused', projectId: 'proj-reading', milestoneId: 'ms-books-q2', dueDate: '2026-04-20', focusRank: 4, completedAt: null, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-04-09T07:00:00Z' },
      { id: 'task-11', title: '阅读《原子习惯》', description: '阅读 James Clear 的《Atomic Habits》。', status: 'ready', projectId: 'proj-reading', milestoneId: 'ms-books-q2', dueDate: '2026-05-15', focusRank: null, completedAt: null, createdAt: '2026-03-20T09:00:00Z', updatedAt: '2026-04-05T12:00:00Z' },
      { id: 'task-12', title: '设计晨间例程流程', description: '定义每日早晨固定流程：冥想、运动、阅读。', status: 'blocked', projectId: 'proj-health', milestoneId: 'ms-routine', dueDate: null, focusRank: null, completedAt: null, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-04-01T08:00:00Z' },
      { id: 'task-13', title: '整理 Orbit 文档结构', description: null, status: 'captured', projectId: 'proj-orbit-mvp', milestoneId: null, dueDate: null, focusRank: null, completedAt: null, createdAt: '2026-04-09T11:00:00Z', updatedAt: '2026-04-09T11:00:00Z' },
      { id: 'task-14', title: '调研 AI 意图解析方案', description: '研究 NLP 方案，用于快速捕获时的意图理解。', status: 'scheduled', projectId: 'proj-orbit-mvp', milestoneId: 'ms-task-engine', dueDate: '2026-04-14', focusRank: 5, completedAt: null, createdAt: '2026-04-08T16:00:00Z', updatedAt: '2026-04-09T08:00:00Z' },
      { id: 'task-15', title: '记录本周学习心得', description: null, status: 'done', projectId: null, milestoneId: null, dueDate: '2026-04-09', focusRank: null, completedAt: '2026-04-09T10:00:00Z', createdAt: '2026-04-07T09:00:00Z', updatedAt: '2026-04-09T10:00:00Z' },
    ];

    for (const t of tasks) {
      db.run(
        `INSERT INTO tasks (id, project_id, milestone_id, title, description, status, due_date, focus_rank, completed_at, created_at, updated_at, deleted_flg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [t.id, t.projectId, t.milestoneId, t.title, t.description, t.status, t.dueDate, t.focusRank, t.completedAt, t.createdAt, t.updatedAt],
      );
      db.run(
        `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
         VALUES (?, 'task', ?, 'tasks', 'wiki', ?, ?, ?, 'human', 'private', ?, ?, ?, 0)`,
        [`task:${t.id}`, t.id, t.title, t.description, t.status, `seed-${t.id}`, t.createdAt, t.updatedAt],
      );
      // Link task → project
      if (t.projectId) {
        db.run(
          `INSERT INTO links (link_id, source_uid, target_uid, relation_type, origin, status, created_at, updated_at, deleted_flg)
           VALUES (?, ?, ?, 'belongs_to', 'human', 'active', ?, ?, 0)`,
          [`link-tp-${t.id}`, `task:${t.id}`, `project:${t.projectId}`, now, now],
        );
      }
      // Link task → milestone
      if (t.milestoneId) {
        db.run(
          `INSERT INTO links (link_id, source_uid, target_uid, relation_type, origin, status, created_at, updated_at, deleted_flg)
           VALUES (?, ?, ?, 'belongs_to', 'human', 'active', ?, ?, 0)`,
          [`link-tm-${t.id}`, `task:${t.id}`, `milestone:${t.milestoneId}`, now, now],
        );
      }
    }

    // ── Events ──────────────────────────────────────────────────────────
    const events = [
      { id: 'evt-1', streamUid: 'task:task-3', eventType: 'task.status_changed', payload: '{"from":"ready","to":"focused"}', occurredAt: '2026-04-09T09:00:00Z' },
      { id: 'evt-2', streamUid: 'task:task-3', eventType: 'task.status_changed', payload: '{"from":"scheduled","to":"ready"}', occurredAt: '2026-04-08T14:00:00Z' },
      { id: 'evt-3', streamUid: 'task:task-3', eventType: 'task.status_changed', payload: '{"from":"captured","to":"scheduled"}', occurredAt: '2026-04-06T10:00:00Z' },
      { id: 'evt-4', streamUid: 'task:task-1', eventType: 'task.status_changed', payload: '{"from":"focused","to":"done"}', occurredAt: '2026-04-03T16:00:00Z' },
      { id: 'evt-5', streamUid: 'task:task-12', eventType: 'task.status_changed', payload: '{"from":"ready","to":"blocked","note":"需要先确定运动计划"}', occurredAt: '2026-04-01T08:00:00Z' },
      { id: 'evt-6', streamUid: 'task:task-10', eventType: 'task.assignment', payload: '{"note":"设为本周重点任务"}', occurredAt: '2026-04-07T09:00:00Z' },
      { id: 'evt-7', streamUid: 'task:task-15', eventType: 'task.status_changed', payload: '{"from":"focused","to":"done"}', occurredAt: '2026-04-09T10:00:00Z' },
    ];

    for (const e of events) {
      db.run(
        `INSERT INTO events (event_id, stream_uid, event_type, actor_type, payload_json, occurred_at, created_at)
         VALUES (?, ?, ?, 'user', ?, ?, ?)`,
        [e.id, e.streamUid, e.eventType, e.payload, e.occurredAt, e.occurredAt],
      );
    }

    // ── Source Endpoints (Subscriptions) ─────────────────────────────────
    const endpoints = [
      { id: 'ep-hn', title: 'Hacker News', endpointType: 'rss', url: 'https://news.ycombinator.com', feedUrl: 'https://rsshub.app/hackernews/best', description: 'Top stories from HN', syncStatus: 'idle', totalItems: 5, createdAt: '2026-03-01T10:00:00Z' },
      { id: 'ep-github', title: 'GitHub Trending', endpointType: 'rss', url: 'https://github.com/trending', feedUrl: 'https://rsshub.app/github/trending/daily', description: 'Daily trending repos', syncStatus: 'idle', totalItems: 3, createdAt: '2026-03-05T10:00:00Z' },
      { id: 'ep-lex', title: 'Lex Fridman Podcast', endpointType: 'podcast', url: 'https://lexfridman.com/podcast', feedUrl: 'https://lexfridman.com/feed/podcast/', description: 'Conversations about intelligence', syncStatus: 'idle', totalItems: 4, createdAt: '2026-03-10T10:00:00Z' },
      { id: 'ep-fireship', title: 'Fireship (YouTube)', endpointType: 'youtube', url: 'https://www.youtube.com/@Fireship', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA', description: 'High-intensity code tutorials', syncStatus: 'paused', totalItems: 2, createdAt: '2026-03-15T10:00:00Z' },
      { id: 'ep-xiaoyuzhou', title: '不合时宜', endpointType: 'podcast', url: 'https://www.xiaoyuzhoufm.com/podcast/6013f9f58e2f7ee375cf4216', feedUrl: null, description: '关于当下的文化观察与思考', syncStatus: 'idle', totalItems: 0, createdAt: '2026-03-20T10:00:00Z' },
    ];

    for (const ep of endpoints) {
      db.run(
        `INSERT INTO source_endpoints (id, title, endpoint_type, url, feed_url, description, icon_url, language, fetch_interval_minutes, sync_status, quality_score, total_items, confirmed_items, consecutive_errors, created_at, updated_at, deleted_flg)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 60, ?, 0.5, ?, 0, 0, ?, ?, 0)`,
        [ep.id, ep.title, ep.endpointType, ep.url, ep.feedUrl, ep.description, ep.syncStatus, ep.totalItems, ep.createdAt, now],
      );
      db.run(
        `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
         VALUES (?, 'source_endpoint', ?, 'source_endpoints', 'system', ?, ?, 'active', 'human', 'private', ?, ?, ?, 0)`,
        [`source_endpoint:${ep.id}`, ep.id, ep.title, ep.description, `seed-${ep.id}`, ep.createdAt, now],
      );
    }

    // ── Articles ─────────────────────────────────────────────────────────
    const articles = [
      { id: 'art-1', title: 'Attention Is All You Need', sourceUrl: 'https://arxiv.org/abs/1706.03762', author: 'Vaswani et al.', mediaType: 'web_article', status: 'reading', readingProgress: 0.45, origin: 'user_save', summary: 'The seminal Transformer paper', publishedAt: '2017-06-12T00:00:00Z', createdAt: '2026-04-01T08:00:00Z', endpointId: null },
      { id: 'art-2', title: 'How to Build a Second Brain', sourceUrl: 'https://fortelabs.com/blog/basboverview/', author: 'Tiago Forte', mediaType: 'web_article', status: 'unread', readingProgress: null, origin: 'user_save', summary: 'A proven method to organise your digital life', publishedAt: '2019-02-20T00:00:00Z', createdAt: '2026-04-02T09:00:00Z', endpointId: null },
      { id: 'art-3', title: 'The Bitter Lesson', sourceUrl: 'http://www.incompleteideas.net/IncIdeas/BitterLesson.html', author: 'Rich Sutton', mediaType: 'web_article', status: 'archived', readingProgress: 1.0, origin: 'user_save', summary: 'Computation > human knowledge in AI', publishedAt: '2019-03-13T00:00:00Z', createdAt: '2026-04-03T10:00:00Z', endpointId: null },
      { id: 'art-4', title: 'Lex Fridman #400: Elon Musk', sourceUrl: 'https://lexfridman.com/elon-musk-4', author: 'Lex Fridman', mediaType: 'podcast', status: 'unread', readingProgress: null, origin: 'feed_auto', summary: 'War, AI, aliens, politics, physics, video games, and humanity', publishedAt: '2023-12-28T00:00:00Z', createdAt: '2026-04-05T11:00:00Z', endpointId: 'ep-lex' },
      { id: 'art-5', title: 'React Server Components Explained', sourceUrl: 'https://www.youtube.com/watch?v=TQQPAU21ZUw', author: 'Fireship', mediaType: 'youtube', status: 'reading', readingProgress: 0.7, origin: 'feed_auto', summary: 'RSC in 100 seconds + deep dive', publishedAt: '2024-01-15T00:00:00Z', createdAt: '2026-04-06T12:00:00Z', endpointId: 'ep-fireship' },
      { id: 'art-6', title: 'SQLite is not a toy database', sourceUrl: 'https://antonz.org/sqlite-is-not-a-toy-database/', author: 'Anton Zhiyanov', mediaType: 'web_article', status: 'unread', readingProgress: null, origin: 'feed_auto', summary: 'Why SQLite deserves more respect', publishedAt: '2024-02-10T00:00:00Z', createdAt: '2026-04-07T08:00:00Z', endpointId: 'ep-hn' },
    ];

    for (const a of articles) {
      db.run(
        `INSERT INTO articles (id, content_item_id, source_endpoint_id, title, source_url, author, media_type, language, summary, status, reading_progress, origin, published_at, fetched_at, created_at, updated_at, deleted_flg)
         VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [a.id, a.endpointId, a.title, a.sourceUrl, a.author, a.mediaType, a.summary, a.status, a.readingProgress, a.origin, a.publishedAt, a.createdAt, a.createdAt, now],
      );
      db.run(
        `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
         VALUES (?, 'article', ?, 'articles', 'sources', ?, ?, ?, ?, 'private', ?, ?, ?, 0)`,
        [`article:${a.id}`, a.id, a.title, a.summary, a.status, a.origin, `seed-${a.id}`, a.createdAt, now],
      );
    }

    // ── Content Items ────────────────────────────────────────────────────
    const contentItems = [
      { id: 'ci-1', endpointId: 'ep-hn', externalId: 'hn-39901234', title: 'Show HN: I built a local-first personal OS', status: 'pending', rawJson: '{"url":"https://example.com/localfirst-os","points":342}' },
      { id: 'ci-2', endpointId: 'ep-hn', externalId: 'hn-39901235', title: 'Why I moved from Postgres to SQLite', status: 'pending', rawJson: '{"url":"https://example.com/pg-to-sqlite","points":218}' },
      { id: 'ci-3', endpointId: 'ep-github', externalId: 'gh-trending-1', title: 'juspay/hyperswitch — Open source payments switch', status: 'pending', rawJson: '{"url":"https://github.com/juspay/hyperswitch","stars":10500}' },
      { id: 'ci-4', endpointId: 'ep-lex', externalId: 'lex-401', title: '#401: Sam Altman on the Future of AI', status: 'promoted', rawJson: '{"url":"https://lexfridman.com/sam-altman-2","duration":"3:14:22"}' },
      { id: 'ci-5', endpointId: 'ep-fireship', externalId: 'yt-fw1234', title: 'Bun 1.0 — The Node.js Killer?', status: 'pending', rawJson: '{"url":"https://www.youtube.com/watch?v=abc123","duration":"12:05"}' },
    ];

    for (const ci of contentItems) {
      db.run(
        `INSERT INTO content_items (id, source_endpoint_id, external_id, title, content_type, raw_json, origin, processing_depth, status, created_at, updated_at, deleted_flg)
         VALUES (?, ?, ?, ?, NULL, ?, 'feed_auto', 'lightweight', ?, ?, ?, 0)`,
        [ci.id, ci.endpointId, ci.externalId, ci.title, ci.rawJson, ci.status, now, now],
      );
    }

    // ── Highlights ───────────────────────────────────────────────────────
    const highlights = [
      { id: 'hl-1', articleId: 'art-1', quoteText: 'Attention mechanisms have become an integral part of compelling sequence modeling.', color: 'yellow', note: '核心论点', kind: 'highlight' },
      { id: 'hl-2', articleId: 'art-1', quoteText: 'The Transformer is the first transduction model relying entirely on self-attention.', color: 'blue', note: null, kind: 'highlight' },
      { id: 'hl-3', articleId: 'art-3', quoteText: 'The biggest lesson that can be read from 70 years of AI research is that general methods that leverage computation are ultimately the most effective.', color: 'green', note: '这就是 Bitter Lesson 的核心', kind: 'highlight' },
    ];

    for (const h of highlights) {
      db.run(
        `INSERT INTO highlights (id, source_object_type, source_object_id, anchor_json, quote_text, color, note, highlight_kind, created_by, created_at, updated_at, deleted_flg)
         VALUES (?, 'article', ?, '{}', ?, ?, ?, ?, 'manual', ?, ?, 0)`,
        [h.id, h.articleId, h.quoteText, h.color, h.note, h.kind, now, now],
      );
    }

    // ── FTS entries for search ──────────────────────────────────────────
    for (const t of tasks) {
      db.run(
        `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
         VALUES (?, ?, ?, '')`,
        [`task:${t.id}`, t.title, t.description ?? ''],
      );
    }
    for (const p of projects) {
      db.run(
        `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
         VALUES (?, ?, ?, '')`,
        [`project:${p.id}`, p.title, p.description],
      );
    }
    for (const m of milestones) {
      db.run(
        `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
         VALUES (?, ?, ?, '')`,
        [`milestone:${m.id}`, m.title, m.description],
      );
    }
    for (const a of articles) {
      db.run(
        `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
         VALUES (?, ?, ?, ?)`,
        [`article:${a.id}`, a.title, a.summary, a.author ?? ''],
      );
    }
    for (const ep of endpoints) {
      db.run(
        `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
         VALUES (?, ?, ?, ?)`,
        [`source_endpoint:${ep.id}`, ep.title, ep.description, ep.endpointType],
      );
    }
  });
}
