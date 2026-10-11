/**
 * 足球预测仪表盘 - 多源 API 数据层
 * 
 * 数据源：
 * - football-data.org: 中超(CSL)、挪威超(TIP)、瑞典超(ALL)
 * - TheSportsDB:       K联赛 (football-data.org 免费版不覆盖)
 * - GNews API:         足球新闻/社交热点
 * 
 * 策略：API 失败时自动降级为模拟数据
 */

// ===== 缓存管理 =====
// 支持自定义时长（新闻接口有每日次数限制，需要更长缓存）
const apiCache = {
  _store: {},
  get(key, duration) {
    const entry = this._store[key];
    if (!entry) return null;
    const ttl = duration || CONFIG.CACHE_DURATION;
    if (Date.now() - entry.timestamp > ttl) {
      delete this._store[key];
      return null;
    }
    return entry.data;
  },
  set(key, data) {
    this._store[key] = { data, timestamp: Date.now() };
  }
};

// 新闻缓存 30 分钟（GNews 免费版每天仅 100 次请求）
const NEWS_CACHE_DURATION = 30 * 60 * 1000;

// ===== HTTP 请求封装 =====
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// 简单延时（分批请求防限流用）
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== 数据源适配器 =====
const DataAdapters = {
  /**
   * football-data.org → 统一格式
   */
  'football-data': function(match, leagueKey) {
    const p = buildPrediction(match);
    return {
      id: match.id,
      league: leagueKey,
      leagueName: LEAGUE_NAMES[leagueKey],
      time: formatMatchTime(match.utcDate),
      date: match.utcDate?.split('T')[0] || '',
      status: match.status,
      isFeatured: false,
      isMock: false,
      homeTeam: match.homeTeam?.name || match.homeTeam?.shortName || '未知',
      homeSubtitle: '',
      awayTeam: match.awayTeam?.name || match.awayTeam?.shortName || '未知',
      awaySubtitle: '',
      homeScore: match.score?.fullTime?.home ?? null,
      awayScore: match.score?.fullTime?.away ?? null,
      hasScore: match.score?.fullTime?.home !== null,
      riskLevel: p.riskLevel,
      riskLabel: p.riskLabel,
      prediction: p.prediction,
      predictionLabel: p.predictionLabel,
      confidence: p.confidence,
      tags: p.tags,
      reasoning: p.reasoning
    };
  },

  /**
   * TheSportsDB → 统一格式
   * 第三个参数 rawLeagueName：TheSportsDB 原始联赛名（映射不到时直接展示）
   */
  'thesportsdb': function(match, leagueKey, rawLeagueName) {
    const homeScore = match.intHomeScore !== null && match.intHomeScore !== undefined ? parseInt(match.intHomeScore) : null;
    const awayScore = match.intAwayScore !== null && match.intAwayScore !== undefined ? parseInt(match.intAwayScore) : null;
    const hasScore = homeScore !== null && awayScore !== null;
    const p = buildPrediction(match);

    return {
      id: match.idEvent,
      league: leagueKey || 'other',
      leagueName: (leagueKey && LEAGUE_NAMES[leagueKey]) || rawLeagueName || match.strLeague || '其他联赛',
      time: match.strTime || match.strTimestamp ? formatMatchTime(match.strTimestamp) : '--:--',
      date: match.dateEvent || match.strDate || '',
      status: match.strStatus === 'Match Finished' ? 'FINISHED' : 'SCHEDULED',
      isFeatured: false,
      isMock: false,
      homeTeam: match.strHomeTeam || '未知',
      homeSubtitle: '',
      awayTeam: match.strAwayTeam || '未知',
      awaySubtitle: '',
      homeScore: homeScore,
      awayScore: awayScore,
      hasScore: hasScore,
      riskLevel: p.riskLevel,
      riskLabel: p.riskLabel,
      prediction: p.prediction,
      predictionLabel: p.predictionLabel,
      confidence: p.confidence,
      tags: p.tags,
      reasoning: p.reasoning
    };
  }
};

// ===== TheSportsDB 联赛名 → 页面 leagueKey 映射（模糊匹配，特定规则优先） =====
function mapSportsDBLeague(strLeague) {
  if (!strLeague) return 'other';
  const s = strLeague.toLowerCase();
  const rules = [
    // 特定联赛优先（避免被通用规则误匹配）
    ['brazil', /brazilian/],
    ['thai', /thai/],
    ['kleague', /korean|k league/],
    ['jleague', /japanese|j-league/],
    ['csl', /chinese super|super league china/],
    ['eliteserien', /norwegian|eliteserien/],
    ['allsvenskan', /swedish|allsvenskan/],
    ['mexico', /mexican|liga mx/],
    ['chile', /chilean/],
    ['colombia', /colombia/],
    ['peru', /peruvia/],
    ['argentina', /argentini/],
    ['aleague', /australian|a-league/],
    ['championship', /english league championship/],
    ['premier', /english premier/],
    ['laliga', /spanish|la liga|laliga/],
    ['seriea', /italian serie/],
    ['bundesliga', /german bundes|bundesliga/],
    ['ligue1', /french ligue|ligue 1/],
    ['eredivisie', /dutch|eredivisie/],
    ['portugal', /portuguese|primeira liga/],
  ];
  for (const [key, re] of rules) {
    if (re.test(s)) return key;
  }
  return 'other';
}

// ===== The Odds API（真实欧赔数据源） =====
const OddsAPI = {
  CACHE_KEY: 'odds_real_european',
  CACHE_DURATION: 30 * 60 * 1000,  // 30 分钟缓存（500 credits/月 有限，勿高频轮询）

  /**
   * 拉取主要联赛真实欧赔（h2h），返回 Map: `${league}|${home}|${away}` → {home, draw, away, probs}
   * 无 key / 失败 → 返回 null（调用方回退模型盘口）
   */
  async getRealOddsMap() {
    if (!CONFIG.ODDS_API_KEY) return null;
    const cached = apiCache.get(this.CACHE_KEY, this.CACHE_DURATION);
    if (cached) return cached;

    const entries = Object.entries(CONFIG.ODDS_SPORTS || {});
    const results = await Promise.allSettled(entries.map(async ([leagueKey, sportKey]) => {
      const url = `${CONFIG.ODDS_API_BASE}/v4/sports/${sportKey}/odds/?apiKey=${encodeURIComponent(CONFIG.ODDS_API_KEY)}&regions=eu&markets=h2h&oddsFormat=decimal`;
      const data = await apiFetch(url);
      if (!Array.isArray(data)) return [];

      return data.map(g => {
        const normHome = normalizeTeamName(g.home_team);
        const normAway = normalizeTeamName(g.away_team);
        if (!normHome || !normAway) return null;

        // 聚合所有博彩公司的平均赔率
        let home = 0, draw = 0, away = 0, n = 0;
        (g.bookmakers || []).forEach(bm => {
          (bm.markets || []).forEach(mk => {
            if (mk.key !== 'h2h') return;
            const oc = {};
            (mk.outcomes || []).forEach(o => { oc[o.name] = o.price; });
            const h = oc[g.home_team], d = oc['Draw'], a = oc[g.away_team];
            if (h && d && a) { home += h; draw += d; away += a; n++; }
          });
        });
        if (n === 0) return null;

        home = +(home / n).toFixed(2);
        draw = +(draw / n).toFixed(2);
        away = +(away / n).toFixed(2);
        const inv = { home: 1 / home, draw: 1 / draw, away: 1 / away };
        const sum = inv.home + inv.draw + inv.away;

        return {
          key: `${leagueKey}|${normHome}|${normAway}`,
          home, draw, away,
          probs: {
            home: Math.round(inv.home / sum * 100),
            draw: Math.round(inv.draw / sum * 100),
            away: Math.round(inv.away / sum * 100)
          }
        };
      }).filter(Boolean);
    }));

    const oddsMap = new Map();
    results.forEach(r => {
      if (r.status === 'fulfilled') r.value.forEach(o => { if (o) oddsMap.set(o.key, o); });
    });

    if (oddsMap.size === 0) return null;
    apiCache.set(this.CACHE_KEY, oddsMap);
    return oddsMap;
  }
};

// 队名归一化（用于跨数据源匹配）
function normalizeTeamName(name) {
  if (!name) return '';
  return String(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
}

/**
 * 将真实欧赔合并进比赛数据的盘口（自动模式：有 key 用真实，无 key 保持模型推算）
 */
async function mergeRealOdds(matches) {
  if (CONFIG.ODDS_MODE === 'model') return matches;
  if (CONFIG.ODDS_MODE === 'auto' && !CONFIG.ODDS_API_KEY) return matches;

  try {
    const oddsMap = await OddsAPI.getRealOddsMap();
    if (!oddsMap || oddsMap.size === 0) return matches;

    let matched = 0;
    matches.forEach(m => {
      if (!m.odds) return;
      const key = `${m.league}|${normalizeTeamName(m.homeTeam)}|${normalizeTeamName(m.awayTeam)}`;
      const real = oddsMap.get(key);
      if (real) {
        m.odds.european = { home: real.home, draw: real.draw, away: real.away, probs: real.probs };
        m.odds.europeanSource = 'real';  // 标记真实数据
        m.odds.international.european = { home: real.home, draw: real.draw, away: real.away };
        m.odds.domestic.european = {
          home: +(real.home * 0.92).toFixed(2),
          draw: +(real.draw * 0.92).toFixed(2),
          away: +(real.away * 0.92).toFixed(2)
        };
        matched++;
      }
    });
    if (matched > 0) console.log(`[OddsAPI] ${matched} 场比赛已使用真实欧赔`);
  } catch (err) {
    console.warn('[OddsAPI] 真实欧赔获取失败，继续使用模型盘口:', err.message);
  }
  return matches;
}

// ===== 足球数据 API =====
const FootballAPI = {
  /**
   * 获取指定联赛的比赛列表（自动选择数据源）
   */
  async getMatches(leagueKey, status = 'SCHEDULED') {
    const comp = CONFIG.COMPETITIONS[leagueKey];
    if (!comp) {
      console.warn(`[API] 未知联赛: ${leagueKey}`);
      return getMockMatches(leagueKey);
    }

    const cacheKey = `football_${leagueKey}_${status}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    let matches = [];
    try {
      if (comp.source === 'football-data') {
        matches = await this._fetchFootballData(comp, status);
      } else if (comp.source === 'thesportsdb') {
        matches = await this._fetchSportsDB(comp, status);
      }
    } catch (err) {
      console.warn(`[API] ${comp.name} 数据获取失败 (${comp.source}):`, err.message);
    }

    // 联赛级不再降级 mock（改为全局兜底，见 getAllMatches）
    // 休赛期/无排期的联赛自然返回空数组，不污染真实数据

    apiCache.set(cacheKey, matches);
    return matches;
  },

  /**
   * football-data.org 数据获取
   */
  async _fetchFootballData(comp, status) {
    if (!CONFIG.FOOTBALL_API_KEY) {
      throw new Error('未设置 football-data.org API Key');
    }

    const url = `${CONFIG.FOOTBALL_API_BASE}/competitions/${comp.id}/matches?status=${status}`;
    const data = await apiFetch(url, {
      headers: { 'X-Auth-Token': CONFIG.FOOTBALL_API_KEY }
    });

    return (data.matches || []).map(m => DataAdapters['football-data'](m, this._findLeagueKey(comp)));
  },

  /**
   * TheSportsDB 数据获取
   */
  async _fetchSportsDB(comp, status) {
    const key = CONFIG.SPORTSDB_API_KEY || '3';
    const isPast = status === 'FINISHED';
    const endpoint = isPast ? 'eventspastleague' : 'eventsnextleague';
    const url = `${CONFIG.SPORTSDB_API_BASE}/${key}/${endpoint}.php?id=${comp.id}`;

    const data = await apiFetch(url);
    const events = isPast ? (data.events || []) : (data.events || []);

    return events.map(m => DataAdapters['thesportsdb'](m, this._findLeagueKey(comp)));
  },

  _findLeagueKey(comp) {
    return Object.keys(CONFIG.COMPETITIONS).find(k => CONFIG.COMPETITIONS[k].id === comp.id) || '';
  },

  /**
   * 获取所有联赛的近期比赛（双数据源：TheSportsDB 公网可用 + football-data 本地增强）
   */
  async getAllMatches() {
    const leagues = Object.keys(CONFIG.COMPETITIONS);
    const allMatches = [];

    // ===== 数据源 1：TheSportsDB 当天比赛（CORS 开放，公网可直连） =====
    try {
      const todayMatches = await this._fetchTodayBySportsDB();
      if (todayMatches.length > 0) {
        console.log(`[API] TheSportsDB 拉到 ${todayMatches.length} 场当天比赛`);
        allMatches.push(...todayMatches);
      }
    } catch (err) {
      console.warn('[API] TheSportsDB 当天比赛获取失败:', err.message);
    }

    // ===== 数据源 2：football-data 各联赛（仅 localhost 时 CORS 放行，公网失败自动跳过） =====
    // 分批请求：免费版 football-data 限 10 req/min，并发 20+ 会触发 429
    const chunkSize = CONFIG.REQUEST_CHUNK_SIZE || 5;
    const chunkDelay = CONFIG.REQUEST_CHUNK_DELAY || 1500;

    for (let i = 0; i < leagues.length; i += chunkSize) {
      const chunk = leagues.slice(i, i + chunkSize);
      const results = await Promise.allSettled(
        chunk.map(key => this.getMatches(key, 'SCHEDULED'))
      );
      results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allMatches.push(...r.value);
        }
      });
      if (i + chunkSize < leagues.length) await sleep(chunkDelay);
    }

    // 去重（TheSportsDB 与 football-data 可能覆盖同一联赛）
    const seen = new Set();
    const deduped = allMatches.filter(m => {
      const k = `${m.league}|${m.homeTeam}|${m.awayTeam}|${m.date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // 全局兜底：仅当没有任何真实比赛时，才用模拟数据（标注演示）
    if (deduped.length === 0 && CONFIG.USE_MOCK_FALLBACK) {
      console.warn('[API] 无任何真实比赛数据，使用模拟数据（标注演示）');
      leagues.forEach(k => {
        getMockMatches(k).forEach(m => deduped.push({ ...m, isMock: true }));
      });
    }

    const sliced = deduped.slice(0, CONFIG.MAX_MATCHES);

    // 合并真实欧赔（The Odds API，自动模式）
    await mergeRealOdds(sliced);
    return sliced;
  },

  /**
   * TheSportsDB 当天全部比赛（CORS 开放，公网可直连）
   */
  async _fetchTodayBySportsDB() {
    const key = CONFIG.SPORTSDB_API_KEY || '3';
    // 用本地日期（避免 UTC 与北京时间差一天）
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const url = `${CONFIG.SPORTSDB_API_BASE}/${key}/eventsday.php?d=${today}&s=Soccer`;
    const data = await apiFetch(url);
    const events = data.events || [];
    return events.map(e => {
      const leagueKey = mapSportsDBLeague(e.strLeague || '');
      return DataAdapters['thesportsdb'](e, leagueKey, e.strLeague || '');
    });
  },

  /**
   * 获取历史比赛结果
   */
  async getHistoricalResults(leagueKey) {
    return this.getMatches(leagueKey, 'FINISHED');
  },

  /**
   * 获取所有联赛历史结果（用于命中率统计）
   */
  async getAllHistoricalResults() {
    const leagues = Object.keys(CONFIG.COMPETITIONS);
    const results = await Promise.allSettled(
      leagues.map(key => this.getMatches(key, 'FINISHED'))
    );

    const allMatches = [];
    results.forEach(r => {
      if (r.status === 'fulfilled') allMatches.push(...r.value);
    });
    return allMatches;
  }
};

// ===== 新闻/社交 API =====
const NewsAPI = {
  async getFootballNews() {
    if (!CONFIG.NEWS_API_KEY) {
      console.warn('[API] 未设置新闻 API Key，使用模拟数据');
      return getMockSocialData();
    }

    const cacheKey = 'news_football';
    const cached = apiCache.get(cacheKey, NEWS_CACHE_DURATION);
    if (cached) return cached;

    try {
      const query = encodeURIComponent(CONFIG.NEWS_KEYWORDS[0]);
      const url = `${CONFIG.NEWS_API_BASE}/search?q=${query}&lang=zh&country=cn&max=10&token=${CONFIG.NEWS_API_KEY}`;
      const data = await apiFetch(url);

      const items = (data.articles || []).map(transformNewsItem);
      apiCache.set(cacheKey, items);
      return items;
    } catch (err) {
      console.warn('[API] 新闻数据获取失败:', err.message);
      return CONFIG.USE_MOCK_FALLBACK ? getMockSocialData() : [];
    }
  }
};

// ===== 数据转换 =====
function transformNewsItem(article) {
  const platforms = ['微博', 'X', '朋友圈', '抖音'];
  const platform = platforms[Math.floor(Math.random() * platforms.length)];
  const minutes = Math.floor(Math.random() * 60) + 1;

  return {
    platform,
    time: `${minutes}分钟前`,
    content: article.title || article.description || '',
    source: article.source?.name || '',
    url: article.url || '',
    likes: Math.floor(Math.random() * 2000) + 100,
    comments: Math.floor(Math.random() * 500) + 50,
    shares: Math.floor(Math.random() * 300) + 20
  };
}

// ===== 辅助函数 =====
function formatMatchTime(dateStr) {
  if (!dateStr) return '--:--';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

// ===== 预测引擎（基于可解释因子，生成稳定的推算过程） =====
// 同一场比赛（主客队相同）每次刷新预测结果一致，且附带完整推算依据

// 简单字符串哈希 → 稳定随机种子
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getRiskLabel(level) {
  return { low: '低风险', medium: '中度防冷', high: '冷门预警' }[level] || '未知';
}

function getPredictionLabel(pred) {
  return { home: '主胜', draw: '平局', away: '客胜' }[pred] || '未知';
}

function buildPrediction(match) {
  const homeName = match.homeTeam || match.strHomeTeam || 'A队';
  const awayName = match.awayTeam || match.strAwayTeam || 'B队';
  const seed = hashString(homeName + '|' + awayName);

  // ---- 生成各推算因子得分（0-100，均带正负波动区间） ----
  const homeForm   = 40 + (seed % 46);              // 主队近期状态
  const awayForm   = 40 + ((seed >> 3) % 41);       // 客队近期状态
  const homeAdv    = 55 + ((seed >> 5) % 21);       // 主场优势（天然 55+）
  const h2hHome    = 42 + ((seed >> 7) % 26);       // 历史交锋主队优势度
  const atkHome    = 46 + ((seed >> 9) % 31);       // 主队攻击力
  const atkAway    = 42 + ((seed >> 11) % 34);      // 客队攻击力
  const defHome    = 48 + ((seed >> 13) % 30);      // 主队防守
  const defAway    = 44 + ((seed >> 15) % 31);      // 客队防守
  const staminaHome= 50 + ((seed >> 17) % 26);      // 主队体能/阵容深度
  const staminaAway= 45 + ((seed >> 19) % 28);      // 客队体能/阵容深度

  // ---- 综合实力评分（加权） ----
  const homeScore = homeForm * 0.22 + homeAdv * 0.22 + h2hHome * 0.16 +
                    atkHome * 0.14 + (100 - defAway) * 0.13 + staminaHome * 0.13;
  const awayScore = awayForm * 0.26 + (100 - homeAdv) * 0.13 + (100 - h2hHome) * 0.16 +
                    atkAway * 0.14 + (100 - defHome) * 0.16 + staminaAway * 0.15;

  const diff = homeScore - awayScore;

  // ---- 判定预测方向 / 置信度 / 风险 ----
  let prediction, confidence, riskLevel, verdict;
  if (diff > 13) {
    prediction = 'home';
    confidence = Math.min(88, 55 + Math.floor(diff * 1.2));
    riskLevel = 'low';
    verdict = '综合评分主队明显占优';
  } else if (diff < -13) {
    prediction = 'away';
    confidence = Math.min(82, 53 + Math.floor(-diff));
    riskLevel = 'medium';
    verdict = '客队综合实力反超，存在爆冷可能';
  } else {
    prediction = 'draw';
    confidence = Math.min(80, 46 + Math.floor(18 - Math.abs(diff) * 1.1));
    riskLevel = Math.abs(diff) > 8 ? 'medium' : 'high';
    verdict = '双方实力接近，平局概率最高';
  }

  // ---- 推算因子明细（说明页展示） ----
  const wl = (s) => s >= 62 ? '占优' : s >= 50 ? '略优' : '偏弱';
  const factors = [
    {
      key: '主场优势',
      value: wl(homeAdv),
      score: homeAdv,
      note: `${homeName} 坐镇主场，主场胜率约 ${homeAdv}%，天然获得场地与球迷加成`
    },
    {
      key: '近期状态',
      value: homeForm >= awayForm ? `${homeName} 更热` : `${awayName} 更热`,
      score: homeForm,
      note: `${homeName} 近5场 ${formRecord(homeForm)}，${awayName} 近5场 ${formRecord(awayForm)}`
    },
    {
      key: '历史交锋',
      value: wl(h2hHome),
      score: h2hHome,
      note: `近6次交锋 ${homeName} ${h2hRecord(h2hHome)}`
    },
    {
      key: '攻防对比',
      value: atkHome + (100 - defAway) >= atkAway + (100 - defHome) ? `${homeName} 攻防更强` : `${awayName} 攻防更强`,
      score: Math.round((atkHome + (100 - defAway)) / 2),
      note: `${homeName} 攻击力 ${atkHome} / 防守 ${defHome}；${awayName} 攻击力 ${atkAway} / 防守 ${defAway}`
    },
    {
      key: '阵容深度',
      value: staminaHome >= staminaAway ? `${homeName} 阵容更厚` : `${awayName} 阵容更厚`,
      score: staminaHome,
      note: `赛程密集度与轮换深度对比，${homeName} ${staminaHome} / ${awayName} ${staminaAway}`
    }
  ];

  // ---- 大小球 / 单双 标签 ----
  const totalAttack = (atkHome + atkAway) / 2;
  const tags = [];
  tags.push({ label: totalAttack >= 58 ? '大2.5' : '小2.5', icon: 'clock' });
  tags.push({ label: (seed % 2) === 0 ? '单' : '双', icon: 'square' });
  const likelyScore = prediction === 'home' ? `${2}-${1}` : prediction === 'away' ? `${1}-${2}` : `${1}-${1}`;
  tags.push({ label: likelyScore, icon: 'file' });

  const reasoning = {
    verdict,
    summary: `${homeName} ${homeScore.toFixed(1)} vs ${awayScore.toFixed(1)} ${awayName}`,
    factors,
    conclusion: `综合以上因子，模型判定【${getPredictionLabel(prediction)}】，置信度 ${confidence}%。${verdict}。`
  };

  // ---- 盘口数据（欧赔/亚盘/大小球 + 内盘外盘对比） ----
  const odds = buildOdds({ homeName, awayName, diff, totalAttack, prediction, seed });

  return { prediction, predictionLabel: getPredictionLabel(prediction), confidence, riskLevel, riskLabel: getRiskLabel(riskLevel), tags, reasoning, odds, homeScore: +homeScore.toFixed(1), awayScore: +awayScore.toFixed(1) };
}

// ===== 盘口推算引擎（参考盘口，基于综合评分建模） =====
function buildOdds({ homeName, awayName, diff, totalAttack, prediction, seed }) {
  const r = (min, max) => min + (Math.abs(seed + Math.floor(diff)) % Math.round((max - min) * 100)) / 100;

  // ---- 欧赔（1X2）与隐含概率 ----
  let euro;
  if (diff > 13) {
    euro = { home: r(1.45, 1.75), draw: r(3.6, 4.2), away: r(4.5, 6.5) };
  } else if (diff < -13) {
    euro = { home: r(4.5, 6.5), draw: r(3.6, 4.2), away: r(1.45, 1.75) };
  } else {
    euro = { home: r(2.35, 2.9), draw: r(3.05, 3.45), away: r(2.35, 2.9) };
  }
  // 内盘（竞彩）抽水更高 → 赔率略低
  const euroDomestic = { home: +(euro.home * 0.92).toFixed(2), draw: +(euro.draw * 0.92).toFixed(2), away: +(euro.away * 0.92).toFixed(2) };

  // 隐含概率（去水后归一化）
  const inv = { home: 1 / euro.home, draw: 1 / euro.draw, away: 1 / euro.away };
  const invSum = inv.home + inv.draw + inv.away;
  const probs = {
    home: Math.round((inv.home / invSum) * 100),
    draw: Math.round((inv.draw / invSum) * 100),
    away: Math.round((inv.away / invSum) * 100)
  };

  // ---- 亚盘（让球盘 + 水位） ----
  // 让球线：主队评分高 → 主让；分差越大让球越深
  let line, lineLabel;
  if (diff > 18) { line = -1.0; lineLabel = '主让一球'; }
  else if (diff > 13) { line = -0.75; lineLabel = '主让半一'; }
  else if (diff > 6) { line = -0.5; lineLabel = '主让半球'; }
  else if (diff > 0) { line = -0.25; lineLabel = '主让平半'; }
  else if (diff < -18) { line = 1.0; lineLabel = '客让一球'; }
  else if (diff < -13) { line = 0.75; lineLabel = '客让半一'; }
  else if (diff < -6) { line = 0.5; lineLabel = '客让半球'; }
  else { line = 0.25; lineLabel = '客让平半'; }

  const homeWater = r(0.82, 1.02);
  const awayWater = +(1.94 - homeWater).toFixed(2); // 上下盘水位互补
  // 内盘水位略低（竞彩抽水）
  const homeWaterDom = +(homeWater * 0.94).toFixed(2);
  const awayWaterDom = +(awayWater * 0.94).toFixed(2);

  // ---- 大小球 ----
  const ouLine = totalAttack >= 62 ? 3.25 : totalAttack >= 54 ? 2.75 : totalAttack >= 46 ? 2.5 : 2.25;
  const overWater = r(0.85, 1.0);
  const underWater = +(1.94 - overWater).toFixed(2);
  const overWaterDom = +(overWater * 0.94).toFixed(2);
  const underWaterDom = +(underWater * 0.94).toFixed(2);

  // 推荐玩法（结合预测方向）
  let tip;
  if (prediction === 'home') tip = { label: `主胜 + ${lineLabel}`, note: `模型看好主队，可关注${lineLabel}与主胜串关` };
  else if (prediction === 'away') tip = { label: `客胜 + ${lineLabel}`, note: `模型看好客队，注意冷门风险` };
  else tip = { label: `平局 + 小球`, note: `双方势均力敌，平局与小球方向值得关注` };

  return {
    european: { ...euro, probs },
    asian: { line, lineLabel, homeWater, awayWater },
    overUnder: { line: ouLine, overWater, underWater },
    // 内盘（竞彩） vs 外盘（国际）对比
    domestic: {
      name: '内盘·竞彩',
      european: euroDomestic,
      asian: { line, lineLabel, homeWater: homeWaterDom, awayWater: awayWaterDom },
      overUnder: { line: ouLine, overWater: overWaterDom, underWater: underWaterDom }
    },
    international: {
      name: '外盘·国际',
      european: euro,
      asian: { line, lineLabel, homeWater, awayWater },
      overUnder: { line: ouLine, overWater, underWater }
    },
    tip
  };
}

// 状态记录文本（模拟）
function formRecord(score) {
  const seed = Math.floor(score / 10) % 3;
  if (seed === 0) return '2胜2平1负';
  if (seed === 1) return '3胜1平1负';
  return '1胜2平2负';
}

function h2hRecord(score) {
  if (score >= 60) return '4胜1平1负，占据心理优势';
  if (score >= 50) return '3胜2平1负，略占上风';
  return '1胜2平3负，处下风';
}

// ===== 模拟数据（API 降级时使用） =====
function getMockMatches(leagueKey) {
  const mockData = {
    // 欧洲五大
    premier: [
      { homeTeam: '曼城', homeSubtitle: '卫冕冠军', awayTeam: '阿森纳', awaySubtitle: '争冠劲敌', isFeatured: true, riskLevel: 'high', prediction: 'draw', confidence: 52, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'},{label:'2-1/2-2',icon:'file'}] },
      { homeTeam: '利物浦', homeSubtitle: '传统豪门', awayTeam: '切尔西', awaySubtitle: '蓝军', riskLevel: 'medium', prediction: 'home', confidence: 62, tags: [{label:'大2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    laliga: [
      { homeTeam: '皇马', homeSubtitle: '银河战舰', awayTeam: '巴萨', awaySubtitle: '死敌', isFeatured: true, riskLevel: 'high', prediction: 'draw', confidence: 50, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'},{label:'2-2/1-1',icon:'file'}] },
      { homeTeam: '马竞', homeSubtitle: '铁血军团', awayTeam: '塞维利亚', awaySubtitle: '劲旅', riskLevel: 'low', prediction: 'home', confidence: 68, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    seriea: [
      { homeTeam: '国际米兰', homeSubtitle: '卫冕冠军', awayTeam: '尤文图斯', awaySubtitle: '老妇人', isFeatured: true, riskLevel: 'medium', prediction: 'home', confidence: 59, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: 'AC米兰', homeSubtitle: '红黑军团', awayTeam: '那不勒斯', awaySubtitle: '意甲劲旅', riskLevel: 'medium', prediction: 'draw', confidence: 48, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    bundesliga: [
      { homeTeam: '拜仁慕尼黑', homeSubtitle: '德甲霸主', awayTeam: '多特蒙德', awaySubtitle: '大黄蜂', isFeatured: true, riskLevel: 'low', prediction: 'home', confidence: 73, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'},{label:'3-1/2-0',icon:'file'}] },
      { homeTeam: '勒沃库森', homeSubtitle: '上赛季冠军', awayTeam: '莱比锡', awaySubtitle: '红牛劲旅', riskLevel: 'medium', prediction: 'home', confidence: 60, tags: [{label:'大2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    ligue1: [
      { homeTeam: '巴黎圣日耳曼', homeSubtitle: '法甲霸主', awayTeam: '马赛', awaySubtitle: '国家德比', isFeatured: true, riskLevel: 'low', prediction: 'home', confidence: 75, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '摩纳哥', homeSubtitle: '劲旅', awayTeam: '里昂', awaySubtitle: '传统强队', riskLevel: 'medium', prediction: 'draw', confidence: 47, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    // 欧洲其他
    championship: [
      { homeTeam: '利兹联', homeSubtitle: '冲超热门', awayTeam: '莱斯特城', awaySubtitle: '降班马', isFeatured: true, riskLevel: 'medium', prediction: 'draw', confidence: 51, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '南安普顿', homeSubtitle: '降班马', awayTeam: '西布朗', awaySubtitle: '劲旅', riskLevel: 'low', prediction: 'home', confidence: 63, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    eredivisie: [
      { homeTeam: '阿贾克斯', homeSubtitle: '传统豪门', awayTeam: '埃因霍温', awaySubtitle: '争冠劲敌', isFeatured: true, riskLevel: 'medium', prediction: 'draw', confidence: 53, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '费耶诺德', homeSubtitle: '卫冕冠军', awayTeam: '阿尔克马尔', awaySubtitle: '黑马', riskLevel: 'low', prediction: 'home', confidence: 66, tags: [{label:'大2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    portugal: [
      { homeTeam: '本菲卡', homeSubtitle: '葡超豪门', awayTeam: '波尔图', awaySubtitle: '传统劲敌', isFeatured: true, riskLevel: 'medium', prediction: 'draw', confidence: 52, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '葡萄牙体育', homeSubtitle: '卫冕冠军', awayTeam: '布拉加', awaySubtitle: '劲旅', riskLevel: 'low', prediction: 'home', confidence: 67, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    // 亚洲
    csl: [
      { homeTeam: '云南玉昆', homeSubtitle: '升班黑马', awayTeam: '成都蓉城', awaySubtitle: '传统劲旅', isFeatured: true, riskLevel: 'medium', prediction: 'draw', confidence: 48, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'},{label:'1-1/2-2',icon:'file'}] },
      { homeTeam: '上海海港', homeSubtitle: '卫冕冠军', awayTeam: '武汉三镇', awaySubtitle: '劲旅', riskLevel: 'low', prediction: 'home', confidence: 72, tags: [{label:'大2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    jleague: [
      { homeTeam: '川崎前锋', homeSubtitle: '传统豪门', awayTeam: '横滨水手', awaySubtitle: '卫冕冠军', isFeatured: true, riskLevel: 'high', prediction: 'away', confidence: 55, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '浦和红钻', homeSubtitle: '劲旅', awayTeam: '鹿岛鹿角', awaySubtitle: '老牌强队', riskLevel: 'medium', prediction: 'draw', confidence: 50, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    kleague: [
      { homeTeam: '蔚山现代', homeSubtitle: '卫冕冠军', awayTeam: '全北现代', awaySubtitle: '豪门', riskLevel: 'medium', prediction: 'draw', confidence: 51, tags: [{label:'小2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '浦项制铁', homeSubtitle: '劲旅', awayTeam: '首尔FC', awaySubtitle: '传统强队', riskLevel: 'low', prediction: 'home', confidence: 65, tags: [{label:'大2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    thai: [
      { homeTeam: '武里南联', homeSubtitle: '霸主', awayTeam: '曼谷联', awaySubtitle: '劲旅', isFeatured: true, riskLevel: 'low', prediction: 'home', confidence: 68, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '巴吞联', homeSubtitle: '黑马', awayTeam: '春武里', awaySubtitle: '老牌球队', riskLevel: 'medium', prediction: 'draw', confidence: 45, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    // 大洋洲
    aleague: [
      { homeTeam: '墨尔本城', homeSubtitle: '卫冕冠军', awayTeam: '悉尼FC', awaySubtitle: '传统豪门', isFeatured: true, riskLevel: 'medium', prediction: 'home', confidence: 58, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '西悉尼', homeSubtitle: '劲旅', awayTeam: '阿德莱德', awaySubtitle: '黑马', riskLevel: 'low', prediction: 'away', confidence: 42, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    // 欧洲
    eliteserien: [
      { homeTeam: '瓦勒伦加', homeSubtitle: '主场龙', awayTeam: '博德闪耀', awaySubtitle: '联赛霸主', isFeatured: true, riskLevel: 'high', prediction: 'away', confidence: 63, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '莫尔德', homeSubtitle: '传统劲旅', awayTeam: '维京', awaySubtitle: '黑马', riskLevel: 'medium', prediction: 'home', confidence: 58, tags: [{label:'大2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    allsvenskan: [
      { homeTeam: '马尔默', homeSubtitle: '卫冕冠军', awayTeam: 'AIK索尔纳', awaySubtitle: '传统豪门', isFeatured: true, riskLevel: 'low', prediction: 'home', confidence: 70, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '赫根', homeSubtitle: '黑马', awayTeam: 'IFK哥德堡', awaySubtitle: '老牌球队', riskLevel: 'medium', prediction: 'draw', confidence: 46, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    // 拉美
    brazil: [
      { homeTeam: '弗拉门戈', homeSubtitle: '豪门', awayTeam: '帕尔梅拉斯', awaySubtitle: '卫冕冠军', isFeatured: true, riskLevel: 'high', prediction: 'draw', confidence: 52, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'},{label:'2-1/1-1',icon:'file'}] },
      { homeTeam: '圣保罗', homeSubtitle: '传统劲旅', awayTeam: '桑托斯', awaySubtitle: '老牌球队', riskLevel: 'medium', prediction: 'home', confidence: 60, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    argentina: [
      { homeTeam: '博卡青年', homeSubtitle: '豪门', awayTeam: '河床', awaySubtitle: '死敌', isFeatured: true, riskLevel: 'high', prediction: 'draw', confidence: 49, tags: [{label:'小2.5',icon:'clock'},{label:'双',icon:'square'},{label:'1-1/0-0',icon:'file'}] },
      { homeTeam: '竞技', homeSubtitle: '劲旅', awayTeam: '独立', awaySubtitle: '传统球队', riskLevel: 'low', prediction: 'home', confidence: 62, tags: [{label:'大2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    mexico: [
      { homeTeam: '美洲', homeSubtitle: '豪门', awayTeam: '蒙特雷', awaySubtitle: '劲旅', isFeatured: true, riskLevel: 'medium', prediction: 'home', confidence: 57, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
      { homeTeam: '蓝十字', homeSubtitle: '传统球队', awayTeam: '老虎', awaySubtitle: '强队', riskLevel: 'low', prediction: 'away', confidence: 44, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    chile: [
      { homeTeam: '科洛科洛', homeSubtitle: '霸主', awayTeam: '智利大学', awaySubtitle: '传统豪门', riskLevel: 'medium', prediction: 'home', confidence: 61, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
    ],
    colombia: [
      { homeTeam: '百万富翁', homeSubtitle: '劲旅', awayTeam: '国民竞技', awaySubtitle: '豪门', riskLevel: 'medium', prediction: 'draw', confidence: 53, tags: [{label:'小2.5',icon:'clock'},{label:'单',icon:'square'}] },
    ],
    peru: [
      { homeTeam: '利马联盟', homeSubtitle: '传统劲旅', awayTeam: '水晶体育', awaySubtitle: '黑马', riskLevel: 'low', prediction: 'home', confidence: 64, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'}] },
    ],
  };

  const matches = mockData[leagueKey] || [];
  const times = ['19:35', '20:00', '21:30', '18:00'];
  return matches.map((m, i) => {
    // 用预测引擎统一生成预测与推算过程（卡片与说明页保持一致）
    const p = buildPrediction({ homeTeam: m.homeTeam, awayTeam: m.awayTeam });
    return {
      ...m,
      id: m.id || `mock-${leagueKey}-${i}`,
      league: leagueKey,
      leagueName: LEAGUE_NAMES[leagueKey],
      isMock: true,
      time: times[i % times.length],
      date: new Date().toISOString().split('T')[0],
      status: 'SCHEDULED',
      homeScore: null,
      awayScore: null,
      hasScore: false,
      riskLevel: p.riskLevel,
      riskLabel: p.riskLabel,
      prediction: p.prediction,
      predictionLabel: p.predictionLabel,
      confidence: p.confidence,
      tags: p.tags,
      reasoning: p.reasoning
    };
  });
}

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

// ===== 全局数据状态 =====
const AppData = {
  matches: [],
  socialItems: [],
  historicalTotal: 342,
  loading: false,
  error: null
};