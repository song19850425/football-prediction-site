/* 全站页面清单：门户首页与查看器共用同一数据源 */
const PAGES = [
  {
    group: "核心应用与看板",
    icon: "🛰️",
    items: [
      { icon: "📡", title: "AI 足球预测中心 · 实时看板", desc: "整合赛程、欧赔、新闻热点的实时仪表盘（V2.4）。", href: "dashboards/prediction-dashboard-deploy/index.html", tag: "实时看板" },
      { icon: "📊", title: "预测数据看板", desc: "KPI 概览、走势与明细下钻的多联赛数据看板。", href: "dashboards/prediction-dashboard/index.html", tag: "Dashboard" },
      { icon: "⚡", title: "赔率分析应用（Vue SPA）", desc: "赛程 / 赔率录入 / 比赛详情 / 回测 / AI 分析的完整单页应用。", href: "apps/football-odds/index.html", tag: "Web App" }
    ]
  },
  {
    group: "产品原型 · 桌面版",
    icon: "🖥️",
    items: [
      { icon: "🧮", title: "赔率录入", desc: "输入欧赔，实时计算隐含概率与价值偏差。", href: "apps/football-odds-mvp-desktop/pages/odds-input.html", tag: "原型" },
      { icon: "🔍", title: "比赛详情", desc: "单场对阵的模型预测、概率分布与投注建议。", href: "apps/football-odds-mvp-desktop/pages/match-detail.html", tag: "原型" },
      { icon: "🗓️", title: "赛程", desc: "按联赛筛选的赛事日历与开赛提醒。", href: "apps/football-odds-mvp-desktop/pages/schedule.html", tag: "原型" },
      { icon: "🤖", title: "AI 分析", desc: "基于模型与情报的赛前分析解读。", href: "apps/football-odds-mvp-desktop/pages/ai-analysis.html", tag: "原型" },
      { icon: "📐", title: "因子分析", desc: "特征贡献度与关键因子拆解。", href: "apps/football-odds-mvp-desktop/pages/factor-analysis.html", tag: "原型" },
      { icon: "📅", title: "本周预测 v2", desc: "本轮全部赛事的批量预测汇总。", href: "apps/football-odds-mvp-desktop/pages/weekly-prediction-v2.html", tag: "预测" },
      { icon: "📆", title: "本周预测（初版）", desc: "早期版本的周度预测页面。", href: "apps/football-odds-mvp-desktop/pages/weekly-prediction.html", tag: "预测" },
      { icon: "✅", title: "周末验证", desc: "预测对阵实际赛果的命中回验。", href: "apps/football-odds-mvp-desktop/pages/weekend-verification.html", tag: "验证" }
    ]
  },
  {
    group: "产品原型 · 移动版",
    icon: "📱",
    items: [
      { icon: "🧮", title: "赔率录入（移动）", desc: "移动端适配的赔率录入交互。", href: "apps/football-odds-mvp-mobile/pages/odds-input.html", tag: "原型" },
      { icon: "🔍", title: "比赛详情（移动）", desc: "移动端单场详情与预测卡片。", href: "apps/football-odds-mvp-mobile/pages/match-detail.html", tag: "原型" },
      { icon: "🗓️", title: "赛程（移动）", desc: "移动端赛事日历。", href: "apps/football-odds-mvp-mobile/pages/schedule.html", tag: "原型" },
      { icon: "🤖", title: "AI 分析（移动）", desc: "移动端智能分析视图。", href: "apps/football-odds-mvp-mobile/pages/ai-analysis.html", tag: "原型" }
    ]
  },
  {
    group: "V3 预测手册",
    icon: "📖",
    items: [
      { icon: "📘", title: "预测手册首页", desc: "V3 方法论、流程与操作手册。", href: "apps/v3-prediction-manual/pages/manual.html", tag: "手册" },
      { icon: "🎯", title: "赔率预测 v2", desc: "结构化赔率预测工作台。", href: "apps/v3-prediction-manual/pages/odds-prediction-v2.html", tag: "工具" },
      { icon: "🎲", title: "赔率预测", desc: "赔率预测基础版。", href: "apps/v3-prediction-manual/pages/odds-prediction.html", tag: "工具" },
      { icon: "🏁", title: "预测结果", desc: "历史预测结果记录。", href: "apps/v3-prediction-manual/pages/prediction-results.html", tag: "结果" },
      { icon: "🧠", title: "提示词库", desc: "分析所用的提示词模板集合。", href: "apps/v3-prediction-manual/pages/prompt-library.html", tag: "工具" },
      { icon: "🧾", title: "预测报告 20260814", desc: "V3 手册配套的预测报告样例。", href: "apps/v3-prediction-manual/reports/prediction-report-20260814.html", tag: "报告" }
    ]
  },
  {
    group: "预测报告",
    icon: "📝",
    items: [
      { icon: "⚽", title: "足球预测展示", desc: "总览型预测结果展示页。", href: "reports/football-predict-showcase.html", tag: "报告" },
      { icon: "📈", title: "2026-09-04 预测展示", desc: "当日预测结果展示。", href: "reports/20260904-predict.html", tag: "报告" },
      { icon: "📉", title: "2026-09-06 周末剩余预测", desc: "周末剩余场次预测。", href: "reports/20260906-weekend-predict.html", tag: "报告" },
      { icon: "🇰🇷", title: "韩K联 2026-09-09 预测", desc: "韩K联赛事预测报告。", href: "reports/kleague-20260909-predict.html", tag: "报告" },
      { icon: "🇪🇺", title: "欧洲次级联赛 2026-09-02 预测", desc: "欧洲次级联赛预测报告。", href: "reports/20260902-euro2-predict.html", tag: "报告" }
    ]
  },
  {
    group: "验证报告",
    icon: "✅",
    items: [
      { icon: "🇰🇷", title: "韩K联 2026-09-09 验证报告", desc: "韩K联预测命中回验。", href: "reports/kleague-20260909-verify.html", tag: "验证" },
      { icon: "🔁", title: "韩K联 2026-09-09 重新评估", desc: "赛后复盘与再评估。", href: "reports/kleague-20260909-reeval.html", tag: "复盘" },
      { icon: "🇪🇺", title: "欧洲次级 2026-09-02 验证展示", desc: "欧洲次级联赛预测验证。", href: "reports/20260902-euro2-verify.html", tag: "验证" }
    ]
  },
  {
    group: "数据 / 模型 / 回测",
    icon: "🔬",
    items: [
      { icon: "🗂️", title: "原始数据报告", desc: "五大联赛原始数据概览与质量分析。", href: "apps/raw-data-report/pages/raw-data-report.html", tag: "数据" },
      { icon: "📊", title: "周末预测（原始数据）", desc: "基于原始数据集的周末预测。", href: "apps/raw-data-report/pages/weekend-predictions.html", tag: "数据" },
      { icon: "🧾", title: "周末验证（原始数据）", desc: "原始数据集预测的命中验证。", href: "apps/raw-data-report/pages/weekend-verification.html", tag: "数据" },
      { icon: "⚖️", title: "偏差分析", desc: "模型预测偏差与校准分析。", href: "apps/raw-data-report/pages/bias-analysis.html", tag: "分析" },
      { icon: "🏆", title: "欧战明细", desc: "欧洲杯赛数据明细。", href: "apps/raw-data-report/pages/european-cups-detail.html", tag: "明细" },
      { icon: "🇩🇪", title: "德甲赛季明细", desc: "德甲赛季级数据明细。", href: "apps/raw-data-report/pages/bundesliga-season-detail.html", tag: "明细" },
      { icon: "🧮", title: "回测报告", desc: "XGBoost 模型滚动赛季回测结果。", href: "reports/backtest/backtest_report.html", tag: "回测" },
      { icon: "🚀", title: "V3.2 升级方案", desc: "模型与系统 V3.2 的升级规划。", href: "reports/v32-upgrade-plan.html", tag: "文档" },
      { icon: "🔭", title: "开源预测项目对比分析", desc: "同类开源方案横向对比。", href: "reports/oss-comparison.html", tag: "文档" }
    ]
  }
];

function countAll() { return PAGES.reduce((n, g) => n + g.items.length, 0); }

function renderPortal() {
  const root = document.getElementById("portal-root");
  if (!root) return;
  root.innerHTML = PAGES.map(g => `
    <section class="section" id="g-${encodeURIComponent(g.group)}">
      <div class="section-head">
        <h2>${g.icon} ${g.group}</h2>
        <span class="count">${g.items.length} 个页面</span>
      </div>
      <div class="grid">
        ${g.items.map(it => `
          <a class="card" href="${it.href}" target="_blank" rel="noopener">
            <span class="ico">${it.icon}</span>
            <h3>${it.title}</h3>
            <p>${it.desc}</p>
            <span class="tag">${it.tag}</span>
            <span class="open">打开页面 →</span>
          </a>`).join("")}
      </div>
    </section>`).join("");
}

function renderViewer() {
  const side = document.getElementById("vsidebar-list");
  const frame = document.getElementById("vframe");
  const bar = document.getElementById("vpath");
  const ext = document.getElementById("vext");
  if (!side) return;

  let active = null;
  const flat = [];
  PAGES.forEach(g => g.items.forEach(it => flat.push(it)));

  function build(filter) {
    const f = (filter || "").trim().toLowerCase();
    side.innerHTML = PAGES.map(g => {
      const items = g.items.filter(it => !f || (it.title + it.desc + it.tag).toLowerCase().includes(f));
      if (!items.length) return "";
      return `<div class="vgroup">${g.icon} ${g.group}</div>` +
        items.map(it => {
          const idx = flat.indexOf(it);
          return `<a class="vitem" data-idx="${idx}">${it.icon} ${it.title}</a>`;
        }).join("");
    }).join("") || `<div class="vgroup">没有匹配的页面</div>`;
    bind();
  }

  function select(idx) {
    const it = flat[idx];
    if (!it) return;
    frame.src = it.href;
    bar.textContent = it.title + "  ·  " + it.href;
    ext.href = it.href;
    document.querySelectorAll(".vitem").forEach(e => e.classList.toggle("active", Number(e.dataset.idx) === idx));
  }

  function bind() {
    side.querySelectorAll(".vitem").forEach(e => e.addEventListener("click", () => select(Number(e.dataset.idx))));
  }

  const search = document.getElementById("vsearch");
  if (search) search.addEventListener("input", e => build(e.target.value));

  build("");
  select(0);
}