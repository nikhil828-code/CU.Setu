"""
Sample data seeding — runs automatically on FIRST boot only (empty database).

Demo accounts: 14 students, every password is `pass123`.
The showcase account is   aarav / pass123   (5 connections, 2 incoming
requests, 1 outgoing request, populated feed).

The connections deliberately form CLUSTERS (CSE, ECE, IT, AI) with bridge
edges between them, so BFS shortest paths are interesting:
    aarav -> tara     : aarav-priya-tara                     (2 hops)
    aarav -> meera    : aarav-ishita-meera                    (2 hops)
    aarav -> dev      : aarav-sneha-kabir-dev                 (3 hops)
"""

from datetime import datetime, timedelta, timezone

import database as db
from models import User, hash_password

SAMPLE_PASSWORD = "pass123"


def _minutes_ago(minutes: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


def _days_ago(days: int) -> str:
    return _minutes_ago(days * 24 * 60)


# --------------------------------------------------------------------------- #
# Students
# --------------------------------------------------------------------------- #
USERS = [
    dict(username="aarav", full_name="Aarav Sharma",
         programme="B.Tech CSE", year="3rd Year",
         bio="Building things with graphs and coffee. Currently obsessed with "
             "algorithm visualisers.",
         skills=["Python", "Java", "Data Structures", "React", "Flask"],
         interests=["Web Development", "Open Source", "Hackathons", "Algorithms"]),
    dict(username="ishita", full_name="Ishita Verma",
         programme="B.Tech CSE", year="3rd Year",
         bio="Frontend enthusiast converting caffeine into components. "
             "Design-first engineer.",
         skills=["React", "TypeScript", "Python", "Tailwind CSS"],
         interests=["UI/UX Design", "Hackathons", "Web Development"]),
    dict(username="rohan", full_name="Rohan Mehta",
         programme="B.Tech CSE", year="4th Year",
         bio="LeetCode nightly. Training my own graph neural network — "
             "my brain.",
         skills=["Java", "Spring Boot", "System Design", "Data Structures"],
         interests=["Competitive Programming", "Open Source", "Startups"]),
    dict(username="priya", full_name="Priya Nair",
         programme="B.Tech ECE", year="3rd Year",
         bio="Circuits by day, code by night. Building an IoT greenhouse "
             "monitor for the botany lab.",
         skills=["C++", "Embedded C", "IoT", "MATLAB"],
         interests=["Robotics", "IoT", "Electronics"]),
    dict(username="arjun", full_name="Arjun Reddy",
         programme="B.Tech ECE", year="4th Year",
         bio="Robocon team lead. If it moves, I probably built it.",
         skills=["Robotics", "C++", "Arduino", "ROS"],
         interests=["Robotics", "Drones", "Automation"]),
    dict(username="sneha", full_name="Sneha Iyer",
         programme="B.Tech IT", year="2nd Year",
         bio="Backend-in-training. My plants and my servers are both "
             "overwatered.",
         skills=["Java", "Spring", "SQL", "Git"],
         interests=["Hackathons", "Cloud Computing", "Cricket"]),
    dict(username="kabir", full_name="Kabir Khan",
         programme="B.Tech IT", year="3rd Year",
         bio="Graph theory enjoyer. I annotate my friendships with edge "
             "weights.",
         skills=["Python", "Dynamic Programming", "Graph Theory", "C++"],
         interests=["Algorithms", "Chess", "Mathematics"]),
    dict(username="meera", full_name="Meera Krishnan",
         programme="M.Tech AI & DS", year="1st Year",
         bio="Researching graph neural networks. Ask me about node "
             "embeddings.",
         skills=["Python", "PyTorch", "Machine Learning", "Deep Learning"],
         interests=["AI Research", "Paper Reading", "Mathematics"]),
    dict(username="vikram", full_name="Vikram Singh",
         programme="M.Tech AI & DS", year="2nd Year",
         bio="NLP grad student. Fine-tuning models and my sleep schedule.",
         skills=["Python", "NLP", "PyTorch", "Transformers"],
         interests=["AI Research", "Linguistics", "Open Source"]),
    dict(username="ananya", full_name="Ananya Das",
         programme="B.Sc Data Science", year="2nd Year",
         bio="Numbers whisper to me. Currently charting campus food prices "
             "over four semesters.",
         skills=["R", "SQL", "Tableau", "Statistics"],
         interests=["Data Visualisation", "Analytics", "Baking"]),
    dict(username="dev", full_name="Dev Patel",
         programme="BCA", year="3rd Year",
         bio="Flutter dev. One codebase, every screen size.",
         skills=["Flutter", "Dart", "Firebase", "UI Design"],
         interests=["Mobile Apps", "Startups", "Gaming"]),
    dict(username="farah", full_name="Farah Ali",
         programme="B.Tech CSE", year="2nd Year",
         bio="Making the web prettier one gradient at a time.",
         skills=["React", "Node.js", "CSS", "MongoDB"],
         interests=["Web Development", "Design Systems", "Hackathons"]),
    dict(username="nikhil", full_name="Nikhil Joshi",
         programme="B.Tech CSE", year="4th Year",
         bio="Placement season survivor. 500 DSA problems later, still "
             "standing.",
         skills=["Data Structures", "Algorithms", "Aptitude", "C++"],
         interests=["Competitive Programming", "Teaching", "Football"]),
    dict(username="tara", full_name="Tara Kapoor",
         programme="B.Tech ECE", year="2nd Year",
         bio="Signal processing student. My filter design finally filters "
             "noise.",
         skills=["Verilog", "MATLAB", "Signal Processing", "PCB Design"],
         interests=["Electronics", "Music Production", "Dance"]),
]

# --------------------------------------------------------------------------- #
# Accepted (undirected) connections
# --------------------------------------------------------------------------- #
CONNECTIONS = [
    # CSE cluster around aarav
    ("aarav", "ishita", 26000), ("aarav", "rohan", 25000),
    ("aarav", "sneha", 9000), ("aarav", "farah", 8000),
    ("aarav", "priya", 7000),
    ("ishita", "rohan", 30000), ("ishita", "farah", 15000),
    ("ishita", "meera", 6000),
    ("rohan", "nikhil", 20000), ("rohan", "vikram", 5000),
    ("farah", "nikhil", 4000), ("farah", "sneha", 3000),
    # ECE cluster
    ("priya", "arjun", 22000), ("priya", "tara", 10000),
    ("arjun", "tara", 12000),
    # IT cluster
    ("sneha", "kabir", 6000), ("kabir", "dev", 2000),
    # AI cluster
    ("meera", "vikram", 28000), ("meera", "ananya", 11000),
    ("vikram", "ananya", 9000),
]

# --------------------------------------------------------------------------- #
# Pending (directed) requests
# --------------------------------------------------------------------------- #
PENDING_REQUESTS = [
    ("meera", "aarav", 45),    # aarav receives -> accept to demo
    ("dev", "aarav", 20),      # aarav receives
    ("aarav", "vikram", 120),  # aarav sent -> cancel to demo
]

# --------------------------------------------------------------------------- #
# Posts (oldest first; indexes are used by LIKES / COMMENTS below)
# --------------------------------------------------------------------------- #
POSTS = [
    ("nikhil", 1300, "500th DSA problem solved today. The grind never stops. "
                     "Next stop: system design interviews. Grateful for this streak."),
    ("arjun", 1100, "Robocon finals locked in. Our line-following robot now "
                    "handles 45-degree ramps. Six months of PID tuning finally paying off."),
    ("tara", 900, "Milled my first PCB today. The silkscreen came out crisp and "
                 "only one pad lifted. Verilog simulators, take notes."),
    ("dev", 800, "Published my first Flutter app on the Play Store — a campus "
                "timetable planner with offline mode. 120 downloads in week one."),
    ("ananya", 720, "Made a dashboard tracking our campus mess prices across "
                    "four semesters. The samosa index is up 38%. Data does not lie."),
    ("kabir", 650, "Solved 30 graph problems this month. Adjacency lists, "
                  "Floyd-Warshall, union-find — I dream in edges now."),
    ("priya", 540, "IoT greenhouse monitor v2 is live. Soil moisture, humidity "
                   "and light sensors all reporting to a Flask dashboard. The "
                   "botany lab is thrilled."),
    ("vikram", 420, "Shortlisted for a research internship on NLP for "
                    "low-resource languages. Resume sessions and transformers "
                    "everywhere."),
    ("farah", 320, "Built a tiny design system for my portfolio — tokens, "
                  "type scale, spacing rhythm. CSS can be engineering too."),
    ("sneha", 240, "Deployed my first Spring Boot service to the cloud. "
                  "Dockerfile is 12 lines and I am unreasonably proud of it."),
    ("aarav", 190, "Mini-project update: building a LinkedIn-style student "
                   "network for our campus where the social graph is literally "
                   "an adjacency list. Meta enough?"),
    ("ishita", 120, "Portfolio redesign done. Dark navy theme, real project "
                    "write-ups, and zero template code. Accessibility audit "
                    "passed too."),
    ("meera", 75, "First graph neural network prototype is training. Node "
                  "embeddings on our citation dataset converge beautifully. "
                  "Paper draft next week."),
    ("rohan", 38, "2nd place at the Smart India Hackathon finals! 36 hours, "
                  "4 coffee runs, 1 working prototype. Team Caffeine did it again."),
]

# (post index, liker, minutes ago)
LIKES = [
    (13, "aarav", 30), (13, "ishita", 29), (13, "priya", 28), (13, "farah", 26),
    (12, "ishita", 60), (12, "vikram", 55), (12, "ananya", 50),
    (11, "ishita", 100), (11, "rohan", 95), (11, "sneha", 90),
    (11, "farah", 85), (11, "kabir", 80),
    (10, "aarav", 15), (10, "farah", 12),
    (9, "kabir", 200), (9, "aarav", 180),
    (8, "ishita", 300), (8, "sneha", 290),
    (7, "meera", 400),
    (6, "tara", 500), (6, "arjun", 480),
    (3, "kabir", 700), (3, "sneha", 650),
    (0, "rohan", 1250),
]

# (post index, comment author, minutes ago, content)
COMMENTS = [
    (13, "aarav", 25, "Congratulations! Which track did you compete in?"),
    (13, "ishita", 22, "So proud of the team! Legend behaviour."),
    (11, "ishita", 110, "Using a Trie for the search bar too, right? Prefix "
                        "search is so satisfying."),
    (11, "kabir", 95, "Adjacency lists everywhere. Respect."),
    (12, "vikram", 58, "Node embeddings next? This is the way."),
    (5, "aarav", 630, "Your graph phase is the best phase."),
    (0, "aarav", 1200, "The 500 club! Teach us, sensei."),
]

# (recipient, kind, actor, message, minutes ago)
NOTIFICATIONS = [
    ("aarav", "request_received", "meera",
     "Meera Krishnan sent you a connection request", 45),
    ("aarav", "request_received", "dev",
     "Dev Patel sent you a connection request", 20),
    ("aarav", "post_liked", "ishita", "Ishita Verma liked your post", 100),
    ("aarav", "post_commented", "kabir", "Kabir Khan commented on your post", 95),
    ("meera", "post_liked", "ishita", "Ishita Verma liked your post", 60),
    ("rohan", "post_liked", "aarav", "Aarav Sharma liked your post", 30),
    ("ishita", "request_accepted", "rohan",
     "Rohan Mehta accepted your connection request", 30000),
    ("dev", "request_accepted", "kabir",
     "Kabir Khan accepted your connection request", 2000),
]


def seed_sample_data() -> bool:
    """Insert everything ONLY when the database has no users yet."""
    if db.fetch_all_users():
        return False

    created = _days_ago(45)
    for spec in USERS:
        db.insert_user(User(
            username=spec["username"],
            full_name=spec["full_name"],
            password_hash=hash_password(SAMPLE_PASSWORD),
            programme=spec["programme"],
            year=spec["year"],
            bio=spec["bio"],
            skills=spec["skills"],
            interests=spec["interests"],
            created_at=created,
        ))

    for user_a, user_b, minutes in CONNECTIONS:
        db.insert_connection(user_a, user_b, _minutes_ago(minutes))

    for sender, receiver, minutes in PENDING_REQUESTS:
        db.insert_request(sender, receiver, _minutes_ago(minutes))

    post_ids = []
    for author, minutes, content in POSTS:
        post_ids.append(db.insert_post(author, content, _minutes_ago(minutes)))

    for post_index, liker, minutes in LIKES:
        db.insert_like(post_ids[post_index], liker, _minutes_ago(minutes))

    for post_index, author, minutes, content in COMMENTS:
        db.insert_comment(post_ids[post_index], author, content,
                          _minutes_ago(minutes))

    for recipient, kind, actor, message, minutes in NOTIFICATIONS:
        db.insert_notification(recipient, kind, actor, message,
                               _minutes_ago(minutes))

    return True
