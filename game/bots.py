# bots.py
import random
from .models import MatchMove, PlayerCard

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

def load_bot(strategy_name):
    return BOT_CLASSES.get(strategy_name.lower(), RandomBot)()


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


# Now safe to load dictionary
BOT_CLASSES = {
    "random": RandomBot,
    # "minmax": MinMaxBot,  # Uncomment if defined
    # "qbot": QBot,
}
