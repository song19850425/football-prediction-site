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
const apiCache = {
  _store: {},
  get(key) {
    const entry = this._store[key];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CONFIG.CACHE_DURATION) {
      delete this._store[key];
      return null;
    }
    return entry.data;
  },
  set(key, data) {
    this._store[key] = { data, timestamp: Date.now() };
  }
};

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

// ===== 数据源适配器 =====
const DataAdapters = {
  /**
   * football-data.org → 统一格式
   */
  'football-data': function(match, leagueKey) {
    return {
      id: match.id,
      league: leagueKey,
      leagueName: LEAGUE_NAMES[leagueKey],
      time: formatMatchTime(match.utcDate),
      date: match.utcDate?.split('T')[0] || '',
      status: match.status,
      isFeatured: false,
      homeTeam: match.homeTeam?.name || match.homeTeam?.shortName || '未知',
      homeSubtitle: '',
      awayTeam: match.awayTeam?.name || match.awayTeam?.shortName || '未知',
      awaySubtitle: '',
      homeScore: match.score?.fullTime?.home ?? null,
      awayScore: match.score?.fullTime?.away ?? null,
      hasScore: match.score?.fullTime?.home !== null,
      riskLevel: computeRiskLevel(match),
      riskLabel: getRiskLabel(computeRiskLevel(match)),
      prediction: predictMatch(match),
      predictionLabel: getPredictionLabel(predictMatch(match)),
      confidence: 40 + Math.floor(Math.random() * 30),
      tags: generateTags(match)
    };
  },

  /**
   * TheSportsDB → 统一格式
   */
  'thesportsdb': function(match, leagueKey) {
    const homeScore = match.intHomeScore !== null && match.intHomeScore !== undefined ? parseInt(match.intHomeScore) : null;
    const awayScore = match.intAwayScore !== null && match.intAwayScore !== undefined ? parseInt(match.intAwayScore) : null;
    const hasScore = homeScore !== null && awayScore !== null;

    return {
      id: match.idEvent,
      league: leagueKey,
      leagueName: LEAGUE_NAMES[leagueKey],
      time: match.strTime || match.strTimestamp ? formatMatchTime(match.strTimestamp) : '--:--',
      date: match.dateEvent || match.strDate || '',
      status: match.strStatus === 'Match Finished' ? 'FINISHED' : 'SCHEDULED',
      isFeatured: false,
      homeTeam: match.strHomeTeam || '未知',
      homeSubtitle: '',
      awayTeam: match.strAwayTeam || '未知',
      awaySubtitle: '',
      homeScore: homeScore,
      awayScore: awayScore,
      hasScore: hasScore,
      riskLevel: computeRiskLevel(match),
      riskLabel: getRiskLabel(computeRiskLevel(match)),
      prediction: predictMatch(match),
      predictionLabel: getPredictionLabel(predictMatch(match)),
      confidence: 40 + Math.floor(Math.random() * 30),
      tags: generateTags(match)
    };
  }
};

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

    if (matches.length === 0 && CONFIG.USE_MOCK_FALLBACK) {
      console.warn(`[API] ${comp.name} 降级为模拟数据`);
      matches = getMockMatches(leagueKey);
    }

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
   * 获取所有联赛的近期比赛（优先 API，降级为 Predictor 预测数据）
   */
  async getAllMatches() {
    // 方案1: 尝试从 API 获取
    let apiMatches = [];
    try {
      const leagues = Object.keys(CONFIG.COMPETITIONS);
      const results = await Promise.allSettled(
        leagues.map(key => this.getMatches(key, 'SCHEDULED'))
      );
      results.forEach(r => {
        if (r.status === 'fulfilled') apiMatches.push(...r.value);
      });
    } catch (err) {
      console.warn('[API] getAllMatches 失败:', err.message);
    }

    // 如果 API 返回了数据，应用 Predictor 预测
    if (apiMatches.length > 0) {
      if (hasPredictor()) {
        apiMatches = this._applyPredictor(apiMatches);
      }
      return apiMatches.slice(0, CONFIG.MAX_MATCHES);
    }

    // 方案2: 使用 Predictor + 历史数据
    if (hasPredictor()) {
      console.log('[API] 使用 Predictor 基于历史数据预测');
      try {
        const predMatches = Predictor.predictAll(window.HISTORICAL_DATA.sm);
        // 标记为真实预测
        predMatches.forEach(m => { m._fromPredictor = true; });
        return predMatches.slice(0, CONFIG.MAX_MATCHES);
      } catch (err) {
        console.warn('[API] Predictor 失败:', err.message);
      }
    }

    // 方案3: 降级为模拟数据
    console.warn('[API] 降级为模拟数据');
    if (CONFIG.USE_MOCK_FALLBACK) {
      const allLeagues = Object.keys(CONFIG.COMPETITIONS);
      return allLeagues.flatMap(k => getMockMatches(k)).slice(0, CONFIG.MAX_MATCHES);
    }
    return [];
  },

  /**
   * 对 API 获取的比赛应用 Predictor 预测
   */
  _applyPredictor(apiMatches) {
    if (!hasPredictor()) return apiMatches;
    
    const { ts } = window.HISTORICAL_DATA;
    
    return apiMatches.map(m => {
      // 尝试找到球队ID匹配
      const homeTeam = Object.values(ts).find(t => 
        t.name === m.homeTeam || t.name.includes(m.homeTeam?.split(' ')[0])
      );
      const awayTeam = Object.values(ts).find(t => 
        t.name === m.awayTeam || t.name.includes(m.awayTeam?.split(' ')[0])
      );
      
      if (homeTeam && awayTeam) {
        const predResult = Predictor.predict({
          hId: homeTeam.id, aId: awayTeam.id,
          hNm: m.homeTeam, aNm: m.awayTeam,
          lg: m.league, lgNm: m.leagueName,
          d: m.date
        });
        
        // 覆盖预测字段
        m.riskLevel = predResult.riskLevel;
        m.riskLabel = predResult.riskLabel;
        m.prediction = predResult.prediction;
        m.predictionLabel = predResult.predictionLabel;
        m.confidence = predResult.confidence;
        m.tags = predResult.tags;
        m.homeProb = predResult.homeProb;
        m.drawProb = predResult.drawProb;
        m.awayProb = predResult.awayProb;
        m.scorePrediction = predResult.scorePrediction;
        m._predResult = predResult;
      }
      
      return m;
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
    const cached = apiCache.get(cacheKey);
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

// ===== 辅助函数（使用真实预测引擎） =====
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

// 全局标志：是否使用真实预测引擎
let _usePredictor = null;
function hasPredictor() {
  if (_usePredictor === null) {
    _usePredictor = typeof Predictor !== 'undefined' && window.HISTORICAL_DATA;
  }
  return _usePredictor;
}

function computeRiskLevel(match) {
  // 真实预测引擎处理
  if (hasPredictor() && match._predResult) {
    return match._predResult.riskLevel;
  }
  const rand = Math.random();
  if (rand < 0.3) return 'low';
  if (rand < 0.7) return 'medium';
  return 'high';
}

function getRiskLabel(level) {
  return { low: '低风险', medium: '中度防冷', high: '冷门预警' }[level] || '未知';
}

function predictMatch(match) {
  if (hasPredictor() && match._predResult) {
    return match._predResult.prediction;
  }
  const r = Math.random();
  if (r < 0.4) return 'home';
  if (r < 0.7) return 'draw';
  return 'away';
}

function getPredictionLabel(pred) {
  return { home: '主胜', draw: '平局', away: '客胜' }[pred] || '未知';
}

function generateTags(match) {
  if (hasPredictor() && match._predResult) {
    return match._predResult.tags;
  }
  const tags = [];
  tags.push({ label: Math.random() > 0.5 ? '大2.5' : '小2.5', icon: 'clock' });
  tags.push({ label: Math.random() > 0.5 ? '单' : '双', icon: 'square' });
  if (Math.random() > 0.6) {
    tags.push({ label: '1-1 / 2-2', icon: 'file' });
  }
  return tags;
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
      { homeTeam: '河南建业', homeSubtitle: '中原铁军', awayTeam: '青岛海牛', awaySubtitle: '保级球队', isFeatured: true, riskLevel: 'low', prediction: 'home', confidence: 68, tags: [{label:'大2.5',icon:'clock'},{label:'单',icon:'square'},{label:'2-0/2-1',icon:'file'}] },
      { homeTeam: '云南玉昆', homeSubtitle: '升班黑马', awayTeam: '成都蓉城', awaySubtitle: '传统劲旅', riskLevel: 'medium', prediction: 'draw', confidence: 48, tags: [{label:'大2.5',icon:'clock'},{label:'双',icon:'square'},{label:'1-1/2-2',icon:'file'}] },
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
  return matches.map((m, i) => ({
    ...m,
    id: m.id || `mock-${leagueKey}-${i}`,
    league: leagueKey,
    leagueName: LEAGUE_NAMES[leagueKey],
    time: times[i % times.length],
    date: new Date().toISOString().split('T')[0],
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    hasScore: false,
    riskLabel: getRiskLabel(m.riskLevel),
    predictionLabel: getPredictionLabel(m.prediction),
    confidence: m.confidence || 50
  }));
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