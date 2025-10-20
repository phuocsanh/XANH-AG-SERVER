const { GoogleGenAI } = require('@google/genai');

// Use your API key directly
const API_KEY =
  process.env.GOOGLE_AI_API_KEY || 'AIzaSyB1z3FySvguqFhSLH5bhxriL0VtCaLCNlA';

const ai = new GoogleGenAI({ apiKey: API_KEY });

async function testModel() {
  try {
    console.log('Testing API connection...');

    // Try to generate content with a simple prompt
    const response = await ai.models.generateContent({
      model: 'gemini-pro',
      contents: [{ role: 'user', parts: [{ text: 'Hello, world!' }] }],
    });

    console.log('API connection successful!');
    console.log('Response:', response.text);
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testModel();
