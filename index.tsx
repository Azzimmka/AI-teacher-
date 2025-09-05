/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

// --- DOM Elements ---
const chatContainer = document.getElementById('chat-container') as HTMLDivElement;
const promptForm = document.getElementById('prompt-form') as HTMLFormElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const submitButton = promptForm.querySelector('button') as HTMLButtonElement;

// --- Gemini AI Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Appends a message to the chat container and handles markdown parsing.
 * @param content The string content of the message.
 * @param sender The sender of the message.
 */
async function displayMessage(content: string, sender: 'user' | 'model' | 'error') {
  const messageDiv = document.createElement('div');
  const senderClass = `${sender}-message`;
  messageDiv.className = `message ${senderClass}`;

  // Use textContent for user messages to prevent XSS.
  if (sender === 'user') {
    const p = document.createElement('p');
    p.textContent = content;
    messageDiv.appendChild(p);
  } else {
    messageDiv.innerHTML = await marked.parse(content);
  }
  
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Shows or hides the loading indicator and disables/enables form controls.
 * @param show True to show, false to hide.
 */
function toggleLoading(show: boolean) {
  if (show) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.className = 'message model-message loading-indicator';
    loadingDiv.innerHTML = `<div class="spinner"></div><span>Thinking...</span>`;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    submitButton.disabled = true;
    promptInput.disabled = true;
  } else {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
    submitButton.disabled = false;
    promptInput.disabled = false;
    promptInput.focus();
  }
}

/**
 * Calls the Gemini API with the user's prompt and displays the response.
 * @param prompt The user's prompt.
 */
async function callGemini(prompt: string) {
  toggleLoading(true);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ codeExecution: {} }],
      },
    });
    
    // Using `any` to access potentially non-standard properties from the original code.
    const executableCode = (response as any).executableCode;
    const codeExecutionResult = (response as any).codeExecutionResult;

    let fullResponse = '';
    if (executableCode) {
      fullResponse += '### Code Generated:\n```python\n' + executableCode + '\n```\n';
    }
    if (codeExecutionResult) {
      fullResponse += '\n### Execution Result:\n' + codeExecutionResult;
    }

    if (fullResponse) {
      await displayMessage(fullResponse, 'model');
    } else if (response.text) {
      // Fallback to text response if no code is generated
      await displayMessage(response.text, 'model');
    } else {
      await displayMessage("I'm sorry, I couldn't generate a response for that. Please try a different prompt.", 'model');
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    await displayMessage(`**Error:** ${errorMessage}`, 'error');
  } finally {
    toggleLoading(false);
  }
}

/**
 * Handles the form submission event.
 */
async function handleFormSubmit(event: SubmitEvent) {
  event.preventDefault();
  const prompt = promptInput.value.trim();

  if (prompt) {
    promptInput.value = '';
    // Auto-resize textarea
    promptInput.style.height = 'auto';
    await displayMessage(prompt, 'user');
    await callGemini(prompt);
  }
}

/**
 * Auto-resize the textarea height based on content.
 */
function autoResizeTextarea() {
    promptInput.style.height = 'auto';
    promptInput.style.height = (promptInput.scrollHeight) + 'px';
}


/**
 * Main function to initialize the application and set up event listeners.
 */
function main() {
  promptForm.addEventListener('submit', handleFormSubmit);
  promptInput.addEventListener('input', autoResizeTextarea);
  promptInput.addEventListener('keydown', (e) => {
      // Submit on Enter, allow new lines with Shift+Enter
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          promptForm.requestSubmit();
      }
  });

  displayMessage("Hello! I can write and execute Python code for you. What would you like to build or calculate?", 'model');
}

main();
