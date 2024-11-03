import express from 'express';
import http from 'http';
import cors from 'cors'
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from 'langchain/prompts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ingestDocs } from './loader.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = ['https://pdf-chatbot-teal-mu.vercel.app', 'http://localhost:3000'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true,
};


// Use CORS middleware
app.use(cors(corsOptions));

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is healthy' });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    process.env.PDF_PATH = req.file.path;
    await ingestDocs();
    res.json({ filePath: req.file.path });
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

app.get('/ask', async (req, res) => {
  try {
    const model = new ChatGoogleGenerativeAI({
      modelName: 'gemini-pro',
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      temperature: 0.3,
    });

    const promptTemplate = `Use the following context to answer the question as accurately as possible.
      Only use information from the context. If the answer is not in the context, respond with, "Answer is not available in the context."

      Context: {context}
      Question: {question}

      Answer:
    `;

    const prompt = new PromptTemplate({
      template: promptTemplate,
      inputVariables: ['context', 'question'],
    });

    const directory = path.join(__dirname, 'faiss_index');
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      modelName: 'embedding-001',
    });
    const loadedVectorStore = await FaissStore.load(directory, embeddings);
    const retriever = loadedVectorStore.asRetriever();

    const userQuestion = req.query.question || 'How to compile a .tex file to a .pdf file';
    const permission = req.query.permission === 'true';
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

    if ((!answer || answer === "Answer is not available in the context.") && permission) {
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

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
