import express from 'express';
import http from 'http';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatGoogleGenerativeAI } from 'langchain/google-genai';
import { PromptTemplate } from 'langchain/prompts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ingestDocs } from './loader.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Enable CORS to allow requests from your frontend origin
app.use(cors({
  origin: '*', // Temporarily allow all origins for testing. Replace with your frontend URL after testing.
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
}));

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
  });
});

// Endpoint to upload PDF files
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    process.env.PDF_PATH = req.file.path; // Save path to PDF for ingestion
    await ingestDocs(); // Re-index the vector store with the new document
    res.json({ filePath: req.file.path });
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Endpoint to ask questions
app.get('/ask', async (req, res) => {
  try {
    const model = new ChatGoogleGenerativeAI({
      modelName: 'gemini-pro',
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      temperature: 0.3,
    });

    // Define prompt template
    const promptTemplate = `
      Use the following context to answer the question as accurately as possible.
      Only use information from the context. If the answer is not in the context, respond with, "Answer is not available in the context."

      Context: {context}
      Question: {question}

      Answer:
    `;

    const prompt = new PromptTemplate({
      template: promptTemplate,
      inputVariables: ['context', 'question'],
    });

    // Load embeddings and vector store
    const directory = path.join(__dirname, 'faiss_index');
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      modelName: 'embedding-001',
    });
    const loadedVectorStore = await FaissStore.load(directory, embeddings);
    const retriever = loadedVectorStore.asRetriever();

    // Retrieve relevant documents based on user question
    const userQuestion = req.query.question || 'How to compile a .tex file to a .pdf file';
    const permission = req.query.permission === 'true'; // Get permission parameter
    const documents = await retriever.getRelevantDocuments(userQuestion);

    let answer;

    if (documents && documents.length > 0) {
      const nonEmptyDocs = documents.filter(doc => doc.pageContent && doc.pageContent.trim().length > 5);
      const context = nonEmptyDocs.map(doc => doc.pageContent.replace(/(\r\n|\n|\r)/gm, " ").trim()).join(" ");

      if (context.trim()) {
        const formattedPrompt = await prompt.format({ context, question: userQuestion });
        const response = await model.call([{ role: 'user', content: formattedPrompt }]);
        answer = response.content;
      }
    }

    // If no relevant context is found and permission is granted, use generative AI fallback
    if ((!answer || answer === "Answer is not available in the context.") && permission) {
      console.log('Using Generative AI fallback...');
      const genModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const genResponse = await genModel.generateContent(userQuestion);
      answer = genResponse.response.text();
    } else if (!answer && !permission) {
      answer = "Answer not found in the context, and AI permission was not granted.";
    }

    res.json({ answer });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the server
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
  } else {
    console.error('Server error:', error);
  }
});
