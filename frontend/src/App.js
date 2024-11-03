import React, { useState } from 'react';
import UploadForm from './UploadForm';
import Chat from './Chat';
import './App.css';

function App() {
  const [uploadedFilePath, setUploadedFilePath] = useState('');

  const handleUploadSuccess = (filePath) => {
    setUploadedFilePath(filePath);
  };

  return (
    <div className="app">
      <header className="header">
        <img src="" alt="logo" />
        <UploadForm onUploadSuccess={handleUploadSuccess} />
      </header>
      
      {uploadedFilePath && <Chat />}
    </div>
  );
}

export default App;
