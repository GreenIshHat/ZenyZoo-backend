from .models import Card, PlayerCard

STARTER_CARD_IDS = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]

def initialize_player_deck(player):
    starter_cards = Card.objects.filter(id__in=STARTER_CARD_IDS)
    for card in starter_cards:
        PlayerCard.objects.get_or_create(owner=player, card=card)


# game/utils.py

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

def get_card_stats(card):
    return {
        'top': card.card.strength_top,
        'right': card.card.strength_right,
        'bottom': card.card.strength_bottom,
        'left': card.card.strength_left
    }

def check_flips(board, new_pos, new_card_obj):
    flips = []
    new_stats = get_card_stats(new_card_obj)

    for direction, neighbor_pos in adjacency.get(new_pos, {}).items():
        neighbor = board.get(neighbor_pos)
        if not neighbor:
            continue

        neighbor_stats = get_card_stats(neighbor['card'])

        # Compare the appropriate stats
        if direction == 'top' and new_stats['top'] > neighbor_stats['bottom']:
            flips.append(neighbor_pos)
        elif direction == 'bottom' and new_stats['bottom'] > neighbor_stats['top']:
            flips.append(neighbor_pos)
        elif direction == 'left' and new_stats['left'] > neighbor_stats['right']:
            flips.append(neighbor_pos)
        elif direction == 'right' and new_stats['right'] > neighbor_stats['left']:
            flips.append(neighbor_pos)

    return flips



