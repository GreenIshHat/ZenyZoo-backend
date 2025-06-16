from django.urls import path

from .views.api import (
    register_user, login_user,
    get_player_deck, get_battle_deck, set_battle_deck,
    create_open_match, list_open_matches, join_match, get_match_state,
    make_move, battle_bot,
    view_shop, buy_card,
)

urlpatterns = [
    path('auth/register/', register_user,       name='register_user'),
    path('auth/login/',    login_user,          name='login_user'),

    path('player-deck/<int:player_id>/', get_player_deck,  name='get_player_deck'),
    path('battle-deck/<int:player_id>/', get_battle_deck,  name='get_battle_deck'),
    path('set-deck/',                   set_battle_deck,   name='set_battle_deck'),

    path('match/create/',    create_open_match,  name='create_open_match'),
    path('match/list-open/', list_open_matches,  name='list_open_matches'),
    path('match/join/',      join_match,         name='join_match'),
    path('match/<int:match_id>/', get_match_state, name='get_match_state'),

    path('battle-bot/', battle_bot, name='battle_bot'),
    path('move/',       make_move,  name='make_move'),

    path('shop/',     view_shop, name='view_shop'),
    path('shop/buy/', buy_card,  name='buy_card'),
]
