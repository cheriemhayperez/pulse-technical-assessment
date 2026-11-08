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
