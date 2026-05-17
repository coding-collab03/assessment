import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const run = async () => {
  try {
    const models = await genAI.listModels();
    console.log("AVAILABLE MODELS:");
    console.log(models);
  } catch (err) {
    console.error(err);
  }
};

run();