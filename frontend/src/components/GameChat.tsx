import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

interface ChatMessage {
  username: string;
  message: string;
  timestamp: string;
}

interface GameChatProps {
  gameId: string;
  currentUsername: string;
}

export function GameChat({ gameId, currentUsername }: GameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const { socket } = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for incoming chat messages
    const handleChatMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    };

    socket.on('chat-message', handleChatMessage);

    return () => {
      socket.off('chat-message', handleChatMessage);
    };
  }, [socket]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!socket || !inputMessage.trim()) return;

    // Send message via WebSocket
    socket.emit('chat-message', {
      gameId,
      message: inputMessage.trim(),
      username: currentUsername
    });

    setInputMessage('');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      {/* Chat Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #ddd',
        backgroundColor: '#fff',
        borderRadius: '8px 8px 0 0',
        fontWeight: 'bold'
      }}>
        💬 Spiel-Chat
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: 0
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: '#999', 
            marginTop: '20px',
            fontSize: '14px'
          }}>
            Noch keine Nachrichten. Starte die Konversation!
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwnMessage = msg.username === currentUsername;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
                  gap: '4px'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  <span style={{ fontWeight: 'bold' }}>
                    {isOwnMessage ? 'Du' : msg.username}
                  </span>
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                <div style={{
                  backgroundColor: isOwnMessage ? '#4CAF50' : '#fff',
                  color: isOwnMessage ? '#fff' : '#333',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  maxWidth: '80%',
                  wordWrap: 'break-word',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  border: isOwnMessage ? 'none' : '1px solid #e0e0e0'
                }}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} style={{
        padding: '12px 16px',
        borderTop: '1px solid #ddd',
        backgroundColor: '#fff',
        borderRadius: '0 0 8px 8px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Nachricht eingeben..."
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: '20px',
              fontSize: '14px',
              outline: 'none'
            }}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: inputMessage.trim() ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
          >
            Senden
          </button>
        </div>
      </form>
    </div>
  );
}
