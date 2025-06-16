# game/management/commands/seed_player_cards.py

from django.core.management.base import BaseCommand
from game.models import Player, Card, PlayerCard

class Command(BaseCommand):
    help = "Give every Player all existing Cards (for retroactive seeding)"

    def handle(self, *args, **options):
        cards = list(Card.objects.all())
        if not cards:
            self.stderr.write("❌ No cards found. Run seed_cards first.")
            return

        for player in Player.objects.all():
            created = 0
            for card in cards:
                pc, was_new = PlayerCard.objects.get_or_create(owner=player, card=card)
                if was_new:
                    # Optionally, mark the first 7 as in_battle_deck:
                    idx = cards.index(card)
                    if idx < 7:
                        pc.in_battle_deck = True
                        pc.save()
                    created += 1
            self.stdout.write(f"Player {player.user.username}: seeded {created} new cards.")
        self.stdout.write(self.style.SUCCESS("✅ All players now own all cards."))

