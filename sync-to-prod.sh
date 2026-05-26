#!/bin/bash
# 测试版验证通过后，同步到正式版
set -e

echo ">> 同步到正式版..."

rsync -a \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='ecosystem.config.js' \
  --exclude='.env' \
  --exclude='sync-to-test.sh' \
  --exclude='sync-to-prod.sh' \
  /home/ubuntu/zcf/feedback_claude_deepseek/ /var/www/feedback-app/

echo ">> 构建后端..."
cd /var/www/feedback-app/server && npm run build

echo ">> 构建前端..."
cd /var/www/feedback-app/client && npm run build

echo ">> 重启正式服务..."
pm2 restart feedback-server

echo ">> 完成! 正式版: http://122.51.83.184"
