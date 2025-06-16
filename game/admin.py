from django.contrib import admin
from .models import Card, Player, Match, PlayerCard
from django.utils.html import format_html

@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'strength_top','strength_right','strength_bottom','strength_left',
        'image_tag',
        'lore'
    )
    readonly_fields = ('image_tag',)
    search_fields = ('name',)

    def image_tag(self, obj):
        if obj.image:
            # obj.image.url already includes MEDIA_URL prefix
            return format_html(
                '<img src="{}" width="80" height="80" style="object-fit:contain;"/>',
                obj.image.url
            )
        return "–"
    image_tag.short_description = 'Preview'

@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ('username', 'created_at', 'user', 'is_bot')
    search_fields = ('username',)

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'player_one', 'player_two', 'created_at', 'winner')
    search_fields = ('player_one__username', 'player_two__username')

@admin.register(PlayerCard)
class PlayerCardAdmin(admin.ModelAdmin):
    list_display = ('owner', 'card', 'in_battle_deck', 'is_active')  # Replaced 'player' with 'owner' and dropped 'acquired_at'
    search_fields = ('owner__username', 'card__name', 'owner', 'in_battle_deck')

