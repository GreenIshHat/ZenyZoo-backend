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
    moves = MatchMove.objects.filter(match=match)

    # Build the board array
    board = [
        {
            "position":       m.position,
            "player_id":      m.player.id,
            "player_card_id": m.card.id,
            "card_name":      m.card.card.name,
            "image":          request.build_absolute_uri(m.card.card.image.url),
            "card_top":       m.card.card.strength_top,
            "card_right":     m.card.card.strength_right,
            "card_bottom":    m.card.card.strength_bottom,
            "card_left":      m.card.card.strength_left,
        }
        for m in moves.order_by('timestamp')
    ]

    # Compute live scores
    p1 = match.player_one
    p2 = match.player_two
    p1_score = moves.filter(player=p1).count()
    p2_score = moves.filter(player=p2).count() if p2 else 0

    last_move = moves.order_by('-timestamp').first()

    return Response({
        "match_id":            match.id,
        "is_active":           match.is_active,
        "current_turn_id":     match.current_turn.id if match.current_turn else None,
        "current_turn_name":   match.current_turn.user.username if match.current_turn else None,
        "player_one":          p1.user.username,
        "player_two":          p2.user.username if p2 else None,
        "player_two_id":       p2.id if p2 else None,
        "player_two_is_bot":   getattr(p2, "is_bot", False) if p2 else False,
        "scores": {
            p1.user.username: p1_score,
            p2.user.username if p2 else "": p2_score
        },
        "winner":              match.winner.user.username if match.winner else None,
        "last_move_by": last_move.player.id if last_move else None,
        "board":               board
    })

# ─── Gameplay ─────────────────────────────────────────────────────────



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def make_move(request):
    """
    Expects JSON: {
      "match_id": <int>,
      "player_id": <int>,
      "card_id":   <int>,
      "position":  <int>
    }
    Returns JSON with:
      - flips:      [positions flipped by human]
      - bot_flips:  [positions flipped by bot]
      - bot_move:   {position, player_card_id, ...} (if bot acted)
      - next_turn_id, next_turn_name
      - game_over, winner (if game ended)
    """
    data      = request.data
    match     = get_object_or_404(Match, id=data["match_id"], is_active=True)
    player    = get_object_or_404(Player, id=data["player_id"])
    card_obj  = get_object_or_404(
                   PlayerCard,
                   id=data["card_id"],
                   owner=player,
                   in_battle_deck=True
               )
    position  = data["position"]

    # 1) Validate turn
    if match.current_turn != player:
        return Response({"error": "Not your turn"}, status=400)

    # 2) Compute flips for human move
    existing_moves = list(MatchMove.objects.filter(match=match))
    board_map = {m.position: m for m in existing_moves}
    flips    = check_flips(board_map, position, card_obj)

    # 3) Apply human flips
    for fpos in flips:
        mv = board_map[fpos]
        mv.player = player
        mv.save()

    # 4) Record human move
    MatchMove.objects.create(
        match=match,
        player=player,
        card=card_obj,
        position=position
    )

    # 5) Check for game-over after human move
    total_moves = MatchMove.objects.filter(match=match).count()
    if total_moves >= 9:
        # Count scores
        p1_count = MatchMove.objects.filter(match=match, player=match.player_one).count()
        p2_count = MatchMove.objects.filter(match=match, player=match.player_two).count() if match.player_two else 0
        winner = None
        if p1_count > p2_count:
            winner = match.player_one
        elif p2_count > p1_count:
            winner = match.player_two
        match.is_active = False
        match.winner    = winner
        match.save()
        return Response({
            "flips":     flips,
            "bot_flips": [],
            "game_over": True,
            "winner":    winner.user.username if winner else "draw"
        })

    # 6) Switch turn
    next_player = match.player_two if player == match.player_one else match.player_one
    match.current_turn = next_player
    match.save()

    # Prepare basic response
    response = {
        "flips":          flips,
        "bot_flips":      [],
        "next_turn_id":   next_player.id,
        "next_turn_name": next_player.user.username,
        "game_over":      False,
    }

    response.update({
        "player_move": {
            "position":        position,
            "player_card_id":  card_obj.id,
            "template_card_id": card_obj.card.id,
            "card_name":       card_obj.card.name,
            "image":           request.build_absolute_uri(card_obj.card.image.url),
            "card_top":        card_obj.card.strength_top,
            "card_right":      card_obj.card.strength_right,
            "card_bottom":     card_obj.card.strength_bottom,
            "card_left":       card_obj.card.strength_left,
        }
    })


    # 7) If it's a bot’s turn now, let the bot play immediately
    if getattr(next_player, "is_bot", False):
        strat_name = getattr(next_player, "bot_strategy", "random")
        try:
            bot = load_bot(strat_name, depth=2)
        except ValueError:
            bot = load_bot("random", depth=2)

        decision = bot.choose_move(match, next_player)
        if decision:
            bpos = decision["position"]
            bcard = decision["card"]

            # Compute flips for bot move
            board2 = {m.position: m for m in MatchMove.objects.filter(match=match)}
            bflips = check_flips(board2, bpos, bcard)

            # Apply bot’s flips
            for fpos in bflips:
                mv = board2[fpos]
                mv.player = next_player
                mv.save()

            # Record bot’s move
            MatchMove.objects.create(
                match=match,
                player=next_player,
                card=bcard,
                position=bpos
            )

            # Add bot_move & bot_flips to response
            response["bot_move"] = {
                "position":        bpos,
                "player_card_id":  bcard.id,
                "template_card_id": bcard.card.id,
                "card_name":       bcard.card.name,
                "image":           request.build_absolute_uri(bcard.card.image.url),
                "card_top":        bcard.card.strength_top,
                "card_right":      bcard.card.strength_right,
                "card_bottom":     bcard.card.strength_bottom,
                "card_left":       bcard.card.strength_left,
            }
            response["bot_flips"] = bflips

            # Switch turn back to human
            match.current_turn = player
            match.save()
        
    response["current_turn_id"]   = match.current_turn.id
    response["current_turn_name"] = match.current_turn.user.username


    return Response(response)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def battle_bot(request):
    """
    API endpoint to make the bot take its move.
    Expects JSON: { "match_id": <id> }.
    """
    match_id = request.data.get("match_id")
    match = get_object_or_404(Match, id=match_id, is_active=True)

    bot_player = match.player_two
    if bot_player is None:
        return Response(
            {"error": "No bot is attached to this match."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Determine strategy, defaulting to "random"
    strat_name = getattr(bot_player, "bot_strategy", None) or "random"
    try:
        strategy = load_bot(strat_name)
    except ValueError:
        # Unknown strategy—fallback
        strategy = load_bot("random")

    # Let the bot choose
    decision = strategy.choose_move(match, bot_player)
    if not decision:
        return Response(
            {"error": "Bot has no valid moves."},
            status=status.HTTP_400_BAD_REQUEST
        )

    pos   = decision['position']
    pc    = decision['card']

    # Check if already taken
    if MatchMove.objects.filter(match=match, position=pos).exists():
        return Response(
            {"error": "Bot selected an occupied position."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Build board map and compute flips
    existing = MatchMove.objects.filter(match=match)
    board_map = {m.position: m for m in existing}
    flips = check_flips(board_map, pos, pc)

    # Apply flips
    for f in flips:
        move_obj = board_map[f]
        move_obj.player = bot_player
        move_obj.save()

    # Register the bot's move
    MatchMove.objects.create(
        match=match,
        player=bot_player,
        card=pc,
        position=pos
    )

    # Switch turn back to the human
    human = match.player_one if bot_player == match.player_two else match.player_two
    match.current_turn = human
    match.save()

    # Prepare JSON with bot_move details
    card = pc.card
    return Response({
        "bot_move": {
            "position": pos,
            "player_card_id": pc.id,
            "template_card_id": card.id,
            "card_name": card.name,
            "image": request.build_absolute_uri(card.image.url),
            "card_top": card.strength_top,
            "card_right": card.strength_right,
            "card_bottom": card.strength_bottom,
            "card_left": card.strength_left
        },
        "bot_flips":    flips,
        "next_turn_id": human.id,
        "next_turn_name": human.user.username
    })

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