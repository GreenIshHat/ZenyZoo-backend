from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404

from game.models import Player, PlayerCard, Match

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

@login_required
def profile_view(request):
    """
    Show all owned cards and current battle deck.
    """
    player = request.user.player
    all_cards = PlayerCard.objects.filter(owner=player)
    battle_deck = all_cards.filter(in_battle_deck=True)
    return render(request, 'game/profile.html', {
        'all_cards': all_cards,
        'battle_deck': battle_deck,
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
    return render(request, 'game/battle.html', {
        'match': match,
        # For backwards compatibility you can still expose match_id:
        'match_id': match.id,
    })

@login_required
def shop_view(request):
    items = ShopCard.objects.filter(is_active=True).select_related('card')
    return render(request, 'game/shop.html', {'items': items})