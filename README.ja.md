# サッカー予測システム · オンライン総覧

**言語:** [中文](README.md) | [English](README.en.md) | 日本語 | [한국어](README.ko.md)

> 1つのリンクで、サッカー予測システム全体のすべてのページを見渡せます。

**オンラインアクセス：** https://song19850425.github.io/football-prediction-site/

## はじめに

本リポジトリは、サッカーオッズ予測プロジェクトの**静的サイト総合入口**です。リアルタイムダッシュボード、デスクトップ / モバイル向けプロダクトプロトタイプ、V3 予測ハンドブック、過去の予測・検証レポート、モデルのバックテストとアップグレード案などのページを一つのポータルに集約し、「全ページビューア」も提供しています。同一画面内ですべてのページを閲覧できます。

## ページ入口

| ページ | 説明 | リンク |
| --- | --- | --- |
| 総覧ポータル | 全サイトのカード型入口、7 分区・計 38 ページ | https://song19850425.github.io/football-prediction-site/ |
| 全ページビューア | 左側の目次 + 埋め込み iframe プレビュー | https://song19850425.github.io/football-prediction-site/viewer.html |
| 履歴データ | 5 大リーグ 10 シーズン · 17,937 試合、リーグ / シーズン / 結果 / チームでの絞り込みとシーズン推移グラフに対応 | https://song19850425.github.io/football-prediction-site/history.html |
| 今後 1 週間の予測 | 今後 7 日間の 5 大リーグ日程 + ポアソンモデルによる推移予測 | https://song19850425.github.io/football-prediction-site/weekly.html |
| リアルタイムダッシュボード | AI サッカー予測センター · リアルタイムダッシュボード | https://song19850425.github.io/football-prediction-site/dashboards/prediction-dashboard-deploy/index.html |

## 機能区分

- コアアプリとダッシュボード
- プロダクトプロトタイプ · デスクトップ版 / モバイル版
- V3 予測ハンドブック
- 予測レポート / 検証レポート
- データ / モデル / バックテスト

## 技術スタック

- 純粋な静的 `HTML + CSS + ネイティブ JavaScript`、ビルド手順は不要
- グラフ：シーズン推移グラフは手書きの SVG、ダッシュボードは ECharts を使用
- アクセスカウント：counterapi.dev（localStorage によるフォールバック付き）
- デプロイ：GitHub Pages（`main` ブランチのルート、`.nojekyll` を含む）

## データ出典

過去の試合データは公開データセット [football-data.co.uk](https://www.football-data.co.uk/) に由来し、機械学習およびデータ研究の展示にのみ使用しています。

## 免責事項

本プロジェクトは機械学習およびデータ研究の展示を目的とするものであり、**いかなる賭けの助言も構成しません**。過去のバックテスト結果は将来の結果を保証するものではありません。

## ライセンス

[MIT](LICENSE)