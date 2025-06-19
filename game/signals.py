# game/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User

from game.models import Player, Card, PlayerCard

@receiver(post_save, sender=User)
def create_player_for_user(sender, instance, created, **kwargs):
    """
    When a new User is made, create its Player profile.
    """
    if created:
        Player.objects.create(user=instance, username=instance.username)

@receiver(post_save, sender=Player)
def give_initial_deck(sender, instance, created, **kwargs):
    if not created:
        return

    # Seed all cards as owned
    # all_cards = list(Card.objects.all())
    # starter pack
    starter = Card.objects.order_by('id')[:10]
    
    for idx, card in enumerate(starter):
        pc, _ = PlayerCard.objects.get_or_create(owner=instance, card=card)
        # Mark the first 7 as in-battle-deck by default
        if idx < 7:
            pc.in_battle_deck = True
            pc.save()
