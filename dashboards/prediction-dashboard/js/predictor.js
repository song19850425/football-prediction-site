/**
 * 足球预测引擎 - 基于真实历史数据的统计预测
 * 
 * 核心算法：
 * 1. 泊松分布模型（Poisson Distribution）计算预期进球
 * 2. 球队攻防强度因子（基于上赛季数据）
 * 3. 近期状态加权（最近10场比赛）
 * 4. 主场优势修正
 * 5. 置信度计算（基于数据量 + 状态一致性）
 * 6. 冷门风险评估
 */

const Predictor = {
  // 联赛平均数据缓存
  _leagueAverages: {},

  /**
   * 初始化：计算各联赛的平均进球数
   */
  init() {
    if (!window.HISTORICAL_DATA) {
      console.warn('[Predictor] 无历史数据，使用降级模式');
      return;
    }
    const { ts, sm } = window.HISTORICAL_DATA;
    
    // 按联赛分组计算平均值
    const leagueTeams = {};
    for (const match of sm) {
      if (!leagueTeams[match.lg]) leagueTeams[match.lg] = { homeGoals: 0, awayGoals: 0, matches: 0 };
    }
    
    // 使用历史数据中的球队统计计算联赛平均
    for (const [id, team] of Object.entries(ts)) {
      // 按联赛分组（通过球队ID范围推测，简化处理：使用全局平均）
      // 实际上我们通过 scheduled matches 中的 league 信息来分组
    }
    
    // 简化：计算全局平均
    const allTeams = Object.values(ts);
    let totalHomeGoals = 0, totalAwayGoals = 0, totalHomeMatches = 0, totalAwayMatches = 0;
    for (const t of allTeams) {
      totalHomeGoals += t.hGF;
      totalAwayGoals += t.aGF;
      totalHomeMatches += t.hM;
      totalAwayMatches += t.aM;
    }
    
    this._leagueAverages['_global'] = {
      avgHomeGoals: totalHomeMatches > 0 ? totalHomeGoals / totalHomeMatches : 1.5,
      avgAwayGoals: totalAwayMatches > 0 ? totalAwayGoals / totalAwayMatches : 1.1,
    };
    
    console.log('[Predictor] 初始化完成, 全局场均进球:', 
      this._leagueAverages['_global'].avgHomeGoals.toFixed(2), '/',
      this._leagueAverages['_global'].avgAwayGoals.toFixed(2));
  },

  /**
   * 获取联赛平均数据
   */
  getLeagueAverages() {
    return this._leagueAverages['_global'];
  },

  /**
   * 主预测函数：对一场比赛进行预测
   * @param {Object} match - 比赛对象 { hId, aId, hNm, aNm, lg }
   * @returns {Object} 预测结果
   */
  predict(match) {
    if (!window.HISTORICAL_DATA) {
      return this._fallbackPrediction(match);
    }

    const { ts } = window.HISTORICAL_DATA;
    const homeTeam = ts[match.hId];
    const awayTeam = ts[match.aId];

    // 如果任一球队无历史数据，降级
    if (!homeTeam && !awayTeam) {
      return this._fallbackPrediction(match);
    }
    if (!homeTeam) {
      return this._predictOneSided(match, awayTeam, false);
    }
    if (!awayTeam) {
      return this._predictOneSided(match, homeTeam, true);
    }

    return this._predictFull(match, homeTeam, awayTeam);
  },

  /**
   * 完整预测（两队都有历史数据）
   */
  _predictFull(match, homeTeam, awayTeam) {
    const avg = this.getLeagueAverages();

    // 1. 计算攻防强度因子
    const homeAttack = homeTeam.hM > 0 ? (homeTeam.hGF / homeTeam.hM) / avg.avgHomeGoals : 1.0;
    const homeDefense = homeTeam.hM > 0 ? (homeTeam.hGA / homeTeam.hM) / avg.avgAwayGoals : 1.0;
    const awayAttack = awayTeam.aM > 0 ? (awayTeam.aGF / awayTeam.aM) / avg.avgAwayGoals : 1.0;
    const awayDefense = awayTeam.aM > 0 ? (awayTeam.aGA / awayTeam.aM) / avg.avgHomeGoals : 1.0;

    // 2. 计算预期进球 (xG)
    let homeXG = homeAttack * awayDefense * avg.avgHomeGoals;
    let awayXG = awayAttack * homeDefense * avg.avgAwayGoals;

    // 3. 近期状态修正
    const homeForm = this._calcForm(homeTeam.rec, 'H');
    const awayForm = this._calcForm(awayTeam.rec, 'A');
    
    // 近期状态影响 xG (±15%)
    const homeFormMod = 1 + (homeForm - 0.4) * 0.3;
    const awayFormMod = 1 + (awayForm - 0.4) * 0.3;
    homeXG *= homeFormMod;
    awayXG *= awayFormMod;

    // 限制 xG 范围
    homeXG = Math.max(0.3, Math.min(homeXG, 4.0));
    awayXG = Math.max(0.2, Math.min(awayXG, 3.5));

    // 4. 泊松分布计算胜负平概率
    const probs = this._poissonProbabilities(homeXG, awayXG);
    
    // 4.5. 平局概率底线修正：确保平局率不低于15%
    const adjustedProbs = this._ensureDrawRate(probs);

    // 5. 确定预测结果
    const prediction = this._determinePrediction(adjustedProbs);

    // 6. 计算置信度
    const confidence = this._calcConfidence(homeTeam, awayTeam, adjustedProbs, homeForm, awayForm);

    // 7. 风险评估
    const riskLevel = this._calcRiskLevel(adjustedProbs, confidence, homeXG, awayXG);

    // 8. 生成比分预测
    const scorePrediction = this._predictScore(homeXG, awayXG, prediction);

    // 9. 生成标签
    const tags = this._generateTags(homeXG, awayXG, adjustedProbs);

    return {
      prediction: prediction,
      predictionLabel: this._getPredLabel(prediction),
      confidence: confidence,
      riskLevel: riskLevel,
      riskLabel: this._getRiskLabel(riskLevel),
      homeXG: homeXG,
      awayXG: awayXG,
      homeProb: adjustedProbs.homeWin,
      drawProb: adjustedProbs.draw,
      awayProb: adjustedProbs.awayWin,
      scorePrediction: scorePrediction,
      tags: tags,
      homeForm: homeForm,
      awayForm: awayForm,
      dataQuality: 'high',
    };
  },

  /**
   * 单边预测（只有一队有历史数据）
   */
  _predictOneSided(match, knownTeam, isHome) {
    const avg = this.getLeagueAverages();
    const team = knownTeam;
    const form = this._calcForm(team.rec, isHome ? 'H' : 'A');
    
    let homeXG, awayXG;
    if (isHome) {
      homeXG = team.hM > 0 ? (team.hGF / team.hM) : avg.avgHomeGoals;
      awayXG = avg.avgAwayGoals;
    } else {
      homeXG = avg.avgHomeGoals;
      awayXG = team.aM > 0 ? (team.aGF / team.aM) : avg.avgAwayGoals;
    }

    const probs = this._poissonProbabilities(homeXG, awayXG);
    const prediction = this._determinePrediction(probs);
    const confidence = Math.min(55, 40 + team.tM * 0.4);

    return {
      prediction: prediction,
      predictionLabel: this._getPredLabel(prediction),
      confidence: Math.round(confidence),
      riskLevel: 'medium',
      riskLabel: '中度防冷',
      homeXG: homeXG,
      awayXG: awayXG,
      homeProb: probs.homeWin,
      drawProb: probs.draw,
      awayProb: probs.awayWin,
      scorePrediction: this._predictScore(homeXG, awayXG, prediction),
      tags: this._generateTags(homeXG, awayXG, probs),
      homeForm: form,
      awayForm: 0.4,
      dataQuality: 'partial',
    };
  },

  /**
   * 降级预测（两队都无历史数据）
   */
  _fallbackPrediction(match) {
    return {
      prediction: 'home',
      predictionLabel: '主胜',
      confidence: 50,
      riskLevel: 'high',
      riskLabel: '冷门预警',
      homeXG: 1.5,
      awayXG: 1.0,
      homeProb: 45,
      drawProb: 28,
      awayProb: 27,
      scorePrediction: '1-0',
      tags: [{ label: '大2.5', icon: 'clock' }, { label: '单', icon: 'square' }],
      homeForm: 0.4,
      awayForm: 0.4,
      dataQuality: 'none',
    };
  },

  /**
   * 计算近期状态（基于最近10场比赛）
   * 返回 0-1 之间的状态值
   */
  _calcForm(recentMatches, venue) {
    if (!recentMatches || recentMatches.length === 0) return 0.4;
    
    const filtered = venue ? recentMatches.filter(m => m.v === venue) : recentMatches;
    const matches = filtered.length > 0 ? filtered : recentMatches;
    
    let totalPoints = 0;
    let maxPoints = 0;
    const weights = [];
    
    // 指数衰减权重：最近的比赛权重更高
    for (let i = 0; i < Math.min(matches.length, 10); i++) {
      weights.push(Math.exp(-i * 0.15)); // e^(-0.15*i)
    }
    const weightSum = weights.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < Math.min(matches.length, 10); i++) {
      const m = matches[i];
      const w = weights[i] / weightSum;
      if (m.gf > m.ga) totalPoints += 3 * w;
      else if (m.gf === m.ga) totalPoints += 1 * w;
      maxPoints += 3 * w;
    }
    
    return maxPoints > 0 ? totalPoints / maxPoints : 0.4;
  },

  /**
   * 泊松分布概率计算（含 Dixon-Coles 平局修正）
   * P(home win), P(draw), P(away win)
   */
  _poissonProbabilities(homeXG, awayXG) {
    const maxGoals = 8;
    const homeProbs = [];
    const awayProbs = [];
    
    for (let i = 0; i <= maxGoals; i++) {
      homeProbs.push(this._poisson(i, homeXG));
      awayProbs.push(this._poisson(i, awayXG));
    }
    
    // Dixon-Coles 修正参数 ρ (rho)
    // 低比分平局（0-0, 1-1）概率膨胀
    const rho = this._calcRho(homeXG, awayXG);
    
    let homeWin = 0, draw = 0, awayWin = 0;
    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        let prob = homeProbs[i] * awayProbs[j];
        
        // Dixon-Coles 修正：低比分平局概率调整
        if (i === j && i <= 2) {
          if (i === 0) {
            prob *= (1 + rho * 1.2 * (1 - homeXG * 0.3) * (1 - awayXG * 0.3));
          } else if (i === 1) {
            prob *= (1 + rho * 0.9 * (1 - homeXG * 0.5) * (1 - awayXG * 0.5));
          } else if (i === 2) {
            prob *= (1 + rho * 0.4);
          }
        } else if (i === 0 && j === 1) {
          prob *= (1 - rho * 0.6 * (1 - homeXG * 0.3) * awayXG * 0.5);
        } else if (i === 1 && j === 0) {
          prob *= (1 - rho * 0.6 * homeXG * 0.5 * (1 - awayXG * 0.3));
        }
        
        if (i > j) homeWin += prob;
        else if (i === j) draw += prob;
        else awayWin += prob;
      }
    }
    
    // 归一化
    const total = homeWin + draw + awayWin;
    return {
      homeWin: Math.round(homeWin / total * 100),
      draw: Math.round(draw / total * 100),
      awayWin: Math.round(awayWin / total * 100),
    };
  },

  /**
   * 确保平局率不低于合理水平
   * 将概率向更均衡的分布混合
   */
  _ensureDrawRate(probs) {
    // 目标：平局率至少 20%
    const targetDraw = 20;
    const currentDraw = probs.draw;
    
    if (currentDraw >= targetDraw) return probs;
    
    // 计算需要增加多少平局概率
    const deficit = targetDraw - currentDraw;
    const blendFactor = deficit / (100 - currentDraw);
    
    // 从主胜和客胜中各取一半来增加平局
    const fromHome = probs.homeWin * blendFactor * 0.5;
    const fromAway = probs.awayWin * blendFactor * 0.5;
    
    return {
      homeWin: Math.round(probs.homeWin - fromHome),
      draw: Math.round(probs.draw + fromHome + fromAway),
      awayWin: Math.round(probs.awayWin - fromAway),
    };
  },
  /**
   * 计算 Dixon-Coles ρ 参数
   * ρ 控制平局修正强度，xG 越接近，ρ 越大
   */
  _calcRho(homeXG, awayXG) {
    const xgDiff = Math.abs(homeXG - awayXG);
    // 增强的 ρ 参数：xG 接近时平局概率大幅提升
    return Math.max(0.08, 0.55 - xgDiff * 0.12);
  },

  /**
   * 泊松分布概率质量函数
   */
  _poisson(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return Math.pow(lambda, k) * Math.exp(-lambda) / this._factorial(k);
  },

  _factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  },

  /**
   * 确定预测结果
   */
  _determinePrediction(probs) {
    if (probs.homeWin >= probs.draw && probs.homeWin >= probs.awayWin) return 'home';
    if (probs.draw >= probs.homeWin && probs.draw >= probs.awayWin) return 'draw';
    return 'away';
  },

  /**
   * 计算置信度
   */
  _calcConfidence(homeTeam, awayTeam, probs, homeForm, awayForm) {
    // 数据量因子：比赛越多，置信度越高
    const dataFactor = Math.min(1, (homeTeam.tM + awayTeam.tM) / 60);
    
    // 状态一致性因子：近期状态稳定则置信度高
    const formVariance = Math.abs(homeForm - awayForm);
    const consistencyFactor = 1 - formVariance * 0.5;
    
    // 预测优势因子：胜率越高，置信度越高
    const maxProb = Math.max(probs.homeWin, probs.draw, probs.awayWin);
    const advantageFactor = (maxProb - 33) / 67;
    
    let confidence = 30 + dataFactor * 25 + consistencyFactor * 15 + advantageFactor * 20;
    confidence = Math.round(Math.min(85, Math.max(30, confidence)));
    
    return confidence;
  },

  /**
   * 计算风险等级
   */
  _calcRiskLevel(probs, confidence, homeXG, awayXG) {
    const maxProb = Math.max(probs.homeWin, probs.draw, probs.awayWin);
    const secondProb = [probs.homeWin, probs.draw, probs.awayWin].sort((a, b) => b - a)[1];
    const margin = maxProb - secondProb;
    
    // 低置信度 + 小优势 = 高风险
    if (confidence < 40 || margin < 5) return 'high';
    // 中等置信度 + 中等优势 = 中风险
    if (confidence < 55 || margin < 12) return 'medium';
    // 高置信度 + 大优势 = 低风险
    return 'low';
  },

  /**
   * 预测比分（选择最可能且符合预测结果的比分）
   */
  _predictScore(homeXG, awayXG, prediction) {
    const scores = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = 0; j <= 6; j++) {
        const prob = this._poisson(i, homeXG) * this._poisson(j, awayXG);
        let outcome;
        if (i > j) outcome = 'home';
        else if (i === j) outcome = 'draw';
        else outcome = 'away';
        
        scores.push({ score: `${i}-${j}`, prob, outcome });
      }
    }
    
    // 如果指定了预测结果，优先选择匹配的比分
    if (prediction) {
      const matching = scores.filter(s => s.outcome === prediction);
      matching.sort((a, b) => b.prob - a.prob);
      if (matching.length > 0) return matching[0].score;
    }
    
    // 否则选概率最高的
    scores.sort((a, b) => b.prob - a.prob);
    return scores[0].score;
  },

  /**
   * 生成标签
   */
  _generateTags(homeXG, awayXG, probs) {
    const tags = [];
    const totalXG = homeXG + awayXG;
    
    // 大小球
    tags.push({
      label: totalXG > 2.5 ? '大2.5' : '小2.5',
      icon: 'clock'
    });
    
    // 单双
    const expectedTotal = Math.round(totalXG);
    tags.push({
      label: expectedTotal % 2 === 0 ? '双' : '单',
      icon: 'square'
    });
    
    // 常见比分（概率最高的比分）
    const scores = this._topScores(homeXG, awayXG);
    if (scores.length > 0) {
      tags.push({
        label: scores.join(' / '),
        icon: 'file'
      });
    }
    
    return tags;
  },

  /**
   * 最可能比分
   */
  _topScores(homeXG, awayXG) {
    const scores = [];
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        scores.push({
          score: `${i}-${j}`,
          prob: this._poisson(i, homeXG) * this._poisson(j, awayXG)
        });
      }
    }
    scores.sort((a, b) => b.prob - a.prob);
    return scores.slice(0, 2).map(s => s.score);
  },

  _getPredLabel(pred) {
    return { home: '主胜', draw: '平局', away: '客胜' }[pred] || '未知';
  },

  _getRiskLabel(level) {
    return { low: '低风险', medium: '中度防冷', high: '冷门预警' }[level] || '未知';
  },

  /**
   * 批量预测
   */
  predictAll(matches) {
    return matches.map(m => {
      const pred = this.predict(m);
      return {
        id: m.id,
        league: m.lg,
        leagueName: m.lgNm,
        time: this._formatTime(m.d),
        date: m.d ? m.d.split('T')[0] : '',
        status: m.s,
        isFeatured: false,
        homeTeam: m.hNm,
        homeSubtitle: '',
        awayTeam: m.aNm,
        awaySubtitle: '',
        homeScore: null,
        awayScore: null,
        hasScore: false,
        ...pred,
      };
    });
  },

  _formatTime(dateStr) {
    if (!dateStr) return '--:--';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '--:--';
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '--:--'; }
  },
};

// 自动初始化
if (typeof window !== 'undefined') {
  window.Predictor = Predictor;
  if (window.HISTORICAL_DATA) {
    Predictor.init();
  }
}