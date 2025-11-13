import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiModel(model: string = "gemini-2.5-flash") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}








