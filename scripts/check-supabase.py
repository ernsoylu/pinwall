"""Check the deployed Pinwall security boundary using its public API key."""
import json
import os
import urllib.error
import urllib.request

url = os.environ["VITE_SUPABASE_URL"]
key = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]


def request(path, body=None):
    req = urllib.request.Request(
        url + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as response:
        return response.code, json.load(response)


assert request("/rest/v1/pins?select=id&limit=1")[0] == 200
assert request("/rest/v1/pins?select=edit_token&limit=1")[0] in (401, 403)
assert request("/rest/v1/pin_write_limits?select=*&limit=1")[0] in (401, 403)
body = {"id": "smoke01", "content": "check", "language": "text"}
assert request("/functions/v1/create-pin-cli", body) == (403, {"error": "proxy_required"})
assert request("/functions/v1/create-pin", body) == (400, {"error": "missing_turnstile_token"})
print("Public reads work; edit tokens, rate-limit records, and writes are protected.")
