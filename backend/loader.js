// loader.js
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import dotenv from 'dotenv';

dotenv.config();

export const ingestDocs = async () => {
  try {
    // Load the PDF file and extract text
    const pdfPath = process.env.PDF_PATH;
    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();
    console.log('Documents loaded successfully.');

    // Split text into chunks for embedding
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const docChunks = await textSplitter.splitDocuments(docs);
    console.log(`Document split into ${docChunks.length} chunks.`);

    // Initialize vector store with embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      modelName: 'embedding-001',
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    });

    const vectorStore = await FaissStore.fromDocuments(docChunks, embeddings);
    console.log('Vector store created with embeddings.');

    // Save the vector store locally
    const directory = process.env.VECTOR_STORE_PATH || 'faiss_index';
    await vectorStore.save(directory);
    console.log('Vector store saved successfully at:', directory);
  } catch (error) {
    console.error('Error during document ingestion:', error);
  }
};

// Execute the ingestion function if this file is run directly
if (import.meta.url === new URL(import.meta.url).href) {
  ingestDocs();
}
