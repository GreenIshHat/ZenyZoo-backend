import os

# 1) Set the settings module before any Django setup
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zenyzoo.settings")

# 2) Initialize Django ASGI application (this triggers django.setup())
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# 3) Now it's safe to import and use your routing (models are ready)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import game.routing

# 4) Assemble the ProtocolTypeRouter, using the initialized ASGI app for HTTP
application = ProtocolTypeRouter({
    "http":      django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(game.routing.websocket_urlpatterns)
    ),
})
