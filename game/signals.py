from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Player, Card, PlayerCard

@receiver(post_save, sender=Player)
def give_initial_deck(sender, instance, created, **kwargs):
    if created:
        all_cards = Card.objects.all()
        for card in all_cards:
            PlayerCard.objects.create(owner=instance, card=card)

