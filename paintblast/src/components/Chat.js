import { useState } from "react";
import styles from "../styles/Chat.module.css";

export default function Chat({ messages, onSendMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
      setIsOpen(false);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={styles.chatContainer}>
      <button className={styles.toggleButton} onClick={toggleChat}>
        {isOpen ? "Close Chat" : "Open Chat"}
      </button>

      {isOpen && (
        <div className={styles.chatBox}>
          <div className={styles.messages}>
            {messages.map((msg, index) => (
              <div key={index} className={styles.message}>
                <span className={styles.sender}>{msg.sender}: </span>
                <span className={styles.text}>{msg.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className={styles.input}
              autoFocus
            />
            <button type="submit" className={styles.sendButton}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
