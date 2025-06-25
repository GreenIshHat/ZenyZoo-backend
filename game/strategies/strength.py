# game/strategies/strength.py
import random
from .base import BotStrategy
from game.models import MatchMove, PlayerCard

# Map from offset to (our_side, their_side)
_OFFSETS = {
    -3: ('top',    'bottom'),  # we're below them
    +3: ('bottom', 'top'),     # we're above them
    -1: ('left',   'right'),   # we're to their right
    +1: ('right',  'left'),    # we're to their left
}

class AdvancedStrengthBot(BotStrategy):
    """
    Heuristic:
      • Find the free position adjacent to the opponent card with the lowest 'their_side' strength.
      • Pick the card whose matching 'our_side' strength is the smallest value > that threshold.
      • If none, pick the highest 'our_side' value.
    """

    def choose_move(self, match, bot_player):
        # 1) Build board map: pos -> {'player':id, 'card':PlayerCard}
        moves = MatchMove.objects.filter(match=match)
        board = {m.position: {'player': m.player.id, 'card': m.card} for m in moves}

        # 2) Gather free positions
        free_positions = [i for i in range(9) if i not in board]
        if not free_positions:
            return None

        # 3) Gather available (unused) cards
        played = {m.card.id for m in moves.filter(player=bot_player)}
        available = list(
            PlayerCard.objects
                      .filter(owner=bot_player, in_battle_deck=True)
                      .exclude(id__in=played)
        )
        if not available:
            return None

        # 4) Scan each free pos for opponent weakness
        weakest_spot = None
        weakest_value = float('inf')
        weakest_dir   = None

        for pos in free_positions:
            for offset, (our_side, their_side) in _OFFSETS.items():
                neigh = pos + offset
                # ensure pos/neigh wrap logic for rows
                if 0 <= neigh < 9 and (
                   (offset == -1 and pos % 3 == 0) or
                   (offset == +1 and neigh % 3 == 0)
                ):
                    continue
                info = board.get(neigh)
                if info and info['player'] != bot_player.id:
                    # opponent card there
                    opp_card = info['card'].card
                    val = getattr(opp_card, f'strength_{their_side}')
                    if val < weakest_value:
                        weakest_value = val
                        weakest_spot  = pos
                        weakest_dir   = our_side

        # If no adjacent enemies, fall back to random spot & best-minimum card
        if weakest_spot is None:
            weakest_spot = random.choice(free_positions)

        # 5) Pick the card with minimal our_side > weakest_value
        #    Otherwise pick the card with max our_side
        def side_strength(pc, side):
            s = pc.card
            return getattr(s, f'strength_{side}')

        # Filter cards that can beat that weakness
        beating = [pc for pc in available if side_strength(pc, weakest_dir) > weakest_value]
        if beating:
            # pick the smallest card that still wins
            chosen = min(beating, key=lambda pc: side_strength(pc, weakest_dir))
        else:
            # no card beats it, pick the one with overall highest min_strength
            chosen = max(available, key=lambda pc: min(
                pc.card.strength_top,
                pc.card.strength_right,
                pc.card.strength_bottom,
                pc.card.strength_left
            ))

        return {"position": weakest_spot, "card": chosen}
