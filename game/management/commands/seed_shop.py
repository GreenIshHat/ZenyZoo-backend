import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from game.models import Card, ShopCard

class Command(BaseCommand):
    help = "Seed the in-game Shop from shop_cards.json"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default="game/scripts/shop_cards.json",
            help="Relative path to shop_cards.json"
        )

    def handle(self, *args, **options):
        path = Path(settings.BASE_DIR) / options["file"]
        if not path.exists():
            self.stderr.write(self.style.ERROR(f"File not found: {path}"))
            return

        data = json.loads(path.read_text(encoding="utf-8"))
        created = updated = 0

        for item in data:
            name  = item.get("name")
            price = item.get("price", 0)
            try:
                card = Card.objects.get(name__iexact=name)
            except Card.DoesNotExist:
                self.stderr.write(self.style.WARNING(f" • Skipping '{name}': no Card match"))
                continue

            shop_item, is_new = ShopCard.objects.update_or_create(
                card=card,
                defaults={"price": price, "is_active": True}
            )
            if is_new:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Shop seeding complete: {created} created, {updated} updated."
        ))
