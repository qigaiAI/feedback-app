#!/bin/bash
# 同步源码到测试版部署
set -e

echo ">> 同步到测试版..."

rsync -a \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='ecosystem.config.js' \
  --exclude='.env' \
  --exclude='sync-to-test.sh' \
  /home/ubuntu/zcf/feedback_claude_deepseek/ /var/www/feedback-app-test/

echo ">> 构建后端..."
cd /var/www/feedback-app-test/server && npm run build

echo ">> 构建前端..."
cd /var/www/feedback-app-test/client && npm run build

echo ">> 重启测试服务..."
pm2 restart feedback-server-test

echo ">> 完成! 测试版: http://122.51.83.184:8080"
