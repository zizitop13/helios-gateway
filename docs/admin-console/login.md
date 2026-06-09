---
title: Admin Console Login
---

# Admin Console Login

The login page is the entry point for the protected admin console.

![Admin console login page](./screenshots/login.png)

## Route

```text
/admin/console/login
```

## Purpose

Use this page to sign in with a Firebase admin email and password. Successful login stores an ID token in the browser session and redirects to the admin dashboard.

## Controls

- `Email`: Firebase user email.
- `Password`: Firebase user password.
- `Login`: submits the credentials. The button is disabled until both fields contain values.

## Error State

If Firebase rejects the credentials, the page shows a `Login failed` alert with the authentication error message.
