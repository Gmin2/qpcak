---
title: Creating and using API keys
---

# Creating and using API keys

Create an API key under **Settings → Developers → API keys**. Each key is shown only once, so copy it immediately and store it securely.

Authenticate requests by sending the key in the `Authorization: Bearer <key>` header. Keys can be scoped to read-only or read-write, and you can set an expiry date.

Rotate keys regularly. If a key leaks, revoke it from the dashboard; revocation takes effect within a few seconds across all regions.
