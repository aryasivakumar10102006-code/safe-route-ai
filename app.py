

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from datetime import datetime
import hashlib
import os

app = Flask(__name__)
app.secret_key = "saferoute-ai-secret-2024"  # Change in production

# ─────────────────────────────────────────────
# In-memory data stores (replace with DB later)
# ─────────────────────────────────────────────

# users = { email: { name, email, password_hash } }
users = {}

# hazards = [ { type, location, description, timestamp, user } ]
hazards = [
    {
        "type": "Pothole / Bad Road",
        "location": "MG Road, Near Metro Station",
        "description": "Large pothole causing vehicles to swerve suddenly. Dangerous at night.",
        "timestamp": "2024-01-15 08:32 AM",
        "user": "Arjun Sharma"
    },
    {
        "type": "Waterlogging",
        "location": "Anna Salai, Chennai",
        "description": "Heavy waterlogging after last night's rain. Road barely visible.",
        "timestamp": "2024-01-15 07:15 AM",
        "user": "Priya Nair"
    },
    {
        "type": "Accident",
        "location": "NH-48, Bangalore Bypass",
        "description": "Two-vehicle collision blocking left lane. Police on the way.",
        "timestamp": "2024-01-15 06:50 AM",
        "user": "Rahul Mehta"
    }
]


# ─────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────

def hash_password(password):
    """Simple SHA-256 password hashing. Use bcrypt in production."""
    return hashlib.sha256(password.encode()).hexdigest()

def is_logged_in():
    """Check if user is currently in session."""
    return "user_email" in session

def get_current_user():
    """Return current user dict from session email."""
    email = session.get("user_email")
    return users.get(email)


# ─────────────────────────────────────────────
# Page Routes
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Landing page - redirect to dashboard if already logged in."""
    if is_logged_in():
        return redirect(url_for("dashboard"))
    return render_template("index.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    """Signup page - handles user registration."""
    if is_logged_in():
        return redirect(url_for("dashboard"))

    error = None
    if request.method == "POST":
        name     = request.form.get("name", "").strip()
        email    = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm  = request.form.get("confirm_password", "")

        # Validation
        if not all([name, email, password, confirm]):
            error = "All fields are required."
        elif password != confirm:
            error = "Passwords do not match."
        elif len(password) < 6:
            error = "Password must be at least 6 characters."
        elif email in users:
            error = "An account with this email already exists."
        else:
            # Register new user
            users[email] = {
                "name": name,
                "email": email,
                "password_hash": hash_password(password),
                "joined": datetime.now().strftime("%Y-%m-%d")
            }
            # Auto-login after signup
            session["user_email"] = email
            return redirect(url_for("dashboard"))

    return render_template("signup.html", error=error)


@app.route("/login", methods=["GET", "POST"])
def login():
    """Login page - handles user authentication."""
    if is_logged_in():
        return redirect(url_for("dashboard"))

    error = None
    if request.method == "POST":
        email    = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        user = users.get(email)
        if not user or user["password_hash"] != hash_password(password):
            error = "Invalid email or password."
        else:
            session["user_email"] = email
            return redirect(url_for("dashboard"))

    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    """Clear session and redirect to landing page."""
    session.clear()
    return redirect(url_for("index"))


@app.route("/dashboard")
def dashboard():
    """Main dashboard - protected route."""
    if not is_logged_in():
        return redirect(url_for("login"))

    user = get_current_user()
    return render_template("dashboard.html", user=user, hazards=hazards)


# ─────────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────────

@app.route("/report", methods=["POST"])
def report():
    """
    POST /report
    Accepts JSON hazard data and stores it in-memory.
    Future: Save to database, trigger real-time updates via WebSocket.
    """
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401

    user = get_current_user()
    data = request.get_json()

    # Validate required fields
    if not data or not all(k in data for k in ["type", "location", "description"]):
        return jsonify({"error": "Missing required fields"}), 400

    hazard = {
        "type":        data["type"].strip(),
        "location":    data["location"].strip(),
        "description": data["description"].strip(),
        "timestamp":   datetime.now().strftime("%Y-%m-%d %I:%M %p"),
        "user":        user["name"],
        # Future: add lat/lng for map integration
        # "lat": data.get("lat"),
        # "lng": data.get("lng"),
    }

    hazards.insert(0, hazard)  # Newest first

    return jsonify({"success": True, "hazard": hazard}), 201


@app.route("/hazards", methods=["GET"])
def get_hazards():
    """
    GET /hazards
    Returns all hazards as JSON.
    Future: Support filtering by type, location radius, date range.
    """
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401

    hazard_type = request.args.get("type")
    filtered = [h for h in hazards if not hazard_type or h["type"] == hazard_type]

    return jsonify({"hazards": filtered, "count": len(filtered)})


# ─────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("🚦 SafeRoute AI running at http://127.0.0.1:5000")
    app.run(debug=True)
