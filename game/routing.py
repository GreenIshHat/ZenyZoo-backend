# game/routing.py
from django.urls    import re_path
from .consumers     import MatchConsumer, MatchListConsumer
from .chat.consumers     import GlobalChatConsumer, MatchChatConsumer

websocket_urlpatterns = [
    re_path(r"ws/matches/$",           MatchListConsumer.as_asgi()),
    re_path(r"ws/match/(?P<match_id>\d+)/$", MatchConsumer.as_asgi()),
    re_path(r"ws/chat/match/(?P<match_id>\d+)/$", MatchChatConsumer.as_asgi()),
    re_path(r"ws/chat/global/$", GlobalChatConsumer.as_asgi()),
]

