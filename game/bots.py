# game/bots.py
from .strategies.random import RandomBot
from .strategies.minmax import MinMaxBot
from .strategies.strength import AdvancedStrengthBot
from .strategies.alphabeta import AlphaBetaBot


def load_bot(name, **kwargs):
    """
    name: 'random' or 'minmax'
    kwargs: e.g. depth=2
    """
    key = name.lower()
    if key == "random":
        return RandomBot(**kwargs)
    if key == "minmax":
        return MinMaxBot(**kwargs)
    if key in ("strength", "heuristic", "advanced"):
        return AdvancedStrengthBot(**kwargs)
    if key in ("alphabeta", "alpha-beta", "aggressive"):
        return AlphaBetaBot(**kwargs)
    raise ValueError(f"Unknown bot strategy '{name}'")
