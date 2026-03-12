# PhoneAPI

This document describes the public Phone API exposed by `InitPhoneAPI` in `src/PhoneAPI.ts`. The module registers high-level call control and recording methods on `window.phone`, providing a unified interface for dialing, answering, ending calls, sending DTMF, and managing call recordings.

---

## Quick Nav

- [📘 Overview](#-overview)
- [🧩 Module Breakdown](#-module-breakdown)
- [⚙️ Call Actions](#️-call-actions)
  - [Dial](#dial)
  - [EndCall](#endcall)
  - [Answer](#answer)
  - [Decline](#decline)
  - [SendDtmf](#senddtmf)
- [🎛️ In-Call Controls](#️-in-call-controls)
  - [Hold](#hold)
  - [Unhold](#unhold)
  - [Mute](#mute)
  - [Unmute](#unmute)
  - [BlindTransfer](#blindtransfer)
  - [AttendedTransfer](#attendedtransfer)
  - [CompleteTransfer](#completetransfer)
  - [CancelTransfer](#canceltransfer)
- [👤 Buddy Management](#-buddy-management)
  - [AddBuddy](#addbuddy)
  - [DeleteBuddy](#deletebuddy)
  - [UpdateBuddy](#updatebuddy)
- [📼 Recording API](#-recording-api)
  - [SaveRecording](#saverecording)
  - [GetRecording](#getrecording)
  - [PlayRecording](#playrecording)
- [🧭 API Reference](#-api-reference)
- [🔗 Dependencies](#-dependencies)
- [💡 Examples & Usage](#-examples--usage)
- [📝 Notes & Edge Cases](#-notes--edge-cases)

---

## 📘 Overview

`InitPhoneAPI` attaches the following methods to `window.phone`:

| Category | Methods |
|----------|---------|
| **Call control** | `Dial`, `Answer`, `EndCall`, `Decline` |
| **In-call** | `Hold`, `Unhold`, `Mute`, `Unmute`, `BlindTransfer`, `AttendedTransfer`, `CompleteTransfer`, `CancelTransfer`, `SendDtmf` |
| **Buddy management** | `AddBuddy`, `DeleteBuddy`, `UpdateBuddy` |
| **Recordings** | `SaveRecording`, `GetRecording`, `PlayRecording` |

All call methods accept flexible parameter types (string ID, session object, buddy object) and work with or without `await`. They delegate to provider-specific implementations via `phone.GetProvider()` and to internal callbacks such as `OnAudioCall`, `OnVideoCall`, and `OnDecline`.

---

## 🧩 Module Breakdown

- **Initialization**: `InitPhoneAPI()` is invoked during `BrowserPhoneCore.HookUpEvents()` after other callbacks (Core, Buddy, Session, Provider, etc.) are registered.
- **Provider integration**: Call actions use `phone.GetProvider(session.Provider)` to obtain the active provider and call its methods (`Answer`, `Decline`, `Cancel`, `Hangup`, `SendDtmf`).
- **Session resolution**: Methods resolve sessions via `phone.GetSession()`, `phone.GetBuddyWithSession()`, or from buddy/session objects passed as arguments.
- **Recording storage**: Recordings are persisted via `phone.IndexStorage.SaveToStore("CallRecordings", ...)` and retrieved with `GetFromStore`.

---

## ⚙️ Call Actions

<details>
<summary><h3 id="dial">📤 phone.Dial(param, withVideo?, provider?)</h3></summary>

Initiates an outbound call. Works with or without `await`.

**Signature**

```typescript
phone.Dial(
  param: string | BuddyObject,
  withVideo?: boolean,
  provider?: string
): Promise<string | undefined>
```

**Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `param` | `string` \| `BuddyObject` | — | Dial string (e.g. `"*65"`), buddy ID, or BuddyObject |
| `withVideo` | `boolean` | `false` | Enable video call |
| `provider` | `string` | `"sip"` | Provider to use when no buddy is found (e.g. `"sip"`, `"teams"`) |

**Returns**

- `Promise<string | undefined>` — Session ID when awaited, or `undefined` on error.

**Resolution logic (when `param` is a string)**

1. **Buddy ID**: If `GetBuddyById(param)` returns a buddy with contacts, use that buddy and its contact’s provider.
2. **Contact number**: If `GetBuddyByContact(param)` finds a buddy, use that buddy and the matching contact.
3. **Dial string**: Otherwise treat as a dial string and create a temporary buddy with the given `provider`.

**Examples**

```javascript
phone.Dial("*65")                           // Fire and forget
const sessionId = await phone.Dial("*65")   // Get session ID
phone.Dial("*65", true)                     // Video call
phone.Dial("*65", false, "teams")           // Use Teams provider
phone.Dial(buddyObject)                     // Use buddy's contact provider
phone.Dial(buddyId)                         // Use buddy ID (uses contact's provider)
```

**Related**

- `OnAudioCall`, `OnVideoCall` (CoreCallbacks)
- `GetBuddyById`, `GetBuddyByContact` (BuddyCallbacks)
- `GetSession` (SessionCallbacks)

</details>

<details>
<summary><h3 id="endcall">🔴 phone.EndCall(param)</h3></summary>

Ends, cancels, or declines a call depending on session state and direction.

**Signature**

```typescript
phone.EndCall(param: string | SessionObject | BuddyObject): Promise<any>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `string` \| `SessionObject` \| `BuddyObject` | Session ID, session object, or buddy object |

**Returns**

- `Promise<any>` — The ended session when awaited, or `undefined` on error.

**Behavior**

- **Established call**: Calls provider `Hangup(session)`.
- **Inbound (not answered)**: Calls provider `Decline` or `Reject`, or `Cancel` as fallback.
- **Outbound (not answered)**: Calls provider `Cancel(session)`.

After the provider call, the session is removed and UI is updated after a 1-second delay.

**Examples**

```javascript
phone.EndCall(sessionId)                     // By session ID
phone.EndCall(sessionObject)                // By session object
phone.EndCall(buddyObject)                  // Active call for buddy
const session = await phone.EndCall(sessionId)  // Get ended session
```

**Related**

- `StopRingback`, `RemoveSession`, `UpdateStage`, `UpdateBuddyList`
- Provider: `Hangup`, `Decline`, `Reject`, `Cancel`

</details>

<details>
<summary><h3 id="answer">📥 phone.Answer(param)</h3></summary>

Answers an incoming call.

**Signature**

```typescript
phone.Answer(param: string | SessionObject | BuddyObject): Promise<any>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `string` \| `SessionObject` \| `BuddyObject` | Session ID, session object, or buddy object |

**Returns**

- `Promise<any>` — The answered session when awaited, or `undefined` on error.

**Behavior**

- Resolves session from ID, session object, or buddy (first ringing/incoming session).
- Stops ringback if playing.
- Sets session state to `"Establishing"` and status to `"Connecting"`.
- Calls provider `Answer(session)`.

**Examples**

```javascript
phone.Answer(sessionId)                     // By session ID
phone.Answer(sessionObject)                 // By session object
phone.Answer(buddyObject)                   // Incoming call for buddy
const session = await phone.Answer(sessionId)  // Get answered session
```

**Related**

- `StopRingback`, `GetProvider`, `UpdateStage`
- Provider: `Answer`

</details>

<details>
<summary><h3 id="decline">🚫 phone.Decline(sessionId)</h3></summary>

Declines an incoming call by session ID.

**Signature**

```typescript
phone.Decline(sessionId: string): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | ID of the session to decline |

**Returns**

- `Promise<void>` — Resolves when done (or when session not found; errors are logged).

**Behavior**

- Looks up session via `GetSession(sessionId)`.
- If found, calls `phone.OnDecline(session)`.
- If session not found or on error, logs and resolves without throwing.

**Examples**

```javascript
phone.Decline(sessionId)
await phone.Decline(sessionId)
```

**Related**

- `OnDecline` (CoreCallbacks)
- `GetSession` (SessionCallbacks)

</details>

<details>
<summary><h3 id="senddtmf">🔢 phone.SendDtmf(sessionId, dtmf)</h3></summary>

Sends DTMF digits to an active session.

**Signature**

```typescript
phone.SendDtmf(sessionId: string, dtmf: string): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | ID of the session |
| `dtmf` | `string` | DTMF string (e.g. `"1"`, `"1#"`, `"1*"`) |

**Returns**

- `Promise<void>` — Resolves when done; logs and resolves if session/provider not found.

**Behavior**

- Resolves session via `GetSession(sessionId)`.
- Gets provider via `GetProvider(session.Provider)`.
- If provider has `SendDtmf`, calls `provider.SendDtmf(dtmf, session)`.

**Examples**

```javascript
phone.SendDtmf(sessionId, "1")
phone.SendDtmf(sessionId, "1#")


var sessionId = await phone.Dial("123");
phone.SendDtmf(sessionId, "1");

phone.Dial("123");
var sessions = phone.GetActiveSessions();

phone.SendDtmf(sessions[0].Id, "1");

```

**Related**

- Provider: `SendDtmf(dtmf, session)`
- `GetSession`, `GetProvider`

</details>

---

## 🎛️ In-Call Controls

<details>
<summary><h3 id="hold">⏸️ phone.Hold(param)</h3></summary>

Places an active call on hold.

**Signature**

```typescript
phone.Hold(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `string` \| `SessionObject` \| `BuddyObject` | Session ID, session object, or buddy object |

**Returns**

- `Promise<SessionObject | undefined>` — The session, or `undefined` on failure.

**Behavior**

- Resolves the session from the param.
- When a `BuddyObject` is passed, targets the first `Established` session (falls back to the last session).
- Resolves the owning buddy via `GetBuddyWithSession`, then calls `OnHold(session, buddy)`.
- `OnHold` calls `provider.Hold(session)`, sets `session.isOnHold = true`, and triggers `OnCallHold`.

**Examples**

```javascript
phone.Hold(sessionId)
phone.Hold(sessionObject)
phone.Hold(buddyObject)
const session = await phone.Hold(sessionId)
```

**Related**

- `OnHold` (CoreCallbacks)
- `GetBuddyWithSession`, `GetSession`

</details>

<details>
<summary><h3 id="unhold">▶️ phone.Unhold(param)</h3></summary>

Takes a call off hold.

**Signature**

```typescript
phone.Unhold(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `string` \| `SessionObject` \| `BuddyObject` | Session ID, session object, or buddy object |

**Returns**

- `Promise<SessionObject | undefined>` — The session, or `undefined` on failure.

**Behavior**

- When a `BuddyObject` is passed, targets the first session where `isOnHold` is true (falls back to the last session).
- Calls `OnUnhold(session, buddy)`, which calls `provider.Unhold(session)`, sets `session.isOnHold = false`, and triggers `OnCallUnhold`.

**Examples**

```javascript
phone.Unhold(sessionId)
phone.Unhold(buddyObject)
```

**Related**

- `OnUnhold` (CoreCallbacks)

</details>

<details>
<summary><h3 id="mute">🔇 phone.Mute(param)</h3></summary>

Mutes the microphone for an active call.

**Signature**

```typescript
phone.Mute(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `string` \| `SessionObject` \| `BuddyObject` | Session ID, session object, or buddy object |

**Returns**

- `Promise<SessionObject | undefined>` — The session, or `undefined` on failure.

**Behavior**

- Resolves session, then calls `OnMute(session, buddy)`.
- `OnMute` calls `provider.Mute(session)` and updates `session.isOnMute = true`.

**Examples**

```javascript
phone.Mute(sessionId)
phone.Mute(buddyObject)
```

**Related**

- `OnMute` (CoreCallbacks)

</details>

<details>
<summary><h3 id="unmute">🔊 phone.Unmute(param)</h3></summary>

Unmutes the microphone for an active call.

**Signature**

```typescript
phone.Unmute(param: string | SessionObject | BuddyObject): Promise<SessionObject | undefined>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `string` \| `SessionObject` \| `BuddyObject` | Session ID, session object, or buddy object |

**Returns**

- `Promise<SessionObject | undefined>` — The session, or `undefined` on failure.

**Behavior**

- When a `BuddyObject` is passed, targets the first session where `isOnMute` is true.
- Calls `OnUnmute(session, buddy)`, which calls `provider.UnMute(session)` and sets `session.isOnMute = false`.

**Examples**

```javascript
phone.Unmute(sessionId)
phone.Unmute(buddyObject)
```

**Related**

- `OnUnmute` (CoreCallbacks)

</details>

<details>
<summary><h3 id="blindtransfer">➡️ phone.BlindTransfer(param, destination)</h3></summary>

Immediately transfers a call to the destination without consultation.

**Signature**

```typescript
phone.BlindTransfer(
  param: string | SessionObject | BuddyObject,
  destination: string | BuddyObject
): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `string` \| `SessionObject` \| `BuddyObject` | The session to transfer |
| `destination` | `string` \| `BuddyObject` | Transfer target: dial string, buddy ID, or `BuddyObject` |

**Returns**

- `Promise<void>`

**Destination resolution (when `destination` is a string)**

1. Looks up as buddy ID via `GetBuddyById`
2. Looks up as contact number via `GetBuddyByContact`
3. Creates a minimal `ContactObject` stub using the session's current provider

**Behavior**

- Resolves `currentBuddy` from the source session via `GetBuddyWithSession`.
- Calls `OnBlindTransfer(currentBuddy, session, destBuddy, destContact)`.
- The provider handles the SIP REFER immediately; no consultation leg is created.

**Examples**

```javascript
phone.BlindTransfer(sessionId, "*200")
phone.BlindTransfer(sessionId, buddyObject)
await phone.BlindTransfer(sessionId, "*200")
```

**Related**

- `OnBlindTransfer` (CoreCallbacks)
- Provider: `BlindTransfer(currentBuddy, session, buddy, contact)`

</details>

<details>
<summary><h3 id="attendedtransfer">🔀 phone.AttendedTransfer(param, destination)</h3></summary>

Initiates a consultative (attended) transfer. Dials the destination while keeping the original call on hold. After consulting, call `CompleteTransfer` to connect the parties or `CancelTransfer` to restore the original call.

**Signature**

```typescript
phone.AttendedTransfer(
  param: string | SessionObject | BuddyObject,
  destination: string | BuddyObject
): Promise<{ session: SessionObject, childSessionId: string } | undefined>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `param` | `string` \| `SessionObject` \| `BuddyObject` | The session to transfer |
| `destination` | `string` \| `BuddyObject` | Transfer target: dial string, buddy ID, or `BuddyObject` |

**Returns**

- `Promise<{ session: SessionObject, childSessionId: string } | undefined>`
  - `session` — the original session
  - `childSessionId` — ID of the new outbound leg to the destination; pass to `CompleteTransfer` or `CancelTransfer`

**Behavior**

- Resolves destination using the same logic as `BlindTransfer`.
- Calls `OnAttendedTransfer(currentBuddy, session, destBuddy, destContact)`, which creates a child `SessionObject` and dials the destination.
- `session.AttendedTransferCall` is set to the child session ID by the internal handler.

**Examples**

```javascript
// Initiate
const { childSessionId } = await phone.AttendedTransfer(sessionId, "*200");

// After consulting with *200...
await phone.CompleteTransfer(childSessionId);   // bridge the call
// or
await phone.CancelTransfer(childSessionId);     // abort, restore original
```

**Related**

- `OnAttendedTransfer`, `OnCompleteTransfer`, `OnCancelAttendedTransfer` (CoreCallbacks)
- `CompleteTransfer`, `CancelTransfer` (PhoneAPI)

</details>

<details>
<summary><h3 id="completetransfer">✅ phone.CompleteTransfer(childSessionId)</h3></summary>

Completes a pending attended transfer, connecting the original caller to the destination.

**Signature**

```typescript
phone.CompleteTransfer(childSessionId: string): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `childSessionId` | `string` | Child session ID returned by `AttendedTransfer` |

**Returns**

- `Promise<void>`

**Behavior**

- Resolves the child session via `GetSession(childSessionId)`.
- Calls `OnCompleteTransfer(childSession)`, which sends the REFER to bridge the original caller to the destination.

**Example**

```javascript
await phone.CompleteTransfer(childSessionId)
```

**Related**

- `OnCompleteTransfer` (CoreCallbacks)
- `AttendedTransfer`, `CancelTransfer` (PhoneAPI)

</details>

<details>
<summary><h3 id="canceltransfer">❌ phone.CancelTransfer(childSessionId)</h3></summary>

Cancels a pending attended transfer and restores the original call.

**Signature**

```typescript
phone.CancelTransfer(childSessionId: string): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `childSessionId` | `string` | Child session ID returned by `AttendedTransfer` |

**Returns**

- `Promise<void>`

**Behavior**

- Resolves the child session via `GetSession(childSessionId)`.
- Calls `OnCancelAttendedTransfer(childSession)`, which cancels the outbound leg and clears `session.AttendedTransferCall` on the parent session.

**Example**

```javascript
await phone.CancelTransfer(childSessionId)
```

**Related**

- `OnCancelAttendedTransfer` (CoreCallbacks)
- `AttendedTransfer`, `CompleteTransfer` (PhoneAPI)

</details>

---

## 👤 Buddy Management

<details>
<summary><h3 id="addbuddy">➕ phone.AddBuddy(buddy)</h3></summary>

Adds a buddy to the active buddy list, persists it to storage, and refreshes the UI.

**Signature**

```typescript
phone.AddBuddy(buddy: BuddyObject): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `buddy` | `BuddyObject` | The buddy to add (must have a unique `Id`) |

**Returns**

- `Promise<void>`

**Behavior**

- No-ops silently if a buddy with the same `Id` already exists in `MyBuddies`.
- Pushes the buddy to `phone.MyBuddies`, then calls `UpdateBuddyList`, `UpdateStage`, `UpdateUI`, and `SaveBuddy` in sequence.
- Errors are caught and logged; the method does not throw.

**Example**

```javascript
const buddy = {
  Id: phone.UID(),
  DisplayName: "Alice",
  DisplayNumber: "100",
  Contacts: [{ Number: "100", Provider: "sip" }],
  Sessions: []
};
await phone.AddBuddy(buddy);
```

**Related**

- `SaveBuddy`, `UpdateBuddyList`, `UpdateStage`, `UpdateUI`

</details>

<details>
<summary><h3 id="deletebuddy">🗑️ phone.DeleteBuddy(buddy)</h3></summary>

Removes a buddy from the active buddy list and triggers the deletion lifecycle callback.

**Signature**

```typescript
phone.DeleteBuddy(buddy: BuddyObject): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `buddy` | `BuddyObject` | The buddy to remove (matched by `Id`) |

**Returns**

- `Promise<void>`

**Behavior**

- Filters the buddy from `phone.MyBuddies` by `Id`.
- Calls `phone.OnBuddyDeleted(buddy)` which handles storage cleanup and UI updates.
- Errors are caught and logged; the method does not throw.

**Example**

```javascript
await phone.DeleteBuddy(buddyObject);
```

**Related**

- `OnBuddyDeleted` (BuddyCallbacks)

</details>

<details>
<summary><h3 id="updatebuddy">✏️ phone.UpdateBuddy(buddy)</h3></summary>

Propagates changes to an existing buddy through the update lifecycle callback.

**Signature**

```typescript
phone.UpdateBuddy(buddy: BuddyObject): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `buddy` | `BuddyObject` | The updated buddy object (must already exist in `MyBuddies`) |

**Returns**

- `Promise<void>`

**Behavior**

- Calls `phone.OnBuddyUpdated(buddy)` which handles storage persistence and UI refresh.
- Errors are caught and logged; the method does not throw.

**Example**

```javascript
buddy.DisplayName = "Alice Smith";
await phone.UpdateBuddy(buddy);
```

**Related**

- `OnBuddyUpdated` (BuddyCallbacks)

</details>

---

## 📼 Recording API

<details>
<summary><h3 id="saverecording">💾 phone.SaveRecording(recording)</h3></summary>

Persists a recording to IndexedDB.

**Signature**

```typescript
phone.SaveRecording(recording: RecordingObject): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `recording` | `RecordingObject` | Recording object with at least `Id` |

**Returns**

- `Promise<void>`

**Behavior**

- Saves to `IndexStorage.SaveToStore("CallRecordings", recording.Id, recording)`.
- Logs success; on error, logs and resolves (does not throw).

**Related**

- `RecordingObject` (Browser-Phone-Core-Types)
- `IndexStorage` (storage layer)

</details>

<details>
<summary><h3 id="getrecording">📂 phone.GetRecording(recordingId)</h3></summary>

Retrieves a recording from storage by ID.

**Signature**

```typescript
phone.GetRecording(recordingId: string): Promise<RecordingObject | null>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `recordingId` | `string` | ID of the recording |

**Returns**

- `Promise<RecordingObject | null>` — Recording object or `null` if not found or on error.

**Related**

- `IndexStorage.GetFromStore("CallRecordings", recordingId)`

</details>

<details>
<summary><h3 id="playrecording">▶️ phone.PlayRecording(recording)</h3></summary>

Plays a recording in the browser.

**Signature**

```typescript
phone.PlayRecording(recording: RecordingObject | string): Promise<void>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `recording` | `RecordingObject` \| `string` | Recording object or recording ID |

**Returns**

- `Promise<void>`

**Behavior**

- If `recording` is a string, fetches via `GetRecording(recording)`.
- Expects `Recording.Blob` to be a valid `Blob`.
- Creates an `Audio` element, appends to `document.body`, plays the blob URL.
- Cleans up object URL and removes the element when playback ends or on error.
- On invalid data, shows a toast: `"Failed to process recording"`.

**Examples**

```javascript
phone.PlayRecording(recordingObject)
phone.PlayRecording("recording-id-123")
await phone.PlayRecording(recordingId)
```

**Related**

- `GetRecording`, `RecordingObject`
- `phone.Toast` (UI feedback)

</details>

---

## 🧭 API Reference

| Method | Signature | Returns |
|--------|-----------|---------|
| `Dial` | `(param, withVideo?, provider?)` | `Promise<string \| undefined>` |
| `EndCall` | `(param)` | `Promise<SessionObject \| undefined>` |
| `Answer` | `(param)` | `Promise<SessionObject \| undefined>` |
| `Decline` | `(sessionId)` | `Promise<void>` |
| `Hold` | `(param)` | `Promise<SessionObject \| undefined>` |
| `Unhold` | `(param)` | `Promise<SessionObject \| undefined>` |
| `Mute` | `(param)` | `Promise<SessionObject \| undefined>` |
| `Unmute` | `(param)` | `Promise<SessionObject \| undefined>` |
| `BlindTransfer` | `(param, destination)` | `Promise<void>` |
| `AttendedTransfer` | `(param, destination)` | `Promise<{ session, childSessionId } \| undefined>` |
| `CompleteTransfer` | `(childSessionId)` | `Promise<void>` |
| `CancelTransfer` | `(childSessionId)` | `Promise<void>` |
| `SendDtmf` | `(sessionId, dtmf)` | `Promise<void>` |
| `AddBuddy` | `(buddy)` | `Promise<void>` |
| `DeleteBuddy` | `(buddy)` | `Promise<void>` |
| `UpdateBuddy` | `(buddy)` | `Promise<void>` |
| `SaveRecording` | `(recording)` | `Promise<void>` |
| `GetRecording` | `(recordingId)` | `Promise<RecordingObject \| null>` |
| `PlayRecording` | `(recording)` | `Promise<void>` |

---

## 🔗 Dependencies

PhoneAPI relies on the following being available on `window.phone` (from other modules):

| Dependency | Provided by | Used for |
|------------|-------------|----------|
| `GetBuddyById` | BuddyCallbacks | Resolving buddy by ID in `Dial` |
| `GetBuddyByContact` | BuddyCallbacks | Resolving buddy by contact in `Dial` |
| `GetBuddyWithSession` | BuddyCallbacks | Finding buddy for a session in `Answer`, `EndCall` |
| `GetSession` | SessionCallbacks | Resolving session by ID |
| `GetProvider` | ProviderCallbacks | Getting provider for call actions |
| `OnAudioCall`, `OnVideoCall` | CoreCallbacks | Placing audio/video calls in `Dial` |
| `OnDecline` | CoreCallbacks | Declining calls |
| `OnHold`, `OnUnhold` | CoreCallbacks | Hold/unhold calls |
| `OnMute`, `OnUnmute` | CoreCallbacks | Mute/unmute calls |
| `OnBuddyDeleted`, `OnBuddyUpdated` | BuddyCallbacks | Buddy deletion and update lifecycle |
| `SaveBuddy`, `UpdateBuddyList`, `UpdateUI` | BuddyCallbacks / CoreCallbacks | Buddy persistence and UI refresh in `AddBuddy` |
| `OnBlindTransfer` | CoreCallbacks | Blind (immediate) transfer |
| `OnAttendedTransfer`, `OnCompleteTransfer`, `OnCancelAttendedTransfer` | CoreCallbacks | Consultative transfer lifecycle |
| `StopRingback` | CoreCallbacks | Stopping ringback before answer/end |
| `RemoveSession`, `UpdateStage`, `UpdateBuddyList` | SessionCallbacks | Cleanup and UI updates |
| `IndexStorage` | Storage layer | Saving/loading recordings |
| `UID` | CoreCallbacks | Generating IDs for temporary buddies |
| `Settings` | Browser-Phone-Core | Device IDs for temporary buddies |
| `Toast` | UI layer | Error feedback in `PlayRecording` |
| `Lang` | Localization | "Connecting" status text |
| `MyBuddies` | Browser-Phone-Core | Session/buddy lookup and temporary buddy storage |

---

## 💡 Examples & Usage

### Basic call flow

```javascript
// Place call and get session ID
const sessionId = await phone.Dial("*65");
if (sessionId) {
  console.log("Call started:", sessionId);
}

// Answer incoming call (e.g. from buddy)
phone.Answer(phone.SelectedBuddy);

// End call
await phone.EndCall(sessionId);
```

### Video call with provider

```javascript
phone.Dial("*65", true);                    // Video, default SIP
phone.Dial("*65", true, "teams");          // Video via Teams
```

### Decline incoming call

```javascript
phone.Decline(incomingSessionId);
```

### Hold and unhold

```javascript
// Hold
await phone.Hold(sessionId);

// Resume
await phone.Unhold(sessionId);
```

### Mute and unmute

```javascript
await phone.Mute(sessionId);
await phone.Unmute(sessionId);
```

### Blind transfer

```javascript
// Transfer immediately to *200
await phone.BlindTransfer(sessionId, "*200");

// Transfer to an existing buddy
await phone.BlindTransfer(sessionId, buddyObject);
```

### Attended (consultative) transfer

```javascript
// Step 1 — consult with *200 while original caller waits on hold
const { childSessionId } = await phone.AttendedTransfer(sessionId, "*200");

// Step 2a — complete: bridge original caller to *200
await phone.CompleteTransfer(childSessionId);

// Step 2b — or cancel: drop *200, restore original call
await phone.CancelTransfer(childSessionId);
```

### DTMF during call

```javascript
await phone.SendDtmf(sessionId, "1");
await phone.SendDtmf(sessionId, "123#");
```

### Recording lifecycle

```javascript
// Save (typically from OnStopRecording)
await phone.SaveRecording(recordingObject);

// Retrieve
const recording = await phone.GetRecording("recording-id");
if (recording) {
  await phone.PlayRecording(recording);
}

// Or play by ID
await phone.PlayRecording("recording-id");
```

---

## 📝 Notes & Edge Cases

- **Temporary buddies**: When dialing a string that is not a buddy ID or contact, a temporary buddy is created and pushed to `MyBuddies` so `GetSession` can find the session. If the buddy has `AutoDelete`, it is disabled before dialing.
- **Parameter flexibility**: `Dial`, `Answer`, `EndCall`, `Hold`, `Unhold`, `Mute`, `Unmute`, `BlindTransfer`, and `AttendedTransfer` accept string IDs, session objects, or buddy objects. Invalid types log an error and return `undefined`.
- **Provider fallback**: If the session’s provider is not found, `"sip"` is used as fallback for `Answer` and `EndCall`.
- **Recording playback**: `PlayRecording` expects `Recording.Blob` to be a `Blob`. Invalid data triggers a toast and does not throw.
- **Decline vs EndCall**: `Decline(sessionId)` only accepts a session ID and always calls `OnDecline`. `EndCall(param)` accepts multiple types and chooses Hangup/Decline/Cancel based on session state and direction.
- **Hold/Mute buddy resolution**: `Hold`, `Unhold`, `Mute`, and `Unmute` resolve the owning buddy via `GetBuddyWithSession` and pass it to the internal `On*` handler. If no buddy is found (e.g. temporary session), `null` is passed — the internal handlers use it only for activity logging.
- **Transfer destination**: `BlindTransfer` and `AttendedTransfer` resolve the destination string using the same `GetBuddyById` → `GetBuddyByContact` → stub fallback pattern as `Dial`, but do not add the destination to `MyBuddies`.
- **Attended transfer child session**: `AttendedTransfer` returns `childSessionId` read from `session.AttendedTransferCall` immediately after `OnAttendedTransfer` completes. Pass this ID to `CompleteTransfer` or `CancelTransfer`.
- **Duplicate resolve**: Some methods call `resolve()` twice (e.g. in `SaveRecording`); this is redundant but harmless.
