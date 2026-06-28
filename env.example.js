// -----------------------------------------------
//  Local credentials for the test pages (NOT committed)
// ===============================================
// 1) Copy this file to "env.js" (env.js is gitignored)
// 2) Fill in your Siperb Personal Access Token (PAT) and a Script Device Token
//    from the Siperb Admin Control Panel.
//
//    PAT:          Admin Control Panel -> Personal Access Tokens
//    Device Token: Admin Control Panel -> Devices -> (a "script" platform device)

window.PERSONAL_ACCESS_TOKEN = "<YOUR_PERSONAL_ACCESS_TOKEN>";
window.DEVICE_TOKEN          = "<YOUR_KNOWN_DEVICE_TOKEN>";

// Optional: number to dial when you click "Call" on the test pages.
window.DIAL_TARGET = "*65";

// Optional: extra ICE servers (STUN/TURN) used for WebRTC media.
// The test pages already add a public STUN server and will also pick up any
// ICE servers returned by provisioning. Add your own TURN here if needed,
// e.g. for calls that must traverse symmetric NAT / strict firewalls.
//
// window.EXTRA_ICE_SERVERS = [
//   { urls: "stun:stun.l.google.com:19302" },
//   { urls: "turn:turn.example.com:3478", username: "user", credential: "pass" }
// ];
