export async function emitSocketEvent(room, event, data) {
  const socketServerUrl = process.env.SOCKET_SERVER_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${socketServerUrl}/internal/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: process.env.ADMIN_SECRET,
        room,
        event,
        data,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to emit socket event:", err);
    return false;
  }
}
