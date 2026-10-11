# 足球预测系统 · 在线总览

**语言 / Language：** 中文 | [English](README.en.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

> 一个链接，看遍整套足球预测系统的所有页面。

**在线访问：** https://song19850425.github.io/football-prediction-site/

## 简介

本仓库是足球赔率预测项目的**静态站点总入口**，把实时看板、桌面 / 移动端产品原型、V3 预测手册、历次预测与验证报告、模型回测与升级方案等页面归集到统一门户，并提供「全页面查看器」，可在同一界面内浏览全部页面。

## 页面入口

| 页面 | 说明 | 链接 |
| --- | --- | --- |
| 总览门户 | 全站卡片式入口，7 个分区共 38 个页面 | https://song19850425.github.io/football-prediction-site/ |
| 全页面查看器 | 左侧目录 + 内嵌 iframe 预览 | https://song19850425.github.io/football-prediction-site/viewer.html |
| 历史数据 | 五大联赛 10 个赛季 · 17,937 场比赛，支持联赛 / 赛季 / 赛果 / 球队筛选与赛季走势图 | https://song19850425.github.io/football-prediction-site/history.html |
| 未来一周预测 | 未来 7 天五大联赛赛程 + 泊松模型走势预测 | https://song19850425.github.io/football-prediction-site/weekly.html |
| 实时看板 | AI 足球预测中心 · 实时看板 | https://song19850425.github.io/football-prediction-site/dashboards/prediction-dashboard-deploy/index.html |

## 功能分区

- 核心应用与看板
- 产品原型 · 桌面版 / 移动版
- V3 预测手册
- 预测报告 / 验证报告
- 数据 / 模型 / 回测

## 技术栈

- 纯静态 `HTML + CSS + 原生 JavaScript`，无需构建步骤
- 图表：历史走势图为手写 SVG；看板使用 ECharts
- 访问计数：counterapi.dev（含 localStorage 降级）
- 部署：GitHub Pages（`main` 分支根目录，含 `.nojekyll`）

## 数据来源

历史比赛数据来自公开数据集 [football-data.co.uk](https://www.football-data.co.uk/)，仅用于机器学习与数据研究展示。

## 免责声明

本项目仅供机器学习与数据研究展示，**不构成任何投注建议**。历史回测表现不代表未来结果。

## 许可证

[MIT](LICENSE)