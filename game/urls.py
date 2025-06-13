from django.contrib.auth.views import LoginView, LogoutView
from django.urls import path
from .views import (
    start_match,
    set_battle_deck,
    register_player,
	register_user, login_user,
    get_player_deck,
	get_battle_deck,
	get_match_state,
	make_move,
    view_shop,
    buy_card,

	home_view, battle_view, battle_bot, 
	profile_view, choose_battle_deck,
	register_form,

	create_open_match,
	join_match,
	list_open_matches,
	match_list_view
)


urlpatterns = [
    # Home & Profile
    path('', home_view, name='home'),
    path('profile/', profile_view, name='profile_view'),
    path('deck/select/', choose_battle_deck, name='choose_battle_deck'),

    # User Auth
    path('login/', LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('register/', register_form, name='register'),
    path('logout/', LogoutView.as_view(), name='logout'),

    path('auth/register/', register_user, name='register_user'),
    path('auth/login/', login_user, name='login_user'),

    # Player + Decks
    path('player-deck/<int:player_id>/', get_player_deck, name='get_player_deck'),
    path('battle-deck/<int:player_id>/', get_battle_deck, name='get_battle_deck'),
    path('set-deck/', set_battle_deck, name='set_battle_deck'),

    # Match Flow
    path('matches/', match_list_view, name='match_list'),
    path('match/create/', create_open_match, name='create_open_match'),
    path('match/list-open/', list_open_matches, name='api_list_open_matches'),
    path('match/join/', join_match, name='join_match'),
    path('match/<int:match_id>/', get_match_state, name='get_match_state'),

    # Game Battle
    path('battle/<int:match_id>/', battle_view, name='battle_view'),
    path('battle-bot/', battle_bot, name='battle_bot'),
    path('move/', make_move, name='make_move'),

    # Shop
    path('shop/', view_shop, name='view_shop'),
    path('shop/buy/', buy_card, name='buy_card'),
]


