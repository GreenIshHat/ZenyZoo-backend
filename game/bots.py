# bots.py
import random
from .models import MatchMove, PlayerCard

class BotStrategy:
    def choose_move(self, match, bot_player):
        raise NotImplementedError()

class RandomBot(BotStrategy):
    def choose_move(self, match, bot_player):
        # Find empty board positions (0 to 8)
        occupied = MatchMove.objects.filter(match=match).values_list('position', flat=True)
        empty_positions = [i for i in range(9) if i not in occupied]

        card = PlayerCard.objects.filter(owner=bot_player, in_battle_deck=True).first()
        if card and empty_positions:
            return {
                'card': card,
                'position': random.choice(empty_positions)
            }
        return None

