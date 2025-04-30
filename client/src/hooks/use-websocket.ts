import { useEffect, useState, useRef, useCallback } from "react";
import { WebSocketMessage } from "@shared/schema";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket({
  url,
  onMessage,
  reconnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Function to connect to WebSocket
  const connect = useCallback(() => {
    // Close existing connection if any
    if (webSocketRef.current) {
      webSocketRef.current.close();
    }
    
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const parsedMessage: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(parsedMessage);
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
      
      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError(new Error("WebSocket connection error"));
      };
      
      ws.onclose = (event) => {
        setIsConnected(false);
        
        // Attempt to reconnect
        if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(`WebSocket disconnected. Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          if (reconnectTimeoutRef.current) {
            window.clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError(new Error("Maximum reconnect attempts reached"));
        }
      };
      
      webSocketRef.current = ws;
      
    } catch (err) {
      console.error("Error creating WebSocket:", err);
      setError(err instanceof Error ? err : new Error("Failed to create WebSocket connection"));
    }
  }, [url, onMessage, reconnect, reconnectInterval, maxReconnectAttempts]);

  // Connect on mount
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, [connect]);
  
  // Function to send message
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (webSocketRef.current && isConnected) {
      webSocketRef.current.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not connected");
    }
  }, [isConnected]);
  
  // Function to manually reconnect
  const reconnectWebSocket = useCallback(() => {
    if (!isConnected) {
      reconnectAttemptsRef.current = 0;
      connect();
    }
  }, [isConnected, connect]);

  return {
    isConnected,
    error,
    sendMessage,
    reconnect: reconnectWebSocket,
  };
}
