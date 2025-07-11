from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login

from game.models        import Player, PlayerCard, Match, MatchMove, ShopCard
from game.utils         import initialize_player_deck, check_flips
from game.bots          import load_bot

from channels.layers    import get_channel_layer
from asgiref.sync       import async_to_sync

from .serializers import MatchStateSerializer

# ─── Auth ────────────────────────────────────────────────────────────

@api_view(['POST'])
def register_user(request):
    username = request.data.get("username")
    password = request.data.get("password")
    if not username or not password:
        return Response({"error": "Username and password are required."}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already taken."}, status=400)
    user = User.objects.create_user(username=username, password=password)
    player = Player.objects.create(user=user)
    initialize_player_deck(player)
    return Response({
        "message": "User created",
        "user_id": user.id,
        "player_id": player.id
    })

@api_view(['POST'])
def login_user(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(username=username, password=password)
    if user:
        login(request, user)
        return Response({"message": "Login successful", "user_id": user.id})
    return Response({"error": "Invalid credentials"}, status=401)

# ─── Deck Endpoints ────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_player_deck(request, player_id):
    player = get_object_or_404(Player, id=player_id)
    cards = PlayerCard.objects.filter(owner=player).select_related('card')
    deck = [{
        "card_id": pc.card.id,
        "name": pc.card.name,
        "in_battle_deck": pc.in_battle_deck
    } for pc in cards]
    return Response({"player": player.user.username, "deck": deck})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_battle_deck(request, player_id):
    """
    Return the 7 cards in the player’s battle deck,
    using PlayerCard.id for move-submission.
    """
    player = get_object_or_404(Player, id=player_id)
    pcs = PlayerCard.objects.filter(owner=player, in_battle_deck=True).select_related('card')

    deck = []
    for pc in pcs:
        deck.append({
            "player_card_id": pc.id,            # <- PlayerCard PK
            "template_card_id": pc.card.id,     # optional, the Card PK
            "name": pc.card.name,
            "image": request.build_absolute_uri(pc.card.image.url),
            "stats": {
                "top":    pc.card.strength_top,
                "right":  pc.card.strength_right,
                "bottom": pc.card.strength_bottom,
                "left":   pc.card.strength_left,
            }
        })

    return Response({
        "player":      player.user.username,
        "battle_deck": deck
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_battle_deck(request):
    player = get_object_or_404(Player, id=request.data.get("player_id"))
    card_ids = request.data.get("card_ids", [])
    if len(card_ids) != 7:
        return Response({"error": "Must select exactly 7 cards."}, status=400)
    owned = PlayerCard.objects.filter(owner=player)
    if not set(card_ids).issubset({pc.card.id for pc in owned}):
        return Response({"error": "Invalid card selection."}, status=400)
    owned.update(in_battle_deck=False)
    PlayerCard.objects.filter(owner=player, card__id__in=card_ids).update(in_battle_deck=True)
    return Response({"success": True, "battle_deck": card_ids})

# ─── Match Flow ────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_open_match(request):
    player = get_object_or_404(Player, id=request.data.get("player_id"))
    match = Match.objects.create(player_one=player, current_turn=player, is_active=True)
    return Response({"match_id": match.id, "status": "waiting_for_opponent"})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_open_matches(request):
    qs = Match.objects.filter(player_two__isnull=True, is_active=True)
    data = [{"match_id": m.id, "host": m.player_one.user.username} for m in qs]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_match(request):
    match = get_object_or_404(Match, id=request.data.get("match_id"))
    if match.player_two:
        return Response({"error": "Match full"}, status=400)
    player = get_object_or_404(Player, id=request.data.get("player_id"))
    match.player_two = player
    match.save()
    return Response({"match_id": match.id, "message": "Joined match"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_match_state(request, match_id):
    match = get_object_or_404(Match, id=match_id)
    serializer = MatchStateSerializer(match, context={'request': request})
    return Response(serializer.data)



MAX_BOT_TRIES = 9

def execute_bot_move(match, bot_player):
    strategy = getattr(bot_player, "bot_strategy", "random")
    try:
        bot = load_bot(strategy, depth=2)
    except ValueError:
        bot = load_bot("random", depth=2)
    for _ in range(MAX_BOT_TRIES):
        taken = {m.position for m in MatchMove.objects.filter(match=match)}
        decision = bot.choose_move(match, bot_player)
        if not decision or decision["position"] in taken:
            continue
        board_map = {m.position: m for m in MatchMove.objects.filter(match=match)}
        flips = check_flips(board_map, decision["position"], decision["card"])
        for pos in flips:
            mv = board_map[pos]
            mv.player = bot_player
            mv.save()
        MatchMove.objects.create(match=match, player=bot_player, card=decision["card"], position=decision["position"])
        move_info = {
            "position": decision["position"],
            "player_card_id": decision["card"].id,
            "template_card_id": decision["card"].card.id,
            "card_name": decision["card"].card.name,
            "image": decision["card"].card.image.url,
            "card_top": decision["card"].card.strength_top,
            "card_right": decision["card"].card.strength_right,
            "card_bottom": decision["card"].card.strength_bottom,
            "card_left": decision["card"].card.strength_left
        }
        return move_info, flips
    return None, []

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def make_move(request):
    data = request.data
    match = get_object_or_404(Match, id=data.get("match_id"))
    player = get_object_or_404(Player, id=data.get("player_id"))
    if not match.is_active or match.current_turn != player:
        return Response({"error": "Invalid move"}, status=400)
    card_obj = get_object_or_404(PlayerCard, id=data.get("card_id"), owner=player, in_battle_deck=True)
    position = data.get("position")
    board_map = {m.position: m for m in MatchMove.objects.filter(match=match)}
    flips = check_flips(board_map, position, card_obj)
    for pos in flips:
        mv = board_map[pos]
        mv.player = player
        mv.save()
    MatchMove.objects.create(match=match, player=player, card=card_obj, position=position)
    next_player = match.player_two if player == match.player_one else match.player_one
    if getattr(next_player, "is_bot", False):
        bot_move, bot_flips = execute_bot_move(match, next_player)
        if bot_move is None:
            match.is_active = False
            match.winner = player
        else:
            match.current_turn = player
    else:
        bot_move, bot_flips = None, []
        match.current_turn = next_player
    match.save()
    moves = MatchMove.objects.filter(match=match).order_by('position', 'pk')
    board_final = {m.position: m for m in moves}
    p1 = match.player_one
    p2 = match.player_two
    p1_score = sum(1 for mv in board_final.values() if mv.player == p1)
    p2_score = sum(1 for mv in board_final.values() if p2 and mv.player == p2)
    named_scores = {p1.user.username: p1_score}
    if p2: named_scores[p2.user.username] = p2_score
    total_positions = len(board_final)
    if not match.is_active or total_positions >= 9:
        if match.winner is None:
            match.winner = p1 if p1_score > p2_score else p2
        match.is_active = False
        match.save()
    response = {
        "flips": flips,
        "bot_flips": bot_flips,
        "bot_move": bot_move,
        "named_scores": named_scores,
        "game_over": not match.is_active,
        "winner": match.winner.user.username if match.winner else None,
        "current_turn_id": match.current_turn.id if match.current_turn else None,
        "current_turn_name": match.current_turn.user.username if match.current_turn else None
    }
    return Response(response)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def battle_bot(request):
    match = get_object_or_404(Match, id=request.data.get("match_id"), is_active=True)
    bot_player = match.player_two
    if not getattr(bot_player, "is_bot", False):
        return Response({"error": "No bot attached"}, status=400)
    human = match.player_one if bot_player == match.player_two else match.player_two
    bot_move, bot_flips = execute_bot_move(match, bot_player)
    match.current_turn = human
    match.save()
    moves = MatchMove.objects.filter(match=match).order_by('position', 'pk')
    board_final = {m.position: m for m in moves}
    p1 = match.player_one
    p2 = match.player_two
    named_scores = {p1.user.username: sum(1 for mv in board_final.values() if mv.player == p1)}
    if p2: named_scores[p2.user.username] = sum(1 for mv in board_final.values() if mv.player == p2)
    return Response({
        "bot_move": bot_move,
        "bot_flips": bot_flips,
        "named_scores": named_scores,
        "current_turn_id": human.id,
        "current_turn_name": human.user.username
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def forfeit_match(request):
    match = get_object_or_404(Match, id=request.data.get("match_id"), is_active=True)
    player = get_object_or_404(Player, id=request.data.get("player_id"))
    opponent = match.player_two if player == match.player_one else match.player_one
    match.is_active = False
    match.winner = opponent
    match.save()
    state = MatchStateSerializer(match).data
    state["forfeited"] = True
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"match_{match.id}", {"type": "state_update", "data": state}
    )
    return Response(state)


# ─── Shop ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_shop(request):
    items = ShopCard.objects.filter(is_active=True)
    data = [{"card_id": i.card.id, "price": i.price} for i in items]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def buy_card(request):
    player = request.user.player
    card_id = request.data.get("card_id")

    try:
        shop_item = ShopCard.objects.get(card__id=card_id, is_active=True)
    except ShopCard.DoesNotExist:
        return Response({"error": "Card not available"}, status=status.HTTP_404_NOT_FOUND)

    price = shop_item.price
    if player.credits < price:
        return Response({"error": "Insufficient Zenys"}, status=status.HTTP_400_BAD_REQUEST)

    # Deduct price
    player.credits -= price
    player.save()

    # Grant the card
    PlayerCard.objects.create(owner=player, card=shop_item.card, acquired_from="shop")

    return Response({
        "message": "Card purchased!",
        "new_credits": player.credits
    })