# game/bots.py
from .strategies.random import RandomBot
from .strategies.minmax import MinMaxBot
from .strategies.strength import AdvancedStrengthBot


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
    raise ValueError(f"Unknown bot strategy '{name}'")
