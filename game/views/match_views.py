# at top of game/match_views.py
from asgiref.sync      import async_to_sync
from channels.layers   import get_channel_layer

from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from django.utils.crypto import get_random_string
from django.contrib.auth   import get_user_model

from game.models import Match, Player

from django.utils.timesince import timesince
from django.utils import timezone
from datetime import timedelta

# from game.events import on_player_joined

User = get_user_model()

@login_required
def match_list_view(request):
    cutoff = timezone.now() - timedelta(hours=1)
    open_matches = Match.objects.filter(
        is_active=True,
        is_finished=False,
        created_at__gte=cutoff   # only show matches less than 1h old
    ).order_by('created_at')
    for m in open_matches:
        m.since = timesince(m.created_at, timezone.now())
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

        # notify everyone that this match now has a second player
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "match_list",
            {
                "type": "match_joined",
                "data": {
                    "id":          match.id,
                    "player_two":  match.player_two.user.username
                }
            }
        )
        #on_player_joined(match)   # <— Notify the channel layer here

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

    # notify everyone a new match is open
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "match_list",
        {
            "type": "match_created",
            "data": {
                "id":         match.id,
                "player_one": match.player_one.user.username
            }
        }
    )

    return redirect('battle_view', match_id=match.id)

@login_required
def quick_match(request):
    player = request.user.player
    # Try to join the oldest waiting match not hosted by you
    match = (Match.objects
             .filter(player_two__isnull=True, is_active=True)
             .exclude(player_one=player)
             .order_by('created_at')
             .first())

    if match:
        match.player_two = player
        match.save()
    else:
        match = Match.objects.create(
            player_one=player,
            current_turn=player,
            is_active=True
        )

    # notify everyone a new match is open
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "match_list",
        {
            "type": "match_created",
            "data": {
                "id":         match.id,
                "player_one": match.player_one.user.username
            }
        }
    )

    return redirect('battle_view', match_id=match.id)
    


@login_required
def start_bot_match(request, match_id):
    """
    Attaches a bot (Random, MinMax, or Advanced Strength) as Player Two,
    naming them appropriately so the front end shows the right label.
    """
    # 1) Read the chosen strategy ('random','minmax','advanced', etc.)
    strategy = request.GET.get('difficulty', 'random').lower()

    # 2) Map strategy → display name
    name_map = {
        'random':   'RamBot',
        'minmax':   'Maxie Bot',
        'advanced': 'BrainBot',
        'strength': 'BrainBot',
        'heuristic':'BrainBot',
    }
    display_name = name_map.get(strategy, strategy.title())

    # 3) Load the waiting match
    match = get_object_or_404(Match, id=match_id, player_two__isnull=True)

    # 4) Get or create a User+Player for that bot
    bot_user, _ = User.objects.get_or_create(
        username=display_name,
        defaults={'password': get_random_string(12)}
    )
    bot_player, created = Player.objects.get_or_create(
        user=bot_user,
        defaults={'username': display_name}
    )

    # 5) Mark as bot and save strategy
    bot_player.is_bot = True
    bot_player.bot_strategy = strategy
    bot_player.save()

    # 6) Attach and go to the battle
    match.player_two = bot_player
    match.save()
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