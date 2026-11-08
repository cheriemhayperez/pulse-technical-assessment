# Pulse Notes

## Phase 1

### What was broken

- **Presence / Ghost dots:** The heartbeat updated the online status of all users instead of only the user making the request. As a result, inactive users continued to appear on the map.
- **Chat messages:** The sender used `t: "msg"` while the receiver expected `t: "chat"`. Because the message types didn't match, messages were not displayed.
- **Busy status:** When a session ended, both users remained marked as busy. This prevented them from connecting with other users again.
- **ICE candidate handling:** ICE candidates were processed before the remote description was set. This happened in the wrong order and caused WebRTC connections to fail.
- **Failed connections:** When a WebRTC connection failed, only the local session was cleaned up. The other user was not notified and could remain stuck in the session.

### How I found the issues

- Traced the heartbeat logic in the polling API and found that it updated the presence records of all users.
- Compared the outgoing chat message format with what the receiving side expected.
- Checked the signaling API and found that the `end` event did not reset both users' busy status.
- Reviewed the WebRTC signaling flow and found that ICE candidates were processed before the remote description was ready.
- Checked the connection state handler and found that it did not notify the other user when a connection failed.

### How I fixed them

- Updated the heartbeat query so that only the user making the request gets their online status refreshed.
- Changed the outgoing chat message type to `t: "chat"` to match what the receiver expects.
- Updated the session-end handling to reset both users' busy status so they can connect again.
- Set the remote description before processing queued ICE candidates to follow the correct WebRTC setup order.
- Sent an `end` signal to the other user when the connection failed, then cleaned up the local session.

## Phase 2

Phase 2 focused on appearance and usability, without changing how signaling or WebRTC work. The original UI was usable after Phase 1, but it felt like separate default panels on a dark map. I restyled the product around a map-first layout, one shared look, and clearer connect / chat / video exits.

### What I changed

- **Overall design:** Replaced the original zinc colors with a consistent dark navy and teal theme, including updated typography and shared CSS styles, so the map, chat, and prompts feel like one place.
- **Entry screen:** Simplified the welcome screen with a clear title, short description, main action, and better loading and error messages. Client-side join failures are now caught and shown on this screen instead of opening an empty live session.
- **Map:** Improved the Mapbox dark theme, made user markers easier to click, and made busy users appear dimmed and non-clickable. Added map controls for zooming in (+), zooming out (−), recentering the map on my location, and viewing the whole world. When no other users are online, the map shows an empty-state message.
- **Chat:** Reworked the chat panel into a floating panel on desktop and a bottom sheet on mobile so most of the map stays visible. Improved scrolling and made the panel inactive while video is open.
- **Connection dialogs:** Improved the incoming request dialog with clearer messages, keyboard navigation, Escape handling, and a countdown display.
- **Video interface:** Added clearer user labels, a waiting state, and a Return to chat action in the video overlay.
- **Responsive design:** Adjusted layouts and button sizes for smaller screens and added support for reduced-motion preferences.

### Video and camera cleanup

I fixed an issue where the browser's camera or microphone indicator remained active after leaving the video interface, even though the video UI was already closed.

- Added a generation check to identify cancelled video requests.
- Stopped camera and microphone tracks when leaving video.
- Stopped tracks if the browser granted permission after the video request had already been cancelled.
- Prevented cancelled requests from triggering unnecessary errors or additional signaling messages.
- Stopped remaining sender tracks and cleared video element references during cleanup.
- Kept the peer connection active when returning to chat, but closed it when leaving the session.

## Phase 3

### Issues found

- Anyone could call poll, signal, or leave with another user’s public id. Poll also returned every peer’s id, so those ids were not secrets.
- Join let the client pick the id and overwrite an existing session.
- Signal `fromId` was taken from the request body, so callers could impersonate someone else.
- Accept/end could set `busy` without a real handshake. Poll/leave/signal did not use the same id checks as join.
- There was no rate limiting or body-size limit. Raw GPS was sent to join.

### How they were ranked

- Critical: unauthenticated poll/signal/leave, public session ids, spoofed `fromId`.
- High: join overwrite, easy flooding of presence and signals.
- Medium: `busy` without a handshake, inconsistent id checks.
- Low: raw GPS in the join body.

### What was fixed

- Join now creates a public map id and a private session secret. The secret is hashed in the database and never shown to other users.
- Poll, signal, and leave require that secret. Signal `fromId` always comes from the authenticated session.
- Join no longer upserts over another session. GPS is offset on the client before join.
- Request/accept/end only change `busy` for a paired pair. Ids are validated the same way on every route.
- Basic per-IP rate limits and a 70 KB body cap.

## Phase 4

### What I built

- **Pulse Intent:** Users can choose why they are on Pulse through six categories: Help (`help`), Company (`company`), Trade (`trade`), Food (`food`), Ride (`ride`), and Chat / Meet (`meet`). This helps others understand what they need or what they can offer.
- Users can also add a short 24-character message describing what they need or are looking for. For example: "Need a vet?"
- Their intention and short message appear in a compact card below their map marker, together with their approximate area and distance.
- Users can tap another person's marker to preview their intention before deciding to connect. A connection request is sent only when they click Connect.
- Users can change or clear their intention without leaving Pulse.

### Why I built it

My vision for Pulse is to create an all-in-one platform where people can connect, find what they need, and discover what others can offer.

Instead of using different apps for different everyday needs, Pulse aims to bring these connections together in one place.

People could use Pulse to:

- Find help or assistance when they need it.
- Offer or find services.
- Find people to talk to or spend time with.
- Buy, sell, or exchange products.
- Discover food, recommendations, or food-related offers.
- Find available rides or offer transportation.

The idea is to make it easier to connect people who need something with people who can provide it. By showing why someone is on Pulse, people can better understand what others are looking for and start more meaningful conversations.

### What I would improve next

- Expand Pulse to support different needs, services, and offers in one platform.
- Develop more ways to help people connect and communicate around their needs.
