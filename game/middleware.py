from django.utils import timezone

class UpdateLastSeenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.user.is_authenticated:
            try:
                player = getattr(request.user, 'player', None)
                if player:
                    print(f"Updating last_seen for {player.user.username}")
                    player.last_seen = timezone.now()
                    player.save(update_fields=['last_seen'])
            except Exception as e:
                print("LastSeen middleware error:", e)
        return response
