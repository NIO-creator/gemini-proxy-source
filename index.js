/**
 * A secure proxy Cloud Function to handle Gemini and TTS API calls.
 * This prevents the API key from being exposed in client-side code (like GitHub Pages).
 * * NOTE: The GEMINI_API_KEY is retrieved securely from the Cloud Run environment variables.
 */

const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set. Deployment failed.");
}
const ai = new GoogleGenAI({ apiKey });

const TEXT_MODEL = "gemini-2.5-flash-preview-09-2025";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Kore"; 

exports.processGeminiRequest = async (req, res) => {
    // Set CORS headers for all responses (mandatory for client-side apps)
    res.set('Access-Control-Allow-Origin', '*'); 

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST' || !req.body.prompt) {
        return res.status(400).send({ error: 'Requires a POST request with a "prompt" in the body.' });
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
};