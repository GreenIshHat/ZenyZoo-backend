from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from django.utils.crypto import get_random_string

from game.models import Match, Player

@login_required
def match_list_view(request):
    open_matches = Match.objects.filter(
        player_two__isnull=True,
        is_active=True
    ).order_by('id')
    return render(request, 'game/match_list.html', {
        'open_matches': open_matches
    })

@login_required
def join_match(request, match_id):
    """
    Fill player_two slot and go to battle page.
    """
    match = get_object_or_404(Match, id=match_id, player_two__isnull=True)
    match.player_two = request.user.player
    match.save()
    return redirect('battle_view', match_id=match.id)

@login_required
def start_match(request):
    """
    HTML endpoint → create a match and go straight into battle.
    """
    player = request.user.player
    match = Match.objects.create(
        player_one=player,
        current_turn=player,
        is_active=True
    )
    return redirect('battle_view', match_id=match.id)


@login_required
def start_bot_match(request, match_id):
    match = get_object_or_404(Match, id=match_id, player_two__isnull=True)

    bot_user, _ = User.objects.get_or_create(
        username="RandomBot",
        defaults={'password': get_random_string(12)}
    )
    bot_player, created = Player.objects.get_or_create(
        user=bot_user,
        defaults={'username': "RandomBot"}
    )
    # **Always** mark as bot and set strategy**
    bot_player.is_bot = True
    bot_player.bot_strategy = "random"
    bot_player.save()

    match.player_two = bot_player
    match.save()

    return redirect('battle_view', match_id=match.id)