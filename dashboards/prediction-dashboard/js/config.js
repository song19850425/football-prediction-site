/**
 * 足球预测仪表盘 - API 配置
 * 
 * 注册免费 API Key：
 * 1. football-data.org → https://www.football-data.org/client/register
 *    免费版覆盖：英超、西甲、意甲、德甲、法甲、巴甲、英冠、荷甲、葡超
 *    （中超、J联赛、澳超、阿甲、墨超等需付费版，免费版降级为模拟数据）
 * 2. TheSportsDB → https://www.thesportsdb.com/free_sports_api
 *    覆盖：K联赛、泰超 (football-data.org 免费版不覆盖)
 * 3. GNews API → https://gnews.io/register
 *    覆盖：足球新闻/社交热点
 * 
 * 获取 Key 后填入下方，或通过页面设置面板输入（自动保存到 localStorage）
 */

const CONFIG = {
  // ===== API Keys =====
  // 优先从 localStorage 读取，其次使用下方默认值
  FOOTBALL_API_KEY: localStorage.getItem('pd_football_key') || 'b9bf4e1ea8594605ae422ce46c9b511e',
  SPORTSDB_API_KEY: localStorage.getItem('pd_sportsdb_key') || '3',  // TheSportsDB 免费测试 Key
  NEWS_API_KEY: localStorage.getItem('pd_news_key') || 'bcfa4a8368ef1adcffade6f9a216b3c9',

  // ===== API 端点 =====
  FOOTBALL_API_BASE: 'https://api.football-data.org/v4',
  SPORTSDB_API_BASE: 'https://www.thesportsdb.com/api/v1/json',
  NEWS_API_BASE: 'https://gnews.io/api/v4',

  // ===== 联赛配置（含数据源映射） =====
  COMPETITIONS: {
    // ★ 欧洲五大联赛（免费版可用 → football-data.org）
    premier:   { id: 'PL',  name: '英超',            color: '#3b0764', source: 'football-data', region: '欧洲五大' },
    laliga:    { id: 'PD',  name: '西甲',            color: '#dc2626', source: 'football-data', region: '欧洲五大' },
    seriea:    { id: 'SA',  name: '意甲',            color: '#2563eb', source: 'football-data', region: '欧洲五大' },
    bundesliga:{ id: 'BL1', name: '德甲',            color: '#e11d48', source: 'football-data', region: '欧洲五大' },
    ligue1:    { id: 'FL1', name: '法甲',            color: '#1d4ed8', source: 'football-data', region: '欧洲五大' },

    // ★ 欧洲次级联赛（免费版可用）
    championship:{ id: 'ELC', name: '英冠',          color: '#fbbf24', source: 'football-data', region: '欧洲其他' },
    eredivisie:  { id: 'DED', name: '荷甲',          color: '#f97316', source: 'football-data', region: '欧洲其他' },
    portugal:    { id: 'PPL', name: '葡超',          color: '#22c55e', source: 'football-data', region: '欧洲其他' },

    // ★ 拉美联赛（免费版可用）
    brazil:    { id: 'BSA', name: '巴甲',            color: '#16a34a', source: 'football-data', region: '拉美' },

    // ===== 以下联赛 football-data.org 免费版不覆盖，降级为模拟数据 =====
    // -- 亚洲联赛 --
    csl:       { id: 'CSL', name: '中超',            color: '#e53935', source: 'football-data', region: '亚洲' },
    jleague:   { id: 'JJL', name: 'J联赛',           color: '#ef4444', source: 'football-data', region: '亚洲' },
    kleague:   { id: '4468',name: 'K联赛',           color: '#3b82f6', source: 'thesportsdb',   region: '亚洲' },
    thai:      { id: '4547',name: '泰超',            color: '#06b6d4', source: 'thesportsdb',   region: '亚洲' },

    // -- 大洋洲 --
    aleague:   { id: 'AAL', name: '澳超',            color: '#f59e0b', source: 'football-data', region: '大洋洲' },

    // -- 北欧联赛 --
    eliteserien:{ id: 'TIP', name: '挪威超',         color: '#00c781', source: 'football-data', region: '欧洲其他' },
    allsvenskan:{ id: 'ALL', name: '瑞典超',         color: '#facc15', source: 'football-data', region: '欧洲其他' },

    // -- 拉美其他联赛 --
    argentina: { id: 'ASL', name: '阿甲',            color: '#8b5cf6', source: 'football-data', region: '拉美' },
    mexico:    { id: 'LMX', name: '墨超',            color: '#ec4899', source: 'football-data', region: '拉美' },
    chile:     { id: 'CPD', name: '智利甲',          color: '#ef4444', source: 'football-data', region: '拉美' },
    colombia:  { id: 'CLP', name: '哥伦甲',          color: '#f97316', source: 'football-data', region: '拉美' },
    peru:      { id: 'PPD', name: '秘鲁甲',          color: '#eab308', source: 'football-data', region: '拉美' },
  },

  // ===== 新闻关键词 =====
  NEWS_KEYWORDS: [
    'Premier League La Liga Serie A Bundesliga',
    'football soccer transfer news',
    '中超 J联赛 K联赛 泰超',
    'Brazil Serie A Argentina Liga MX',
    'Eliteserien Allsvenskan Eredivisie',
  ],

  // ===== 缓存设置 =====
  CACHE_DURATION: 5 * 60 * 1000,  // 5分钟缓存
  MAX_SOCIAL_ITEMS: 12,
  MAX_MATCHES: 30,                 // 最多显示30场比赛（联赛增多）

  // ===== 降级策略 =====
  USE_MOCK_FALLBACK: true,  // API 失败时自动使用模拟数据
};

// ===== 联赛名称映射 =====
const LEAGUE_NAMES = {
  // 欧洲五大
  premier: '英超',       laliga: '西甲',         seriea: '意甲',
  bundesliga: '德甲',    ligue1: '法甲',
  // 欧洲其他
  championship: '英冠',  eredivisie: '荷甲',     portugal: '葡超',
  eliteserien: '挪威超', allsvenskan: '瑞典超',
  // 亚洲
  csl: '中超',           jleague: 'J联赛',       kleague: 'K联赛',
  thai: '泰超',
  // 大洋洲
  aleague: '澳超',
  // 拉美
  brazil: '巴甲',        argentina: '阿甲',      mexico: '墨超',
  chile: '智利甲',       colombia: '哥伦甲',     peru: '秘鲁甲',
};

const LEAGUE_LABELS = {
  premier: 'league-premier',         laliga: 'league-laliga',           seriea: 'league-seriea',
  bundesliga: 'league-bundesliga',   ligue1: 'league-ligue1',
  championship: 'league-championship', eredivisie: 'league-eredivisie', portugal: 'league-portugal',
  eliteserien: 'league-eliteserien', allsvenskan: 'league-allsvenskan',
  csl: 'league-csl',                jleague: 'league-jleague',         kleague: 'league-kleague',
  thai: 'league-thai',              aleague: 'league-aleague',
  brazil: 'league-brazil',          argentina: 'league-argentina',     mexico: 'league-mexico',
  chile: 'league-chile',            colombia: 'league-colombia',       peru: 'league-peru',
};

// 联赛分组（用于筛选标签）
const LEAGUE_GROUPS = [
  { key: 'all',      name: '全部' },
  // 欧洲五大
  { key: 'premier',  name: '英超',      group: '欧洲五大' },
  { key: 'laliga',   name: '西甲',      group: '欧洲五大' },
  { key: 'seriea',   name: '意甲',      group: '欧洲五大' },
  { key: 'bundesliga', name: '德甲',    group: '欧洲五大' },
  { key: 'ligue1',   name: '法甲',      group: '欧洲五大' },
  // 欧洲其他
  { key: 'championship', name: '英冠',  group: '欧洲其他' },
  { key: 'eredivisie', name: '荷甲',    group: '欧洲其他' },
  { key: 'portugal', name: '葡超',      group: '欧洲其他' },
  { key: 'eliteserien', name: '挪威超', group: '欧洲其他' },
  { key: 'allsvenskan', name: '瑞典超', group: '欧洲其他' },
  // 亚洲
  { key: 'csl',      name: '中超',      group: '亚洲' },
  { key: 'jleague',  name: 'J联赛',     group: '亚洲' },
  { key: 'kleague',  name: 'K联赛',     group: '亚洲' },
  { key: 'thai',     name: '泰超',      group: '亚洲' },
  // 大洋洲
  { key: 'aleague',  name: '澳超',      group: '大洋洲' },
  // 拉美
  { key: 'brazil',   name: '巴甲',      group: '拉美' },
  { key: 'argentina',name: '阿甲',      group: '拉美' },
  { key: 'mexico',   name: '墨超',      group: '拉美' },
  { key: 'chile',    name: '智利甲',    group: '拉美' },
  { key: 'colombia', name: '哥伦甲',    group: '拉美' },
  { key: 'peru',     name: '秘鲁甲',    group: '拉美' },
];