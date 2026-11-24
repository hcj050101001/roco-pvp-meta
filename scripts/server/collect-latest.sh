#!/usr/bin/env sh
set -eu

# 仅搜集当季最新阵容进入研究暂存队列（research/inbox），不自动改动生产 data/lineups/。
npm run research:latest
npm run research:validate
npm run research:coverage
npm run research:vision
npm run research:review
