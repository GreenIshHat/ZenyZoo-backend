import json
import os
from django.core.management.base import BaseCommand
from game.models import Card

class Command(BaseCommand):
    help = 'Seed the card deck from deck_v2.json'

    def handle(self, *args, **kwargs):
        file_path = os.path.join(os.path.dirname(__file__), '../../deck_v2.json')
        file_path = os.path.abspath(file_path)

        with open(file_path, 'r') as file:
            cards = json.load(file)

        Card.objects.all().delete()
        for card in cards:
            Card.objects.create(
                name=card["name"],
                image=card["image"],
                strength_top=card["strength_top"],
                strength_bottom=card["strength_bottom"],
                strength_left=card["strength_left"],
                strength_right=card["strength_right"],
                lore=card.get("description", "")
            )

        self.stdout.write(self.style.SUCCESS('✅ Deck seeded successfully.'))

