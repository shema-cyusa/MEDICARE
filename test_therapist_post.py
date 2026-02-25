import requests
import json

BASE_URL = "http://127.0.0.1:4000"

# Test as therapist ID 3 (Ishimwe)
therapist_id = 3
content = "This is a test post from therapist ID 3"

print(f"Creating post for therapist ID {therapist_id}...")
try:
    payload = {
        "therapist_id": therapist_id,
        "content": content
    }
    response = requests.post(f"{BASE_URL}/api/therapist-posts", json=payload)
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Post created successfully!")
        print(f"  Post ID: {data.get('id')}")
        print(f"  Content: {data.get('content')}")
        print(f"  Author: {data.get('author_name')}")
        print(f"  Created at: {data.get('created_at')}")
    else:
        print(f"✗ Post creation failed: {response.status_code}")
        print(f"  Error: {response.json()}")
except Exception as e:
    print(f"✗ Exception: {e}")
