import React, { useState } from 'react';

function Chat() {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');

  const handleAsk = async () => {
    if (!question.trim()) return;

    try {
      const response = await fetch(`https://pdf-chatbot-hhte.onrender.com/ask?question=${encodeURIComponent(question)}`);
      const result = await response.json();

      if (result.answer === "Answer is not available in the context.") {
        setPendingQuestion(question);
        setShowPermissionModal(true);
      } else {
        setChatHistory((prev) => [
          ...prev,
          { role: 'user', content: question },
          { role: 'bot', content: result.answer },
        ]);
        setQuestion('');
      }
    } catch (error) {
      console.error('Error fetching answer:', error);
    }
  };

  const handlePermissionResponse = async (permissionGranted) => {
    setShowPermissionModal(false);

    if (permissionGranted) {
      try {
        const response = await fetch(`https://pdf-chatbot-hhte.onrender.com/ask?question=${encodeURIComponent(pendingQuestion)}&permission=true`);
        const result = await response.json();

        setChatHistory((prev) => [
          ...prev,
          { role: 'user', content: pendingQuestion },
          { role: 'bot', content: result.answer },
        ]);
      } catch (error) {
        console.error('Error fetching answer with AI permission:', error);
      }
    } else {
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: pendingQuestion },
        { role: 'bot', content: "Answer not found in the document context, and AI permission was not granted." },
      ]);
    }
    setPendingQuestion('');
    setQuestion('');
  };

  return (
    <div className="chat">
      <div className="chat-history">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          placeholder="Ask a question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button onClick={handleAsk}>Send</button>
      </div>

      {showPermissionModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Use AI Assistance</h2>
            <p>The answer is not available in the document context. Do you want to use AI assistance to answer this question?</p>
            <button onClick={() => handlePermissionResponse(true)}>Yes, use AI</button>
            <button onClick={() => handlePermissionResponse(false)}>No, thanks</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
