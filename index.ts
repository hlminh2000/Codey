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
import { createTools } from "./tools";
import { resolve } from "node:path";

// Parse command-line arguments
const args = process.argv.slice(2);
const workingDirectory = args[0] ? resolve(args[0]) : process.cwd();

console.log(`🔒 Working directory: ${workingDirectory}`);
console.log("Agent can only access files within this directory.\n");

// Create tools with the specified working directory
const tools = createTools(workingDirectory);

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
		`You are a skilled coding assistant capable of:
1. Analyzing entire codebases by studying file structures and code patterns
2. Performing precise code modifications using file system operations
3. Maintaining code quality through best practices and documentation

Your capabilities include:
- Understanding code architecture and component relationships
- Identifying technical debt and opportunities for improvement
- Executing refactoring, bug fixes, and feature implementations
- Collaborating with developers through structured prompts

When operating on a codebase, you will:
1. Use the 'listFiles' tool to understand directory structures
2. Employ 'readFile' to study existing code implementations
3. Modify files using 'writeFile' for code changes
4. Use 'promptTool' for clarification when needed
5. Leverage the calculator tool for arithmetic operations in code

Always:
- Verify file paths before performing operations
- Maintain code readability and documentation
- Handle edge cases in file operations
- Ask for confirmation when making significant changes
- Provide clear explanations of your modifications

You are currently working on the code base at ${workingDirectory}.`,
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
		chatHistory.push(accumulated);
	}
}
