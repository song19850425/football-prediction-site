# -*- coding: utf-8 -*-
"""泊松攻防强度模型 —— 前向回测 + Dixon-Coles 修正 + 赔率校准（研究用途）。

严格复现 build_weekly.py 的攻防强度与泊松模型，逐赛季前向回测：
第 S 赛季只用 S 之前赛季的已完赛比赛拟合，无未来函数。

三层优化的增量验证（逐层独立，不叠改）：
  第 1 层：Dixon-Coles 低比分修正，网格搜索 rho ∈ [-0.2, 0.2] step 0.01
  第 2 层：市场赔率概率校准 P_final = a·P_model + (1-a)·P_market，网格 a ∈ [0,1] step 0.05
  第 3 层：时间衰减加权攻防强度，指数衰减半衰期网格搜索

评估指标：准确率 / 平局命中率 / log-loss / Brier / ROI（策略A、策略B 价值下注）
仅使用 Python 标准库。
"""
import io
import json
import math
import sys
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

PATH = r"d:\文件\TREA 目录\6a64786b5f5ef16ff6d945f5\_site\data\history.json"
MAXG = 8
FALLBACK_BASE_H = 1.5   # 首赛季无历史数据时的联赛基准兜底（仅 2016-17 生效）
FALLBACK_BASE_A = 1.2

data = json.load(io.open(PATH, encoding='utf-8'))
matches = data["matches"]
seasons = data["seasons"]
leagues = data["leagues"]

# ---------------------------------------------------------------- 泊松 pmf 缓存
_pmf_cache = {}


def pmf(lam):
    key = round(lam, 6)
    v = _pmf_cache.get(key)
    if v is None:
        v = [math.exp(-lam) * lam ** k / math.factorial(k) for k in range(MAXG + 1)]
        _pmf_cache[key] = v
    return v


# --------------------------------------------------- 逐赛季前向拟合（预计算 lamH/lamA）
def build_rows():
    """返回预测样本列表，每条含 lamH/lamA/实际结果/赔率/去水市场概率。"""
    team = {lg: defaultdict(lambda: [0, 0, 0, 0.0]) for lg in leagues}  # 加权: gf_w,ga_w,n_w
    lg_tot = {lg: [0.0, 0.0, 0.0] for lg in leagues}  # 加权: home_goals, away_goals, matches

    def strengths(lg, tname, avg_gf, avg_ga):
        rec = team[lg].get(tname)
        if rec is None or rec[2] == 0:
            return 1.0, 1.0
        gf, ga, n = rec[0], rec[1], rec[2]
        atk = min(1.7, max(0.5, (gf / n) / avg_gf))
        dfn = min(1.7, max(0.5, (ga / n) / avg_ga))
        return atk, dfn

    out = []
    for S in seasons:
        # 用"当前赛季之前"的累计统计拟合参数
        for lg in leagues:
            gf_tot = sum(v[0] for v in team[lg].values())
            ga_tot = sum(v[1] for v in team[lg].values())
            nlg = sum(v[2] for v in team[lg].values())
            if nlg == 0:
                base_h, base_a = FALLBACK_BASE_H, FALLBACK_BASE_A
                avg_gf = avg_ga = 1.35
            else:
                avg_gf = gf_tot / nlg
                avg_ga = ga_tot / nlg
                base_h = lg_tot[lg][0] / lg_tot[lg][2]
                base_a = lg_tot[lg][1] / lg_tot[lg][2]
            for mt in matches:
                if mt["s"] != S or mt["l"] != lg:
                    continue
                if nlg == 0:
                    ah = dh = aa = da = 1.0
                else:
                    ah, dh = strengths(lg, mt["h"], avg_gf, avg_ga)
                    aa, da = strengths(lg, mt["a"], avg_gf, avg_ga)
                lamH = max(0.15, base_h * ah * da)
                lamA = max(0.15, base_a * aa * dh)
                oh, od, oa = mt.get("oh"), mt.get("od"), mt.get("oa")
                if oh and od and oa:
                    inv = [1.0 / oh, 1.0 / od, 1.0 / oa]
                    t = sum(inv)
                    mkt = (inv[0] / t, inv[1] / t, inv[2] / t)
                else:
                    mkt = None
                out.append({
                    "lg": lg, "s": S, "r": mt["r"],
                    "lamH": lamH, "lamA": lamA,
                    "ph": pmf(lamH), "pa": pmf(lamA),
                    "odds": {"H": oh, "D": od, "A": oa},
                    "mkt": mkt,
                })
        # 赛季结束并入累计（本版权重=1，时间衰减层单独处理）
        for mt in matches:
            if mt["s"] != S:
                continue
            lg = mt["l"]
            team[lg][mt["h"]][0] += mt["hg"]
            team[lg][mt["h"]][1] += mt["ag"]
            team[lg][mt["h"]][2] += 1
            team[lg][mt["a"]][0] += mt["ag"]
            team[lg][mt["a"]][1] += mt["hg"]
            team[lg][mt["a"]][2] += 1
            lg_tot[lg][0] += mt["hg"]
            lg_tot[lg][1] += mt["ag"]
            lg_tot[lg][2] += 1
    return out


ROWS = build_rows()
N = len(ROWS)
ODDS_N = sum(1 for r in ROWS if r["mkt"] is not None)

OUT_KEYS = ("H", "D", "A")


# ---------------------------------------------------------------- Dixon-Coles
def dc_tau(x, y, lamH, lamA, rho):
    if x == 0 and y == 0:
        return 1.0 - lamH * lamA * rho
    if x == 0 and y == 1:
        return 1.0 + lamH * rho
    if x == 1 and y == 0:
        return 1.0 + lamA * rho
    if x == 1 and y == 1:
        return 1.0 - rho
    return 1.0


def model_probs(row, rho):
    ph, pa = row["ph"], row["pa"]
    lamH, lamA = row["lamH"], row["lamA"]
    pH = pD = pA = 0.0
    for i in range(MAXG + 1):
        pi = ph[i]
        if pi == 0.0:
            continue
        for j in range(MAXG + 1):
            p = pi * pa[j]
            if rho != 0.0:
                if i <= 1 and j <= 1:
                    p *= dc_tau(i, j, lamH, lamA, rho)
            if i > j:
                pH += p
            elif i == j:
                pD += p
            else:
                pA += p
    s = pH + pD + pA
    return pH / s, pD / s, pA / s


# ---------------------------------------------------------------- 指标评估
def evaluate(probs_fn, label=""):
    """probs_fn(row) -> (pH,pD,pA) 已含全部校准。返回指标 dict。"""
    n = hit = dpred = dhit = actual_draw = 0
    sum_pD = 0.0
    ll = brier = 0.0
    # ROI
    sA = wA = 0
    stakeA = profitA = sum_oA = 0.0
    bets = {1.00: [0, 0, 0.0, 0.0, 0.0], 1.05: [0, 0, 0.0, 0.0, 0.0],
            1.10: [0, 0, 0.0, 0.0, 0.0]}  # n,w,profit,stake,sum_odds
    for row in ROWS:
        pH, pD, pA = probs_fn(row)
        probs = {"H": pH, "D": pD, "A": pA}
        actual = row["r"]
        pred = max(OUT_KEYS, key=lambda k: probs[k])
        n += 1
        if pred == actual:
            hit += 1
        if pred == "D":
            dpred += 1
            if actual == "D":
                dhit += 1
        if actual == "D":
            actual_draw += 1
        sum_pD += pD
        pa_act = probs[actual]
        if pa_act > 0:
            ll -= math.log(pa_act)
        for k in OUT_KEYS:
            y = 1.0 if k == actual else 0.0
            brier += (probs[k] - y) ** 2
        # ROI
        o = row["odds"].get(pred)
        if o is None:
            continue
        sA += 1
        stakeA += 1.0
        sum_oA += o
        win = (pred == actual)
        if win:
            wA += 1
            profitA += o - 1.0
        else:
            profitA -= 1.0
        for th, rec in bets.items():
            if probs[pred] * o > th:
                rec[0] += 1
                rec[3] += 1.0
                rec[4] += o
                if win:
                    rec[1] += 1
                    rec[2] += o - 1.0
                else:
                    rec[2] -= 1.0
    res = {
        "acc": hit / n, "hit": hit, "n": n,
        "draw_prec": (dhit / dpred if dpred else 0.0), "dpred": dpred, "dhit": dhit,
        "mean_pD": sum_pD / n, "draw_rate": actual_draw / n,
        "logloss": ll / n, "brier": brier / n,
        "roiA": (100 * profitA / stakeA if stakeA else 0.0), "nA": sA, "winA": wA,
        "profitA": profitA,
    }
    for th, rec in bets.items():
        res["roiB%.2f" % th] = (100 * rec[2] / rec[3] if rec[3] else 0.0)
        res["nB%.2f" % th] = rec[0]
    return res


def fmt(res):
    return ("acc=%.4f logloss=%.4f brier=%.4f mean_pD=%.4f(实际平局率%.4f) "
            "ROI_A=%.2f%%(n=%d) B1.00=%.2f%%(n=%d) B1.05=%.2f%%(n=%d) B1.10=%.2f%%(n=%d)"
            % (res["acc"], res["logloss"], res["brier"], res["mean_pD"], res["draw_rate"],
               res["roiA"], res["nA"], res["roiB1.00"], res["nB1.00"],
               res["roiB1.05"], res["nB1.05"], res["roiB1.10"], res["nB1.10"]))


print("=" * 78)
print("样本：%d 场预测（五联赛 %s），其中含赔率 %d 场" % (N, "、".join(leagues.values()), ODDS_N))
print("=" * 78)

# ---------------------------------------------------------------- 基线（rho=0, alpha=1）
base = evaluate(lambda r: model_probs(r, 0.0))
print("\n[基线] 纯模型（rho=0，无市场校准）")
print("  " + fmt(base))

# ---------------------------------------------------------------- 第 1 层：Dixon-Coles
print("\n" + "=" * 78)
print("第 1 层：Dixon-Coles 低比分修正（网格搜索 rho）")
print("=" * 78)
best_rho, best_rho_res = 0.0, base
rho_list = [round(-0.2 + 0.01 * i, 2) for i in range(41)]
for rho in rho_list:
    res = evaluate(lambda r, rho=rho: model_probs(r, rho))
    if res["logloss"] < best_rho_res["logloss"] - 1e-12:
        best_rho, best_rho_res = rho, res
# 展示若干 rho 点
for rho in (-0.10, -0.05, 0.0, 0.05, 0.10, 0.12):
    if rho in rho_list:
        res = evaluate(lambda r, rho=rho: model_probs(r, rho))
        print("  rho=%+.2f  %s" % (rho, fmt(res)))
print("  >>> 最优 rho=%+.2f（按 log-loss）" % best_rho)
print("  " + fmt(best_rho_res))

# ---------------------------------------------------------------- 第 2 层：赔率校准
print("\n" + "=" * 78)
print("第 2 层：市场赔率概率校准（固定最优 rho，网格搜索 alpha）")
print("  约定 P_final = alpha*P_model + (1-alpha)*P_market；alpha=1 为纯模型")
print("=" * 78)


def make_blend(rho, alpha):
    def f(row):
        pH, pD, pA = model_probs(row, rho)
        if alpha >= 1.0 or row["mkt"] is None:
            return pH, pD, pA
        mH, mD, mA = row["mkt"]
        return (alpha * pH + (1 - alpha) * mH,
                alpha * pD + (1 - alpha) * mD,
                alpha * pA + (1 - alpha) * mA)
    return f


best_alpha, best_alpha_res = 1.0, best_rho_res
for i in range(21):
    a = round(0.05 * i, 2)
    res = evaluate(make_blend(best_rho, a))
    if res["logloss"] < best_alpha_res["logloss"] - 1e-12:
        best_alpha, best_alpha_res = a, res
for a in (0.0, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0):
    res = evaluate(make_blend(best_rho, a))
    print("  alpha=%.2f  %s" % (a, fmt(res)))
print("  >>> 最优 alpha=%.2f（按 log-loss）" % best_alpha)
print("  " + fmt(best_alpha_res))

# ---------------------------------------------------------------- 第 3 层：时间衰减
print("\n" + "=" * 78)
print("第 3 层：时间衰减加权攻防强度（指数衰减半衰期，天）")
print("=" * 78)

# 预解析日期 -> 天序号
from datetime import date
_d0 = date(2000, 1, 1)


def day_of(dstr):
    y, m, d = (int(x) for x in dstr.split("-"))
    return (date(y, m, d) - _d0).days


for mt in matches:
    mt["_day"] = day_of(mt["d"])
season_start = {}
for s in seasons:
    ds = [mt["_day"] for mt in matches if mt["s"] == s]
    season_start[s] = min(ds) if ds else 0
matches_sorted = sorted(matches, key=lambda m: m["_day"])


def build_rows_decay(halflife):
    team = {lg: defaultdict(lambda: [0.0, 0.0, 0.0]) for lg in leagues}
    lg_tot = {lg: [0.0, 0.0, 0.0] for lg in leagues}
    out = []
    for S in seasons:
        ref = season_start[S]
        # 只累计 ref 之前的比赛，按天距衰减
        for lg in leagues:
            team[lg].clear()
            lg_tot[lg] = [0.0, 0.0, 0.0]
        for mt in matches_sorted:
            if mt["_day"] >= ref:
                break
            w = 0.5 ** ((ref - mt["_day"]) / halflife)
            lg = mt["l"]
            team[lg][mt["h"]][0] += w * mt["hg"]
            team[lg][mt["h"]][1] += w * mt["ag"]
            team[lg][mt["h"]][2] += w
            team[lg][mt["a"]][0] += w * mt["ag"]
            team[lg][mt["a"]][1] += w * mt["hg"]
            team[lg][mt["a"]][2] += w
            lg_tot[lg][0] += w * mt["hg"]
            lg_tot[lg][1] += w * mt["ag"]
            lg_tot[lg][2] += w
        for lg in leagues:
            gf_tot = sum(v[0] for v in team[lg].values())
            ga_tot = sum(v[1] for v in team[lg].values())
            nlg = sum(v[2] for v in team[lg].values())
            if nlg == 0:
                base_h, base_a = FALLBACK_BASE_H, FALLBACK_BASE_A
                avg_gf = avg_ga = 1.35
            else:
                avg_gf = gf_tot / nlg
                avg_ga = ga_tot / nlg
                base_h = lg_tot[lg][0] / lg_tot[lg][2]
                base_a = lg_tot[lg][1] / lg_tot[lg][2]
            for mt in matches:
                if mt["s"] != S or mt["l"] != lg:
                    continue
                if nlg == 0:
                    ah = dh = aa = da = 1.0
                else:
                    def st(t):
                        rec = team[lg].get(t)
                        if rec is None or rec[2] == 0:
                            return 1.0, 1.0
                        return (min(1.7, max(0.5, (rec[0] / rec[2]) / avg_gf)),
                                min(1.7, max(0.5, (rec[1] / rec[2]) / avg_ga)))
                    ah, dh = st(mt["h"])
                    aa, da = st(mt["a"])
                lamH = max(0.15, base_h * ah * da)
                lamA = max(0.15, base_a * aa * dh)
                o = mt.get("oh"), mt.get("od"), mt.get("oa")
                oh, od, oa = o
                if oh and od and oa:
                    inv = [1.0 / oh, 1.0 / od, 1.0 / oa]
                    t = sum(inv)
                    mkt = (inv[0] / t, inv[1] / t, inv[2] / t)
                else:
                    mkt = None
                out.append({"lg": lg, "s": S, "r": mt["r"],
                            "lamH": lamH, "lamA": lamA,
                            "ph": pmf(lamH), "pa": pmf(lamA),
                            "odds": {"H": oh, "D": od, "A": oa}, "mkt": mkt})
    return out


def evaluate_rows(rows_alt, probs_fn, label=""):
    """在替换后的样本集上评估（样本集一致时用于衰减层）。"""
    global ROWS
    old = ROWS
    ROWS = rows_alt
    try:
        res = evaluate(probs_fn, label)
    finally:
        ROWS = old
    return res


# 在纯模型（alpha=1，含最优 rho）下测试衰减对模型本身是否有增量
best_hl, best_hl_res = None, best_rho_res
for hl in (120, 240, 365, 550, 730, 1095):
    rows_alt = build_rows_decay(hl)
    res_opt = evaluate_rows(rows_alt, make_blend(best_rho, 1.0))
    print("  half-life=%4dd  纯模型(DC): %s" % (hl, fmt(res_opt)))
    if res_opt["logloss"] < best_hl_res["logloss"] - 1e-12:
        best_hl, best_hl_res = hl, res_opt
# 衰减层最终叠加到第1+2层最优混合后的效果
if best_hl is not None:
    rows_alt = build_rows_decay(best_hl)
    best_hl_res = evaluate_rows(rows_alt, make_blend(best_rho, best_alpha))
    print("  >>> 最优 half-life=%s（按 log-loss）；叠加第1+2层混合后：" % (best_hl,))
    print("  " + fmt(best_hl_res))
else:
    print("  >>> 时间衰减无正增量，不采用（保持等权）")

# ---------------------------------------------------------------- 汇总对比表
print("\n" + "=" * 78)
print("汇总：改动前 vs 改动后（前向回测，全样本 %d 场，含赔率 %d 场）" % (N, ODDS_N))
print("=" * 78)
print("%-24s %7s %7s %8s %8s %8s %7s %7s %7s"
      % ("方案", "准确率", "均pD", "logloss", "brier", "ROI_A", "B1.00", "B1.05", "B1.10"))
for name, res in (("基线(rho=0,α=1)", base),
                  ("第1层 DC(rho=%.2f)" % best_rho, best_rho_res),
                  ("第1+2层 DC+校准(α=%.2f)" % best_alpha, best_alpha_res),
                  ("第1+2+3层 (+衰减)", best_hl_res),
                  ("纯市场基准(α=0)", evaluate(make_blend(best_rho, 0.0)))):
    print("%-24s %7.4f %7.4f %8.4f %8.4f %8.2f%% %6.2f%% %6.2f%% %6.2f%%"
          % (name, res["acc"], res["mean_pD"], res["logloss"], res["brier"],
             res["roiA"], res["roiB1.00"], res["roiB1.05"], res["roiB1.10"]))
print("（实际平局率 %.4f）" % base["draw_rate"])

# 竞彩 70% 返还率情景
print("\n" + "=" * 78)
print("竞彩低返还率情景：按欧赔 0.7 折算（估算）")
print("=" * 78)


def roi_factor(probs_fn, factor):
    stake = profit = sum_o = 0.0
    n = w = 0
    for row in ROWS:
        pH, pD, pA = probs_fn(row)
        probs = {"H": pH, "D": pD, "A": pA}
        pred = max(OUT_KEYS, key=lambda k: probs[k])
        o = row["odds"].get(pred)
        if o is None:
            continue
        n += 1
        stake += 1.0
        sum_o += o
        if pred == row["r"]:
            w += 1
            profit += o * factor - 1.0
        else:
            profit -= 1.0
    return n, w, profit, stake


for name, fn in (("基线", lambda r: model_probs(r, 0.0)),
                 ("DC+校准最优", make_blend(best_rho, best_alpha))):
    n, w, profit, stake = roi_factor(fn, 0.7)
    print("  %-12s 注数%6d 命中%6.2f%% ROI%8.2f%%" % (name, n, 100 * w / n, 100 * profit / stake))

print("\n最优配置：rho=%+.2f  alpha=%.2f  half-life=%s" % (best_rho, best_alpha, best_hl))