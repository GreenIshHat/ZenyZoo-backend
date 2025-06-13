from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from rest_framework import status
from .models import Match, Player, PlayerCard, Card
from .utils import initialize_player_deck
from django.shortcuts import render, redirect
from django.shortcuts import get_object_or_404
from .bots import load_bot

@login_required
def home_view(request):
    return render(request, 'game/home.html')


def register_form(request):
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        if not User.objects.filter(username=username).exists():
            User.objects.create_user(username=username, password=password)
            return redirect('login')
    return render(request, 'registration/register.html')

@login_required
def profile_view(request):
    player = Player.objects.get(username=request.user.username)
    all_cards = PlayerCard.objects.filter(owner=player)
    battle_deck = all_cards.filter(in_battle_deck=True)
    return render(request, 'game/profile.html', {
        'all_cards': all_cards,
        'battle_deck': battle_deck,
    })


@login_required
def match_list_view(request):
    return render(request, 'game/match_list.html')


@login_required
def battle_view(request, match_id):
    return render(request, 'game/battle.html', {'match_id': match_id})

@login_required
def choose_battle_deck(request):
    player = Player.objects.get(username=request.user.username)
    owned_cards = PlayerCard.objects.filter(owner=player)

    if request.method == 'POST':
        selected_ids = request.POST.getlist('cards')[:7]

        # Clear current battle deck
        PlayerCard.objects.filter(owner=player).update(in_battle_deck=False)
        # Set new ones
        PlayerCard.objects.filter(owner=player, id__in=selected_ids).update(in_battle_deck=True)

        return redirect('profile_view')  # or any next page

    return render(request, 'game/select_deck.html', {
        'owned_cards': owned_cards
    })


# API
@api_view(['POST'])
def register_user(request):
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response({"error": "Username and password are required."}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already taken."}, status=400)

    user = User.objects.create_user(username=username, password=password)
    player = Player.objects.create(user=user, username=username)

    # Optionally: seed their cards
    initialize_player_deck(player)

    return Response({
        "message": "User and Player created.",
        "user_id": user.id,
        "player_id": player.id,
        "username": username
    })


@api_view(['POST'])
def login_user(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(username=username, password=password)
    if user:
        login(request, user)  # Sets session if CSRF/session auth is enabled
        return Response({"message": "Login successful", "user_id": user.id})
    else:
        return Response({"error": "Invalid credentials"}, status=401)

@api_view(['POST'])
def register_player(request):
    username = request.data.get("username")
    if not username:
        return Response({"error": "Username is required."}, status=400)

    player, created = Player.objects.get_or_create(username=username)

    if created:
        # Optionally seed their collection here
        initialize_player_deck(player)

    return Response({
        "player_id": player.id,
        "username": player.username,
        "created": created
    })


@api_view(['POST'])
def start_match(request):
    player1_id = request.data.get("player_one_id")
    player2_id = request.data.get("player_two_id")

    if not player1_id or not player2_id:
        return Response({"error": "Both player IDs required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        player1 = Player.objects.get(id=player1_id)
        player2 = Player.objects.get(id=player2_id)
    except Player.DoesNotExist:
        return Response({"error": "One or both players not found."}, status=status.HTTP_404_NOT_FOUND)

    match = Match.objects.create(
        player_one=player1,
        player_two=player2,
        current_turn=player1
    )

    initialize_player_deck(player1)
    initialize_player_deck(player2)

    return Response({
        "match_id": match.id,
        "current_turn": match.current_turn.username,
    })


@api_view(['GET'])
def get_battle_deck(request, player_id):
    try:
        player = Player.objects.get(id=player_id)
        battle_cards = PlayerCard.objects.filter(owner=player, in_battle_deck=True).select_related('card')

        deck_data = []
        for pc in battle_cards:
            card = pc.card
            deck_data.append({
                "card_id": card.id,
                "name": card.name,
                "image": card.image.url if card.image else None,
                "lore": card.lore,
                "stats": {
                    "top": card.strength_top,
                    "right": card.strength_right,
                    "bottom": card.strength_bottom,
                    "left": card.strength_left,
                }
            })

        return Response({"player": player.username, "battle_deck": deck_data})
    except Player.DoesNotExist:
        return Response({"error": "Player not found"}, status=404)


@api_view(['POST'])
def make_move(request):
    match_id = request.data.get('match_id')
    player_id = request.data.get('player_id')
    card_id = request.data.get('card_id')
    position = request.data.get('position')

    match = get_object_or_404(Match, id=match_id, is_active=True)
    player = get_object_or_404(Player, id=player_id)

    if match.current_turn != player:
        return Response({"error": "Not your turn"}, status=400)

    if MatchMove.objects.filter(match=match, position=position).exists():
        return Response({"error": "Position already taken"}, status=400)

    card = get_object_or_404(PlayerCard, id=card_id, owner=player, in_battle_deck=True)

    # Build current board
    moves = MatchMove.objects.filter(match=match)
    board = {m.position: {'player': m.player, 'card': m.card} for m in moves}

    # Flip logic
    flips = check_flips(board, position, card)

    # Apply flips: simulate ownership change
    for pos in flips:
        flip_move = moves.get(position=pos)
        flip_move.player = player
        flip_move.save()

    # Register this move
    MatchMove.objects.create(
        match=match,
        player=player,
        card=card,
        position=position
    )

    # Victory check
    if len(board) + 1 >= 9:
        # Board full: Count owned cards
        p1_score = MatchMove.objects.filter(match=match, player=match.player_one).count()
        p2_score = 9 - p1_score
        winner = match.player_one if p1_score > p2_score else match.player_two if p2_score > p1_score else None
        match.is_active = False
        match.save()

        return Response({
            "move": position,
            "flips": flips,
            "game_over": True,
            "winner": winner.username if winner else "draw"
        })

    # Change turn
    match.current_turn = match.player_two if player == match.player_one else match.player_one
    match.save()

    return Response({
        "move": position,
        "flips": flips,
        "next_turn": match.current_turn.username,
        "game_over": False
    })



@api_view(['POST'])
def battle_bot(request):
    match_id = request.data.get("match_id")
    match = get_object_or_404(Match, id=match_id, is_active=True)

    if match.current_turn != match.player_two:
        return Response({"error": "It's not bot's turn."}, status=400)

    bot_player = match.player_two
    strategy = strategy = load_bot("random")  # or "minmax", etc.

    move = strategy.choose_move(match, bot_player)

    if not move:
        return Response({"error": "Bot has no valid moves."}, status=400)

    # Check if position taken
    if MatchMove.objects.filter(match=match, position=move['position']).exists():
        return Response({"error": "Bot selected an invalid move."}, status=400)

    # Build board
    moves = MatchMove.objects.filter(match=match)
    board = {m.position: {'player': m.player, 'card': m.card} for m in moves}
    flips = check_flips(board, move['position'], move['card'])

    # Apply flips
    for pos in flips:
        flip_move = moves.get(position=pos)
        flip_move.player = bot_player
        flip_move.save()

    # Register bot move
    MatchMove.objects.create(
        match=match,
        player=bot_player,
        card=move['card'],
        position=move['position']
    )

    if len(board) + 1 >= 9:
        p1_score = MatchMove.objects.filter(match=match, player=match.player_one).count()
        p2_score = 9 - p1_score
        winner = match.player_one if p1_score > p2_score else match.player_two if p2_score > p1_score else None
        match.is_active = False
        match.save()

        return Response({
            "move": move['position'],
            "flips": flips,
            "game_over": True,
            "winner": winner.username if winner else "draw"
        })

    match.current_turn = match.player_one
    match.save()

    return Response({
        "move": move['position'],
        "flips": flips,
        "next_turn": match.current_turn.username,
        "game_over": False
    })


def check_victory(match):
    board = match.board  # example: 9-length list of placed card IDs or None
    if None in board:
        return None  # game still on

    # Count controlled cards
    p1_count = match.get_card_count_for(match.player_one)
    p2_count = match.get_card_count_for(match.player_two)

    if p1_count > p2_count:
        match.winner = match.player_one
    elif p2_count > p1_count:
        match.winner = match.player_two
    else:
        match.winner = None  # draw

    match.is_active = False
    match.save()

    return match.winner


@api_view(['GET'])
def get_match_state(request, match_id):
    match = get_object_or_404(Match, id=match_id)
    moves = MatchMove.objects.filter(match=match).order_by('timestamp')

    board = []
    for move in moves:
        board.append({
            "position": move.position,
            "player": move.player.username,
            "card_id": move.card.card.id,
            "card_name": move.card.card.name,
            "image": move.card.card.image.url,
        })

    return Response({
        "match_id": match.id,
        "current_turn": match.current_turn.username,
        "is_active": match.is_active,
        "board": board
    })


@api_view(['GET'])
def get_player_deck(request, player_id):
    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"error": "Player not found"}, status=404)

    deck = PlayerCard.objects.filter(owner=player).select_related('card')
    data = []
    for pc in deck:
        card = pc.card
        data.append({
            "card_id": card.id,
            "name": card.name,
            "image": card.image.url if hasattr(card.image, 'url') else card.image,
            "in_battle_deck": pc.in_battle_deck,
            "lore": card.lore,
            "stats": {
                "top": card.strength_top,
                "right": card.strength_right,
                "bottom": card.strength_bottom,
                "left": card.strength_left
            }
        })

    return Response({"player": player.username, "deck": data})


@api_view(['POST'])
def create_open_match(request):
    player_id = request.data.get("player_id")
    player = Player.objects.get(id=player_id)

    match = Match.objects.create(player_one=player, current_turn=player, is_active=True)
    return Response({"match_id": match.id, "status": "waiting_for_opponent"})


@api_view(['POST'])
def join_match(request):
    match_id = request.data.get("match_id")
    player_id = request.data.get("player_id")

    match = Match.objects.get(id=match_id)
    if match.player_two is not None:
        return Response({"error": "Match already full"}, status=400)

    player = Player.objects.get(id=player_id)
    match.player_two = player
    match.save()

    return Response({"match_id": match.id, "message": "Match joined"})

@api_view(['GET'])
def list_open_matches(request):
    matches = Match.objects.filter(player_two__isnull=True, is_active=True)
    data = [{"match_id": m.id, "host": m.player_one.username} for m in matches]
    return Response(data)


@api_view(['POST'])
def set_battle_deck(request):
    player_id = request.data.get("player_id")
    card_ids = request.data.get("card_ids", [])

    if len(card_ids) != 7:
        return Response({"error": "You must select exactly 7 cards."}, status=400)

    try:
        player = Player.objects.get(id=player_id)
    except Player.DoesNotExist:
        return Response({"error": "Player not found"}, status=404)

    owned_cards = PlayerCard.objects.filter(owner=player)
    owned_card_ids = set(pc.card.id for pc in owned_cards)

    if not set(card_ids).issubset(owned_card_ids):
        return Response({"error": "One or more cards are not owned by the player."}, status=400)

    # Clear previous battle deck
    owned_cards.update(in_battle_deck=False)

    # Set selected cards to battle deck
    PlayerCard.objects.filter(owner=player, card__id__in=card_ids).update(in_battle_deck=True)

    return Response({"success": True, "battle_deck": card_ids})


@api_view(['POST'])
def buy_card(request):
    player_id = request.data.get("player_id")
    card_id = request.data.get("card_id")

    # Fetch and validate
    player = Player.objects.get(id=player_id)
    shop_item = ShopCard.objects.get(card_id=card_id, is_active=True)

    # (Add logic to check player currency here…)

    # Give card
    PlayerCard.objects.create(owner=player, card=shop_item.card, acquired_from="shop")

    return Response({"message": "Card purchased!"})

@api_view(['GET'])
def view_shop(request):
    shop_cards = ShopCard.objects.filter(is_active=True)
    data = [{
        "card_id": sc.card.id,
        "name": sc.card.name,
        "price": sc.price,
        "image": sc.card.image.url,
    } for sc in shop_cards]
    return Response(data)



