/**
 * 足球预测仪表盘 - 动态渲染引擎 V3.0
 * 数据来源：predictions.json（基于 180支球队、2875场历史数据的泊松分布预测）
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
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  database: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
};

// ===== 平台图标 =====
const PLATFORM_ICONS = {
  'X': ICONS.x, '微博': ICONS.weibo, '朋友圈': ICONS.moments, '抖音': ICONS.douyin,
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

// ===== 全局数据 =====
let predData = null;

// ===== 主渲染函数 =====
async function initDashboard() {
  showLoading(true);

  // 渲染联赛筛选标签
  renderLeagueTabs();

  try {
    // 加载预计算的预测数据（基于真实历史数据）
    const resp = await fetch('../js/predictions.json');
    if (!resp.ok) throw new Error('预测数据加载失败');
    predData = await resp.json();

    console.log(`[Dashboard] 加载完成: ${predData.matches.length} 场比赛, 基于 ${predData.sc} 场历史数据`);

    // 转换预测数据为渲染格式
    const matches = convertPredictions(predData.matches);
    renderMatchCards(matches);
    renderSocialCards(getMockSocialData());
    updateMatchCount(matches.length);
    updateKPI(matches, predData);
    updateDataStatus(true);
    updateFooter(predData);
  } catch (err) {
    console.error('[Dashboard] 加载失败:', err);
    updateDataStatus(false);
    showLoading(false);
    return;
  }

  showLoading(false);
}

// ===== 数据格式转换：predictions.json → 渲染格式 =====
function convertPredictions(predictions) {
  return predictions.map((p, i) => {
    const risk = RISK_STYLES[p.risk] || RISK_STYLES.medium;
    const pred = PRED_STYLES[p.pred] || PRED_STYLES.draw;
    const isFeatured = i < 3; // 前三场标为焦点战

    // 标签转换
    const tags = (p.tags || []).map(t => {
      const icon = t.i === 'clock' ? ICONS.clock : t.i === 'square' ? ICONS.square : ICONS.file;
      return { label: t.l, icon: t.i, html: `<span class="mini-tag">${icon} ${t.l}</span>` };
    });

    return {
      id: p.id,
      league: p.lg,
      leagueName: p.lgNm,
      time: '--:--',
      date: p.d,
      homeTeam: p.hNm,
      homeSubtitle: `${p.hm}场数据`,
      awayTeam: p.aNm,
      awaySubtitle: `${p.am}场数据`,
      prediction: p.pred,
      predictionLabel: p.predLabel,
      confidence: p.conf,
      riskLevel: p.risk,
      riskLabel: p.riskLabel,
      homeProb: p.hp,
      drawProb: p.dp,
      awayProb: p.ap,
      scorePrediction: p.score,
      tags: tags,
      isFeatured: isFeatured,
      _fromRealData: true,
      _homeXG: p.hxg,
      _awayXG: p.axg,
      _homeForm: p.hf,
      _awayForm: p.af,
    };
  });
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
    const isFeatured = m.isFeatured;

    const tagsHTML = (m.tags || []).map(t => t.html || '').join('\n');

    const featuredBadge = isFeatured ? `
      <div class="flex items-center gap-1 text-[var(--pd-gold)]">
        ${ICONS.star}${ICONS.star}
        <span class="text-xs font-semibold ml-1">焦点战</span>
      </div>` : '';

    const cardClass = isFeatured ? 'glass-card featured-card p-5 match-card' : 'glass-card p-5 match-card';

    return `
      <div class="${cardClass}" data-league="${m.league}">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="league-badge ${LEAGUE_LABELS[m.league] || 'league-brazil'}">${m.leagueName}</span>
            <span class="text-xs text-muted-foreground">${m.date}</span>
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
          ${m.scorePrediction ? `<div class="text-xs text-muted-foreground mb-2">预计比分: ${m.scorePrediction}</div>` : ''}
          <div class="flex items-center justify-center gap-2 mb-2">
            <span class="text-2xl font-bold" style="color: ${pred.color};">${m.confidence}%</span>
            <span class="text-xs text-muted-foreground">置信度</span>
          </div>
          <div class="confidence-bar mx-auto" style="width: 80%;">
            <div class="confidence-fill" style="width: ${m.confidence}%; background: linear-gradient(90deg, ${pred.color}, ${pred.color}88);"></div>
          </div>
          ${(m.homeProb !== undefined) ? `
          <div class="mt-3 px-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <span style="color: var(--pd-win);">主胜</span>
              <span style="color: var(--pd-draw);">平局</span>
              <span style="color: var(--pd-lose);">客胜</span>
            </div>
            <div class="flex gap-1 h-2 rounded-full overflow-hidden bg-[rgba(255,255,255,0.05)]">
              <div style="width:${m.homeProb}%; background: var(--pd-win); transition: width 0.6s;"></div>
              <div style="width:${m.drawProb}%; background: var(--pd-draw); transition: width 0.6s;"></div>
              <div style="width:${m.awayProb}%; background: var(--pd-lose); transition: width 0.6s;"></div>
            </div>
            <div class="flex justify-between text-xs mt-1">
              <span style="color: var(--pd-win);">${m.homeProb}%</span>
              <span style="color: var(--pd-draw);">${m.drawProb}%</span>
              <span style="color: var(--pd-lose);">${m.awayProb}%</span>
            </div>
          </div>` : ''}
        </div>

        <div class="flex items-center justify-center gap-2 flex-wrap">
          ${tagsHTML}
        </div>
        ${m._fromRealData ? `<div class="text-center mt-2"><span class="text-xs text-[var(--pd-primary)] flex items-center justify-center gap-1">${ICONS.database} 基于${m.homeSubtitle}+${m.awaySubtitle}真实统计</span></div>` : ''}
      </div>`;
  }).join('');

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

  initSocialScroll();
}

// ===== KPI 更新 =====
function updateMatchCount(count) {
  const el = document.getElementById('matchCount');
  if (el) el.textContent = count;
}

function updateKPI(matches, data) {
  // 预测场次
  const kpiTotal = document.getElementById('kpiTotal');
  if (kpiTotal) kpiTotal.innerHTML = `${matches.length}<span class="text-base text-muted-foreground font-normal">场</span>`;

  // 历史数据总量
  const totalMatches = document.getElementById('totalMatches');
  if (totalMatches) totalMatches.textContent = data.sc || 2875;

  // 平均置信度
  const avgConf = document.getElementById('avgConfidence');
  if (avgConf && matches.length > 0) {
    const sum = matches.reduce((s, m) => s + (m.confidence || 50), 0);
    avgConf.textContent = Math.round(sum / matches.length);
  }

  // 球队数
  const totalTeams = document.getElementById('totalTeams');
  if (totalTeams) totalTeams.textContent = data.tc || 180;

  // 联赛数
  const totalLeagues = document.getElementById('totalInstalledLeagues');
  if (totalLeagues) totalLeagues.textContent = Object.keys(data.ls || {}).length;
}

function updateDataStatus(success) {
  const el = document.getElementById('dataStatus');
  if (!el) return;
  if (success) {
    el.innerHTML = `${ICONS.check} 真实数据预测`;
    el.className = 'data-status status-ok';
  } else {
    el.innerHTML = `${ICONS.alert} 数据加载失败`;
    el.className = 'data-status status-offline';
  }
}

function updateFooter(data) {
  const footerNote = document.querySelector('.dashboard-footer .text-muted-foreground.text-xs');
  if (footerNote && data) {
    footerNote.textContent = `基于 ${data.sc} 场真实历史数据 · 泊松分布 + Dixon-Coles 模型 · 每日更新`;
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
    document.getElementById('inputFootballKey').value = CONFIG.FOOTBALL_API_KEY;
    document.getElementById('inputNewsKey').value = CONFIG.NEWS_API_KEY;
    document.getElementById('inputSportsDBKey').value = CONFIG.SPORTSDB_API_KEY;
  }
}

function saveSettings() {
  const fbKey = document.getElementById('inputFootballKey')?.value || '';
  const newsKey = document.getElementById('inputNewsKey')?.value || '';
  const sportsDBKey = document.getElementById('inputSportsDBKey')?.value || '';

  localStorage.setItem('pd_football_key', fbKey);
  localStorage.setItem('pd_news_key', newsKey);
  localStorage.setItem('pd_sportsdb_key', sportsDBKey);

  CONFIG.FOOTBALL_API_KEY = fbKey;
  CONFIG.NEWS_API_KEY = newsKey;
  CONFIG.SPORTSDB_API_KEY = sportsDBKey;

  apiCache._store = {};

  document.getElementById('apiSettingsPanel').style.display = 'none';
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) overlay.style.display = 'none';

  showToast('设置已保存');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== 模拟社交数据 =====
function getMockSocialData() {
  return [
    { platform: 'X', time: '2分钟前', content: 'Man City vs Arsenal: The title decider? Guardiola and Arteta face off in what could be the match of the season', likes: 12000, comments: 3486, shares: 2238 },
    { platform: '微博', time: '5分钟前', content: '今晚皇马vs巴萨国家德比！姆巴佩首秀国家德比，全球瞩目', likes: 15000, comments: 3892, shares: 3456 },
    { platform: 'X', time: '8分钟前', content: 'Kane hits hat-trick as Bayern Munich cruise past Dortmund 3-0. Der Klassiker dominance continues', likes: 8900, comments: 2100, shares: 1567 },
    { platform: '抖音', time: '12分钟前', content: '国际米兰 vs 尤文图斯：意大利国家德比，谁能笑到最后？', likes: 9800, comments: 3200, shares: 1890 },
    { platform: 'X', time: '15分钟前', content: 'PSG vs Marseille: Le Classique - Mbappe-less PSG still too strong for rivals?', likes: 5600, comments: 1567, shares: 945 },
    { platform: '微博', time: '18分钟前', content: '成都蓉城客场挑战云南玉昆，赛前发布会主教练表示：已经做好充分准备，目标全取三分', likes: 3200, comments: 892, shares: 456 },
    { platform: '抖音', time: '22分钟前', content: '阿贾克斯 vs 埃因霍温：荷甲天王山之战，谁能占据榜首？', likes: 4500, comments: 1200, shares: 678 },
    { platform: 'X', time: '25分钟前', content: 'Benfica vs Porto: O Classico delivers again! Portuguese football at its finest', likes: 3200, comments: 890, shares: 456 },
    { platform: '朋友圈', time: '30分钟前', content: '今晚中超三场焦点战，预测全部命中率高达72%！', likes: 450, comments: 120, shares: 89 },
    { platform: '微博', time: '35分钟前', content: '利物浦 vs 切尔西：红蓝大战，萨拉赫状态火热能否延续进球？', likes: 7800, comments: 2100, shares: 1234 },
    { platform: '抖音', time: '40分钟前', content: '北欧联赛：博德闪耀、马尔默双双出战，北欧霸主地位稳固', likes: 2800, comments: 756, shares: 432 },
    { platform: 'X', time: '45分钟前', content: 'Leeds United pushing for promotion: Championship title race heating up', likes: 2100, comments: 567, shares: 345 },
  ];
}

// ===== 页面初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();

  const settingsBtn = document.getElementById('apiSettingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', toggleSettings);

  const saveBtn = document.getElementById('saveSettingsBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);

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

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      initDashboard();
    });
  }
});