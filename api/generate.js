import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import pdf from 'pdf-parse';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        let { protocolText, protocolFile } = request.body;

        // Handle PDF File
        if (protocolFile) {
            try {
                // Remove Data URI prefix if present (e.g. "data:application/pdf;base64,")
                const base64Data = protocolFile.replace(/^data:application\/pdf;base64,/, "");
                const dataBuffer = Buffer.from(base64Data, 'base64');
                const pdfData = await pdf(dataBuffer);
                protocolText = pdfData.text; // Use extracted text
            } catch (pdfError) {
                console.error("PDF Parse Error:", pdfError);
                return response.status(400).json({ error: 'Failed to parse PDF file' });
            }
        }

        if (!protocolText) {
            return response.status(400).json({ error: 'No protocol text or file provided' });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
            generationConfig: { responseMimeType: "application/json" }
        });

        const schema = {
            "title": "Protocol Title",
            "description": "Brief description",
            "numSamples": 1,
            "sampleVolume": 0,
            "dnaVolume": 2, // Default DNA Volume
            "reagents": [{ "name": "Water", "perSample": 10 }],
            "thermalSteps": [{ "name": "Denaturation", "temp": 95, "duration": "30s", "cycles": 1 }]
        };

        const prompt = `Extract the following molecular biology protocol into this EXACT JSON structure:
    ${JSON.stringify(schema, null, 2)}
    
    Ensure all numerical values are numbers, not strings.
    
    Protocol Content:
    ${protocolText}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const data = JSON.parse(responseText);

        return response.status(200).json(data);
    } catch (error) {
        console.error("AI Error:", error);
        return response.status(500).json({ error: "Failed to process protocol", details: error.message });
    }
}
