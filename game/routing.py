# game/routing.py
from django.urls    import re_path
from .consumers     import MatchConsumer
from .consumers     import MatchListConsumer
from .chat.consumers     import GlobalChatConsumer

websocket_urlpatterns = [
    re_path(r"ws/chat/global/$", GlobalChatConsumer.as_asgi()),
    re_path(r"ws/match/(?P<match_id>\d+)/$", MatchConsumer.as_asgi()),
    re_path(r"ws/matches/$",           MatchListConsumer.as_asgi()),
]

