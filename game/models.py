from django.db import models
from django.db.models import Q, Count
from django.contrib.auth.models import User


class Player(models.Model):
    # user = models.OneToOneField(User, on_delete=models.CASCADE)
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True, unique=True)

    username = models.CharField(max_length=150, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_bot = models.BooleanField(default=False)

    credits = models.PositiveIntegerField(default=1000)
    
    bot_strategy = models.CharField(
        max_length=32, 
        choices=[('random', 'Random')],
        default='random'
    )


    def matches(self):
        """All matches this player participated in."""
        return Match.objects.filter(Q(player_one=self) | Q(player_two=self))

    def total_played(self):
        """Total completed matches (winner is set)."""
        return self.matches().filter(is_active=False).count()

    def total_wins(self):
        return self.matches().filter(is_active=False, winner=self).count()

    def total_losses(self):
        return self.total_played() - self.total_wins() - self.total_draws()

    def total_draws(self):
        return self.matches().filter(is_active=False, winner__isnull=True).count()

    def vs_opponent(self, other):
        """Head-to-head stats against *other* Player."""
        qs = self.matches().filter(Q(player_one=other) | Q(player_two=other), is_active=False)
        return {
            'played': qs.count(),
            'wins':   qs.filter(winner=self).count(),
            'losses': qs.filter(winner=other).count(),
            'draws':  qs.filter(winner__isnull=True).count()
        }

    def human_matches(self):
        return self.matches().filter(
            Q(player_one__is_bot=False) & Q(player_two__is_bot=False),
            is_active=False
        )

    def bot_matches(self):
        return self.matches().filter(
            Q(player_one__is_bot=True) | Q(player_two__is_bot=True),
            is_active=False
        )


class Card(models.Model):
    name = models.CharField(max_length=100)
    image = models.ImageField(upload_to='deck/')  # ← changed from CharField
    strength_top = models.IntegerField()
    strength_bottom = models.IntegerField()
    strength_left = models.IntegerField()
    strength_right = models.IntegerField()
    lore = models.TextField(blank=True)

    price = models.PositiveIntegerField(default=100)

    def __str__(self):
        return self.name

    def image_tag(self):
        if self.image:
            return f'<img src="{self.image.url}" width="80" height="80" />'
        return ""
    image_tag.allow_tags = True
    image_tag.short_description = 'Preview'


class PlayerCard(models.Model):
    owner = models.ForeignKey('Player', on_delete=models.CASCADE, related_name='deck')
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)  # Optional: if used, discarded, etc.
    in_battle_deck = models.BooleanField(default=False)  # 👈 mark if selected for match

    def __str__(self):
        return f"{self.owner.username} owns {self.card.name}"


class ShopCard(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    price = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)
    stock = models.IntegerField(default=999)  # or unlimited

    def __str__(self):
        return f"{self.card.name} - {self.price} zenys"



class Match(models.Model):
    player_one = models.ForeignKey(Player, related_name='matches_as_p1', on_delete=models.CASCADE)
    player_two = models.ForeignKey(Player, related_name='matches_as_p2', 
        on_delete=models.CASCADE,
        null=True,          # ← allow empty slot
        blank=True          # ← for admin/forms
    )
    board_state = models.JSONField(default=dict)  # e.g. {"0": null, "1": {"card_id": 5, "player_id": 2}, ...}
    is_active = models.BooleanField(default=True)
    player_one_deck = models.ManyToManyField(Card, related_name='deck_p1')
    player_two_deck = models.ManyToManyField(Card, related_name='deck_p2')
    current_turn = models.ForeignKey(Player, related_name='turns', on_delete=models.SET_NULL, null=True)
    winner = models.ForeignKey(Player, related_name='wins', null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    is_finished = models.BooleanField(default=False)


class MatchMove(models.Model):
    match = models.ForeignKey(Match, related_name='moves', on_delete=models.CASCADE)
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    card = models.ForeignKey(PlayerCard, on_delete=models.CASCADE)
    position = models.IntegerField()  # 0 to 8
    timestamp = models.DateTimeField(auto_now_add=True)


