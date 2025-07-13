# game/utils.py

from .models import Card, PlayerCard, MatchMove
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync



STARTER_CARD_IDS = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]

def initialize_player_deck(player):
    starter_cards = Card.objects.filter(id__in=STARTER_CARD_IDS)
    for card in starter_cards:
        PlayerCard.objects.get_or_create(owner=player, card=card)


# adjacency map: for each cell index, which neighbors to compare
adjacency = {
    0: {'right': 1, 'bottom': 3},
    1: {'left': 0, 'right': 2, 'bottom': 4},
    2: {'left': 1, 'bottom': 5},
    3: {'top': 0, 'right': 4, 'bottom': 6},
    4: {'top': 1, 'left': 3, 'right': 5, 'bottom': 7},
    5: {'top': 2, 'left': 4, 'bottom': 8},
    6: {'top': 3, 'right': 7},
    7: {'top': 4, 'left': 6, 'right': 8},
    8: {'top': 5, 'left': 7},
}


def get_card_stats(player_card):
    """
    Accepts a PlayerCard instance and returns its four edge strengths.
    """
    return {
        'top':    player_card.card.strength_top,
        'right':  player_card.card.strength_right,
        'bottom': player_card.card.strength_bottom,
        'left':   player_card.card.strength_left,
    }


def check_flips(board, new_pos, new_card_pc):
    """
    board: mapping position -> either
           a) MatchMove instance
           b) dict with key 'card' pointing to a PlayerCard
    new_pos: int (0–8) where we’re placing new_card_pc
    new_card_pc: PlayerCard instance just played

    Returns a list of neighbor positions whose cards should flip.
    """
    flips = []
    new_stats = get_card_stats(new_card_pc)

    for direction, neighbor_pos in adjacency.get(new_pos, {}).items():
        neighbor = board.get(neighbor_pos)
        if not neighbor:
            continue

        # Extract the PlayerCard for that neighbor:
        if isinstance(neighbor, dict):
            # old API style
            neighbor_pc = neighbor['card']
        else:
            # MatchMove instance style
            neighbor_pc = neighbor.card

        neighbor_stats = get_card_stats(neighbor_pc)

        # Compare edge values based on direction
        if direction == 'top' and new_stats['top'] > neighbor_stats['bottom']:
            flips.append(neighbor_pos)
        elif direction == 'bottom' and new_stats['bottom'] > neighbor_stats['top']:
            flips.append(neighbor_pos)
        elif direction == 'left' and new_stats['left'] > neighbor_stats['right']:
            flips.append(neighbor_pos)
        elif direction == 'right' and new_stats['right'] > neighbor_stats['left']:
            flips.append(neighbor_pos)

    return flips


def serialize_board(match):
    moves = MatchMove.objects.filter(match=match).order_by('position', 'pk')
    return [
        {
            "position": m.position,
            "player_id": m.player.id,
            "player_card_id": m.card.id,
            "card_name": m.card.card.name,
            "image": m.card.card.image.url,
            "card_top": m.card.card.strength_top,
            "card_right": m.card.card.strength_right,
            "card_bottom": m.card.card.strength_bottom,
            "card_left": m.card.card.strength_left,
            "color": "#1f77b4" if m.player == match.player_one else "#ff7f0e"
        }
        for m in moves
    ]
