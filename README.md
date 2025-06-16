# Zenyzoo Django Project

A turn-based card-battle web app built with Django and Django REST Framework. Play against friends or the built-in RandomBot, collect cards, track your stats, and climb the leaderboard.

---

## Prerequisites

- **Python 3.10+**  
- **Git**  
- (Optional) **virtualenv** or built-in `venv`  

---

## Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/your-org/zenyzoo.git
   cd zenyzoo
````

2. **Create & activate a virtual environment**

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Apply database migrations**

   ```bash
   python manage.py migrate
   ```

5. **Seed initial data (cards & players)**

   ```bash
   python manage.py seed_cards
   python manage.py seed_player_cards
   ```

6. **Create a superuser**

   ```bash
   python manage.py createsuperuser
   ```

7. **Collect static assets**

   ```bash
   python manage.py collectstatic --noinput
   ```

8. **Run the development server**

   ```bash
   python manage.py runserver
   ```

9. **Open in your browser**
   Visit [http://127.0.0.1:8000/game/](http://127.0.0.1:8000/game/) to register, select your deck, and start battling!

---

## Usage

* **Dashboard**

  * Create or join matches, view your profile & stats.
* **Select Deck**

  * Pick exactly 7 cards from your collection to form your battle deck.
* **Battle View**

  * Place cards on a 3×3 grid, flip adjacent enemy cards by strength.
  * Play against another human or RandomBot (auto-moves after yours).
* **Shop**

  * Acquire new cards (if implemented); shop stub available.

---

## Project Structure

```
zenyzoo/
├── core/                # Core app (if used for shared models/views)
├── game/                # Main game app
│   ├── bots.py          # BotStrategy & RandomBot logic
│   ├── api_urls.py      # API endpoint routing
│   ├── urls.py          # HTML view routing
│   ├── views/           # Split: auth_views, api, match_views, game_views
│   ├── templates/       # HTML templates
│   ├── static/          # JS, CSS
│   └── utils.py         # Flip logic, deck initialization
├── zenyzoo/             # Project settings
├── requirements.txt
└── manage.py
```

---

## Configuration

* **Settings**

  * `LOGIN_URL`, `LOGIN_REDIRECT_URL`, `LOGOUT_REDIRECT_URL` for auth flows.
  * `STATIC_ROOT` & `STATICFILES_DIRS` must point to your static assets.
* **Environment Variables**

  * You can override `SECRET_KEY`, database credentials, etc., via a `.env` file or your OS.

---

## Notes & Tips

* **CSRF & AJAX**

  * All `fetch()` calls in `static/game/script.js` use `credentials: "same-origin"` and send `X-CSRFToken`. Ensure cookies are enabled.
* **Bot Matches**

  * To challenge RandomBot, create an open match and click **Play vs Bot**. The bot uses the `RandomBot` strategy in `game/bots.py`.
* **Two-Player Testing**

  * Register two users (in separate browsers/incognito windows) and have one join the other’s match.

---

## Testing & Debugging

* **Run checks**

  ```bash
  python manage.py check
  ```
* **Seed scripts**

  * `seed_cards` to populate `Card` entries from JSON.
  * `seed_player_cards` to assign full card sets to all players.
* **Common Issues**

  * **Collapsed cards**: CSS aspect‐ratio overrides fixed by final CSS rules.
  * **Bot duplicate plays**: Ensure `RandomBot.choose_move` excludes already-played **PlayerCard** IDs.
  * **Template routing**: Separate HTML vs API URLs, avoid rendering DRF’s browsable templates on API endpoints.

---

Feel free to extend this README with deployment, Docker, CI/CD, or environment-specific instructions as your project scales. Good luck—and happy battling!

```

