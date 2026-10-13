# -*- coding: utf-8 -*-
"""重建站点历史数据 data/history.json。

数据源：football-data.co.uk 公开 CSV（无需 API Key）
  https://www.football-data.co.uk/mmz4281/{赛季码}/{联赛码}.csv
仅使用 Python 标准库，便于在 GitHub Actions 中直接运行。

安全设计：
  1. 某个 联赛+赛季 下载失败时，自动沿用现有 history.json 中该分组的数据，避免丢数据。
  2. 若重建结果比现有数据更少，直接报错退出，不覆盖线上文件。
"""
import csv
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'history.json'

LEAGUES = {'E0': '英超', 'SP1': '西甲', 'I1': '意甲', 'D1': '德甲', 'F1': '法甲'}
START_YEAR = 2016  # 起始赛季 2016-17
BASE = 'https://www.football-data.co.uk/mmz4281'
UA = 'Mozilla/5.0 (compatible; football-prediction-site history builder)'

USE = ['Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR', 'B365H', 'B365D', 'B365A']


def season_code(start_year):
    return '%02d%02d' % (start_year % 100, (start_year + 1) % 100)


def season_label(code):
    """'1617' -> '2016-17'"""
    c = str(code)
    m = re.fullmatch(r'(\d{2})(\d{2})', c)
    if m:
        return '20%s-%s' % (m.group(1), m.group(2))
    return c


def current_season_start(today):
    """赛季跨年：7 月起算新赛季。"""
    return today.year if today.month >= 7 else today.year - 1


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
    for enc in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode('latin-1', 'replace')


def iso_date(s):
    s = (s or '').strip()
    m = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})', s)
    if m:
        dd, mm, yy = m.groups()
        if len(yy) == 2:
            yy = '20' + yy
        return '%s-%02d-%02d' % (yy, int(mm), int(dd))
    return s


def num(x):
    try:
        v = float(x)
    except Exception:
        return None
    if v != v:  # NaN
        return None
    return round(v, 2)


def parse_csv(text, div, season):
    rows = []
    reader = csv.DictReader(io.StringIO(text))
    for r in reader:
        if not r.get('HomeTeam') or not r.get('AwayTeam'):
            continue
        if not (r.get('FTHG') or '').strip() or not (r.get('FTAG') or '').strip():
            continue  # 未开赛
        rows.append({
            'l': div,
            's': season,
            'd': iso_date(r.get('Date')),
            'h': r['HomeTeam'].strip(),
            'a': r['AwayTeam'].strip(),
            'hg': int(float(r['FTHG'])),
            'ag': int(float(r['FTAG'])),
            'r': (r.get('FTR') or '').strip(),
            'oh': num(r.get('B365H')),
            'od': num(r.get('B365D')),
            'oa': num(r.get('B365A')),
        })
    return rows


def load_existing():
    if not OUT.exists():
        return None
    try:
        with io.open(OUT, encoding='utf-8') as fh:
            return json.load(fh)
    except Exception as exc:
        print('[warn] 现有 history.json 读取失败：%s' % exc)
        return None


def main():
    today = datetime.now(timezone.utc).date()
    last = current_season_start(today)
    season_codes = [season_code(y) for y in range(START_YEAR, last + 1)]
    print('重建范围：%s ~ %s' % (season_label(season_codes[0]), season_label(season_codes[-1])))

    existing = load_existing()
    fallback = {}
    if existing:
        for m in existing.get('matches', []):
            fallback.setdefault((m['l'], m['s']), []).append(m)

    rows = []
    failed = []
    # 与原始生成顺序保持一致：按联赛名升序、赛季升序，最后按日期稳定排序
    for div in sorted(LEAGUES):
        for sc in season_codes:
            season = season_label(sc)
            url = '%s/%s/%s.csv' % (BASE, sc, div)
            try:
                text = fetch(url)
                part = parse_csv(text, div, season)
                if not part:
                    raise ValueError('CSV 无已完赛数据')
                rows.extend(part)
                print('  ok   %-3s %s  %d 场' % (div, season, len(part)))
            except (urllib.error.HTTPError, urllib.error.URLError, ValueError, OSError) as exc:
                old = fallback.get((div, season), [])
                failed.append('%s/%s (%s)' % (div, season, exc))
                print('  FAIL %-3s %s  %s -> 沿用现有 %d 场' % (div, season, exc, len(old)))
                rows.extend(old)

    rows.sort(key=lambda x: x['d'])
    seasons = sorted({r['s'] for r in rows})
    out = {'leagues': LEAGUES, 'seasons': seasons, 'count': len(rows), 'matches': rows}

    old_count = (existing or {}).get('count', 0)
    if len(rows) < old_count:
        print('[error] 重建结果 %d 场 < 现有 %d 场，拒绝写入。失败项：%s' % (len(rows), old_count, failed))
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with io.open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))

    print('写入 %s' % OUT)
    print('总场次 %d（原 %d，新增 %d）' % (len(rows), old_count, len(rows) - old_count))
    print('赛季：%s' % ', '.join(seasons))
    print('联赛分布：%s' % dict(Counter(r['l'] for r in rows)))
    print('日期范围：%s -> %s' % (rows[0]['d'], rows[-1]['d']))
    print('文件大小(MB)：%.2f' % (os.path.getsize(OUT) / 1048576.0))
    bad = [r['d'] for r in rows if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', r['d'])]
    print('日期格式异常：%d %s' % (len(bad), bad[:5]))
    if failed:
        print('降级项：%s' % failed)
    return 0


if __name__ == '__main__':
    sys.exit(main())