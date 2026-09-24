#!/bin/sh
# 容器入口：先建表、初始化演示数据，再启动 Gunicorn
set -e

python3 manage.py migrate --noinput
python3 manage.py seed_demo

exec gunicorn config.wsgi:application --bind 0.0.0.0:29519
