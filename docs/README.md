# Browser-Phone-Core Master API Reference

Complete API reference for **Browser-Phone-Core**. All functions are accessed via `window.phone`.

---

<a id="navigation"></a>
## 🧭 Navigation

| Section | Description |
|---------|-------------|
| [📘 Overview](#overview) | Architecture, data flow, and source files |
| [🧩 Module Breakdown](#module-breakdown) | Modules and their responsibilities |
| [⚙️ Functions & Methods](#functions-methods) | Full API by category |
| [🧭 API Reference](#api-reference) | Quick-lookup table of all public methods |
| [💡 Examples & Usage](#examples-usage) | Common patterns and code snippets |
| [📦 Types](#types) | TypeScript interfaces and type definitions |
| [🔧 Settings](#settings) | Configuration reference |
| [🚧 TODOs & Notes](#todos-notes) | Unimplemented features and known issues |

---

<a id="overview"></a>
## 📘 Overview

Browser-Phone-Core is a browser-based VoIP library providing call handling, contact management, messaging, and call recording. It's provider-agnostic (SIP, Teams, WebRTC, etc.) and designed to be embedded in web applications or iframes.

<a id="architecture"></a>
### Architecture

```
Provider (SIP, Teams, etc.)
    ↓
CoreCallbacks → SessionCallbacks / BuddyCallbacks
    ↓
RaiseEvent → DOM CustomEvents + postMessage + Webhooks
    ↓
MessageStreamCallbacks → IndexStorage / localStorage
    ↓
Host Application / UI
```

<a id="source-files"></a>
### Source Files

| File | Purpose |
|------|---------|
| [`src/index.ts`](#overview) | Entry point, exports `BrowserPhoneCore` to `window.phone` |
| [`src/Browser-Phone-Core.ts`](#overview) | Main class, `Init()`, `HookUpEvents()`, `LoadDefaultSettings()` |
| [`src/Browser-Phone-Core-Types.ts`](#types) | TypeScript type definitions |
| [`src/PhoneAPI.ts`](#high-level-call-api) | High-level `Dial`, `Answer`, `EndCall`, `SendDtmf` |
| [`src/CoreCallbacks.ts`](#call-control) | Low-level call operations, utility functions |
| [`src/BuddyCallbacks.ts`](#buddy-contact-management) | Buddy CRUD, lookups, storage |
| [`src/BuddyMaintenance.ts`](#buddy-maintenance) | Expiry, deduplication, sanitization |
| [`src/SessionCallbacks.ts`](#session-management) | Session lifecycle, timers, RTP stats |
| [`src/CallkitCallbacks.ts`](#callkit-callbacks) | Call lifecycle hooks (started, connected, ended) |
| [`src/ProviderCallbacks.ts`](#provider-management) | Provider registration and lifecycle |
| [`src/MessageStreamCallbacks.ts`](#message-stream) | Message CRUD, CDR updates |
| [`src/Browser-Phone-Events.ts`](#event-system) | Event types, `RaiseEvent()`, delivery channels |
| [`src/NetworkHandler.ts`](#network) | Online/offline detection |

---

<a id="module-breakdown"></a>
## 🧩 Module Breakdown

<details>
<summary><strong>BrowserPhoneCore</strong> — Main class &amp; initialization</summary>

The core orchestrator. Creates the `window.phone` namespace, hooks up all modules, loads settings and buddies from storage.

- **Class:** `BrowserPhoneCore`
- **Entry:** `window.phone.InitBrowserPhone()` or `new BrowserPhoneCore().Init()`
- **Dependencies:** Requires `LoadFromStorage`, `SaveToStorage`, `IndexStorage`, and `PROFILE_USER_ID` to be set on `window.phone` before calling `Init()`.

</details>

<details>
<summary><strong>PhoneAPI</strong> — High-level call control</summary>

Provides the developer-facing call API: [`Dial`](#dial), [`Answer`](#answer), [`EndCall`](#endcall), [`Decline`](#decline), [`SendDtmf`](#senddtmf), and recording functions. These wrap the low-level callbacks in [`CoreCallbacks`](#call-control) with smart resolution logic.

</details>

<details>
<summary><strong>CoreCallbacks</strong> — Low-level call operations</summary>

Implements the actual call mechanics: `OnAudioCall`, `OnVideoCall`, `OnAnswer`, `OnHangup`, `OnHold`, `OnMute`, transfers, conferencing, and recording triggers. Each function delegates to the appropriate provider.

</details>

<details>
<summary><strong>SessionCallbacks</strong> — Session lifecycle</summary>

Manages session objects in memory: add, update, remove, timers, call state/status, RTP stats (audio levels, jitter, packet loss, MOS), and multi-call hold logic.

</details>

<details>
<summary><strong>BuddyCallbacks</strong> — Contact management</summary>

CRUD operations for buddies (contacts): add, update, delete, select, lookup by ID or contact number. Persists to IndexStorage. Fires events on changes.

</details>

<details>
<summary><strong>BuddyMaintenance</strong> — Data hygiene</summary>

Runs automatically during [`LoadBuddies()`](#loadbuddies). Handles expired buddy cleanup, duplicate merging (by contact number), and malformed data repair.

</details>

<details>
<summary><strong>ProviderCallbacks</strong> — Provider management</summary>

Registers and manages telephony providers (SIP, Teams, etc.). Provides lifecycle callbacks for connection, disconnection, errors, and messaging events.

</details>

<details>
<summary><strong>MessageStreamCallbacks</strong> — Message &amp; CDR storage</summary>

Handles message persistence with dual-write (localStorage + IndexStorage). Builds CDR (Call Detail Record) items and provides load/save/update operations.

</details>

<details>
<summary><strong>Browser-Phone-Events</strong> — Event system</summary>

Defines all event types and the [`RaiseEvent()`](#raiseevent) function. Events are delivered via DOM CustomEvents, postMessage, webhooks, and parent frame forwarding.

</details>

<details>
<summary><strong>NetworkHandler</strong> — Connectivity</summary>

Tracks browser online/offline state. Exposes [`IsOnline()`](#isonline) and sets `phone.Online`.

</details>

---

<a id="functions-methods"></a>
## ⚙️ Functions & Methods

<a id="initialization"></a>
### Initialization

<details>
<a id="initbrowserphone"></a>
<summary><code>InitBrowserPhone()</code></summary>

Initializes the phone core. Must be called after storage and profile are configured.

```js
await window.phone.InitBrowserPhone()
```

**Prerequisites** (must be set before calling):
- `window.phone.LoadFromStorage` — `function(key) => string`
- `window.phone.SaveToStorage` — `function(key, value) => void`
- `window.phone.IndexStorage` — IndexedDB storage instance
- `window.phone.PROFILE_USER_ID` — `string` identifying the current user

**What it does:**
1. Validates storage and profile are set
2. Hooks up all event callbacks
3. Loads Settings from storage (or initializes empty)
4. Loads all Buddies from storage (runs [maintenance](#buddy-maintenance))
5. Clears in-memory Sessions on reload

**Edge cases:**
- Throws `Error("Initialise the Storage first")` if `LoadFromStorage` is not set
- Throws `Error("Profile User ID not found")` if `PROFILE_USER_ID` is not set
- If `MyBuddies` is already initialized, logs a warning but continues

</details>

---

<a id="high-level-call-api"></a>
### High-Level Call API

<details>
<a id="dial"></a>
<summary><code>Dial(param, withVideo?, provider?)</code></summary>

Dials a call. Works with or without `await`.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `param` | `string \| BuddyObject` | required | Dial string, buddy ID, or buddy object |
| `withVideo` | `boolean` | `false` | Video call if `true` |
| `provider` | `string` | `"sip"` | Provider type (only used when no buddy is found) |

**Returns:** `Promise<string | undefined>` — sessionId when awaited

**Resolution logic:**
1. If `param` is a string, check if it matches a buddy ID → uses that buddy's contact
2. If no buddy found, check if it matches a contact number on any existing buddy
3. If still no match, create a temporary buddy with the string as contact number

**Edge cases:**
- If a buddy has `AutoDelete: true`, dialing it sets `AutoDelete` to `false` and re-saves
- Temporary buddies are added to `MyBuddies` so session lookup works
- Returns `undefined` if `param` is an invalid type

```js
phone.Dial("*65")                         // fire & forget
const sessionId = await phone.Dial("*65") // get sessionId
phone.Dial("*65", true)                   // video call
phone.Dial("*65", false, "teams")         // use Teams provider
phone.Dial(buddyObject)                   // dial using buddy's contact provider
phone.Dial("buddy-id-123")               // dial by buddy ID
```

**Source:** [`src/PhoneAPI.ts`](#source-files)

</details>

<details>
<a id="answer"></a>
<summary><code>Answer(param)</code></summary>

Answers an incoming call. Works with or without `await`.

| Param | Type | Description |
|-------|------|-------------|
| `param` | `string \| SessionObject \| BuddyObject` | sessionId, session object, or buddy object |

**Returns:** `Promise<SessionObject | undefined>`

**Resolution logic:**
- String → looks up session by ID
- BuddyObject → finds first `Ringing`/`Incoming`/`inbound` session
- SessionObject → uses directly

**Edge cases:**
- Falls back to default `"sip"` provider if session's provider is not found
- Stops ringback audio before answering

```js
phone.Answer(sessionId)
phone.Answer(sessionObject)
phone.Answer(buddyObject)
const session = await phone.Answer(sessionId)
```

**Source:** [`src/PhoneAPI.ts`](#source-files)

</details>

<details>
<a id="endcall"></a>
<summary><code>EndCall(param)</code></summary>

Ends a call. Automatically determines the correct action based on call state.

| Param | Type | Description |
|-------|------|-------------|
| `param` | `string \| SessionObject \| BuddyObject` | sessionId, session object, or buddy object |

**Returns:** `Promise<SessionObject | undefined>`

**Behavior:**
- `State === "Established"` → **Hangup**
- Inbound & not established → **Decline** (falls back to Reject, then Cancel)
- Outbound & not established → **Cancel**

**Edge cases:**
- Session is removed after a 1-second delay
- Falls back to default `"sip"` provider if not found
- Returns `undefined` if no session or buddy found

```js
phone.EndCall(sessionId)
phone.EndCall(sessionObject)
phone.EndCall(buddyObject)
const session = await phone.EndCall(sessionId)
```

**Source:** [`src/PhoneAPI.ts`](#source-files)

</details>

<details>
<a id="decline"></a>
<summary><code>Decline(sessionId)</code></summary>

Declines an incoming call by session ID. Delegates to [`OnDecline`](#call-control).

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID to decline |

**Returns:** `Promise<void>`

```js
await phone.Decline(sessionId)
```

**Source:** [`src/PhoneAPI.ts`](#source-files)

</details>

<details>
<a id="senddtmf"></a>
<summary><code>SendDtmf(sessionId, dtmf)</code></summary>

Sends DTMF tones to an active session.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID |
| `dtmf` | `string` | DTMF digits (e.g. `"1"`, `"1#"`, `"1*"`) |

**Returns:** `boolean` — `true` if sent, `false` if provider not found

```js
phone.SendDtmf(sessionId, "1")
phone.SendDtmf(sessionId, "123#")
```

**Source:** [`src/PhoneAPI.ts`](#source-files)

</details>

---

<a id="session-management"></a>
### Session Management

<details>
<summary><code>GetSession(sessionId)</code></summary>

Get a session by ID. Searches all buddies' session arrays.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID |

**Returns:** `SessionObject | null`

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>GetActiveSessions()</code></summary>

Returns all active sessions across all buddies.

**Returns:** `SessionObject[]`

```js
const sessions = phone.GetActiveSessions()
console.log("Active calls:", sessions.length)
```

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>AddSession(buddy, session)</code></summary>

Add a session to a buddy's `Sessions` array. Initializes array if needed.

| Param | Type | Description |
|-------|------|-------------|
| `buddy` | `BuddyObject` | The buddy |
| `session` | `SessionObject` | The session to add |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>UpdateSession(session)</code></summary>

Update an existing session by matching its ID. Merges all fields except `Timer`.

| Param | Type | Description |
|-------|------|-------------|
| `session` | `SessionObject` | The session with updated fields |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>RemoveSession(sessionId)</code></summary>

Remove a session by ID from all buddies.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID to remove |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>UpdateCallStatus(sessionId, status)</code></summary>

Update the human-readable status string of a session. Triggers UI refresh.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID |
| `status` | `string` | Status text (e.g. `"Ringing"`, `"Connected"`) |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>UpdateCallState(sessionId, state)</code></summary>

Update the state of a session.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID |
| `state` | `string` | `"Establishing"` \| `"Established"` \| `"Ended"` \| `"Missed"` \| `"Rejected"` |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>StartCallTimer(sessionId)</code> / <code>StopCallTimer(sessionId)</code></summary>

Start or stop a 1-second interval timer on a session. The timer increments `session.Timer` each second.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>UpdateSessionTimer(sessionId, timer)</code></summary>

Manually set the timer value for a session.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID |
| `timer` | `number` | Timer value in seconds |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>AddSessionEvent(sessionId, activity)</code></summary>

Add an event to a session's event log. Deduplicates events within 100ms. Also deduplicates `OnCallAnswered` across the entire log.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID |
| `activity` | `{ Timestamp?, Activity?, Data? }` | The event to add |

**Returns:** `SessionObject | null`

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>PlaceOtherCallsOnHold(sessionId)</code></summary>

Place all other active calls on hold except the given session. Skips sessions already on hold.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session to keep active |

**Returns:** `Promise<void>`

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>CollapseOtherExtendedSessions(sessionId)</code></summary>

Collapse all extended session views to `"basic"` except the given session. Skips sessions with an active attended transfer.

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session to keep extended |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

<details>
<summary><strong>RTP Stats Functions</strong></summary>

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `UpdateSessionSenderAudioLevel(sessionId, audioLevel)` | `string, number` | `SessionObject \| null` | Track sender audio level (clamped 0-100) |
| `UpdateSessionReceiverAudioLevel(sessionId, audioLevel)` | `string, number` | `SessionObject \| null` | Track receiver audio level (clamped 0-100) |
| `UpdateSessionSenderStats(sessionId, stats)` | `string, any` | `SessionObject \| null` | Push sender RTP stats to `session.RtpSenderStats` and `session.Data.RtpSenderStats` |
| `UpdateSessionReceiverStats(sessionId, stats)` | `string, any` | `SessionObject \| null` | Push receiver RTP stats to `session.RtpReceiverStats` and `session.Data.RtpReceiverStats` |
| `UpdateSessionRemoteInboundRtpStreamStats(sessionId, stats)` | `string, any` | `SessionObject \| null` | Push remote inbound RTP stats. Auto-calculates **MOS**, **jitter**, **packet loss**, and **RTT** averages from last 10 samples using E-model (G.107) |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

---

<a id="buddy-contact-management"></a>
### Buddy / Contact Management

<details>
<summary><code>GetBuddyById(buddyId)</code></summary>

Get a buddy by ID. Checks in-memory `MyBuddies` first, then falls back to IndexStorage.

| Param | Type | Description |
|-------|------|-------------|
| `buddyId` | `string` | The buddy ID |

**Returns:** `Promise<BuddyObject | null>`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>GetBuddyByContact(contact)</code></summary>

Get a buddy by contact number. Searches all buddies' `Contacts` arrays. Skips deleted buddies. If found buddy has `AutoDelete: true`, resets it to `false`.

| Param | Type | Description |
|-------|------|-------------|
| `contact` | `string` | The contact number to search for |

**Returns:** `BuddyObject | null`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>GetBuddyWithSession(sessionId)</code></summary>

Get the buddy that owns a given session. Also checks attended transfer relationships (`ParentSessionId`, `AttendedTransferCall`).

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | The session ID |

**Returns:** `BuddyObject | null`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>GetBuddySession(buddy, sessionId)</code></summary>

Get a specific session from a buddy's `Sessions` array.

| Param | Type | Description |
|-------|------|-------------|
| `buddy` | `BuddyObject` | The buddy |
| `sessionId` | `string` | The session ID |

**Returns:** `Promise<SessionObject | null>`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>OnBuddyAdded(buddy)</code></summary>

Add a new buddy. Assigns a new UUID as `Id`, sets `LastActivity`, saves to storage, and raises the [`OnBuddyAdded`](#eventtypes) event.

| Param | Type | Description |
|-------|------|-------------|
| `buddy` | `BuddyObject` | The buddy to add |

**Returns:** `Promise<void>`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>OnBuddyUpdated(buddy)</code></summary>

Update an existing buddy. Sets `Selected: false`, updates `LastActivity`, saves, and raises [`OnBuddyUpdated`](#eventtypes).

| Param | Type | Description |
|-------|------|-------------|
| `buddy` | `BuddyObject` | The buddy to update |

**Returns:** `Promise<void>`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>OnBuddyDeleted(buddy)</code></summary>

Delete a buddy. Uses soft-delete: first call marks `AutoDelete: true`, actual removal happens when buddy expires (see [`isBuddyExpired`](#buddy-maintenance)). Raises [`OnBuddyDeleted`](#eventtypes).

| Param | Type | Description |
|-------|------|-------------|
| `buddy` | `BuddyObject` | The buddy to delete |

**Returns:** `Promise<void>`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>OnBuddySelected(buddy)</code> / <code>OnBuddyDeSelected(buddy)</code></summary>

**OnBuddySelected:** Called when a buddy is selected. Clears the missed call badge (`Missed = 0`), saves, and raises [`OnBuddySelected`](#eventtypes).

**OnBuddyDeSelected:** Called when a buddy is deselected. Clears last selected buddy from storage.

| Param | Type | Description |
|-------|------|-------------|
| `buddy` | `BuddyObject` | The buddy |

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>AddMissedCallBadge(buddy)</code></summary>

Increment the `Missed` counter on a buddy and save.

| Param | Type | Description |
|-------|------|-------------|
| `buddy` | `BuddyObject` | The buddy |

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<a id="updatebuddylastactivity"></a>
<summary><code>UpdateBuddyLastActivity(buddyId)</code></summary>

Update a buddy's `LastActivity` timestamp to now. Accepts either a buddy ID string or a buddy object.

| Param | Type | Description |
|-------|------|-------------|
| `buddyId` | `string \| BuddyObject` | Buddy ID or buddy object |

**Returns:** `Promise<void>`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>SaveBuddy(key, data)</code></summary>

Save a buddy to IndexStorage. Strips `MessageStreamItems`, `Sessions`, and `Selected` before persisting.

| Param | Type | Description |
|-------|------|-------------|
| `key` | `string` | The buddy ID |
| `data` | `BuddyObject` | The buddy data |

**Returns:** `Promise<boolean>`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

<details>
<a id="loadbuddies"></a>
<summary><code>LoadBuddies()</code></summary>

Load all buddies from IndexStorage. Automatically runs the [maintenance pipeline](#buddy-maintenance): `handleAutoDeleteBuddies` → `handleDuplicateBuddies` → `sanitizeMalformedBuddies`. Loads messages for each buddy.

**Returns:** `Promise<BuddyObject[]>`

**Source:** [`src/BuddyCallbacks.ts`](#source-files)

</details>

---

<a id="provider-management"></a>
### Provider Management

<details>
<summary><code>AddProvider(provider)</code></summary>

Register a provider in `Settings.Providers`. Skips if already registered (matched by `TypeStr`).

| Param | Type | Description |
|-------|------|-------------|
| `provider` | `object` | Provider object with `TypeStr` property |

**Source:** [`src/ProviderCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>GetProvider(provider)</code></summary>

Get a registered provider by type. Accepts a string (`"sip"`) or object (`{ Type: "sip" }`). Defaults to `"sip"`.

| Param | Type | Description |
|-------|------|-------------|
| `provider` | `string \| object` | Provider type string or object with `.Type` |

**Returns:** `ProviderObject | null`

**Source:** [`src/ProviderCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>GetProviders()</code></summary>

Get all registered providers from `Settings.Providers`.

**Returns:** `ProviderObject[]`

**Source:** [`src/ProviderCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>ConnectProvider(providerName)</code></summary>

Calls `Connect()` on a registered provider.

| Param | Type | Description |
|-------|------|-------------|
| `providerName` | `string` | The provider type string |

**Source:** [`src/ProviderCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>UpdateProviderStatus(providerType, status)</code> / <code>UpdateProviderState(providerType, state, errorMessage?)</code></summary>

**UpdateProviderStatus:** Updates the `Status` field of a provider (e.g. `"Connected"`, `"Registered"`).

**UpdateProviderState:** Updates the `State` field with optional `ErrorMessage`.

| Param | Type | Description |
|-------|------|-------------|
| `providerType` | `string` | The provider type string |
| `status` / `state` | `string` | New value |
| `errorMessage` | `string?` | Optional error message (state only) |

**Source:** [`src/ProviderCallbacks.ts`](#source-files)

</details>

<details>
<summary><strong>Provider Lifecycle Callbacks</strong></summary>

| Function | Description |
|----------|-------------|
| `ProviderConnected(data?)` | Called when a provider connects. Posts message to parent. |
| `ProviderDisconnected(data?)` | Called when a provider disconnects. |
| `ProviderError(data?)` | Called on provider error. Shows toast notification. |
| `ProviderMessage(data?)` | Called when a provider sends a message. |
| `ProviderMessageReceived(data?)` | Called when a message is received from provider. |
| `ProviderMessageSent(data?)` | Called when a message is successfully sent. |
| `ProviderMessageDelivered(data?)` | Called when a message delivery is confirmed. |
| `ProviderMessageRead(data?)` | Called when a message read receipt is received. |

**Source:** [`src/ProviderCallbacks.ts`](#source-files)

</details>

---

<a id="message-stream"></a>
### Message Stream

<details>
<summary><code>AddMessage(buddy, message)</code></summary>

Add a message to a buddy's message stream. Dual-writes to localStorage (`SavedMessages`) and IndexStorage (`MessageStream`). If IndexStorage write succeeds, removes from localStorage to avoid duplication. Updates buddy's `LastActivity`.

| Param | Type | Description |
|-------|------|-------------|
| `buddy` | `BuddyObject` | The buddy |
| `message` | `MessageStreamItem` | The message object |

**Returns:** `Promise<void>`

**Edge cases:**
- If IndexStorage save fails, message stays in localStorage as fallback
- Calls `OnMessageAdded` callback if registered

**Source:** [`src/MessageStreamCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>BuildMessageStreamItem(message)</code></summary>

Convert a raw message into a normalized `MessageStreamItem`. For CDR messages, generates a body string like `"Outbound call 0 seconds answered"`.

| Param | Type | Description |
|-------|------|-------------|
| `message` | `object` | Raw message object |

**Returns:** `MessageStreamItem`

**Source:** [`src/MessageStreamCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>LoadMessage(messageId)</code> / <code>GetMessageStreamItem(messageId)</code></summary>

**LoadMessage:** Load a single message from IndexStorage.

**GetMessageStreamItem:** Load and return a deep copy with all data from IndexStorage. Returns `null` if `messageId` is falsy.

| Param | Type | Description |
|-------|------|-------------|
| `messageId` | `string` | The message ID |

**Returns:** `Promise<MessageStreamItem>` / `Promise<MessageStreamItem | null>`

**Source:** [`src/MessageStreamCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>SetMessageStreamItem(message)</code></summary>

Update an existing message in IndexStorage. Merges new fields into the existing record. Also updates the buddy's last activity via [`UpdateBuddyLastActivity`](#updatebuddylastactivity).

| Param | Type | Description |
|-------|------|-------------|
| `message` | `object` | Message object (must have `Id`) |

**Returns:** `Promise<void>`

**Source:** [`src/MessageStreamCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>SaveMessage(key, data)</code></summary>

Save a message to both localStorage and IndexStorage.

| Param | Type | Description |
|-------|------|-------------|
| `key` | `string` | The message ID |
| `data` | `object` | The message data |

**Returns:** `Promise<string>` — the message ID, or `null` on error

**Source:** [`src/MessageStreamCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>LoadBuddyMessages(buddyId)</code></summary>

Load all messages for a buddy from IndexStorage using the `BuddyId` index. Also checks localStorage fallback for any messages that failed IndexStorage save.

| Param | Type | Description |
|-------|------|-------------|
| `buddyId` | `string` | The buddy ID |

**Returns:** `Promise<MessageStreamItem[]>`

**Source:** [`src/MessageStreamCallbacks.ts`](#source-files)

</details>

<details>
<summary><code>UpdateCallDetailRecord(buddyId, message)</code></summary>

Update an existing CDR message. Loads from storage, merges changed fields, deletes old record, and re-saves.

| Param | Type | Description |
|-------|------|-------------|
| `buddyId` | `string` | The buddy ID |
| `message` | `object` | CDR message with updated fields |

**Returns:** `Promise<MessageStreamItem>`

**Source:** [`src/MessageStreamCallbacks.ts`](#source-files)

</details>

---

<a id="recordings"></a>
### Recordings

<details>
<summary><code>SaveRecording(recording)</code></summary>

Save a recording to IndexStorage under the `"CallRecordings"` store.

| Param | Type | Description |
|-------|------|-------------|
| `recording` | `RecordingObject` | The recording (must have `.Id`) |

**Returns:** `Promise<void>`

**Source:** [`src/PhoneAPI.ts`](#source-files)

</details>

<details>
<a id="getrecording"></a>
<summary><code>GetRecording(recordingId)</code></summary>

Retrieve a recording from IndexStorage.

| Param | Type | Description |
|-------|------|-------------|
| `recordingId` | `string` | The recording ID |

**Returns:** `Promise<RecordingObject | null>`

**Source:** [`src/PhoneAPI.ts`](#source-files)

</details>

<details>
<summary><code>PlayRecording(recording)</code></summary>

Play a recording through an `<audio>` element appended to the DOM. Auto-cleans up after playback ends.

| Param | Type | Description |
|-------|------|-------------|
| `recording` | `RecordingObject \| string` | Recording object or recording ID |

**Returns:** `Promise<void>`

**Edge cases:**
- If `recording` is a string, loads it via [`GetRecording`](#getrecording)
- Validates that `Recording.Blob` is a valid `Blob` instance
- Shows toast on error

**Source:** [`src/PhoneAPI.ts`](#source-files)

</details>

---

<a id="call-control"></a>
### Call Control

> These are used internally by the [High-Level Call API](#high-level-call-api). You typically use `Dial`, `Answer`, and `EndCall` instead.

<details>
<summary><strong>Call Control Functions</strong></summary>

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `OnAudioCall(contact, buddy, existingSession?)` | contact object, buddy, optional session | `Promise<void>` | Initiate audio call. Creates session, resolves devices, delegates to provider's `AudioCall()` |
| `OnVideoCall(contact, buddy)` | contact object, buddy | `Promise<void>` | Initiate video call. Checks `provider.SupportsVideo` before calling `VideoCall()` |
| `OnAnswer(session, buddy)` | session, buddy | `Promise<void>` | Answer via provider's `Answer()` |
| `OnDecline(session, buddy)` | session, buddy | `Promise<void>` | Decline via provider's `Decline()`. Removes session after 1s. |
| `OnCancel(session, buddy)` | session, buddy | `Promise<void>` | Cancel outgoing call via provider's `Cancel()` |
| `OnHangup(session, buddy)` | session, buddy | `Promise<void>` | Hangup established call via provider's `Hangup()` |
| `OnHold(session, buddy)` | session, buddy | `Promise<void>` | Place call on hold. Sets `isOnHold: true`. Adds activity log. |
| `OnUnhold(session, buddy)` | session, buddy | `Promise<void>` | Resume held call. Sets `isOnHold: false`. |
| `OnMute(session, buddy)` | session, buddy | `Promise<void>` | Mute audio via provider's `Mute()` |
| `OnUnmute(session, buddy)` | session, buddy | `Promise<void>` | Unmute audio via provider's `UnMute()` |
| `OnSendDtmf(dtmf, session)` | dtmf string, session | `Promise<void>` | Send DTMF via provider's `SendDtmf()` |
| `OnStartRecording(session)` | session | `Promise<void>` | Start call recording via `RecordSession()` |
| `OnStopRecording(session)` | session | `Promise<void>` | Stop call recording via `StopRecordingSession()` |

**Source:** [`src/CoreCallbacks.ts`](#source-files)

</details>

---

<a id="transfer-conference"></a>
### Transfer & Conference

<details>
<summary><strong>Transfer & Conference Functions</strong></summary>

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `OnAttendedTransfer(currentBuddy, session, buddy, contact)` | currentBuddy, session, buddy, contact | `Promise<void>` | Start attended (warm) transfer. Creates a child session linked via `ParentSessionId`. |
| `OnCancelAttendedTransfer(childSession)` | childSession | `Promise<void>` | Cancel attended transfer. Clears parent's `AttendedTransferCall`. |
| `OnCompleteTransfer(childSession)` | childSession | `Promise<void>` | Complete attended transfer via provider's `CompleteTransfer()` |
| `OnHangupAttendedTransfer(childSession)` | childSession | `Promise<void>` | Hangup the attended transfer leg |
| `OnBlindTransfer(currentBuddy, session, buddy, contact)` | currentBuddy, session, buddy, contact | `Promise<void>` | Blind (cold) transfer via provider's `BlindTransfer()` |
| `OnConference(currentBuddy, session, buddy, contact)` | currentBuddy, session, buddy, contact | `Promise<void>` | Start conference via provider's `Conference()` |
| `OnJoinConference(session)` | session | `Promise<void>` | Join conference via provider's `JoinConference()` |
| `OnHangupConference(session)` | session | `Promise<void>` | Leave conference via provider's `HangupConference()` |

**Source:** [`src/CoreCallbacks.ts`](#source-files)

</details>

---

<a id="callkit-callbacks"></a>
### Callkit Callbacks

<details>
<summary><strong>Callkit Callback Functions</strong></summary>

| Function | Parameters | Description |
|----------|-----------|-------------|
| `OnCallStarted(data?)` | `data?` | Called when a call starts. Posts `"OnCallStarted"` message to parent window. |
| `OnCallConnected(sessionId)` | `sessionId: string` | Called when a call connects. If `Settings.RecordAllCalls` is `true`, auto-starts recording. |
| `OnCallEnded(sessionId)` | `sessionId: string` | Called when a call ends. Posts `"OnCallEnded"` message and removes the session. |
| `OnCallOutgoing(data?)` | `data?` | Called for outgoing call. 🚧 *TODO: Not yet implemented.* |
| `OnCallMissed(data?)` | `data?` | Called for missed call. 🚧 *TODO: Not yet implemented.* |
| `GetCallCount(sessionId?)` | `sessionId?: string` | Returns count of active calls excluding the given sessionId. |

**Source:** [`src/CallkitCallbacks.ts`](#source-files)

</details>

---

<a id="event-system"></a>
### Event System

<details>
<a id="raiseevent"></a>
<summary><code>RaiseEvent(message)</code></summary>

Raise an event through all delivery channels:

1. **Webhooks** — calls `window.phone.Webhooks[eventName](message)` if registered
2. **DOM CustomEvent** — dispatches on current `window`
3. **Parent CustomEvent** — dispatches on `window.parent` (if in iframe)
4. **postMessage (same origin)** — sends JSON to current window
5. **postMessage (parent)** — sends JSON to parent with `*` origin

| Param | Type | Description |
|-------|------|-------------|
| `message` | `{ Event: string, Data?: any, Timestamp?: string, ... }` | Event payload. `Timestamp` is auto-set if missing. |

**Source:** [`src/Browser-Phone-Events.ts`](#source-files)

</details>

<details>
<a id="eventtypes"></a>
<summary><strong>EventTypes</strong> (<code>phone.EventTypes</code>)</summary>

High-level events raised by the core library. Use these to listen for state changes.

| Constant | Event Name | Fired When |
|----------|-----------|------------|
| `OnMessage` | `"OnMessage"` | Generic message event |
| `OnMessageStreamItemAdded` | `"OnMessageStreamItemAdded"` | Message added to stream |
| `OnMessageStreamItemUpdated` | `"OnMessageStreamItemUpdated"` | Message updated |
| `OnMessageStreamItemDeleted` | `"OnMessageStreamItemDeleted"` | Message deleted |
| `OnBuddySelected` | `"OnBuddySelected"` | Buddy selected |
| `OnBuddyAdded` | `"OnBuddyAdded"` | New buddy added |
| `OnBuddyUpdated` | `"OnBuddyUpdated"` | Buddy updated |
| `OnBuddyDeleted` | `"OnBuddyDeleted"` | Buddy deleted |
| `OnSessionStarted` | `"OnSessionStarted"` | Session started |
| `OnSessionEnded` | `"OnSessionEnded"` | Session ended |
| `OnSessionTimerUpdated` | `"OnSessionTimerUpdated"` | Session timer tick |
| `OnRecordingStarted` | `"OnRecordingStarted"` | Recording started |
| `OnRecordingEnded` | `"OnRecordingEnded"` | Recording ended |
| `OnSessionStateChange` | `"OnSessionStateChange"` | Session state changed |

**Source:** [`src/Browser-Phone-Events.ts`](#source-files)

</details>

<details>
<a id="sessioneventtypes"></a>
<summary><strong>SessionEventTypes</strong> (<code>phone.SessionEventTypes</code>)</summary>

Granular session lifecycle events used internally by providers.

| Event | Description |
|-------|-------------|
| `OnCallAnswered` | Call was answered |
| `SessionStarted` / `SessionEnded` | Session lifecycle |
| `SessionTimerUpdated` | Timer tick |
| `SessionStatusUpdated` / `SessionStateUpdated` | Status/state changed |
| `SessionRemoved` / `SessionAdded` / `SessionUpdated` | Session CRUD |
| `SessionSelected` / `SessionDeselected` | Session selection |
| `SessionHold` / `SessionUnhold` / `SessionMute` | In-call actions |
| `TransportMessageOutbound` / `TransportMessageInbound` | SIP transport messages |
| `CreateUserAgent` / `UserAgentCreated` | SIP user agent lifecycle |
| `TransportConnected` | Transport connected |
| `SendingRegistration` / `RegistrationSent` / `RegistrationFailed` / `RegistrationSuccess` / `RegistrationTimedOut` / `RegistrationCancelled` / `RegistrationError` | SIP registration lifecycle |
| `SessionDescriptionHandlerCreated` | SDP handler created |
| `SessionReceivedBye` | Received BYE |
| `CallDeclinedByDoNotDisturb` | Call declined by DND |
| `InviteSent` / `InviteReceived` / `InviteAccepted` / `InviteRejected` / `InviteTimedOut` / `InviteCancelled` / `InviteError` | SIP INVITE lifecycle |
| `OnInviteSent` / `OnInviteAccepted` / `OnInviteRejected` / `OnInviteTimedOut` / `OnInviteCancelled` / `OnInviteError` | INVITE callback variants |
| `OnTrackAdded` | Media track added |
| `RegistererStateChange` | Registerer state changed |
| `IceCandidate` / `IceConnectionStateChange` | ICE lifecycle |
| `OnIncomingCall` / `ReceivedCallInvite` | Incoming call detected |
| `MadeAudioCall` / `MadeVideoCall` | Outbound call initiated |
| `CallStarted` / `CallEnded` / `CallMissed` / `CallOutgoing` / `CallIncoming` | Call lifecycle |
| `CallHold` / `CallUnhold` / `CallMute` / `CallUnmute` | In-call state changes |
| `CallAttendedTransfer` / `CallCompleteTransfer` / `CallHangupAttendedTransfer` / `CallCancelAttendedTransfer` | Transfer lifecycle |

**Source:** [`src/SessionCallbacks.ts`](#source-files)

</details>

---

<a id="utility-functions"></a>
### Utility Functions

<details>
<summary><strong>Utility Functions</strong></summary>

| Function | Returns | Description |
|----------|---------|-------------|
| `UID()` | `string` | Generate a UUID v4 |
| `TimeNow()` | `string` | Current time as ISO 8601 string |
| `RandomAvatar()` | `string` | Random avatar URL from `Settings.AvailableAvatar` |
| `SaveSettings()` | `void` | Save `phone.Settings` to storage. Strips `Providers` before persisting. |

**Source:** [`src/CoreCallbacks.ts`](#source-files)

</details>

---

<a id="network"></a>
### Network

<details>
<a id="isonline"></a>
<summary><code>IsOnline()</code></summary>

Returns the current network status.

**Returns:** `boolean`

Automatically tracks browser `online`/`offline` events and updates `phone.Online`.

**Source:** [`src/NetworkHandler.ts`](#source-files)

</details>

---

<a id="buddy-maintenance"></a>
### Buddy Maintenance

> Exported from `BuddyMaintenance.ts`. Run automatically during [`LoadBuddies()`](#loadbuddies).

<details>
<summary><strong>Maintenance Functions</strong></summary>

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `isBuddyExpired(buddy, now?)` | buddy, optional timestamp | `boolean` | Check if buddy exceeds `MaxBuddyAge` (default: 30 days) |
| `mergeBuddyMessages(sourceBuddyId, targetBuddyId)` | source ID, target ID | `Promise<number>` | Merge all messages from one buddy to another by rewriting `BuddyId`. Returns count merged. |
| `handleAutoDeleteBuddies(buddies)` | buddy array | `Promise<BuddyObject[]>` | Remove buddies marked `AutoDelete` that have expired. Deletes from IndexStorage. |
| `handleDuplicateBuddies(buddies)` | buddy array | `Promise<BuddyObject[]>` | Detect duplicates by contact number, merge messages into the most recent, soft-delete the older. |
| `sanitizeMalformedBuddies(buddies)` | buddy array | `Promise<BuddyObject[]>` | Fix missing `Id` (assigns UUID), delete buddies with empty `DisplayName`, initialize empty `Contacts`. |

**Source:** [`src/BuddyMaintenance.ts`](#source-files)

</details>

---

<a id="api-reference"></a>
## 🧭 API Reference

Quick-lookup table of all public methods on `window.phone`.

<details>
<summary><strong>Click to expand full API reference</strong></summary>

| Method | Returns | Category |
|--------|---------|----------|
| `InitBrowserPhone()` | `Promise<void>` | [Initialization](#initialization) |
| `Dial(param, withVideo?, provider?)` | `Promise<string \| undefined>` | [Call API](#high-level-call-api) |
| `Answer(param)` | `Promise<SessionObject \| undefined>` | [Call API](#high-level-call-api) |
| `EndCall(param)` | `Promise<SessionObject \| undefined>` | [Call API](#high-level-call-api) |
| `Decline(sessionId)` | `Promise<void>` | [Call API](#high-level-call-api) |
| `SendDtmf(sessionId, dtmf)` | `boolean` | [Call API](#high-level-call-api) |
| `GetSession(sessionId)` | `SessionObject \| null` | [Sessions](#session-management) |
| `GetActiveSessions()` | `SessionObject[]` | [Sessions](#session-management) |
| `AddSession(buddy, session)` | `void` | [Sessions](#session-management) |
| `UpdateSession(session)` | `void` | [Sessions](#session-management) |
| `RemoveSession(sessionId)` | `void` | [Sessions](#session-management) |
| `UpdateCallStatus(sessionId, status)` | `void` | [Sessions](#session-management) |
| `UpdateCallState(sessionId, state)` | `void` | [Sessions](#session-management) |
| `StartCallTimer(sessionId)` | `void` | [Sessions](#session-management) |
| `StopCallTimer(sessionId)` | `void` | [Sessions](#session-management) |
| `UpdateSessionTimer(sessionId, timer)` | `void` | [Sessions](#session-management) |
| `AddSessionEvent(sessionId, activity)` | `SessionObject \| null` | [Sessions](#session-management) |
| `PlaceOtherCallsOnHold(sessionId)` | `Promise<void>` | [Sessions](#session-management) |
| `CollapseOtherExtendedSessions(sessionId)` | `void` | [Sessions](#session-management) |
| `UpdateSessionSenderAudioLevel(sessionId, level)` | `SessionObject \| null` | [Sessions](#session-management) |
| `UpdateSessionReceiverAudioLevel(sessionId, level)` | `SessionObject \| null` | [Sessions](#session-management) |
| `UpdateSessionSenderStats(sessionId, stats)` | `SessionObject \| null` | [Sessions](#session-management) |
| `UpdateSessionReceiverStats(sessionId, stats)` | `SessionObject \| null` | [Sessions](#session-management) |
| `UpdateSessionRemoteInboundRtpStreamStats(sessionId, stats)` | `SessionObject \| null` | [Sessions](#session-management) |
| `GetBuddyById(buddyId)` | `Promise<BuddyObject \| null>` | [Buddies](#buddy-contact-management) |
| `GetBuddyByContact(contact)` | `BuddyObject \| null` | [Buddies](#buddy-contact-management) |
| `GetBuddyWithSession(sessionId)` | `BuddyObject \| null` | [Buddies](#buddy-contact-management) |
| `GetBuddySession(buddy, sessionId)` | `Promise<SessionObject \| null>` | [Buddies](#buddy-contact-management) |
| `OnBuddyAdded(buddy)` | `Promise<void>` | [Buddies](#buddy-contact-management) |
| `OnBuddyUpdated(buddy)` | `Promise<void>` | [Buddies](#buddy-contact-management) |
| `OnBuddyDeleted(buddy)` | `Promise<void>` | [Buddies](#buddy-contact-management) |
| `OnBuddySelected(buddy)` | `void` | [Buddies](#buddy-contact-management) |
| `OnBuddyDeSelected(buddy)` | `Promise<void>` | [Buddies](#buddy-contact-management) |
| `AddMissedCallBadge(buddy)` | `void` | [Buddies](#buddy-contact-management) |
| `UpdateBuddyLastActivity(buddyId)` | `Promise<void>` | [Buddies](#buddy-contact-management) |
| `SaveBuddy(key, data)` | `Promise<boolean>` | [Buddies](#buddy-contact-management) |
| `LoadBuddies()` | `Promise<BuddyObject[]>` | [Buddies](#buddy-contact-management) |
| `AddProvider(provider)` | `void` | [Providers](#provider-management) |
| `GetProvider(provider)` | `ProviderObject \| null` | [Providers](#provider-management) |
| `GetProviders()` | `ProviderObject[]` | [Providers](#provider-management) |
| `ConnectProvider(providerName)` | `void` | [Providers](#provider-management) |
| `UpdateProviderStatus(type, status)` | `void` | [Providers](#provider-management) |
| `UpdateProviderState(type, state, error?)` | `void` | [Providers](#provider-management) |
| `AddMessage(buddy, message)` | `Promise<void>` | [Messages](#message-stream) |
| `BuildMessageStreamItem(message)` | `MessageStreamItem` | [Messages](#message-stream) |
| `LoadMessage(messageId)` | `Promise<MessageStreamItem>` | [Messages](#message-stream) |
| `GetMessageStreamItem(messageId)` | `Promise<MessageStreamItem \| null>` | [Messages](#message-stream) |
| `SetMessageStreamItem(message)` | `Promise<void>` | [Messages](#message-stream) |
| `SaveMessage(key, data)` | `Promise<string>` | [Messages](#message-stream) |
| `LoadBuddyMessages(buddyId)` | `Promise<MessageStreamItem[]>` | [Messages](#message-stream) |
| `UpdateCallDetailRecord(buddyId, message)` | `Promise<MessageStreamItem>` | [Messages](#message-stream) |
| `SaveRecording(recording)` | `Promise<void>` | [Recordings](#recordings) |
| `GetRecording(recordingId)` | `Promise<RecordingObject \| null>` | [Recordings](#recordings) |
| `PlayRecording(recording)` | `Promise<void>` | [Recordings](#recordings) |
| `RaiseEvent(message)` | `void` | [Events](#event-system) |
| `UID()` | `string` | [Utility](#utility-functions) |
| `TimeNow()` | `string` | [Utility](#utility-functions) |
| `RandomAvatar()` | `string` | [Utility](#utility-functions) |
| `SaveSettings()` | `void` | [Utility](#utility-functions) |
| `IsOnline()` | `boolean` | [Network](#network) |
| `GetCallCount(sessionId?)` | `number` | [Callkit](#callkit-callbacks) |

</details>

---

<a id="examples-usage"></a>
## 💡 Examples & Usage

<details>
<summary><strong>Basic Setup &amp; Initialization</strong></summary>

```js
// 1. Configure storage (must be done before init)
window.phone.PROFILE_USER_ID = "user-123";
window.phone.LoadFromStorage = (key) => localStorage.getItem(key);
window.phone.SaveToStorage = (key, value) => localStorage.setItem(key, value);
window.phone.IndexStorage = myIndexDBInstance;

// 2. Initialize
await window.phone.InitBrowserPhone();
```

</details>

<details>
<summary><strong>Making &amp; Managing Calls</strong></summary>

```js
// Dial a number
const sessionId = await phone.Dial("*65");

// Dial with video
phone.Dial("*65", true);

// Dial using a specific provider
phone.Dial("*65", false, "teams");

// Answer an incoming call
window.addEventListener("OnSessionStateChange", async (event) => {
    const data = event.detail.Data;
    if (data.State === "Ringing") {
        await phone.Answer(data.SessionId);
    }
});

// End a call
await phone.EndCall(sessionId);

// Send DTMF during a call
phone.SendDtmf(sessionId, "1234#");

// Check active calls
const sessions = phone.GetActiveSessions();
console.log("Active calls:", sessions.length);
```

</details>

<details>
<summary><strong>Listening to Events</strong></summary>

```js
// Using EventTypes constant (recommended)
window.addEventListener(phone.EventTypes.OnBuddyAdded, (event) => {
    console.log("Buddy added:", event.detail.Data);
});

// Listening to session state changes
window.addEventListener("OnSessionStateChange", (event) => {
    const session = phone.GetSession(event.detail.Data.SessionId);
    console.log("Session:", session?.DisplayName, "-", event.detail.Data.State);
});

// Using webhooks
phone.Webhooks.OnSessionEnded = (message) => {
    console.log("Call ended:", message.Data);
};

// Listen for multiple events
const events = [
    phone.EventTypes.OnSessionStarted,
    phone.EventTypes.OnSessionEnded
];
events.forEach(eventType => {
    window.addEventListener(eventType, (event) => {
        console.log(`${eventType}:`, event.detail);
    });
});

// Removing a listener
const handler = (event) => console.log(event.detail);
window.addEventListener("OnBuddyAdded", handler);
window.removeEventListener("OnBuddyAdded", handler);
```

</details>

<details>
<summary><strong>Working with Buddies</strong></summary>

```js
// Add a new buddy
await phone.OnBuddyAdded({
    DisplayName: "John Doe",
    Contacts: [{ Number: "+15551234567", Provider: "sip" }]
});

// Find buddy by contact number
const buddy = phone.GetBuddyByContact("+15551234567");

// Find buddy by ID
const buddy = await phone.GetBuddyById("buddy-uuid-here");

// Update a buddy
buddy.DisplayName = "Jane Doe";
await phone.OnBuddyUpdated(buddy);

// Delete a buddy (soft delete)
await phone.OnBuddyDeleted(buddy);
```

</details>

<details>
<summary><strong>Working with Recordings</strong></summary>

```js
// Auto-record all calls
phone.Settings.RecordAllCalls = true;

// Manually start/stop recording
await phone.OnStartRecording(session);
await phone.OnStopRecording(session);

// Retrieve and play a recording
const recording = await phone.GetRecording("recording-id");
await phone.PlayRecording(recording);

// Or play by ID directly
await phone.PlayRecording("recording-id");
```

</details>

<details>
<summary><strong>Provider Registration</strong></summary>

```js
// Register a provider
phone.AddProvider(mySipProvider);

// Connect a provider
phone.ConnectProvider("sip");

// Check provider status
const provider = phone.GetProvider("sip");
console.log("Status:", provider?.Status);

// List all providers
const providers = phone.GetProviders();
```

</details>

---

<a id="types"></a>
## 📦 Types

<details>
<summary><strong>BuddyObject</strong></summary>

```ts
interface BuddyObject {
    Id: string;
    DisplayName: string;
    Contacts: { Number: string; Provider: string; }[];
    Sessions: SessionObject[];           // In-memory only, not persisted
    MessageStreamItems: MessageStreamItem[];
    LastActivity: string;                // ISO 8601
    Missed: number;
    AutoDelete: boolean;
    isDeleted: boolean;
    Selected: boolean;                   // Not persisted
    IsTemporary: boolean;
    [key: string]: any;
}
```

</details>

<details>
<summary><strong>SessionObject</strong></summary>

```ts
interface SessionObject {
    Id: string;
    DisplayName: string;
    DisplayNumber: string;
    Direction: "inbound" | "outbound";
    State: "Establishing" | "Established" | "Ended" | "Missed" | "Rejected";
    Status: string;
    Timer: number;                       // Seconds since call start
    WithVideo: boolean;
    Provider: string;
    BuddyId: string;
    View: "basic" | "extended";
    StartTime: string;                   // ISO 8601
    AudioInputDevice: string;
    AudioOutputDevice: string;
    VideoInputDevice: string;
    isOnHold: boolean;
    isOnMute: boolean;
    Flagged: boolean;
    Comments: any[];
    Recording: any[];
    Reactions: any[];
    Events: any[];
    ProfileUserId: string;
    AttendedTransferCall: string | null;  // Child session ID for attended transfer
    ParentSessionId: string;              // Parent session ID (for transfer child)
    RtpSenderLevel: number;              // 0-100
    RtpReceiverLevel: number;            // 0-100
    RtpSenderStats: any[];
    RtpReceiverStats: any[];
    RtpRemoteInboundStats: any[];
    [key: string]: any;
}
```

</details>

<details>
<summary><strong>MessageStreamItem</strong></summary>

```ts
interface MessageStreamItem {
    Id: string;
    BuddyId: string;
    Type: string;
    Direction: "inbound" | "outbound";
    Date: string;                        // ISO 8601
    Body: string;
    Tags: string[];
    Options: any[];
    Reactions: any[];
    Recordings: any[];
    Comments: any[];
    Flagged: boolean;
    [key: string]: any;
}
```

</details>

<details>
<summary><strong>CDRMessageItem</strong></summary>

Extends `MessageStreamItem` with call-specific fields:

```ts
type CDRMessageItem = MessageStreamItem & {
    Type: "CDR";
    Events?: any[];
    Disposition: string;
    Duration: number;
    Provider?: { Type: string; Description: string; };
    PeerConnection?: any;
    ProfileUserId?: string;
    Network?: string;
    Recordings?: any[];
    StartTime?: Date;
    AnswerTime?: Date;
    EndTime?: Date;
    FromName?: string;
    FromNumber?: string;
    ToName?: string;
    ToNumber?: string;
    TermindatedBy?: string;
}
```

</details>

<details>
<summary><strong>RecordingObject</strong></summary>

```ts
interface RecordingObject {
    Id: string;
    SessionId: string;
    Blob?: Blob;                         // Audio blob for playback
    [key: string]: any;
}
```

</details>

---

<a id="global-state"></a>
## 🌐 Global State

Properties on `window.phone`:

| Property | Type | Description |
|----------|------|-------------|
| `Settings` | `object` | User configuration (see [Settings](#settings)) |
| `MyBuddies` | `BuddyObject[]` | All active buddies in memory |
| `SelectedBuddy` | `BuddyObject \| null` | Currently selected buddy |
| `SelectedBuddyId` | `string \| null` | ID of selected buddy |
| `PROFILE_USER_ID` | `string` | Current user ID (set before init) |
| `Online` | `boolean` | Network status (auto-tracked) |
| `IndexStorage` | `object` | IndexedDB storage instance (set before init) |
| `EventTypes` | `object` | Event type constants |
| `SessionEventTypes` | `object` | Session event type constants |
| `Lang` | `object` | Language strings |
| `Webhooks` | `object` | Event webhook callback functions |
| `MyAudioinputDevices` | `MediaDeviceInfo[]` | Available audio input devices |
| `MySpeakerDevices` | `MediaDeviceInfo[]` | Available audio output devices |

---

<a id="settings"></a>
## 🔧 Settings

Stored as `Settings-{PROFILE_USER_ID}` in storage. `Providers` are stripped before saving.

<details>
<summary><strong>Persisted Settings</strong></summary>

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `MaxDidLength` | `number` | `16` | Max DID/number length |
| `EnableAlphanumericDial` | `boolean` | `false` | Allow alphanumeric dialing |
| `UiMaxWidth` | `number` | `9999999` | Max UI width in pixels |
| `DisplayDateFormat` | `string` | `"YYYY-MM-DD"` | Date display format |
| `DisplayTimeFormat` | `string` | `"h:mm:ss A"` | Time display format |
| `BuddyAutoDeleteAtEnd` | `boolean` | `false` | Auto-delete buddies at session end |
| `HideAutoDeleteBuddies` | `boolean` | `true` | Hide soft-deleted buddies from UI |
| `BuddySortBy` | `string` | `"activity"` | `"alphabetical"` or `"activity"` |
| `VideoResampleSize` | `string` | `"SD"` | Video resample size |
| `Avatar` | `string` | default avatar | User avatar (stored as base64 on save) |
| `WallpaperLight` | `string` | default | Light theme wallpaper (stored as base64) |
| `WallpaperDark` | `string` | default | Dark theme wallpaper (stored as base64) |
| `LoadAlternateLang` | `boolean` | `true` | Enable alternate language loading |
| `Language` | `string` | `"auto"` | Language code or `"auto"` for browser default |
| `AvailableLang` | `string[]` | `["fr","ja","zh-hans",...]` | Supported language codes |

</details>

<details>
<summary><strong>Runtime-Only Settings</strong></summary>

These settings are not persisted to storage and must be set each session.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `RecordAllCalls` | `boolean` | unset | If `true`, auto-start recording when call connects |
| `MaxBuddyAge` | `number` | `2592000000` (30 days ms) | Buddy retention threshold for auto-delete |
| `AudioSrcId` | `string` | `"default"` | Selected audio input device ID |
| `AudioOutputId` | `string` | `"default"` | Selected audio output device ID |
| `VideoSrcId` | `string` | `"default"` | Selected video input device ID |
| `Providers` | `array` | `[]` | Registered providers (cleared on save) |

</details>

---

