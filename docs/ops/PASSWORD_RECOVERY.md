# Password Recovery

SnackFlow owner password recovery is a maintainer-only operation. It is not exposed through a public API endpoint and it does not run during app startup.

## Owner Lockout

Use `backend/scripts/reset_owner_password.py` when the owner/admin cannot log in and no logged-in owner can reset the password from the Users page.

Only the system maintainer with approved production database access should run it. Never share the temporary password in public chat, commit messages, tickets, or logs.

Required environment variables:

```bash
DATABASE_URL='postgresql://...'
RESET_OWNER_USERNAME='owner-username'
RESET_OWNER_PASSWORD='new-temporary-password'
```

Run from the backend directory:

```bash
cd backend
source .venv/bin/activate
DATABASE_URL='postgresql://...' \
RESET_OWNER_USERNAME='owner-username' \
RESET_OWNER_PASSWORD='new-temporary-password' \
python scripts/reset_owner_password.py
```

The script:

- Requires `DATABASE_URL`, `RESET_OWNER_USERNAME`, and `RESET_OWNER_PASSWORD`.
- Refuses demo passwords such as `admin123` and `booker123`.
- Updates only the selected existing `OWNER` account by default.
- Does not print the password.
- Writes an audit log entry without storing the password or password hash.
- Does not create users and does not modify stock, sales, ledger, or payment data.

If an approved maintenance case requires resetting a non-owner user directly, set:

```bash
ALLOW_NON_OWNER_RESET=true
```

Prefer using the app Users page for non-owner password resets whenever an owner can log in.

## After Reset

1. Give the temporary password to the owner through a private channel only.
2. The owner should log in and immediately change it in Settings.
3. Remove the temporary password from shell history or any password manager note used only for transfer.
4. Confirm that no password was pasted into Git, deployment logs, or support chat.

## Owner Resetting User Passwords

Logged-in owners can reset order booker passwords from the Users page. Leave the password field blank to keep the existing password. Enter a new password only when a reset is intended.
