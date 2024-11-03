import React, { useState } from 'react';

const Chat = () => {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;

    try {
      const response = await fetch(`https://pdf-chatbotbackend.onrender.com/ask?question=${encodeURIComponent(question)}`);
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
      alert('Error fetching answer.');
    }
  };

  const handlePermissionResponse = async (permissionGranted) => {
    setShowPermissionModal(false);

    if (permissionGranted) {
      try {
        const response = await fetch(`https://pdf-chatbotbackend.onrender.com/ask?question=${encodeURIComponent(pendingQuestion)}&permission=true`);
        const result = await response.json();

        setChatHistory((prev) => [
          ...prev,
          { role: 'user', content: pendingQuestion },
          { role: 'bot', content: result.answer },
        ]);
      } catch (error) {
        console.error('Error fetching answer with AI permission:', error);
        alert('Failed to fetch answer with AI.');
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
    <div>
      <input 
        type="text" 
        value={question} 
        onChange={(e) => setQuestion(e.target.value)} 
        placeholder="Ask a question" 
      />
      <button onClick={handleAsk}>Ask</button>

      {chatHistory.map((msg, idx) => (
        <p key={idx} style={{ color: msg.role === 'user' ? 'blue' : 'green' }}>
          {msg.role}: {msg.content}
        </p>
      ))}

      {showPermissionModal && (
        <div>
          <p>The answer is not found in the document. Allow AI assistance?</p>
          <button onClick={() => handlePermissionResponse(true)}>Yes</button>
          <button onClick={() => handlePermissionResponse(false)}>No</button>
        </div>
      )}
    </div>
  );
};

export default Chat;
