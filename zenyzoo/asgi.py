import os

# 1) Point at your settings *first*:
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "zenyzoo.settings")

# 2) Immediately initialize Django (this loads INSTALLED_APPS, model-registry, etc.)
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# 3) Now it’s safe to import Channels and your routing
from channels.routing  import ProtocolTypeRouter, URLRouter
from channels.auth     import AuthMiddlewareStack
import game.routing

# 4) Compose the ProtocolTypeRouter, using the already-set-up Django app:
application = ProtocolTypeRouter({
    "http":      django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(game.routing.websocket_urlpatterns)
    ),
})
