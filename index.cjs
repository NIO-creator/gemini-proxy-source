/**
 * A secure proxy Node.js server to handle Gemini and TTS API calls on Cloud Run.
 * This prevents the API key from being exposed in client-side code.
 * NOTE: The server MUST listen on the port provided by the $PORT environment variable.
 */
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Essential for client-side access
const { GoogleGenAI } = require('@google/genai');

// --- Server Setup ---
const app = express();
// Cloud Run injects the PORT environment variable. We MUST use it.
const PORT = process.env.PORT || 8080; 

// Apply middleware
app.use(cors()); // Allow all origins for proxy access
app.use(bodyParser.json());

// --- API Configuration ---
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set. The service will fail.");
}
const ai = new GoogleGenAI({ apiKey });

const TEXT_MODEL = "gemini-2.5-flash-preview-09-2025";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Kore"; 

// --- Health Check / Root Endpoint ---
app.get('/', (req, res) => {
    res.status(200).send('Gemini Proxy Service is Running.');
});

// --- Core Proxy Logic Endpoint ---
app.post('/process', async (req, res) => {
    // Note: CORS headers are handled by the 'cors' middleware, 
    // but the options handling is still useful for verification.
    if (req.method === 'OPTIONS') {
        return res.status(204).send();
    }

    if (!req.body.prompt) {
        return res.status(400).send({ error: 'Requires a "prompt" in the body.' });
    }

    if (!apiKey) {
        return res.status(500).send({ error: 'Server configuration error: API Key not set.' });
    }

    const { prompt } = req.body;
    let textResponse;

    try {
        // --- 1. Call Gemini for Text Response (with Search Grounding) ---
        const textResult = await ai.models.generateContent({
            model: TEXT_MODEL,
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ "google_search": {} }],
        });

        textResponse = textResult.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
            return res.status(500).send({ error: 'Gemini failed to generate text content.' });
        }
    } catch (error) {
        console.error("Gemini Text API Error:", error);
        return res.status(500).send({ error: 'An error occurred during text generation.' });
    }

    try {
        // --- 2. Call Gemini TTS for Audio Response ---
        const ttsPrompt = `Say in a clear and helpful tone: "${textResponse}"`; 

        const ttsResult = await ai.models.generateContent({
            model: TTS_MODEL,
            contents: [{ parts: [{ text: ttsPrompt }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: TTS_VOICE }
                    }
                }
            }
        });

        const audioPart = ttsResult.candidates?.[0]?.content?.parts?.[0];
        const audioData = audioPart?.inlineData?.data; // Base64 PCM data
        const mimeType = audioPart?.inlineData?.mimeType; // "audio/L16;rate=24000"

        // --- 3. Return both Text and Base64 Audio ---
        res.status(200).send({
            text: textResponse,
            audioData: audioData || null,
            mimeType: mimeType || null
        });

    } catch (error) {
        console.error("Gemini TTS API Error:", error);
        res.status(200).send({ text: textResponse, audioData: null, error: 'TTS failed' });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

