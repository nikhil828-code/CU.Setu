"""
End-to-end API smoke test for CampusConnect.

Runs against a LIVE service (default http://localhost:5001) and exercises
every REST flow: auth, feed, trie search, recommendations, BFS paths,
requests lifecycle (send/accept/reject/cancel), likes, comments,
profile edit, notifications, logout.

Usage:
    python3 smoke_test.py            # expects the service to be running

NOTE: this script MUTATES data (registers a temporary `smoketest` user).
Afterwards you can restore a pristine demo database by deleting
data/network.db and restarting the service (it re-seeds automatically).
"""
import json
import urllib.request
import urllib.error
import http.cookiejar

BASE = "http://localhost:5001"
GW = "http://localhost:81"

passed = 0
failed = 0


def check(label, cond, detail=""):
    global passed, failed
    mark = "PASS" if cond else "FAIL"
    if cond:
        passed += 1
    else:
        failed += 1
    print(f"[{mark}] {label}  {detail}")


def client(base):
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def call(method, path, payload=None):
        url = base + path
        data = None
        headers = {}
        if payload is not None:
            data = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with opener.open(req, timeout=15) as resp:
                return resp.status, json.loads(resp.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            try:
                body = json.loads(body)
            except Exception:
                pass
            return e.code, body
    return call


def main():
    gw = client(GW)
    s, d = gw("GET", "/api/health?XTransformPort=5001")
    check("gateway XTransformPort routes to Flask", s == 200 and d.get("ok"), str(d)[:70])

    api = client(BASE)
    s, d = api("POST", "/api/auth/login", {"username": "aarav", "password": "pass123"})
    check("login aarav", s == 200 and d.get("user", {}).get("username") == "aarav")

    s, d = api("GET", "/api/feed")
    posts = d.get("posts", [])
    authors = {p["author"]["username"] for p in posts}
    check("feed from connections + self only", s == 200 and len(posts) == 6 and
          authors == {"aarav", "ishita", "rohan", "sneha", "farah", "priya"},
          f"n={len(posts)}")
    times = [p["created_at"] for p in posts]
    check("feed newest-first (heap order)", times == sorted(times, reverse=True))
    check("post has likes/comments fields", all(
        set(p) >= {"id", "author", "content", "created_at", "likes",
                   "liked_by_me", "comments", "is_mine"} for p in posts))

    s, d = api("GET", "/api/search?q=an")
    unames = [r["username"] for r in d.get("results", [])]
    check("trie prefix 'an' -> ananya", "ananya" in unames, str(unames))
    s, d = api("GET", "/api/search?q=shar")
    check("trie name-word 'shar' -> aarav",
          any(r["username"] == "aarav" for r in d.get("results", [])))
    s, d = api("GET", "/api/search?q=zzz")
    check("trie unknown prefix empty", d.get("results") == [])

    s, d = api("GET", "/api/recommendations?limit=8")
    recs = d.get("recommendations", [])
    excluded_ok = all(r["username"] not in
                      {"ishita", "rohan", "sneha", "farah", "priya",
                       "meera", "dev", "vikram"} for r in recs)
    check("recommendations exclude connected/pending", s == 200 and excluded_ok,
          str([r["username"] for r in recs]))
    check("top rec ranked with mutuals+score",
          recs and recs[0]["mutual_count"] >= 1 and recs[0]["score"] > 0,
          f"top={recs[0]['username']} mutuals={recs[0]['mutual_count']} score={recs[0]['score']}")

    s, d = api("GET", "/api/requests")
    check("aarav: 2 received, 1 sent",
          len(d.get("received", [])) == 2 and len(d.get("sent", [])) == 1,
          f"r={len(d.get('received', []))} s={len(d.get('sent', []))}")

    s, d = api("GET", "/api/connections")
    check("aarav degree = 5", len(d.get("connections", [])) == 5)

    s, d = api("GET", "/api/degrees")
    check("degree buckets (BFS levels)", d.get("counts", {}).get("first") == 5,
          str(d.get("counts")))

    s, d = api("GET", "/api/connections/path/vikram")
    check("BFS aarav->vikram = 2 hops", d.get("path") == ["aarav", "rohan", "vikram"],
          str(d.get("path")))
    s, d = api("GET", "/api/connections/path/tara")
    check("BFS aarav->tara = 2 hops via priya", d.get("path") == ["aarav", "priya", "tara"],
          str(d.get("path")))
    s, d = api("GET", "/api/connections/path/dev")
    check("BFS aarav->dev = 3 hops", d.get("distance") == 3, str(d.get("path")))

    s, d = api("GET", "/api/connections/mutual/ishita")
    mutuals = {m["username"] for m in d.get("mutual", [])}
    check("mutual(aarav, ishita) via set intersection", mutuals == {"rohan", "farah"},
          str(mutuals))

    s, d = api("POST", "/api/posts", {"content": "Smoke test post from the API"})
    pid = d.get("post", {}).get("id")
    check("create post", s == 201 and pid is not None)
    s, d = api("POST", f"/api/posts/{pid}/like")
    check("toggle like on", d.get("liked") is True and d.get("likes") == 1, str(d))
    s, d = api("POST", f"/api/posts/{pid}/comments", {"content": "nice"})
    check("add comment", s == 201)
    s, d = api("DELETE", f"/api/posts/{pid}")
    check("delete own post", s == 200 and d.get("deleted") == pid)
    s, d = api("DELETE", f"/api/posts/{pid}")
    check("delete missing post 404", s == 404, str(s))

    s, d = api("GET", "/api/users/meera")
    check("profile relationship pending_in",
          d.get("user", {}).get("relationship") == "pending_in")
    s, d = api("PUT", "/api/profile", {"full_name": "Aarav Sharma",
                                        "programme": "B.Tech CSE", "year": "3rd Year",
                                        "bio": "updated bio",
                                        "skills": ["Python", "Java", "Data Structures", "React", "Flask"],
                                        "interests": ["Web Development", "Open Source", "Hackathons", "Algorithms"]})
    check("edit profile", s == 200 and d.get("user", {}).get("bio") == "updated bio")

    r_api = client(BASE)
    s, d = r_api("POST", "/api/auth/register", {"username": "smoketest", "password": "test123",
                                                "full_name": "Smoke Test", "programme": "B.Tech CSE",
                                                "year": "1st Year", "bio": "temp", "skills": ["Python"],
                                                "interests": ["Testing"]})
    check("register new user", s == 201 and d.get("user", {}).get("username") == "smoketest")
    s, d = r_api("POST", "/api/auth/register", {"username": "smoketest", "password": "x12345",
                                                "full_name": "Dup"})
    check("duplicate username 409", s == 409, str(s))
    s, d = r_api("POST", "/api/auth/login", {"username": "smoketest", "password": "wrong"})
    check("wrong password 401", s == 401, str(s))
    s, d = r_api("POST", "/api/auth/login", {"username": "smoketest", "password": "test123"})
    check("re-login", s == 200)

    s, d = r_api("POST", "/api/requests", {"username": "smoketest"})
    check("self-connect rejected 400", s == 400, str(s))
    s, d = r_api("POST", "/api/requests", {"username": "aarav"})
    check("send request smoketest->aarav", s == 201)
    s, d = r_api("POST", "/api/requests", {"username": "aarav"})
    check("duplicate request 409", s == 409, str(s))

    s, d = r_api("POST", "/api/requests", {"username": "tara"})
    s, d = r_api("GET", "/api/requests")
    tara_req = next((r for r in d["sent"] if r["receiver"]["username"] == "tara"), None)
    check("sent request listed", tara_req is not None)
    s, d = r_api("POST", f"/api/requests/{tara_req['id']}/cancel")
    check("cancel own request", s == 200)

    s, d = api("GET", "/api/requests")
    recv = next((r for r in d["received"] if r["sender"]["username"] == "smoketest"), None)
    check("aarav sees smoketest request", recv is not None)
    s, d = api("POST", f"/api/requests/{recv['id']}/accept")
    check("accept request", s == 200)
    s, d = api("GET", "/api/connections")
    check("smoketest now connected",
          any(c["username"] == "smoketest" for c in d.get("connections", [])))
    s, d = r_api("GET", "/api/users/aarav")
    check("smoketest sees relationship connected",
          d.get("user", {}).get("relationship") == "connected")

    s, d = r_api("DELETE", "/api/connections/aarav")
    check("remove connection", s == 200)
    s, d = api("GET", "/api/connections/path/smoketest")
    check("path to now-isolated user is null",
          d.get("path") is None and d.get("distance") is None, str(d.get("path")))

    p_api = client(BASE)
    s, d = p_api("POST", "/api/auth/login", {"username": "priya", "password": "pass123"})
    check("login priya", s == 200)
    s, d = r_api("POST", "/api/requests", {"username": "priya"})
    s, d = p_api("GET", "/api/requests")
    recv = next((r for r in d["received"] if r["sender"]["username"] == "smoketest"), None)
    check("priya sees smoketest request", recv is not None)
    s, d = p_api("POST", f"/api/requests/{recv['id']}/reject")
    check("reject request", s == 200)
    s, d = r_api("GET", "/api/users/priya")
    check("after reject relationship none",
          d.get("user", {}).get("relationship") == "none")

    s, d = api("GET", "/api/notifications")
    check("notifications + unread count", s == 200 and d.get("unread", 0) >= 1,
          f"unread={d.get('unread')}")
    s, d = api("POST", "/api/notifications/read-all")
    check("mark all read", s == 200)
    s, d = api("GET", "/api/notifications")
    check("unread now 0", d.get("unread") == 0)

    s, d = api("GET", "/api/stats")
    check("stats live from memory", s == 200 and d.get("students") == 15,
          str(d))

    s, d = api("POST", "/api/auth/logout")
    check("logout", s == 200)
    s, d = api("GET", "/api/feed")
    check("feed after logout 401", s == 401, str(s))

    print(f"\nRESULT: {passed} passed, {failed} failed")


if __name__ == "__main__":
    main()
