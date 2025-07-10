from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Q, Count
from django.views.generic import TemplateView
from game.models import Player, PlayerCard, Match, ShopCard

@login_required
def home_view(request):
    """
    Landing page after login.
    """
    # enforce that a 7-card deck exists
    deck_count = PlayerCard.objects.filter(
        owner=request.user.player,
        in_battle_deck=True
    ).count()
    if deck_count != 7:
        return redirect('choose_battle_deck')

    return render(request, 'game/home.html')

class AboutView(TemplateView):
    template_name = 'game/about.html'

@login_required
def profile_view(request):
    player = request.user.player

    # deck & cards
    all_cards     = PlayerCard.objects.filter(owner=player)
    battle_deck   = all_cards.filter(in_battle_deck=True)

    # core stats
    total   = player.total_played()
    wins    = player.total_wins()
    draws   = player.total_draws()
    losses  = player.total_losses()

    # splits
    human_played = player.human_matches().count()
    bot_played   = player.bot_matches().count()

    # head-to-head opponents
    opponents = Player.objects.filter(
        Q(matches_as_p1__player_two=player) |
        Q(matches_as_p2__player_one=player),
        is_bot=False
    ).distinct().exclude(id=player.id)

    h2h = {
        opp.user.username: player.vs_opponent(opp)
        for opp in opponents
    }

    return render(request, 'game/profile.html', {
        'all_cards':    all_cards,
        'battle_deck':  battle_deck,
        'stats': {
            'total': total, 'wins': wins,
            'draws': draws, 'losses': losses,
            'human_played': human_played,
            'bot_played': bot_played,
        },
        'h2h': h2h
    })

@login_required
def choose_battle_deck(request):
    """
    Select exactly 7 cards for battle.
    """
    player = request.user.player
    owned_cards = PlayerCard.objects.filter(owner=player)

    if request.method == 'POST':
        selected_ids = request.POST.getlist('cards')[:7]
        # Reset & set selection
        PlayerCard.objects.filter(owner=player).update(in_battle_deck=False)
        PlayerCard.objects.filter(owner=player, id__in=selected_ids).update(in_battle_deck=True)
        return redirect('profile_view')

    return render(request, 'game/select_deck.html', {
        'owned_cards': owned_cards
    })

@login_required
def battle_view(request, match_id):
    """
    The JS-driven battle board.
    """
    match = get_object_or_404(Match, id=match_id)
    player = get_object_or_404(Player, user=request.user)

    # If slot 2 is open and this user is not the host, auto-join
    if match.player_two is None and player != match.player_one:
        match.player_two = player
        match.save()

    return render(request, 'game/battle.html', {
        'match': match,
        # For backwards compatibility you can still expose match_id:
        'match_id': match.id,
    })

@login_required
def shop_view(request):
    # grab all active shop entries, including card info
    shop_items = ShopCard.objects.filter(is_active=True).select_related('card')
    return render(request, 'game/shop.html', {
        'shop_items': shop_items,
        'credits':    request.user.player.credits,
    })