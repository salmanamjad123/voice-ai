/**
 * Creates a WebSocket connection with proper error handling
 * @param path - The endpoint path (e.g., '/ws/transcription')
 * @returns WebSocket instance
 */
export function createWebSocketConnection(path: string): WebSocket {
  // Construct WebSocket URL with proper protocol
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const url = `${protocol}//${host}${path}`;

  // Create WebSocket instance
  const ws = new WebSocket(url);

  // Connection opened
  ws.addEventListener('open', () => {
    console.log('WebSocket connection established');
  });

  // Connection error
  ws.addEventListener('error', (event) => {
    console.error('WebSocket error:', event);
  });

  // Connection closed
  ws.addEventListener('close', (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
  });

  return ws;
}