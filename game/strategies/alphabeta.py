# game/strategies/alphabeta.py

import math
from copy import deepcopy
from .base import BotStrategy
from game.models import MatchMove, PlayerCard
from game.utils import check_flips

class GameState:
    """
    In‐memory snapshot of a match for alpha-beta.
    - board: pos→{"player":id,"card":PlayerCard}
    - decks: player_id→[remaining PlayerCard,…]
    - current: whose turn (player_id)
    """
    def __init__(self, match, current_player_id):
        moves = MatchMove.objects.filter(match=match)
        self.board = { m.position: {"player":m.player.id, "card":m.card} for m in moves }
        # build decks minus played cards
        self.decks = {}
        for p in (match.player_one, match.player_two):
            played = { m.card.id for m in moves.filter(player=p) }
            all_pc = PlayerCard.objects.filter(owner=p, in_battle_deck=True)
            self.decks[p.id] = [pc for pc in all_pc if pc.id not in played]
        self.current = current_player_id
        self.match   = match

    def get_valid_moves(self):
        free = [i for i in range(9) if i not in self.board]
        return [ (pos,card) for pos in free for card in self.decks[self.current] ]

    def simulate_move(self, move):
        pos, card = move
        ns = deepcopy(self)
        # place
        ns.board[pos] = {"player":ns.current,"card":card}
        # remove from deck
        ns.decks[ns.current] = [c for c in ns.decks[ns.current] if c.id!=card.id]
        # flips
        flips = check_flips(ns.board, pos, card)
        for f in flips:
            ns.board[f]["player"] = ns.current
        # switch
        p1 = ns.match.player_one.id
        p2 = ns.match.player_two.id
        ns.current = p2 if ns.current==p1 else p1
        return ns

    def is_terminal(self):
        return len(self.board) >= 9

    def evaluate_board(self):
        # (# owned by previous mover) - (by opponent)
        cnt = {}
        for info in self.board.values():
            cnt[info["player"]] = cnt.get(info["player"],0) + 1
        p1 = self.match.player_one.id
        p2 = self.match.player_two.id
        prev = p2 if self.current==p1 else p1
        opp  = p1 if prev==p2 else p2
        return cnt.get(prev,0) - cnt.get(opp,0)


class AlphaBetaBot(BotStrategy):
    def __init__(self, depth=4):
        self.depth = depth

    def choose_move(self, match, bot_player):
        root = GameState(match, bot_player.id)
        best_score = -math.inf
        best_move  = None
        alpha, beta = -math.inf, math.inf

        for move in root.get_valid_moves():
            score = self._alphabeta(root.simulate_move(move),
                                    self.depth-1, False,
                                    alpha, beta)
            if score > best_score:
                best_score, best_move = score, move
            alpha = max(alpha, best_score)
        if not best_move:
            return None
        pos, card = best_move
        return {"position": pos, "card": card}

    def _alphabeta(self, state, depth, maximizing, alpha, beta):
        if depth == 0 or state.is_terminal():
            return state.evaluate_board()

        if maximizing:
            value = -math.inf
            for mv in state.get_valid_moves():
                value = max(value, self._alphabeta(
                    state.simulate_move(mv),
                    depth-1, False,
                    alpha, beta))
                alpha = max(alpha, value)
                if alpha >= beta:
                    break
            return value
        else:
            value = math.inf
            for mv in state.get_valid_moves():
                value = min(value, self._alphabeta(
                    state.simulate_move(mv),
                    depth-1, True,
                    alpha, beta))
                beta = min(beta, value)
                if beta <= alpha:
                    break
            return value