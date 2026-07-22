# Roundtable

Group chat rooms you join by code, where you can pull AI models into the
conversation and jump on a voice call together. Built on the
[DeepSpace SDK](https://deep.space).

**Live app:** https://roundtable.app.space

## What it does
- Start a room and share a code; participants join, chat in real time, and react to messages with emoji.
- Invite an AI into the thread — pick a Claude model (Sonnet, Opus, or Haiku) and it replies inline as the discussion unfolds.
- See who's currently in the room with live presence, and drop into a group voice call.
- Host controls to remove participants and clear the room; paid plans unlock more.

## How it's built
Rooms, messages, and reactions are collections in a `RecordRoom` Durable Object,
so every message and emoji syncs live. Live participant presence is handled by
`usePresenceRoom` over a `PresenceRoom`. AI replies stream in through the
DeepSpace integrations proxy to the model the user selected, and the group voice
call is a LiveKit room whose access token is minted by the SDK (user-billed)
with the WebRTC audio handled client-side. Plans are Stripe-synced subscriptions
with one-time products available via `useCheckout`.

## Run your own

Deploy your own copy in three commands:

```sh
npm install
npx deepspace login     # one-time, opens a browser tab
npx deepspace deploy    # -> <name>.app.space
```

Auth, the database, real-time sync, and hosting all come from DeepSpace, so
there is nothing else to configure. Your subdomain is the `name` field in
`wrangler.toml`; change it for your own deployment.

Or build something new: apps like this are made by handing a prompt to a
coding agent — start at [deep.space/get-started](https://deep.space/get-started),
or scaffold from scratch: `npm create deepspace@latest my-app`.

---
*Roundtable was built end-to-end by an AI agent on the DeepSpace SDK.
DeepSpace is laying the foundation for rebuilding the Internet in an AI-native
way — [deep.space](https://deep.space) · [docs](https://docs.deep.space).*
