# -*- coding: utf-8 -*-
"""生成未来一周比赛预测静态数据 data/weekly.json。

赛程 / 赔率数据源（按优先级）：
  1) football-data.co.uk/fixtures.csv —— 免费、无需 Key、自带 B365 欧赔；
     但该文件约每周更新一次，多数日期取不到未来一周赛程。
  2) football-data.org v4 API —— 需要 Key，从环境变量 FOOTBALL_API_KEY 读取
     （仅存在于 CI 环境，绝不写入前端）。仅在源 1 无数据时启用。

球队攻防强度：
  - 源 1 路径：当前赛季已完赛比分（football-data.co.uk 赛季 CSV，失败回退 data/history.json）
  - 源 2 路径：football-data.org 积分榜

模型：泊松攻防强度（与页面原模型一致）
  lamH = 联赛主场基准 * 主队进攻 * 客队防守
  lamA = 联赛客场基准 * 客队进攻 * 主队防守
仅使用 Python 标准库。
"""
import csv
import io
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'weekly.json'
HIST = ROOT / 'data' / 'history.json'

# 联赛码 -> 中文名（与 history.json 的 leagues 保持一致）
LEAGUES = {'E0': '英超', 'SP1': '西甲', 'I1': '意甲', 'D1': '德甲', 'F1': '法甲'}
# football-data.co.uk 联赛码 <-> football-data.org API 联赛码
CODE_TO_API = {'E0': 'PL', 'SP1': 'PD', 'I1': 'SA', 'D1': 'BL1', 'F1': 'FL1'}
API_TO_CODE = {v: k for k, v in CODE_TO_API.items()}
# 无可用数据时的联赛主/客场场均进球兜底值
DEFAULT_BASE = {
    'E0': (1.555, 1.280), 'SP1': (1.486, 1.133), 'I1': (1.481, 1.262),
    'D1': (1.722, 1.374), 'F1': (1.513, 1.215),
}
BASE = 'https://www.football-data.co.uk'
API_BASE = 'https://api.football-data.org/v4'
UA = 'Mozilla/5.0 (compatible; football-prediction-site weekly builder)'
DAYS_AHEAD = 7
MAX_GOALS = 8
# Dixon-Coles 低比分修正参数 ρ（scripts/backtest_betting.py 前向回测网格搜索最优，log-loss 最低）
DC_RHO = -0.05
# 说明：回测显示本模型相对博彩市场的互补信息≈0（对数损失最优解即"直接用市场概率"），
# 故不与市场赔率做概率混合，保留模型自身的独立输出（页面已另有"市场概率"单独展示）。


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    for enc in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode('latin-1', 'replace')


def api_get(path, key, timeout=30):
    req = urllib.request.Request(API_BASE + path, headers={
        'User-Agent': UA, 'X-Auth-Token': key})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


def season_code(start_year):
    return '%02d%02d' % (start_year % 100, (start_year + 1) % 100)


def current_season_start(today):
    return today.year if today.month >= 7 else today.year - 1


def to_float(x):
    try:
        v = float(x)
    except Exception:
        return None
    if v != v or v <= 1.0:
        return None
    return v


def last_sunday(year, month):
    d = date(year, month, 31) if month in (3, 10) else None
    while d.month != month:
        d -= timedelta(days=1)
    while d.weekday() != 6:
        d -= timedelta(days=1)
    return d


def london_offset_hours(d):
    """英国夏令时判断：3 月最后一个周日至 10 月最后一个周日为 BST(+1)。"""
    start = last_sunday(d.year, 3)
    end = last_sunday(d.year, 10)
    return 1 if start <= d < end else 0


def parse_dt(dstr, tstr):
    """football-data.co.uk 的日期/时间为英国本地时间 -> 返回 UTC datetime。"""
    dstr = (dstr or '').strip()
    if not dstr:
        return None
    d = None
    for fmt in ('%d/%m/%Y', '%d/%m/%y'):
        try:
            d = datetime.strptime(dstr, fmt).date()
            break
        except ValueError:
            d = None
    if d is None:
        return None
    hh = mm = 0
    tstr = (tstr or '').strip()
    if ':' in tstr:
        try:
            hh, mm = [int(x) for x in tstr.split(':')[:2]]
        except ValueError:
            hh = mm = 0
    local = datetime(d.year, d.month, d.day, hh, mm)
    utc = local - timedelta(hours=london_offset_hours(d))
    return utc.replace(tzinfo=timezone.utc)


def load_history():
    if not HIST.exists():
        return None
    try:
        with io.open(HIST, encoding='utf-8') as fh:
            return json.load(fh)
    except Exception as exc:
        print('[warn] history.json 读取失败：%s' % exc)
        return None


def season_matches(div, scode, history, season_label):
    """取某联赛某赛季已完赛比赛：优先现下载，失败回退 history.json。"""
    url = '%s/mmz4281/%s/%s.csv' % (BASE, scode, div)
    try:
        text = fetch(url)
        rows = []
        for r in csv.DictReader(io.StringIO(text)):
            if not r.get('HomeTeam') or not r.get('AwayTeam'):
                continue
            if not (r.get('FTHG') or '').strip() or not (r.get('FTAG') or '').strip():
                continue
            rows.append((r['HomeTeam'].strip(), r['AwayTeam'].strip(),
                         int(float(r['FTHG'])), int(float(r['FTAG']))))
        if rows:
            print('  强度源 %-3s %s 现下载 %d 场' % (div, season_label, len(rows)))
            return rows
    except Exception as exc:
        print('  强度源 %-3s %s 下载失败(%s)，回退 history.json' % (div, season_label, exc))

    if history:
        rows = [(m['h'], m['a'], m['hg'], m['ag'])
                for m in history.get('matches', [])
                if m['l'] == div and m['s'] == season_label]
        if rows:
            print('  强度源 %-3s %s 取自 history %d 场' % (div, season_label, len(rows)))
            return rows
    return []


def team_strengths(rows):
    """由比赛结果计算各队进攻/防守强度与联赛主客场基准。"""
    if not rows:
        return {}, None
    agg = {}
    hg = ag = 0
    for h, a, gh, ga in rows:
        for name, gf, ga_ in ((h, gh, ga), (a, ga, gh)):
            s = agg.setdefault(name, {'gf': 0, 'ga': 0, 'n': 0})
            s['gf'] += gf
            s['ga'] += ga_
            s['n'] += 1
        hg += gh
        ag += ga
    n = float(len(rows))
    avg_gf = sum(s['gf'] / s['n'] for s in agg.values()) / len(agg)
    avg_ga = sum(s['ga'] / s['n'] for s in agg.values()) / len(agg)
    avg_gf = avg_gf or 1.35
    avg_ga = avg_ga or 1.35
    table = {}
    for name, s in agg.items():
        table[name] = {
            'atk': min(1.7, max(0.5, (s['gf'] / s['n']) / avg_gf)),
            'def': min(1.7, max(0.5, (s['ga'] / s['n']) / avg_ga)),
        }
    return table, (hg / n, ag / n)


def csv_strengths(y, history, cur_label, prev_label):
    """源 1 路径：用 football-data.co.uk 赛季 CSV 计算各联赛攻防强度。"""
    strengths = {}
    for div in sorted(LEAGUES):
        rows = season_matches(div, season_code(y), history, cur_label)
        if len(rows) < 60:  # 新赛季样本太少，回退上一赛季
            alt = season_matches(div, season_code(y - 1), history, prev_label)
            if len(alt) > len(rows):
                rows = alt
        table, base = team_strengths(rows)
        strengths[div] = {'table': table, 'base': base or DEFAULT_BASE[div]}
    return strengths


def poisson(k, lam):
    return math.exp(-lam) * lam ** k / math.factorial(k)


def dc_tau(x, y, lam_h, lam_a, rho):
    """Dixon-Coles 低比分依赖修正因子 τ(x,y)，仅影响 0-0/1-0/0-1/1-1。"""
    if x == 0 and y == 0:
        return 1.0 - lam_h * lam_a * rho
    if x == 0 and y == 1:
        return 1.0 + lam_h * rho
    if x == 1 and y == 0:
        return 1.0 + lam_a * rho
    if x == 1 and y == 1:
        return 1.0 - rho
    return 1.0


def predict(base_h, base_a, home, away):
    atk_h = home.get('atk', 1.0)
    def_h = home.get('def', 1.0)
    atk_a = away.get('atk', 1.0)
    def_a = away.get('def', 1.0)
    lam_h = max(0.15, base_h * atk_h * def_a)
    lam_a = max(0.15, base_a * atk_a * def_h)
    ph = [poisson(i, lam_h) for i in range(MAX_GOALS + 1)]
    pa = [poisson(j, lam_a) for j in range(MAX_GOALS + 1)]
    pH = pD = pA = p_over = btts = 0.0
    for i in range(MAX_GOALS + 1):
        for j in range(MAX_GOALS + 1):
            p = ph[i] * pa[j]
            if i <= 1 and j <= 1:
                p *= dc_tau(i, j, lam_h, lam_a, DC_RHO)  # Dixon-Coles 修正
            if i > j:
                pH += p
            elif i == j:
                pD += p
            else:
                pA += p
            if i + j > 2.5:
                p_over += p
            if i > 0 and j > 0:
                btts += p
    s = pH + pD + pA
    pH, pD, pA = pH / s, pD / s, pA / s
    return {
        'pH': round(pH, 4), 'pD': round(pD, 4), 'pA': round(pA, 4),
        'pOver': round(p_over / s, 4), 'btts': round(btts / s, 4),
        'lamH': round(lam_h, 2), 'lamA': round(lam_a, 2),
    }


def implied(oh, od, oa):
    if not (oh and od and oa):
        return None
    inv = [1.0 / oh, 1.0 / od, 1.0 / oa]
    t = sum(inv)
    return {'h': round(inv[0] / t, 4), 'd': round(inv[1] / t, 4), 'a': round(inv[2] / t, 4)}


def csv_items(today, hi):
    """源 1：从 fixtures.csv 解析窗口内赛程（自带赔率）。"""
    print('下载未来赛程 fixtures.csv …')
    text = fetch('%s/fixtures.csv' % BASE)
    rows = []
    seen = set()
    for r in csv.DictReader(io.StringIO(text)):
        div = (r.get('Div') or '').strip()
        if div not in LEAGUES:
            continue
        dt = parse_dt(r.get('Date'), r.get('Time'))
        if not dt or not (today <= dt.date() <= hi):
            continue
        home = (r.get('HomeTeam') or '').strip()
        away = (r.get('AwayTeam') or '').strip()
        if not home or not away:
            continue
        k = (div, dt.isoformat(), home, away)
        if k in seen:
            continue
        seen.add(k)
        rows.append({
            'code': div, 'league': LEAGUES[div],
            'utc': dt.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'home': home, 'away': away,
            'oh': to_float(r.get('B365H')), 'od': to_float(r.get('B365D')), 'oa': to_float(r.get('B365A')),
        })
    return rows


def api_items(key, today, hi):
    """源 2：football-data.org API 获取窗口内赛程（无赔率），强度取自积分榜。"""
    codes = ','.join(CODE_TO_API.values())
    j = api_get('/matches?dateFrom=%s&dateTo=%s&competitions=%s'
                % (today.isoformat(), hi.isoformat(), codes), key)
    matches = [m for m in j.get('matches', [])
               if (m.get('competition') or {}).get('code') in API_TO_CODE]
    if not matches:
        return []

    need = []
    for m in matches:
        c = m['competition']['code']
        if c not in need:
            need.append(c)

    print('  改用 football-data.org API：%d 场，联赛 %s' % (len(matches), '、'.join(need)))
    tables = {}
    for i, c in enumerate(need):
        try:
            st = api_get('/competitions/%s/standings' % c, key)
            total = next((s for s in st.get('standings', []) if s.get('type') == 'TOTAL'), None)
            rows = (total or {}).get('table', [])
            gfs = [r['goalsFor'] / max(1, r['playedGames']) for r in rows]
            gas = [r['goalsAgainst'] / max(1, r['playedGames']) for r in rows]
            avg_gf = (sum(gfs) / len(gfs)) if gfs else 1.35
            avg_ga = (sum(gas) / len(gas)) if gas else 1.35
            tbl = {}
            for r in rows:
                pm = max(1, r['playedGames'])
                tbl[r['team']['id']] = {
                    'atk': min(1.7, max(0.5, (r['goalsFor'] / pm) / avg_gf)),
                    'def': min(1.7, max(0.5, (r['goalsAgainst'] / pm) / avg_ga)),
                }
            tables[c] = tbl
            print('    积分榜 %s %d 队' % (c, len(tbl)))
        except Exception as exc:
            print('    [warn] 联赛 %s 积分榜获取失败：%s' % (c, exc))
            tables[c] = {}
        if i < len(need) - 1:
            time.sleep(7)  # 免费版约 10 次/分钟，串行间隔

    items = []
    for m in matches:
        c = m['competition']['code']
        div = API_TO_CODE[c]
        base_h, base_a = DEFAULT_BASE[div]
        tbl = tables.get(c) or {}
        H = tbl.get(((m.get('homeTeam') or {}).get('id')), {})
        A = tbl.get(((m.get('awayTeam') or {}).get('id')), {})
        home = (m.get('homeTeam') or {}).get('shortName') or (m.get('homeTeam') or {}).get('name') or ''
        away = (m.get('awayTeam') or {}).get('shortName') or (m.get('awayTeam') or {}).get('name') or ''
        if not home or not away:
            continue
        items.append({
            'code': div, 'league': LEAGUES[div], 'utc': m['utcDate'],
            'home': home, 'away': away,
            'odds': None, 'mkt': None,
            'p': predict(base_h, base_a, H, A),
        })
    return items


def main():
    today = datetime.now(timezone.utc).date()
    hi = today + timedelta(days=DAYS_AHEAD)
    y = current_season_start(today)
    cur_label = '20%02d-%02d' % (y % 100, (y + 1) % 100)
    prev_label = '20%02d-%02d' % ((y - 1) % 100, y % 100)
    history = load_history()

    print('一周窗口：%s ~ %s' % (today, hi))

    # ---- 源 1：免费、无 Key 的 fixtures.csv ----
    try:
        rows = csv_items(today, hi)
    except Exception as exc:
        print('  fixtures.csv 获取失败：%s' % exc)
        rows = []

    items = []
    source = 'football-data.co.uk'
    if rows:
        print('  fixtures.csv 命中 %d 场（%s ~ %s）。' % (len(rows), rows[0]['utc'], rows[-1]['utc']))
        strengths = csv_strengths(y, history, cur_label, prev_label)
        for r in rows:
            st = strengths.get(r['code']) or {'table': {}, 'base': DEFAULT_BASE[r['code']]}
            base_h, base_a = st['base']
            oh, od, oa = r['oh'], r['od'], r['oa']
            mkt = implied(oh, od, oa)
            p = predict(base_h, base_a, st['table'].get(r['home'], {}),
                        st['table'].get(r['away'], {}))
            items.append({
                'code': r['code'], 'league': r['league'], 'utc': r['utc'],
                'home': r['home'], 'away': r['away'],
                'odds': {'h': oh, 'd': od, 'a': oa} if (oh and od and oa) else None,
                'mkt': mkt,
                'p': p,
            })
    else:
        print('  fixtures.csv 无近一周赛程（该文件约每周更新一次）。')
        api_key = (os.environ.get('FOOTBALL_API_KEY') or '').strip()
        if not api_key:
            print('[error] 未配置 FOOTBALL_API_KEY，且免费赛程源暂无数据，保留线上旧数据，不覆盖。')
            return 1
        try:
            items = api_items(api_key, today, hi)
        except Exception as exc:
            print('[error] API 赛程获取失败：%s，保留线上旧数据。' % exc)
            return 1
        source = 'football-data.org'

    items.sort(key=lambda x: (x['utc'], x['code'], x['home']))
    if not items:
        print('[error] 未取到任何未来赛程，保留线上旧数据，不覆盖。')
        return 1

    out = {
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'from': today.isoformat(),
        'to': hi.isoformat(),
        'source': source,
        'season': cur_label,
        'leagues': LEAGUES,
        'count': len(items),
        'items': items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with io.open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))

    from collections import Counter
    print('写入 %s' % OUT)
    print('数据源 %s · 总场次 %d，联赛分布 %s'
          % (source, len(items), dict(Counter(i['code'] for i in items))))
    print('含赔率场次 %d' % sum(1 for i in items if i['mkt']))
    print('时间范围 %s ~ %s' % (items[0]['utc'], items[-1]['utc']))
    return 0


if __name__ == '__main__':
    sys.exit(main())