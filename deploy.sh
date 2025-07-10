#!/usr/bin/env bash
# for render start command: chmod +x deploy.sh && ./deploy.sh
set -e

pwd

echo "[startup] applying migrations"
python manage.py migrate --no-input

echo "[startup] seeding cards"
python manage.py seed_cards

echo "[startup] seeding player cards"
python manage.py seed_player_cards

echo "[startup] seeding shop"
python manage.py seed_shop

echo "[startup] collecting static files"
python manage.py collectstatic --no-input

echo "[startup] launching Daphne"
exec daphne zenyzoo.asgi:application --port $PORT --bind 0.0.0.0
