import random
from .base import BotStrategy
from game.models import PlayerCard, MatchMove



class RandomBot(BotStrategy):
    def choose_move(self, match, bot_player):
        # 1) Free positions
        occupied = {m.position for m in MatchMove.objects.filter(match=match)}
        free_positions = [i for i in range(9) if i not in occupied]
        if not free_positions:
            return None

        # 2) Bot’s unused battle-deck cards
        played_ids = {
            m.card.id 
            for m in MatchMove.objects.filter(match=match, player=bot_player)
        }
        available = list(
            PlayerCard.objects
                      .filter(owner=bot_player, in_battle_deck=True)
                      .exclude(id__in=played_ids)
        )
        if not available:
            return None

        # 3) Pick random
        return {
            'position': random.choice(free_positions),
            'card':     random.choice(available)
        }
