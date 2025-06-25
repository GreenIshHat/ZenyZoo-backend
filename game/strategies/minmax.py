# game/strategies/minmax.py

import math
import random
from copy import deepcopy
from .base import BotStrategy
from game.models import MatchMove, PlayerCard

class GameState:
    """
    In‐memory snapshot of a match for minimax.
    - board: position -> {"player": player_id, "card": PlayerCard}
    - decks: player_id -> [remaining PlayerCard, ...]
    - current: player_id whose turn it is
    """
    def __init__(self, match, current_player_id):
        # build board map
        moves = MatchMove.objects.filter(match=match)
        self.board = {
            m.position: {"player": m.player.id, "card": m.card}
            for m in moves
        }
        # build each player’s remaining deck
        self.decks = {}
        for p in (match.player_one, match.player_two):
            played = {m.card.id for m in moves.filter(player=p)}
            all_cards = PlayerCard.objects.filter(owner=p, in_battle_deck=True)
            self.decks[p.id] = [pc for pc in all_cards if pc.id not in played]
        self.current = current_player_id
        self.match   = match

    def get_valid_moves(self):
        """All (position, card) pairs available."""
        free_positions = [i for i in range(9) if i not in self.board]
        moves = []
        for pos in free_positions:
            for card in self.decks[self.current]:
                moves.append((pos, card))
        return moves


    def simulate_move(self, move):
        """Return a new GameState with that move applied (including flips)."""
        pos, card = move

        # ► Manual shallow copy instead of deepcopy for performance
        new_state = object.__new__(GameState)
        # copy the board mapping
        new_state.board = self.board.copy()
        # copy each player’s deck list
        new_state.decks = {pid: deck[:] for pid, deck in self.decks.items()}
        # carry over other attributes
        new_state.current = self.current
        new_state.match   = self.match

        # place the card
        new_state.board[pos] = {"player": new_state.current, "card": card}
        # remove card from deck
        new_state.decks[new_state.current] = [
            c for c in new_state.decks[new_state.current] if c.id != card.id
        ]

        # apply flips
        from game.utils import check_flips
        flips = check_flips(new_state.board, pos, card)
        for fpos in flips:
            new_state.board[fpos]["player"] = new_state.current

        # switch turn
        p1_id = new_state.match.player_one.id
        p2_id = new_state.match.player_two.id
        new_state.current = p2_id if new_state.current == p1_id else p1_id

        return new_state


    def is_terminal(self):
        """True when the board is full (9 moves)."""
        return len(self.board) >= 9

    def evaluate_board(self):
        """
        Heuristic: (# of cells owned by the player who just moved)
                 - (cells owned by the opponent).
        """
        counts = {}
        for info in self.board.values():
            pid = info["player"]
            counts[pid] = counts.get(pid, 0) + 1

        # identify the “previous” mover
        p1_id = self.match.player_one.id
        p2_id = self.match.player_two.id
        prev_id = p2_id if self.current == p1_id else p1_id
        opp_id  = p1_id if prev_id == p2_id else p2_id

        return counts.get(prev_id, 0) - counts.get(opp_id, 0)


class MinMaxBot(BotStrategy):
    def __init__(self, depth=3):
        """
        depth=3 gives a good balance of lookahead and speed.
        Increase or decrease as needed.
        """
        self.depth = depth

    def choose_move(self, match, bot_player):
        """
        Return {'position': int, 'card': PlayerCard} or None.
        """
        root_state = GameState(match, bot_player.id)
        best_score = -math.inf
        best_move  = None

        for move in root_state.get_valid_moves():
            score = self._minmax(root_state.simulate_move(move), self.depth - 1, False)
            if score > best_score:
                best_score = score
                best_move  = move

        if not best_move:
            return None
        pos, card = best_move
        return {"position": pos, "card": card}

    def _minmax(self, state, depth, is_maximizing):
        if depth == 0 or state.is_terminal():
            return state.evaluate_board()

        if is_maximizing:
            max_eval = -math.inf
            for mv in state.get_valid_moves():
                eval = self._minmax(state.simulate_move(mv), depth - 1, False)
                max_eval = max(max_eval, eval)
            return max_eval
        else:
            min_eval = math.inf
            for mv in state.get_valid_moves():
                eval = self._minmax(state.simulate_move(mv), depth - 1, True)
                min_eval = min(min_eval, eval)
            return min_eval
