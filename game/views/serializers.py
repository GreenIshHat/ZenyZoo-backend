from rest_framework import serializers
from game.models import Match, MatchMove

class MatchMoveSerializer(serializers.ModelSerializer):
    player_id       = serializers.IntegerField(source='player.id')
    player_card_id  = serializers.IntegerField(source='card.id')
    card_name       = serializers.CharField(source='card.card.name')
    image           = serializers.SerializerMethodField()
    card_top        = serializers.IntegerField(source='card.card.strength_top')
    card_right      = serializers.IntegerField(source='card.card.strength_right')
    card_bottom     = serializers.IntegerField(source='card.card.strength_bottom')
    card_left       = serializers.IntegerField(source='card.card.strength_left')
    color           = serializers.SerializerMethodField()

    def get_image(self, obj):
        req = self.context.get('request')
        return req.build_absolute_uri(obj.card.card.image.url) if req else obj.card.card.image.url

    def get_color(self, obj):
        # Default colors; you can improve logic if you add player color fields
        return '#1f77b4' if obj.player == obj.match.player_one else '#ff7f0e'

    class Meta:
        model = MatchMove
        fields = [
            'position',
            'player_id',
            'player_card_id',
            'card_name',
            'image',
            'card_top',
            'card_right',
            'card_bottom',
            'card_left',
            'color',
        ]

class MatchStateSerializer(serializers.ModelSerializer):
    board = MatchMoveSerializer(many=True, source='moves')
    named_scores = serializers.SerializerMethodField()
    player_two = serializers.SerializerMethodField()
    game_over = serializers.SerializerMethodField()
    winner_id = serializers.SerializerMethodField()
    winner = serializers.SerializerMethodField()
    current_turn_id = serializers.SerializerMethodField()
    current_turn_name = serializers.SerializerMethodField()
    player_one = serializers.CharField(source='player_one.user.username')

    class Meta:
        model = Match
        fields = [
            'id',  # or 'match_id' if you want, but then add source='id'
            'is_active',
            'game_over',
            'winner_id',
            'winner',
            'current_turn_id',
            'current_turn_name',
            'player_one',
            'player_two',
            'named_scores',
            'board'
        ]

    def get_game_over(self, match):
        return not match.is_active

    def get_winner_id(self, match):
        return match.winner.id if match.winner else None

    def get_winner(self, match):
        return match.winner.user.username if match.winner else None

    def get_current_turn_id(self, match):
        return match.current_turn.id if match.current_turn else None

    def get_current_turn_name(self, match):
        return match.current_turn.user.username if match.current_turn else None

    def get_player_two(self, match):
        return match.player_two.user.username if match.player_two else None

    def get_named_scores(self, match):
        scores = {}
        for mv in match.moves.all():
            name = mv.player.user.username
            scores[name] = scores.get(name, 0) + 1
        return scores
