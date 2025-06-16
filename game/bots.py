import random
from abc import ABC, abstractmethod

from game.models import PlayerCard, MatchMove

"""
Optional Refactor: game/strategies/ Module

To future-proof for more complex bots (Q-learning, etc.):

game/
├── bots.py           # Loader
├── strategies/
│   ├── base.py       # BotStrategy
│   ├── random.py     # RandomBot
│   ├── minmax.py     # MinMaxBot
│   └── qbot.py       # QBot


from .strategies.random import RandomBot
from .strategies.minmax import MinMaxBot
from .strategies.qbot import QBot

"""




class BotStrategy(ABC):
    @abstractmethod
    def choose_move(self, match, bot_player):
        """
        Return a dict {'position': int, 'card': PlayerCard}, or None.
        """
        pass

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

def load_bot(name):
    if name.lower() == "random":
        return RandomBot()
    raise ValueError(f"Unknown bot strategy '{name}'")

