import requests
import json

BASE_URL = "http://127.0.0.1:4000"

# Try logging in as different therapists
therapists_to_try = [
    {"email": "ishimwe@therapist.com", "password": "Password123!"},
    {"email": "niyo@therapist.com", "password": "Password123!"},
]

for creds in therapists_to_try:
    print(f"\nTrying login as {creds['email']}...")
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Login successful!")
            print(f"  ID: {data.get('id')}")
            print(f"  Name: {data.get('name')}")
            print(f"  Type: {data.get('user_type')}")
            print(f"  Therapist ID: {data.get('therapist_id')}")
        else:
            print(f"✗ Login failed: {response.status_code}")
            print(f"  Error: {response.json()}")
    except Exception as e:
        print(f"✗ Exception: {e}")
