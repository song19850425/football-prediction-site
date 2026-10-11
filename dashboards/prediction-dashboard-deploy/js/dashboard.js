/**
 * 足球预测仪表盘 - 动态渲染引擎
 * 负责从 API 加载数据并渲染到 DOM
 */

// ===== SVG 图标库 =====
const ICONS = {
  star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  warning: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2z"/></svg>',
  clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>',
  square: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>',
  file: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  heart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  comment: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  share: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  weibo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
  moments: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>',
  douyin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
  settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

// ===== 平台图标映射 =====
const PLATFORM_ICONS = {
  'X': ICONS.x,
  '微博': ICONS.weibo,
  '朋友圈': ICONS.moments,
  '抖音': ICONS.douyin,
};

// ===== 风险等级样式 =====
const RISK_STYLES = {
  low:    { class: 'risk-low',    color: 'var(--pd-win)' },
  medium: { class: 'risk-mid',    color: 'var(--pd-draw)' },
  high:   { class: 'risk-high',   color: 'var(--pd-lose)' },
};

// ===== 预测结果样式 =====
const PRED_STYLES = {
  home: { class: 'pred-win',  color: 'var(--pd-win)' },
  draw: { class: 'pred-draw', color: 'var(--pd-draw)' },
  away: { class: 'pred-lose', color: 'var(--pd-lose)' },
};

// ===== 主渲染函数 =====
async function initDashboard() {
  showLoading(true);

  // 渲染联赛筛选标签
  renderLeagueTabs();

  try {
    // 并行加载所有数据
    const [matches, socialItems] = await Promise.all([
      FootballAPI.getAllMatches(),
      NewsAPI.getFootballNews()
    ]);

    AppData.matches = matches;
    AppData.socialItems = socialItems;

    // 渲染
    renderMatchCards(matches);
    renderSocialCards(socialItems);
    updateMatchCount(matches.length);
    const realCount = matches.filter(m => !m.isMock).length;
    updateDataStatus(realCount > 0);
    updateDataSourceBadge(realCount, matches.length);
    updateLastUpdateTime();

    console.log(`[Dashboard] 加载完成: ${matches.length} 场比赛 (真实${realCount}/演示${matches.length - realCount}), ${socialItems.length} 条热点`);
  } catch (err) {
    console.error('[Dashboard] 初始化失败:', err);
    AppData.error = err.message;
    updateDataStatus(false);
    // 降级：使用模拟数据
    if (CONFIG.USE_MOCK_FALLBACK) {
      const allLeagues = Object.keys(CONFIG.COMPETITIONS);
      const mockMatches = allLeagues.flatMap(k => getMockMatches(k));
      AppData.matches = mockMatches;
      renderMatchCards(mockMatches);
      renderSocialCards(getMockSocialData());
      updateMatchCount(mockMatches.length);
      updateDataSourceBadge(0, mockMatches.length);
      updateLastUpdateTime();
    }
  } finally {
    showLoading(false);
  }
}

// ===== 比赛卡片渲染 =====
function renderMatchCards(matches) {
  const container = document.getElementById('matchCardsContainer');
  if (!container) return;

  if (matches.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无比赛数据</div>';
    return;
  }

  container.innerHTML = matches.map((m, i) => {
    const risk = RISK_STYLES[m.riskLevel] || RISK_STYLES.medium;
    const pred = PRED_STYLES[m.prediction] || PRED_STYLES.draw;
    const isFeatured = m.isFeatured || i === 0;

    const tagsHTML = (m.tags || []).map(t => {
      const icon = t.icon === 'clock' ? ICONS.clock : t.icon === 'square' ? ICONS.square : ICONS.file;
      return `<span class="mini-tag">${icon} ${t.label}</span>`;
    }).join('\n');

    const featuredBadge = isFeatured ? `
      <div class="flex items-center gap-1 text-[var(--pd-gold)]">
        ${ICONS.star}${ICONS.star}
        <span class="text-xs font-semibold ml-1">焦点战</span>
      </div>` : '';

    const cardClass = isFeatured ? 'glass-card featured-card p-5 match-card' : 'glass-card p-5 match-card';
    const demoBadge = m.isMock ? '<span class="demo-badge" title="休赛期演示数据">演示</span>' : '';

    return `
      <div class="${cardClass}" data-league="${m.league}">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="league-badge ${LEAGUE_LABELS[m.league] || 'league-csl'}">${m.leagueName}</span>
            ${demoBadge}
            <span class="text-xs text-muted-foreground">${m.time}</span>
          </div>
          ${featuredBadge}
        </div>

        <div class="text-center mb-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex-1 text-right">
              <div class="font-bold text-base">${m.homeTeam}</div>
              <div class="text-xs text-muted-foreground mt-0.5">${m.homeSubtitle || ''}</div>
            </div>
            <div class="px-4 text-muted-foreground font-bold text-sm">VS</div>
            <div class="flex-1 text-left">
              <div class="font-bold text-base">${m.awayTeam}</div>
              <div class="text-xs text-muted-foreground mt-0.5">${m.awaySubtitle || ''}</div>
            </div>
          </div>
          <div class="risk-badge ${risk.class} mt-2">
            ${ICONS.warning}
            ${m.riskLabel}
          </div>
        </div>

        <div class="text-center mb-4 py-3 rounded-lg bg-muted/50">
          <div class="prediction-result ${pred.class} mb-1">${m.predictionLabel}</div>
          <div class="flex items-center justify-center gap-2 mb-2">
            <span class="text-2xl font-bold text-draw" style="color: ${pred.color};">${m.confidence}%</span>
            <span class="text-xs text-muted-foreground">置信度</span>
          </div>
          <div class="confidence-bar mx-auto" style="width: 80%;">
            <div class="confidence-fill" style="width: ${m.confidence}%; background: linear-gradient(90deg, ${pred.color}, ${pred.color}88);"></div>
          </div>
        </div>

        <div class="flex items-center justify-center gap-2 flex-wrap">
          ${tagsHTML}
        </div>
      </div>`;
  }).join('');

  // 重新绑定联赛筛选
  bindLeagueFilter();
}

// ===== 社交热点渲染 =====
function renderSocialCards(items) {
  const track = document.getElementById('socialTrack');
  if (!track) return;

  if (items.length === 0) {
    track.innerHTML = '<div class="empty-state social-empty">暂无热点数据</div>';
    return;
  }

  track.innerHTML = items.map(item => {
    const platformIcon = PLATFORM_ICONS[item.platform] || ICONS.x;
    const platformClass = item.platform === '微博' ? 'social-weibo' : '';

    return `
      <div class="social-card">
        <div class="social-header">
          <div class="social-platform ${platformClass}">
            ${platformIcon}
            <span>${item.platform}</span>
          </div>
          <div class="social-time">${item.time}</div>
        </div>
        <div class="social-content">${item.content}</div>
        <div class="social-footer">
          <div class="social-stat">${ICONS.heart} ${formatNumber(item.likes)}</div>
          <div class="social-stat">${ICONS.comment} ${formatNumber(item.comments)}</div>
          <div class="social-stat">${ICONS.share} ${formatNumber(item.shares)}</div>
        </div>
      </div>`;
  }).join('');

  // 重新启动滚动
  initSocialScroll();
}

// ===== 预测说明页渲染 =====
function renderReasoningPage() {
  const container = document.getElementById('reasoningContainer');
  if (!container) return;

  const matches = AppData.matches || [];
  if (matches.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无比赛数据，请先刷新</div>';
    return;
  }

  container.innerHTML = matches.map((m, i) => {
    const r = m.reasoning;
    const pred = PRED_STYLES[m.prediction] || PRED_STYLES.draw;
    const risk = RISK_STYLES[m.riskLevel] || RISK_STYLES.medium;

    // 推算因子列表
    let factorsHTML = '';
    if (r && r.factors && r.factors.length) {
      factorsHTML = r.factors.map(f => {
        const barColor = f.score >= 62 ? 'var(--pd-win)' : f.score >= 50 ? 'var(--pd-draw)' : 'var(--pd-lose)';
        return `
          <div class="reason-factor">
            <div class="reason-factor-head">
              <span class="reason-factor-key">${f.key}</span>
              <span class="reason-factor-val" style="color:${barColor}">${f.value}</span>
            </div>
            <div class="reason-factor-bar">
              <div class="reason-factor-fill" style="width:${f.score}%; background:${barColor};"></div>
            </div>
            <div class="reason-factor-note">${f.note}</div>
          </div>`;
      }).join('');
    }

    return `
      <div class="glass-card reason-card" data-league="${m.league}">
        <div class="reason-header">
          <div class="flex items-center gap-2">
            <span class="league-badge ${LEAGUE_LABELS[m.league] || 'league-csl'}">${m.leagueName}</span>
            ${m.isMock ? '<span class="demo-badge" title="休赛期演示数据">演示</span>' : ''}
            <span class="reason-time">${m.time}</span>
            <span class="risk-badge ${risk.class}">${ICONS.warning} ${m.riskLabel}</span>
          </div>
          <div class="reason-idx">#${i + 1}</div>
        </div>

        <div class="reason-teams">
          <span class="reason-team">${m.homeTeam}</span>
          <span class="reason-vs">VS</span>
          <span class="reason-team">${m.awayTeam}</span>
        </div>

        <div class="reason-verdict">
          <span class="prediction-result ${pred.class}">${m.predictionLabel}</span>
          <span class="reason-confidence" style="color:${pred.color};">${m.confidence}%</span>
          <span class="reason-verdict-text">${r ? r.verdict : ''}</span>
        </div>

        ${factorsHTML}

        ${r && r.conclusion ? `
        <div class="reason-conclusion">
          <strong>推算结论：</strong>${r.conclusion}
        </div>` : ''}
      </div>`;
  }).join('');
}

// ===== 盘口数据页渲染 =====
function renderOddsPage() {
  const container = document.getElementById('oddsContainer');
  if (!container) return;

  const matches = AppData.matches || [];
  if (matches.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无比赛数据，请先刷新</div>';
    return;
  }

  container.innerHTML = matches.map((m, i) => {
    const o = m.odds;
    if (!o) return '';
    const pred = PRED_STYLES[m.prediction] || PRED_STYLES.draw;
    const risk = RISK_STYLES[m.riskLevel] || RISK_STYLES.medium;

    // 欧赔三列
    const isReal = o.europeanSource === 'real';
    const euroRow = (src, label) => `
      <div class="odds-source">
        <span class="odds-source-name ${isReal ? 'odds-source-real' : ''}">${label}${isReal ? ' ✓真实' : ''}</span>
        <div class="odds-euro">
          <div class="odds-euro-cell"><span class="odds-euro-val">${src.european.home.toFixed(2)}</span><span class="odds-euro-label">主胜</span></div>
          <div class="odds-euro-cell"><span class="odds-euro-val">${src.european.draw.toFixed(2)}</span><span class="odds-euro-label">平</span></div>
          <div class="odds-euro-cell"><span class="odds-euro-val">${src.european.away.toFixed(2)}</span><span class="odds-euro-label">客胜</span></div>
        </div>
        <div class="odds-asian-row">
          <span class="odds-asian-line">${src.asian.lineLabel}</span>
          <span class="odds-water">上盘 <b>${src.asian.homeWater.toFixed(2)}</b></span>
          <span class="odds-water">下盘 <b>${src.asian.awayWater.toFixed(2)}</b></span>
          <span class="odds-ou">大${src.overUnder.line} <b>${src.overUnder.overWater.toFixed(2)}</b> / 小 <b>${src.overUnder.underWater.toFixed(2)}</b></span>
        </div>
      </div>`;

    return `
      <div class="glass-card odds-card" data-league="${m.league}">
        <div class="odds-header">
          <div class="flex items-center gap-2">
            <span class="league-badge ${LEAGUE_LABELS[m.league] || 'league-csl'}">${m.leagueName}</span>
            ${m.isMock ? '<span class="demo-badge" title="休赛期演示数据">演示</span>' : ''}
            <span class="reason-time">${m.time}</span>
            <span class="risk-badge ${risk.class}">${ICONS.warning} ${m.riskLabel}</span>
          </div>
          <span class="prediction-result ${pred.class}">${m.predictionLabel} ${m.confidence}%</span>
        </div>

        <div class="reason-teams">
          <span class="reason-team">${m.homeTeam}</span>
          <span class="reason-vs">VS</span>
          <span class="reason-team">${m.awayTeam}</span>
        </div>

        <!-- 欧赔隐含概率 -->
        <div class="odds-prob-row">
          <span class="odds-prob-cell" style="color:var(--pd-win)">主胜 ${o.european.probs.home}%</span>
          <span class="odds-prob-cell" style="color:var(--pd-draw)">平 ${o.european.probs.draw}%</span>
          <span class="odds-prob-cell" style="color:var(--pd-lose)">客胜 ${o.european.probs.away}%</span>
        </div>

        <!-- 内盘 vs 外盘 -->
        <div class="odds-compare">
          ${euroRow(o.domestic, '内盘 · 竞彩')}
          ${euroRow(o.international, '外盘 · 国际')}
        </div>

        <!-- 推荐玩法 -->
        <div class="odds-tip">
          <strong>推荐玩法：</strong>${o.tip.label} — ${o.tip.note}
        </div>
      </div>`;
  }).join('');
}

// ===== 页面切换（赛事预测 / 预测说明 / 盘口数据） =====
function switchPage(pageName) {
  document.querySelectorAll('.page-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.page-tab').forEach(el => el.classList.remove('active'));

  const tab = document.querySelector(`.page-tab[data-page="${pageName}"]`);
  if (tab) tab.classList.add('active');

  if (pageName === 'reasoning') {
    const sec = document.getElementById('page-reasoning');
    if (sec) sec.style.display = 'block';
    renderReasoningPage();
  } else if (pageName === 'odds') {
    const sec = document.getElementById('page-odds');
    if (sec) sec.style.display = 'block';
    renderOddsPage();
  } else {
    const sec = document.getElementById('page-matches');
    if (sec) sec.style.display = 'block';
  }
}

// ===== 辅助渲染 =====
function updateMatchCount(count) {
  const el = document.getElementById('matchCount');
  if (el) el.textContent = count;
  const rc = document.getElementById('reasonCount');
  if (rc) rc.textContent = count;
}

function updateDataStatus(success) {
  const el = document.getElementById('dataStatus');
  if (!el) return;
  if (success) {
    el.innerHTML = `${ICONS.check} 数据已连接`;
    el.className = 'data-status status-ok';
  } else {
    el.innerHTML = `${ICONS.alert} 使用离线数据`;
    el.className = 'data-status status-offline';
  }
}

// 数据源状态徽章：显示真实/模拟场数
function updateDataSourceBadge(realCount, total) {
  const el = document.getElementById('dataStatus');
  if (!el) return;
  if (realCount > 0) {
    const pct = Math.round(realCount / total * 100);
    el.innerHTML = `${ICONS.check} 真实数据 ${realCount}/${total} 场`;
    el.className = 'data-status status-ok';
    el.title = `其中 ${total - realCount} 场为演示数据（休赛期联赛）`;
  } else if (total > 0) {
    el.innerHTML = `${ICONS.alert} 演示数据 ${total} 场（休赛期）`;
    el.className = 'data-status status-offline';
  } else {
    el.innerHTML = `${ICONS.alert} 暂无数据`;
    el.className = 'data-status status-offline';
  }
}

function showLoading(show) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = show ? 'flex' : 'none';
}

function formatNumber(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// ===== 联赛筛选 =====
function renderLeagueTabs() {
  const container = document.getElementById('leagueFilterTabs');
  if (!container) return;

  const groups = {};
  LEAGUE_GROUPS.forEach(g => {
    if (g.key === 'all') return;
    if (!groups[g.group]) groups[g.group] = [];
    groups[g.group].push(g);
  });

  let html = '<div class="league-tab active" data-league="all">全部</div>';

  for (const [region, leagues] of Object.entries(groups)) {
    html += `<span class="region-label">${region}</span>`;
    leagues.forEach(l => {
      html += `<div class="league-tab" data-league="${l.key}">${l.name}</div>`;
    });
  }

  container.innerHTML = html;
  bindLeagueFilter();
}

function bindLeagueFilter() {
  document.querySelectorAll('.league-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.league-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      const league = this.dataset.league;
      const cards = document.querySelectorAll('.match-card');
      let visibleCount = 0;

      cards.forEach(card => {
        if (league === 'all' || card.dataset.league === league) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      document.getElementById('matchCount').textContent = visibleCount;
    });
  });
}

// ===== 社交滚动 =====
let socialScrollId = null;
let socialPaused = false;

function initSocialScroll() {
  if (socialScrollId) cancelAnimationFrame(socialScrollId);

  const track = document.getElementById('socialTrack');
  if (!track) return;

  let scrollPos = 0;
  const speed = 0.4;

  function autoScroll() {
    if (!socialPaused) {
      scrollPos += speed;
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (scrollPos >= maxScroll) scrollPos = 0;
      track.scrollLeft = scrollPos;
    }
    socialScrollId = requestAnimationFrame(autoScroll);
  }

  track.addEventListener('mouseenter', () => socialPaused = true);
  track.addEventListener('mouseleave', () => socialPaused = false);
  track.addEventListener('touchstart', () => socialPaused = true);
  track.addEventListener('touchend', () => socialPaused = false);

  socialScrollId = requestAnimationFrame(autoScroll);
}

// ===== API 设置面板 =====
function toggleSettings() {
  const panel = document.getElementById('apiSettingsPanel');
  const overlay = document.getElementById('settingsOverlay');
  if (!panel) return;
  const isVisible = panel.style.display === 'block';
  panel.style.display = isVisible ? 'none' : 'block';
  if (overlay) overlay.style.display = isVisible ? 'none' : 'block';

  if (!isVisible) {
    // 填充当前值
    document.getElementById('inputFootballKey').value = CONFIG.FOOTBALL_API_KEY;
    document.getElementById('inputNewsKey').value = CONFIG.NEWS_API_KEY;
    document.getElementById('inputSportsDBKey').value = CONFIG.SPORTSDB_API_KEY;
    const oddsEl = document.getElementById('inputOddsKey');
    if (oddsEl) oddsEl.value = CONFIG.ODDS_API_KEY || '';
  }
}

function saveSettings() {
  const fbKey = document.getElementById('inputFootballKey')?.value || '';
  const newsKey = document.getElementById('inputNewsKey')?.value || '';
  const sportsDBKey = document.getElementById('inputSportsDBKey')?.value || '';
  const oddsKey = document.getElementById('inputOddsKey')?.value?.trim() || '';

  localStorage.setItem('pd_football_key', fbKey);
  localStorage.setItem('pd_news_key', newsKey);
  localStorage.setItem('pd_sportsdb_key', sportsDBKey);
  localStorage.setItem('pd_odds_key', oddsKey);

  CONFIG.FOOTBALL_API_KEY = fbKey;
  CONFIG.NEWS_API_KEY = newsKey;
  CONFIG.SPORTSDB_API_KEY = sportsDBKey;
  CONFIG.ODDS_API_KEY = oddsKey;

  // 清空缓存
  apiCache._store = {};

  document.getElementById('apiSettingsPanel').style.display = 'none';
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) overlay.style.display = 'none';

  // 重新加载
  showToast('设置已保存，正在刷新数据...');
  initDashboard();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== 页面初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();

  // 页面切换 tab
  document.querySelectorAll('.page-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchPage(tab.getAttribute('data-page'));
    });
  });

  // 设置按钮
  const settingsBtn = document.getElementById('apiSettingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', toggleSettings);
  }

  // 保存按钮
  const saveBtn = document.getElementById('saveSettingsBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettings);
  }

  // 关闭设置面板
  function closeSettings() {
    document.getElementById('apiSettingsPanel').style.display = 'none';
    const overlay = document.getElementById('settingsOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  const closeBtn = document.getElementById('closeSettingsBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeSettings);

  const closeBtn2 = document.getElementById('closeSettingsBtn2');
  if (closeBtn2) closeBtn2.addEventListener('click', closeSettings);

  const settingsOverlay = document.getElementById('settingsOverlay');
  if (settingsOverlay) settingsOverlay.addEventListener('click', closeSettings);

  // 显示/隐藏密钥
  const KEY_INPUTS = ['inputFootballKey', 'inputSportsDBKey', 'inputNewsKey', 'inputOddsKey'];
  const toggleShowKeys = document.getElementById('toggleShowKeys');
  if (toggleShowKeys) {
    toggleShowKeys.addEventListener('change', () => {
      KEY_INPUTS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.type = toggleShowKeys.checked ? 'text' : 'password';
      });
    });
  }

  // 刷新按钮（手动：清缓存强制全量刷新）
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      apiCache._store = {};
      spinRefreshBtn(refreshBtn);
      initDashboard();
    });
  }

  // ===== 定时自动刷新（每 5 分钟静默更新，页面保持"活"状态）=====
  // 注1：新闻接口已有独立 30 分钟缓存兜底，不会因自动刷新耗尽每日额度
  // 注2：自动刷新【不清缓存】——每个联赛 15 分钟缓存期内不会重复请求，
  //      只串行重拉缓存过期的联赛，最大限度降低 API 压力
  setInterval(() => {
    if (refreshBtn) spinRefreshBtn(refreshBtn);
    initDashboard();
  }, AUTO_REFRESH_INTERVAL);
});

// ===== 自动刷新配置 =====
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 分钟

// ===== 刷新按钮旋转动画 =====
function spinRefreshBtn(btn) {
  if (!btn) return;
  btn.classList.add('spinning');
  setTimeout(() => btn.classList.remove('spinning'), 800);
}

// ===== 最后更新时间显示 =====
function updateLastUpdateTime() {
  const el = document.getElementById('lastUpdateTime');
  if (!el) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}