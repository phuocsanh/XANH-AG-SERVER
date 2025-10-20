const { GoogleGenerativeAI } = require('@google/generative-ai');

// Use your API key directly
const API_KEY =
  process.env.GOOGLE_AI_API_KEY || 'AIzaSyB1z3FySvguqFhSLH5bhxriL0VtCaLCNlA';

const genAI = new GoogleGenerativeAI(API_KEY);

async function testModel() {
  try {
    console.log('Testing API connection...');

    // Try to generate content with a simple prompt
    const model = genAI.getGenerativeModel({
      model: 'models/gemini-2.0-flash-001',
    });

    const prompt = 'Hello, world!';

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('API connection successful!');
    console.log('Response:', text);
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testModel();
