"""
CampusConnect Flask application — entrypoint.

Run directly (auto-restarts on file changes thanks to the debug reloader):

    python3 app.py

The Next.js frontend talks to this service through the sandbox gateway,
so every frontend request goes to  /api/... ?XTransformPort=5001 .
"""

from flask import Flask, jsonify

import config
from network import network_state
from routes.auth import auth_bp
from routes.connections import connections_bp
from routes.media import media_bp
from routes.notifications import notifications_bp
from routes.posts import posts_bp
from routes.profile import profile_bp
from routes.recommendations import recommendations_bp
from routes.search import search_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=config.SECRET_KEY,          # signs the session cookie
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        JSON_SORT_KEYS=False,
        MAX_CONTENT_LENGTH=config.MAX_MEDIA_BYTES,  # hard cap for uploads
    )

    blueprints = (auth_bp, profile_bp, connections_bp, posts_bp, search_bp,
                  recommendations_bp, notifications_bp, media_bp)
    for blueprint in blueprints:
        app.register_blueprint(blueprint)

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "service": "campus-connect-api",
                        "port": config.PORT})

    @app.get("/api/stats")
    def stats():
        """Live platform numbers for the landing page (never hardcoded)."""
        return jsonify(network_state.stats())

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Endpoint not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(413)
    def payload_too_large(_error):
        mb = config.MAX_MEDIA_BYTES // (1024 * 1024)
        return jsonify({
            "error": f"That file is too large. Uploads are limited to {mb} MB."
        }), 413

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify({"error": "Internal server error."}), 500

    # Startup: create tables, seed sample data on first boot, then load the
    # whole network into the in-memory graph / trie / hash tables.
    network_state.initialize()
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=config.PORT, debug=True)
