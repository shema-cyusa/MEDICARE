import requests
import json

BASE_URL = "http://127.0.0.1:4000"

# Test 1: Create a therapist post
print("=" * 50)
print("TEST 1: Create therapist post")
print("=" * 50)
try:
    payload = {
        "therapist_id": 3,
        "content": "Python test post - should be visible to patients"
    }
    response = requests.post(f"{BASE_URL}/api/therapist-posts", json=payload)
    response.raise_for_status()
    post = response.json()
    print(f"✓ Post created successfully!")
    print(f"  Post ID: {post.get('id')}")
    print(f"  Content: {post.get('content')}")
    print(f"  Author: {post.get('author_name')}")
except Exception as e:
    print(f"✗ Failed: {e}")

# Test 2: Fetch posts for a patient
print("\n" + "=" * 50)
print("TEST 2: Fetch posts for patient")
print("=" * 50)
try:
    response = requests.get(f"{BASE_URL}/api/therapist-posts", params={"user_id": 2})
    response.raise_for_status()
    posts = response.json()
    print(f"✓ Retrieved {len(posts)} posts")
    for post in posts:
        print(f"  - ID {post.get('id')}: {post.get('content')} (by {post.get('author_name')})")
except Exception as e:
    print(f"✗ Failed: {e}")

# Test 3: Fetch posts for a therapist
print("\n" + "=" * 50)
print("TEST 3: Fetch posts for therapist")
print("=" * 50)
try:
    response = requests.get(f"{BASE_URL}/api/therapist-posts", params={"viewer_therapist_id": 3})
    response.raise_for_status()
    posts = response.json()
    print(f"✓ Retrieved {len(posts)} posts")
    for post in posts:
        print(f"  - ID {post.get('id')}: {post.get('content')} (liked: {post.get('liked_by_therapist')})")
except Exception as e:
    print(f"✗ Failed: {e}")

# Test 4: Like a post
print("\n" + "=" * 50)
print("TEST 4: Like a post")
print("=" * 50)
try:
    post_id = 2  # assuming post 2 exists
    payload = {"user_id": 1}
    response = requests.post(f"{BASE_URL}/api/therapist-posts/{post_id}/likes", json=payload)
    if response.status_code == 409:
        print(f"ℹ Post already liked by this user")
    else:
        response.raise_for_status()
        result = response.json()
        print(f"✓ Liked successfully!")
        print(f"  Total likes: {result.get('count')}")
except Exception as e:
    print(f"✗ Failed: {e}")

print("\n" + "=" * 50)
print("All tests completed!")
print("=" * 50)
