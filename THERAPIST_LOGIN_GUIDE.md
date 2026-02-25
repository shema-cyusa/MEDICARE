# Therapist Login Credentials

## Working Therapist Accounts

### Account 1: Ishimwe
- **Email**: ishimwe@therapist.com
- **Password**: Password123!
- **Therapist ID**: 3

### Account 2: Nema/Niyo  
- **Email**: niyo@therapist.com
- **Password**: (needs to be set - uncomment below)

## How to Set/Reset Therapist Passwords

Run this command from the server/scripts directory:

```bash
node set_password.cjs therapist <email> <newPassword>
```

Example:
```bash
node set_password.cjs therapist niyo@therapist.com Password123!
```

## What Was the Problem?

1. The therapist accounts (Diana, Nema, Ishimwe, vava) existed in the database
2. But they had **no password set** (password_hash and password_salt were NULL)
3. Without a password, therapists couldn't log in
4. Without logging in, the therapist dashboard couldn't work
5. We set the password for Ishimwe to "Password123!" and now it works!

## Next Steps

1. Log in using the credentials above
2. You should now be able to:
   - Create posts in the therapist dashboard
   - See your posts in your feed
   - Patients will see your posts in their dashboard
   - Like and comment on posts
