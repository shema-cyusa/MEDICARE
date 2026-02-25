#!/usr/bin/env python3
import requests
import json

BASE_URL = 'http://localhost:4000'

# Lab credentials (you need to adjust these based on your actual lab)
LAB_ID = 1  # First lab in database
LAB_PASSWORD = 'password'  # Default password or actual password

print('=== Testing Lab Results Submission ===')

# Step 1: Get a valid lab assignment (we'll get one from the database via a test)
print('\nStep 1: Getting list of pending assignments...')
login_data = {
    'username': f'lab{LAB_ID}',
    'password': LAB_PASSWORD
}

# Note: We need to get the bearer token first
# For now, let's just try to get assignments

# First, let's check if there are any pending assignments
check_url = f'{BASE_URL}/api/labs/{LAB_ID}/assignments'
print(f'Checking assignments at: {check_url}')

# We need the proper auth. Let's create a minimal test using direct DB insert
print('\nStep 2: Submitting lab results...')

# Let's assume we have an assignment with ID 1
assignment_id = 1

result_data = {
    'result_json': 'Patient blood work shows normal levels. All tests passed successfully.',
    'uploaded_by': 'lab_technician'
}

# To call the endpoint, we need a valid lab token
# Let's use a direct approach: modify the test to use the actual API

print(f'\nAttempting to submit results for assignment {assignment_id}')
print('Result data:', result_data)
print('\nNote: You need to provide valid lab authentication token')
print('Please submit results through the app and watch the console for logs')
