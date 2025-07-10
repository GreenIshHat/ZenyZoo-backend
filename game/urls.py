from django.urls import path
from django.contrib.auth.views import LoginView
from .views.auth_views  import register_form, logout_view
from .views.game_views  import home_view, profile_view, choose_battle_deck, battle_view, shop_view
from .views.match_views import (
                    match_list_view, join_match, start_match, quick_match,
                    start_bot_match, standings_view
)
from .views.game_views import AboutView


urlpatterns = [
    # Home & enforce deck
    path('', home_view, name='home'),

    path('about/', AboutView.as_view(), name='about'),


    # Profile & Deck selection
    path('profile/',      profile_view,         name='profile_view'),
    path('deck/select/',  choose_battle_deck,   name='choose_battle_deck'),

    # League
    path('standings/', standings_view, name='standings'),

    # Auth
    path('login/',    LoginView.as_view(
                         template_name='registration/login.html',
                         redirect_authenticated_user=True
                     ), name='login'),
    path('register/', register_form,            name='register'),
    path('logout/',   logout_view,              name='logout'),

    # Matches & Battles
    path('matches/',            match_list_view, name='match_list'),
    path('match/create/',       start_match,     name='start_match'),
    path('match/<int:match_id>/join/', join_match,      name='join_match'),
    path('battle/<int:match_id>/',    battle_view,      name='battle_view'),
    path('battle/<int:match_id>/bot/',    start_bot_match, name='start_bot_match'),
    path('matches/quick/', quick_match, name='quick_match'),

    # Shop
    path('shop/',     shop_view, name='shop_view'),
]
