from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from django.utils.crypto import get_random_string
from django.contrib.auth   import get_user_model

from game.models import Match, Player

User = get_user_model()

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
def join_match(request):
    match_id  = request.POST.get("match_id")
    player_id = request.POST.get("player_id")
    match     = get_object_or_404(Match, id=match_id)
    if match.player_two is None:
        match.player_two = get_object_or_404(Player, id=player_id)
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
    """
    Hit this via:
      /start_bot_match/<match_id>/?difficulty=random
      or
      /start_bot_match/<match_id>/?difficulty=minmax
    """
    # 1) Read the chosen strategy from the querystring
    strategy = request.GET.get('difficulty', 'random').lower()

    # 2) Load the match waiting for a second player
    match = get_object_or_404(Match, id=match_id, player_two__isnull=True)

    # 3) Ensure bot user & player exist
    bot_user, _ = User.objects.get_or_create(
        username="RamBot" if strategy == "random" else "Maxie Bot",
        defaults={'password': get_random_string(12)}
    )
    bot_player, created = Player.objects.get_or_create(
        user=bot_user,
        defaults={'username': bot_user.username}
    )

    # 4) Mark as bot and save the chosen strategy
    bot_player.is_bot = True
    bot_player.bot_strategy = strategy
    bot_player.save()

    # 5) Attach to match
    match.player_two = bot_player
    # (Optional) also store on the match itself if you have a field:
    # match.bot_strategy = strategy
    match.save()

    # 6) Redirect into the battle view
    return redirect('battle_view', match_id=match.id)



@login_required
def standings_view(request):
    """
    Renders two leaderboards: human players and bot players.
    """
    def build_table(players_qs):
        table = []
        for p in players_qs:
            played   = p.total_played()
            wins     = p.total_wins()
            draws    = p.total_draws()
            losses   = p.total_losses()
            win_rate = round((wins / played) * 100, 1) if played else None

            table.append({
                'username':  p.user.username,
                'played':    played,
                'wins':      wins,
                'draws':     draws,
                'losses':    losses,
                'win_rate':  win_rate,
            })
        # sort by wins desc, then win_rate desc
        table.sort(key=lambda row: (-row['wins'], -(row['win_rate'] or 0)))
        return table

    human_players = Player.objects.filter(is_bot=False)
    bot_players   = Player.objects.filter(is_bot=True)

    human_standings = build_table(human_players)
    bot_standings   = build_table(bot_players)

    return render(request, 'game/standings.html', {
        'human_standings': human_standings,
        'bot_standings':   bot_standings,
    })