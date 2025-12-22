// biome-ignore assist/source/organizeImports: dotenv needs imported first
import "dotenv/config";
// import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
// import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import {
	type AIMessage,
	SystemMessage,
	HumanMessage,
	type BaseMessageLike,
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
	// think: false,
});

const streamAndAccumulateChunks = async (stream: Awaited<ReturnType<typeof model.stream>>) => {
	const chunks = [];
	enum StreamType {
		thought = "thought",
		response = "response",
		none = "none"
	}
	const streamState = {
		currentStreamType: StreamType.thought,
		lastStreamType: StreamType.none
	};
	const setCurrentStreamType = (type: StreamType) => {
		streamState.lastStreamType = streamState.currentStreamType;
		streamState.currentStreamType = type;
	}
	for await (const chunk of stream) {
		if(streamState.currentStreamType !== streamState.lastStreamType) {
			if (streamState.currentStreamType === StreamType.thought) console.log("\n### THOUGHT ###\n");
		}
		if (chunk.content?.length) setCurrentStreamType(StreamType.response)
		if (chunk.additional_kwargs.reasoning_content) setCurrentStreamType(StreamType.thought)
		if (chunk.additional_kwargs.reasoning_content) {
			process.stdout.write(String(chunk.additional_kwargs.reasoning_content));
		}

		if (streamState.currentStreamType !== streamState.lastStreamType) {
			if (streamState.currentStreamType === StreamType.response) console.log("\n###############\n");
		}

		process.stdout.write(chunk.content.toString());
		chunks.push(chunk)
	}
	console.log('\n\n');
	const accumulated = chunks.reduce((acc, chunk) => {
		if (chunk.additional_kwargs.reasoning_content) {
			acc.additional_kwargs.reasoning_content = acc.additional_kwargs.reasoning_content as string + chunk.additional_kwargs.reasoning_content;
		}
		if (chunk.content) {
			acc.content = acc.content.toString() + chunk.content.toString();
		}
		if (chunk.tool_calls) {
			acc.tool_calls?.push(...chunk.tool_calls);
		}
		return acc;
	});
	return accumulated
}

const chatHistory: BaseMessageLike[] = [
	new SystemMessage(
		`
You are a helpful assistant. 
Think through problems step by step to answer the user's questions. 
Always respond in plain text.`,
	),
];
const toolsMap = new Map(tools.map((t) => [t.name, t]));

while (true) {
	const { userPrompt } = await inquirer.prompt([
		{
			type: "input",
			name: "userPrompt",
			message: ">",
		},
	]);
	chatHistory.push(new HumanMessage(userPrompt));
	const response = await model.stream(chatHistory, { tools });
	const accumulated = await streamAndAccumulateChunks(response);
	chatHistory.push(accumulated);
	while ((chatHistory.at(-1) as AIMessage).tool_calls?.length) {
		const lastMessage = chatHistory.at(-1) as AIMessage;
		const toolcallMessages = (
			await Promise.allSettled(
				lastMessage.tool_calls?.map(async (toolCall) => {
					console.log(`#toolcall: ${toolCall.name} ${JSON.stringify(toolCall.args)}`);
					const tool = toolsMap.get(toolCall.name);
					return tool ? await (tool.invoke as any)(toolCall) : undefined;
				}) ?? [],
			)
		).map((r) => (r.status === "fulfilled" ? r.value : r.reason));
		chatHistory.push(...toolcallMessages);
		const response = await model.stream(chatHistory, { tools });
		const accumulated = await streamAndAccumulateChunks(response);
		chatHistory.push(accumulated as any);
	}
}
