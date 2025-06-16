import json
import os

from django.core.management.base import BaseCommand
from django.conf import settings

from game.models import Card

class Command(BaseCommand):
    help = "Load or update cards from game/deck_v2.json, including image paths"

    def handle(self, *args, **options):
        # Path to your JSON file
        json_path = os.path.join(settings.BASE_DIR, 'game', 'deck_v2.json')
        if not os.path.exists(json_path):
            self.stderr.write(f"⚠️  deck_v2.json not found at {json_path}")
            return

        with open(json_path, encoding='utf-8') as fp:
            try:
                data = json.load(fp)
            except json.JSONDecodeError as e:
                self.stderr.write(f"❌  JSON decode error: {e}")
                return

        created_count = 0
        updated_count = 0

        for entry in data:
            name = entry.get('name')
            if not name:
                self.stderr.write("⚠️  Skipping entry with no name")
                continue

            # Build defaults dict for update_or_create
            defaults = {
                'lore': entry.get('lore', ''),
                'strength_top':    entry.get('strength_top', 0),
                'strength_bottom': entry.get('strength_bottom', 0),
                'strength_left':   entry.get('strength_left', 0),
                'strength_right':  entry.get('strength_right', 0),
                # Prepend 'deck/' so ImageField will resolve to MEDIA_ROOT/deck/filename
                'image': f"deck/{entry.get('image')}" if entry.get('image') else '',
            }

            card, created = Card.objects.update_or_create(
                name=name,
                defaults=defaults
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created card: {name}"))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f"Updated card: {name}"))

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Seeding complete: {created_count} created, {updated_count} updated."
        ))
