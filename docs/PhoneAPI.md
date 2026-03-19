# Phone API (`@PhoneAPI` surface)

This document describes the subset of the `window.phone` API that is explicitly marked with the `@PhoneAPI` tag in the source code.  
Only methods whose JSDoc comments include `@PhoneAPI` are listed here.

---

### Quick Nav

- **[📘 Overview](#-overview)**
- **[🧩 Module Breakdown](#-module-breakdown)**
- **[⚙️ Functions & Methods](#-functions--methods)**
  - [Call control](#call-control)
    - [`phone.Dial(...)`](#phonedial)
    - [`phone.EndCall(...)`](#phoneendcall)
    - [`phone.Answer(...)`](#phoneanswer)
    - [`phone.Decline(sessionId)`](#phonedeclinesessionid)
    - [`phone.Hold(...)`](#phonehold)
    - [`phone.Unhold(...)`](#phoneunhold)
    - [`phone.Mute(...)`](#phonemute)
    - [`phone.Unmute(...)`](#phoneunmute)
    - [`phone.BlindTransfer(...)`](#phoneblindtransfer)
    - [`phone.AttendedTransfer(...)`](#phoneattendedtransfer)
    - [`phone.CompleteTransfer(childSessionId)`](#phonecompletetransferchildsessionid)
    - [`phone.CancelTransfer(childSessionId)`](#phonecanceltransferchildsessionid)
    - [`phone.SendDtmf(sessionId, dtmf)`](#phonesenddtmfsessionid-dtmf)
  - [Buddy management](#buddy-management)
    - [`phone.AddBuddy(buddy)`](#phoneaddbuddybuddy)
    - [`phone.DeleteBuddy(buddy)`](#phonedeletebuddybuddy)
    - [`phone.UpdateBuddy(buddy)`](#phoneupdatebuddybuddy)
  - [Recordings](#recordings)
    - [`phone.SaveRecording(recording)`](#phonesaverecordingrecording)
    - [`phone.GetRecording(recordingId)`](#phonegetrecordingrecordingid)
    - [`phone.PlayRecording(recording)`](#phoneplayrecordingrecording)
  - [Message stream](#message-stream)
    - [`phone.LoadMessage(messageId)`](#phoneloadmessagemessageid)
    - [`phone.FlagMessage(messageId)`](#phoneflagmessagemessageid)
  - [Session events](#session-events)
    - [`phone.OnSessionChange(callback)`](#phoneonsessionchangecallback)
- **[🧭 API Reference](#-api-reference)**
- **[💡 Examples & Usage](#-examples--usage)**
- **[📝 Notes & Edge Cases](#-notes--edge-cases)**

---

<details open>
<summary>📘 Overview</summary>

### 📘 Overview

The Phone API surface exposed on `window.phone` is quite large, but only a subset is explicitly tagged as public and stable using the `@PhoneAPI` marker in JSDoc comments.  
This document only includes that tagged surface.

High‑level groups:

- **Initialization**: `InitPhoneAPI()` attaches the tagged methods to `window.phone`.
- **Call control**: Dial, answer, end, hold, mute, transfer, and DTMF helpers.
- **Buddy management**: Add, delete, and update buddies in `phone.MyBuddies`.
- **Recordings**: Save, retrieve, and play call recordings.
- **Message stream**: Load and flag a stored message by ID.
- **Session events**: Subscribe to session state changes.

</details>

---

<details>
<summary>🧩 Module Breakdown</summary>

### 🧩 Module Breakdown

- **Module**: `InitPhoneAPI` (from `src/PhoneAPI/PhoneAPI.ts`)
  - Attaches all `@PhoneAPI`‑tagged methods as functions on `window.phone`.
  - Uses helpers and callbacks defined elsewhere in the core (for example, providers, buddies, sessions, and storage).
- **Module**: `InitMessageStreamCallbacks` (from `src/MessageStreamCallbacks.ts`)
  - Adds `phone.LoadMessage(messageId)` and `phone.FlagMessage(messageId)` (and other message‑stream helpers).
- **Module**: `InitSessionCallbacks` (from `src/SessionCallbacks.ts`)
  - Adds `phone.OnSessionChange(callback)` to subscribe to `"OnSessionStateChange"`.

All methods documented below live under the global `window.phone` namespace (after `InitPhoneAPI()` runs), except `InitPhoneAPI()` itself which is the initializer.

</details>

---

<details>
<summary>⚙️ Functions & Methods</summary>

### ⚙️ Functions & Methods

#### Initialization

##### `InitPhoneAPI()`

```typescript
InitPhoneAPI(): void
```

Initializes the Phone API by attaching the public (tagged) methods to `window.phone`.

---

#### Call control

##### `phone.Dial`

```typescript
phone.Dial(
  param: string | BuddyObject,
  withVideo?: boolean,
  provider?: string
): Promise<string | undefined>
```

Dials a call to the given target. Works with or without `await`.

- `param`: dial string (e.g. `"*65"`), a `BuddyObject`, or a buddy ID.
- `withVideo`: when `true`, starts a video call. Defaults to `false`.
- `provider`: provider name to use when no buddy is found. Defaults to `"sip"`.

Returns the `sessionId` when awaited (or `undefined` if the underlying call fails or throws).

---

##### `phone.EndCall`

```typescript
phone.EndCall(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

Ends a call. Works with or without `await`.

- `param`:
  - A `sessionId` string – looks up the session via `phone.GetSession`.
  - A `SessionObject` – uses it directly.
  - A `BuddyObject` – finds an active or most recent session on that buddy.

Returns the ended `SessionObject` when awaited (or `undefined` when nothing is ended or provider lookup fails).

---

##### `phone.Answer`

```typescript
phone.Answer(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

Answers an incoming call. Works with or without `await`.

- `param`:
  - A `sessionId` string – finds the session and owning buddy.
  - A `SessionObject` – uses it directly.
  - A `BuddyObject` – finds the first ringing/incoming or inbound session.

Returns the answered `SessionObject` when awaited, or `undefined` if no suitable session is found or the provider is unavailable.

---

##### `phone.Decline(sessionId)`

```typescript
phone.Decline(sessionId: string): Promise<void>
```

Declines an incoming call for a given `sessionId`.

- Looks up the session with `phone.GetSession`.
- If found, forwards to `phone.OnDecline(session)`.

---

##### `phone.Hold`

```typescript
phone.Hold(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

Places a call on hold.

- `param`:
  - `sessionId` string – looks up the session.
  - `SessionObject` – uses it directly.
  - `BuddyObject` – chooses an established or most recent session.

Returns the affected session when awaited or `undefined` if no suitable session is found.

---

##### `phone.Unhold`

```typescript
phone.Unhold(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

Takes a held call off hold.

Resolution rules mirror `phone.Hold`, but for buddies it prefers sessions marked as held (for example with `isOnHold`).

---

##### `phone.Mute`

```typescript
phone.Mute(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

Mutes a call.

Resolution rules are the same as `phone.Hold` (session ID, session object, or buddy).

---

##### `phone.Unmute`

```typescript
phone.Unmute(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

Unmutes a call.

For buddies, prefers sessions currently in a muted state, otherwise the most recent session.

---

##### `phone.BlindTransfer`

```typescript
phone.BlindTransfer(
  param: string | SessionObject | BuddyObject,
  destination: string | BuddyObject
): Promise<void>
```

Immediately transfers the active call to a destination, without consulting the target first.

- `param`: session ID, session object, or buddy with an active session.
- `destination`:
  - A dial string (extension, number, etc.).
  - A buddy ID.
  - A `BuddyObject`.

Resolves source/destination buddies and contacts, then delegates to `phone.OnBlindTransfer`.

---

##### `phone.AttendedTransfer`

```typescript
phone.AttendedTransfer(
  param: string | SessionObject | BuddyObject,
  destination: string | BuddyObject
): Promise<{ session: SessionObject, childSessionId: string } | undefined>
```

Starts a consultative (attended) transfer:

- Places the current call on hold.
- Dials the destination as a new child session.
- After the consult, use:
  - `phone.CompleteTransfer(childSessionId)` to complete the transfer.
  - `phone.CancelTransfer(childSessionId)` to cancel.

Returns the original `session` and the `childSessionId` (if created).

---

##### `phone.CompleteTransfer(childSessionId)`

```typescript
phone.CompleteTransfer(childSessionId: string): Promise<void>
```

Completes a pending attended transfer:

- Looks up the child session.
- Delegates to `phone.OnCompleteTransfer(childSession)`.

---

##### `phone.CancelTransfer(childSessionId)`

```typescript
phone.CancelTransfer(childSessionId: string): Promise<void>
```

Cancels a pending attended transfer and restores the original call:

- Looks up the child session.
- Delegates to `phone.OnCancelAttendedTransfer(childSession)`.

---

##### `phone.SendDtmf(sessionId, dtmf)`

```typescript
phone.SendDtmf(sessionId: string, dtmf: string): boolean | undefined
```

Sends DTMF tones to a given session.

- Looks up the session using `sessionId`.
- Resolves the provider via `phone.GetProvider(session.Provider)`.
- If the provider implements `SendDtmf`, calls it asynchronously.

Returns `true` when a send attempt is initiated, `false` when the provider cannot be resolved, or `undefined` when the session cannot be resolved.

---

#### Buddy management

##### `phone.AddBuddy(buddy)`

```typescript
phone.AddBuddy(buddy: BuddyObject): Promise<void>
```

Adds a new buddy to `phone.MyBuddies` and persists it.

- Normalizes input via `phone.CreateValidBuddy`.
- Prevents duplicate IDs or duplicate `DisplayName` values.
- Updates UI (`UpdateBuddyList`, `UpdateStage`, `UpdateUI`) and calls `SaveBuddy`.

---

##### `phone.DeleteBuddy(buddy)`

```typescript
phone.DeleteBuddy(buddy: BuddyObject): Promise<void>
```

Deletes a buddy from `phone.MyBuddies` and triggers `phone.OnBuddyDeleted(buddy)`.

---

##### `phone.UpdateBuddy(buddy)`

```typescript
phone.UpdateBuddy(buddy: BuddyObject): Promise<void>
```

Updates an existing buddy and then refreshes UI state shortly after the update.

- Delegates to `phone.OnBuddyUpdated(buddy)`.
- After a short timeout, calls `UpdateBuddyList`, `UpdateStage`, and `UpdateUI`.

---

#### Recordings

##### `phone.SaveRecording(recording)`

```typescript
phone.SaveRecording(recording: RecordingObject): Promise<void>
```

Saves a call recording into the `"CallRecordings"` store via `IndexStorage.SaveToStore`.

---

##### `phone.GetRecording(recordingId)`

```typescript
phone.GetRecording(recordingId: string): Promise<RecordingObject | null>
```

Retrieves a recording by ID from `"CallRecordings"`.

- Resolves to the stored `RecordingObject` if present.
- Resolves to `null` on error or when not found.

---

##### `phone.PlayRecording(recording)`

```typescript
phone.PlayRecording(recording: RecordingObject | string): Promise<void>
```

Plays a previously saved recording.

- Accepts either:
  - A `recordingId` string.
  - A `RecordingObject`.
- When given an ID, it first calls `phone.GetRecording(recordingId)`.
- Creates an `Audio` element for the recording’s `Blob`, appends it to the DOM, plays it, and cleans up the element and object URL afterward.

---

#### Message stream

##### `phone.LoadMessage(messageId)`

```typescript
phone.LoadMessage(messageId: string): Promise<MessageStreamItem | null>
```

Loads a single message from the Message Stream by its ID.

- Delegates directly to `phone.IndexStorage.GetFromStore("MessageStream", messageId)`.
- Resolves to the stored message object when found, or `null` when not found.

---

##### `phone.FlagMessage(messageId)`

```typescript
phone.FlagMessage(messageId: string): Promise<void>
```

Flags a message by ID and persists the change.

- Loads the message via `phone.GetMessageStreamItem(messageId)`.
- Sets `message.Flagged = true`.
- Mirrors the flag onto `phone.MyBuddies[*].MessageStreamItems` when present and persists via `phone.SetMessageStreamItem(...)`.

---

#### Session events

##### `phone.OnSessionChange(callback)`

```typescript
phone.OnSessionChange(
  callback: (data: { sessionId: string; state: string; event: any }) => void
): () => void
```

Registers a callback for `"OnSessionStateChange"` events and returns an unsubscribe function.

- The callback receives `{ sessionId, state, event }`.
- Values are read from `event.detail.Data` first, then `event.detail`.

</details>

---

<details>
<summary>🧭 API Reference</summary>

### 🧭 API Reference

| Group            | Method                         | Signature                                                      | Returns                                              |
|------------------|--------------------------------|----------------------------------------------------------------|------------------------------------------------------|
| Initialization    | `InitPhoneAPI`                  | `()`                                                           | `void`                                               |
| Call control     | `Dial`                         | `(param, withVideo?, provider?)`                              | `Promise<string \| undefined>`                      |
| Call control     | `EndCall`                      | `(param)`                                                     | `Promise<SessionObject \| undefined>`               |
| Call control     | `Answer`                       | `(param)`                                                     | `Promise<SessionObject \| undefined>`               |
| Call control     | `Decline`                      | `(sessionId)`                                                 | `Promise<void>`                                     |
| Call control     | `Hold`                         | `(param)`                                                     | `Promise<SessionObject \| undefined>`               |
| Call control     | `Unhold`                       | `(param)`                                                     | `Promise<SessionObject \| undefined>`               |
| Call control     | `Mute`                         | `(param)`                                                     | `Promise<SessionObject \| undefined>`               |
| Call control     | `Unmute`                       | `(param)`                                                     | `Promise<SessionObject \| undefined>`               |
| Call control     | `BlindTransfer`                | `(param, destination)`                                        | `Promise<void>`                                     |
| Call control     | `AttendedTransfer`             | `(param, destination)`                                        | `Promise<{ session: SessionObject, childSessionId: string } \| undefined>` |
| Call control     | `CompleteTransfer`             | `(childSessionId)`                                            | `Promise<void>`                                     |
| Call control     | `CancelTransfer`               | `(childSessionId)`                                            | `Promise<void>`                                     |
| Call control     | `SendDtmf`                     | `(sessionId, dtmf)`                                           | `boolean`                                           |
| Buddy management | `AddBuddy`                     | `(buddy)`                                                     | `Promise<void>`                                     |
| Buddy management | `DeleteBuddy`                  | `(buddy)`                                                     | `Promise<void>`                                     |
| Buddy management | `UpdateBuddy`                  | `(buddy)`                                                     | `Promise<void>`                                     |
| Recordings       | `SaveRecording`                | `(recording)`                                                 | `Promise<void>`                                     |
| Recordings       | `GetRecording`                 | `(recordingId)`                                               | `Promise<RecordingObject \| null>`                  |
| Recordings       | `PlayRecording`                | `(recording)`                                                 | `Promise<void>`                                     |
| Message stream   | `LoadMessage`                  | `(messageId)`                                                 | `Promise<MessageStreamItem \| null>`                |
| Message stream   | `FlagMessage`                  | `(messageId)`                                                 | `Promise<void>`                                     |
| Session events   | `OnSessionChange`              | `(callback)`                                                  | `() => void`                                        |

</details>

---

<details>
<summary>💡 Examples & Usage</summary>

### 💡 Examples & Usage

#### Call control

```javascript
// Dial and await a new call
const sessionId = await phone.Dial("*65");

// Answer an incoming call
await phone.Answer(sessionId);

// Put the call on hold and then resume
await phone.Hold(sessionId);
await phone.Unhold(sessionId);

// Mute/unmute
await phone.Mute(sessionId);
await phone.Unmute(sessionId);

// End the call
await phone.EndCall(sessionId);
```

```javascript
// Blind transfer to an extension
await phone.BlindTransfer(sessionId, "*200");
```

```javascript
// Attended transfer flow
const result = await phone.AttendedTransfer(sessionId, "*200");
if (result && result.childSessionId) {
  // After consulting with the target:
  await phone.CompleteTransfer(result.childSessionId);
}
```

```javascript
// Send DTMF during a call
phone.SendDtmf(sessionId, "123#");
```

#### Buddy management

```javascript
// Add a buddy (BuddyObject must be a valid BuddyObject for your app)
await phone.AddBuddy(buddyObject);

// Later, update or delete (also requires a BuddyObject)
await phone.UpdateBuddy(buddyObject);
await phone.DeleteBuddy(buddyObject);
```

#### Recordings

```javascript
// Save a recording
await phone.SaveRecording(recordingObject);

// Fetch and inspect a recording
const recording = await phone.GetRecording(recordingObject.Id);

// Play a recording by ID
await phone.PlayRecording(recordingObject.Id);
```

#### Message stream

```javascript
// Load a message by ID
const messageId = "message-123";
const message = await phone.LoadMessage(messageId);

if (message) {
  console.log("Loaded message:", message);
}
```

</details>

---

<details>
<summary>📝 Notes & Edge Cases</summary>

### 📝 Notes & Edge Cases

- **Tag‑based surface**: Only methods whose JSDoc contains `@PhoneAPI` are included here. Internal helpers and untagged functions are intentionally omitted.
- **Provider resolution**: Call control methods rely on `phone.GetProvider` and provider‑specific implementations (e.g. `Hangup`, `Answer`, `SendDtmf`). Behavior when providers are missing is handled defensively in the implementation.
- **Buddy‑based resolution**: For many helpers, passing a `BuddyObject` selects either the first active session or the most recent one; callers should ensure buddies and sessions are in a consistent state.
- **Recording playback**: `phone.PlayRecording` relies on `Recording.Blob` being a valid `Blob`; invalid data will cause an error and a toast.
- **Storage backends**: Data access methods (`GetRecording`, `SaveRecording`, `LoadMessage`) are thin wrappers around `IndexStorage`. Callers should avoid depending on storage internals and treat these methods as the stable contract.

</details>

