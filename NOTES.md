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