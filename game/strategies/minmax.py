# game/strategies/minmax.py

import math
from copy import deepcopy
from .base import BotStrategy
from game.models import MatchMove, PlayerCard
from game.utils import check_flips

class GameState:
    def __init__(self, match, current_player_id):
        # snapshot existing moves
        moves = MatchMove.objects.filter(match=match)
        self.board = {m.position: {"player": m.player.id, "card": m.card} for m in moves}

        # each player’s remaining cards
        self.decks = {}
        for p in (match.player_one, match.player_two):
            played = {m.card.id for m in moves.filter(player=p)}
            all_cards = PlayerCard.objects.filter(owner=p, in_battle_deck=True)
            self.decks[p.id] = [pc for pc in all_cards if pc.id not in played]

        self.current = current_player_id
        self.match = match

    def get_valid_moves(self):
        free_positions = [i for i in range(9) if i not in self.board]
        return [(pos, card)
                for pos in free_positions
                for card in self.decks[self.current]]

    def simulate_move(self, move):
        pos, card = move
        new = deepcopy(self)
        # place
        new.board[pos] = {"player": new.current, "card": card}
        # remove from deck
        new.decks[new.current] = [c for c in new.decks[new.current] if c.id != card.id]
        # flips
        flips = check_flips(new.board, pos, card)
        for f in flips:
            new.board[f]["player"] = new.current
        # switch turn
        p1, p2 = self.match.player_one.id, self.match.player_two.id
        new.current = p2 if new.current == p1 else p1
        return new

    def is_terminal(self):
        return len(self.board) >= 9

    def evaluate_board(self):
        counts = {}
        for info in self.board.values():
            counts[info["player"]] = counts.get(info["player"], 0) + 1

        p1, p2 = self.match.player_one.id, self.match.player_two.id
        # “previous mover” is opposite of current
        prev = p2 if self.current == p1 else p1
        opp  = p1 if prev == p2 else p2
        return counts.get(prev, 0) - counts.get(opp, 0)


class MinMaxBot(BotStrategy):
    def __init__(self, depth=4):
        self.depth = depth

    def choose_move(self, match, bot_player):
        root = GameState(match, bot_player.id)
        best_val, best_move = -math.inf, None
        alpha, beta = -math.inf, math.inf

        for mv in root.get_valid_moves():
            val = self._alphabeta(root.simulate_move(mv), self.depth-1, alpha, beta, False)
            if val > best_val:
                best_val, best_move = val, mv
            alpha = max(alpha, best_val)

        if not best_move:
            return None
        pos, card = best_move
        return {"position": pos, "card": card}

    def _alphabeta(self, state, depth, alpha, beta, maximizing):
        if depth == 0 or state.is_terminal():
            return state.evaluate_board()

        if maximizing:
            value = -math.inf
            for mv in state.get_valid_moves():
                value = max(value, self._alphabeta(state.simulate_move(mv), depth-1, alpha, beta, False))
                alpha = max(alpha, value)
                if alpha >= beta:
                    break  # prune
            return value
        else:
            value = math.inf
            for mv in state.get_valid_moves():
                value = min(value, self._alphabeta(state.simulate_move(mv), depth-1, alpha, beta, True))
                beta = min(beta, value)
                if alpha >= beta:
                    break  # prune
            return value
