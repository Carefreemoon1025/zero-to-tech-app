#!/usr/bin/env bash
#
# 一键部署到阿里云 ECS（120.25.73.53）。
#
# 用法：
#   scripts/deploy.sh                 # 同步代码 + 装依赖 + 构建 + 重启 + 自测
#   scripts/deploy.sh --skip-build    # 不动前端构建（只改了后端时用，快很多）
#   scripts/deploy.sh --no-restart    # 只同步与构建，不重启服务
#
# 依赖：本机能用 `ssh -F ~/.ssh/config aliyun` 免密登录，且服务器上已完成一次性准备
#      （Node、python3.14-venv、systemd 单元、nginx 反代，见 docs/DEPLOY.md）。
#
# 为什么用 rsync 从本机推，而不是服务器上 git pull：
#   服务器 1.7G 内存，构建有风险；本机构建产物可控，推上去即可。
#   而且这一版部署流程不需要服务器持有仓库和密钥。
set -euo pipefail

SSH_HOST="${SSH_HOST:-aliyun}"
REMOTE_DIR="${REMOTE_DIR:-/opt/zero-to-tech-app}"
SERVICE_USER="${SERVICE_USER:-www-data}"
SSH_OPTS=(-F "$HOME/.ssh/config" -o ConnectTimeout=10)
SSH=(ssh "${SSH_OPTS[@]}" "$SSH_HOST")

SKIP_BUILD=0
NO_RESTART=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --no-restart) NO_RESTART=1 ;;
    *) echo "未知参数：$arg" >&2; exit 2 ;;
  esac
done

log() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

log "1/5 同步代码到 $SSH_HOST:$REMOTE_DIR"
# 排除的是"服务器上自己生成、不该被本机覆盖"的东西：
# node_modules / .next / .venv 是安装与构建产物，data/*.db 是线上真实数据。
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.venv' \
  --exclude '.npm-cache' \
  --exclude '.tmp-*' \
  --exclude '*.log' \
  --exclude '*.db' \
  --exclude 'frontend/.env.local' \
  -e "ssh ${SSH_OPTS[*]}" \
  ./ "$SSH_HOST:$REMOTE_DIR/"

log "2/5 后端依赖"
"${SSH[@]}" "cd $REMOTE_DIR/backend && .venv/bin/pip install -q --disable-pip-version-check \
  -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt && \
  .venv/bin/python -c 'import fastapi, uvicorn, pypinyin'"

if [ "$SKIP_BUILD" -eq 0 ]; then
  log "3/5 前端构建（服务器上 npm install + next build）"
  "${SSH[@]}" "cd $REMOTE_DIR/frontend && npm install --no-audit --no-fund >/dev/null && npm run build 2>&1 | tail -12"
else
  log "3/5 跳过前端构建"
fi

log "4/5 权限与重启"
"${SSH[@]}" "chown -R $SERVICE_USER:$SERVICE_USER $REMOTE_DIR && systemctl daemon-reload"
if [ "$NO_RESTART" -eq 0 ]; then
  "${SSH[@]}" "systemctl restart zero-to-tech-backend zero-to-tech-frontend && sleep 4"
else
  log "（--no-restart：跳过重启）"
fi

log "5/5 自测（经 nginx）"
"${SSH[@]}" 'for p in / /text-lab /api/health /api/profile; do
    printf "  %-14s %s\n" "$p" "$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1$p)"
  done
  echo "  服务状态: $(systemctl is-active zero-to-tech-backend) / $(systemctl is-active zero-to-tech-frontend)"'

printf '\n\033[32m✓ 部署完成：http://120.25.73.53/\033[0m\n'
