# 축구 예측 시스템 · 온라인 개요

**언어:** [中文](README.md) | [English](README.en.md) | [日本語](README.ja.md) | 한국어

> 하나의 링크로 축구 예측 시스템 전체의 모든 페이지를 한눈에 볼 수 있습니다.

**온라인 접속:** https://song19850425.github.io/football-prediction-site/

## 소개

이 저장소는 축구 배당 예측 프로젝트의 **정적 사이트 통합 입구**입니다. 실시간 대시보드, 데스크톱 / 모바일 제품 프로토타입, V3 예측 핸드북, 역대 예측 및 검증 보고서, 모델 백테스트와 업그레이드 방안 등의 페이지를 하나의 포털로 모으고, "전체 페이지 뷰어"를 제공하여 하나의 인터페이스에서 모든 페이지를 열람할 수 있습니다.

## 페이지 입구

| 페이지 | 설명 | 링크 |
| --- | --- | --- |
| 개요 포털 | 전체 사이트의 카드형 입구, 7개 구역 총 38개 페이지 | https://song19850425.github.io/football-prediction-site/ |
| 전체 페이지 뷰어 | 좌측 목차 + 내장 iframe 미리보기 | https://song19850425.github.io/football-prediction-site/viewer.html |
| 과거 데이터 | 5대 리그 10시즌 · 17,937경기, 리그 / 시즌 / 결과 / 팀 필터 및 시즌 추이 차트 지원 | https://song19850425.github.io/football-prediction-site/history.html |
| 향후 1주 예측 | 향후 7일 5대 리그 일정 + 푸아송 모델 추이 예측 | https://song19850425.github.io/football-prediction-site/weekly.html |
| 실시간 대시보드 | AI 축구 예측 센터 · 실시간 대시보드 | https://song19850425.github.io/football-prediction-site/dashboards/prediction-dashboard-deploy/index.html |

## 기능 구역

- 핵심 애플리케이션 및 대시보드
- 제품 프로토타입 · 데스크톱 / 모바일
- V3 예측 핸드북
- 예측 보고서 / 검증 보고서
- 데이터 / 모델 / 백테스트

## 기술 스택

- 순수 정적 `HTML + CSS + 바닐라 JavaScript`, 빌드 단계 불필요
- 차트: 시즌 추이 차트는 직접 작성한 SVG, 대시보드는 ECharts 사용
- 접속 카운트: counterapi.dev (localStorage 폴백 포함)
- 배포: GitHub Pages (`main` 브랜치 루트, `.nojekyll` 포함)

## 데이터 출처

과거 경기 데이터는 공개 데이터셋 [football-data.co.uk](https://www.football-data.co.uk/)에서 가져왔으며, 머신러닝 및 데이터 연구 전시 용도로만 사용됩니다.

## 면책 조항

본 프로젝트는 머신러닝 및 데이터 연구 전시 목적으로만 제공되며, **어떠한 베팅 조언도 구성하지 않습니다**. 과거 백테스트 성과는 미래 결과를 보장하지 않습니다.

## 라이선스

[MIT](LICENSE)