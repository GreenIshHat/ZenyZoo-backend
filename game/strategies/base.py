from abc import ABC, abstractmethod


class BotStrategy(ABC):
    @abstractmethod
    def choose_move(self, match, bot_player):
        """
        Return a dict {'position': int, 'card': PlayerCard}, or None.
        """
        pass