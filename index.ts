// biome-ignore assist/source/organizeImports: dotenv needs imported first
import "dotenv/config";
// import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
// import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import {
	SystemMessage,
	HumanMessage,
	type BaseMessageLike,
	type AIMessage,
} from "@langchain/core/messages";
import inquirer from "inquirer";
import { tools } from "./tools";

// const model = new ChatGoogleGenerativeAI({
// 	model: "gemini-flash-lite-latest",
// 	maxOutputTokens: 2048,
// 	apiKey: process.env.GOOGLE_API_KEY,
// });
// const model = new ChatOpenAI({
// 	model: "gemini-flash-lite-latest",
// 	maxOutputTokens: 2048,
// 	apiKey: process.env.OPEN_ROUTER_API_KEY,
// });
const model = new ChatOllama({
	model: "qwen3:8b",
	temperature: 0,
	think: false,
});


const chatHistory: BaseMessageLike[] = [
	new SystemMessage(
		`/no_think
You are a helpful assistant. Think through problems step by step to answer the user's questions in plain text.
`,
	),
];

while (true) {
	const { userPrompt } = await inquirer.prompt([
		{
			type: "input",
			name: "userPrompt",
			message: ">",
		},
	]);
	chatHistory.push(new HumanMessage(userPrompt));
	const response = await model.invoke(chatHistory, { tools });
	const toolsMap = new Map(tools.map(t => [t.name, t]));
	chatHistory.push(response);
	while ((chatHistory.at(-1) as AIMessage).tool_calls?.length) {
		const lastMessage = chatHistory.at(-1) as AIMessage;
		const toolcallMessages = (
			await Promise.allSettled(
				lastMessage.tool_calls?.map(async (toolCall) => {
					console.log(`#toolcall: ${toolCall.name}\n`);
					const tool = toolsMap.get(toolCall.name);
					return tool ? await (tool.invoke as any)(toolCall) : undefined;
				}) ?? [],
			)
		).map((r) => (r.status === "fulfilled" ? r.value : r.reason));
		chatHistory.push(...toolcallMessages);
		const response = await model.invoke(chatHistory, { tools });
		chatHistory.push(response);
	}
	const lastMessage = chatHistory.at(-1);
	if (
		lastMessage &&
		typeof lastMessage === "object" &&
		"content" in lastMessage
	) {
		console.log(`${lastMessage.content}\n`);
	}
}
