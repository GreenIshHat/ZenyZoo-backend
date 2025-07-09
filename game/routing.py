# game/routing.py
from django.urls import re_path
from game.chat.consumers import GlobalChatConsumer


websocket_urlpatterns = [
    re_path(r"ws/chat/global/$", GlobalChatConsumer.as_asgi()),
]
