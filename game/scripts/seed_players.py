# game/scripts/seed_players.py

from django.contrib.auth.models import User
from game.models import Player
from game.utils import initialize_player_deck  # If you have this util

def run():
    if not User.objects.filter(username="TestHero").exists():
        u1 = User.objects.create_user(username='TestHero', password='testpass')
        p1 = Player.objects.create(user=u1, username='TestHero')
        initialize_player_deck(p1)

    if not User.objects.filter(username="LunaSeeker").exists():
        u2 = User.objects.create_user(username='LunaSeeker', password='moonpass')
        p2 = Player.objects.create(user=u2, username='LunaSeeker')
        initialize_player_deck(p2)

    print("Seeded players successfully.")
