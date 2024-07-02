// This is a port of the ComfyUI websockets API example.
// https://github.com/comfyanonymous/ComfyUI/blob/master/script_examples/websockets_api_example_ws_images.py

import axios from 'axios';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as qs from 'querystring';
import fs from 'fs';
import path from 'path';

const COMFY_UI_SERVER_ADDRESS = "127.0.0.1:8188";

/**
 * Queue workflow for execution
 * @param clientId 
 * @param workflow JSON workflow object. This must be in API workflow format.
 * @returns 
 */
async function queueWorkflow(clientId: string, workflow: object): Promise<any> {
    const data = {
        prompt: workflow,
        client_id: clientId
    };
    const response = await axios.post(`http://${COMFY_UI_SERVER_ADDRESS}/prompt`, data);
    return response.data;
}

/**
 * Get image from server.
 * @param filename 
 * @param subfolder 
 * @param folderType 
 * @returns 
 */
async function getImage(filename: string, subfolder: string, folderType: string): Promise<Buffer> {
    const data = {
        filename: filename,
        subfolder: subfolder,
        type: folderType
    };
    const urlValues = qs.stringify(data);
    const response = await axios.get(`http://${COMFY_UI_SERVER_ADDRESS}/view?${urlValues}`, { responseType: 'arraybuffer' });
    return response.data;
}

/**
 * Gets execution history
 * @param promptId 
 * @returns 
 */
async function getHistory(promptId: string): Promise<any> {
    const response = await axios.get(`http://${COMFY_UI_SERVER_ADDRESS}/history/${promptId}`);
    return response.data;
}

/**
 * Saves an image to /out dir.
 * @param image 
 * @param filename 
 */
function saveImage(image: Buffer, filename: string) {
    const imageDir = path.join(__dirname, "../out/");
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir);
    }
    fs.writeFileSync(path.join(imageDir, filename), image);
}

async function executeWorkflow(prompt: object): Promise<string> {
    const clientId = uuidv4();
    const ws = new WebSocket(`ws://${COMFY_UI_SERVER_ADDRESS}/ws?clientId=${clientId}`);
    const promptResponse = await queueWorkflow(clientId, prompt);
    const promptId = promptResponse.prompt_id;

    return new Promise((resolve, reject) => {
        ws.on('message', (data: WebSocket.Data) => {
            const strData = data.toString();
            // Checking if the data is a valid JSON
            const message = (() => {
                try {
                    return JSON.parse(strData);
                } catch {
                    null
                }
            })();
            if (!message) {
                return;
            }
            if (message.type === 'executing') {
                const msgData = message.data;
                if (msgData.prompt_id === promptId && !msgData.node) {
                    // Execution is done
                    ws.close();
                    resolve(promptId);
                }
            }
        });

        // Connection is not closed by server usually.
        // If it is closed by server, it's an error.
        ws.on('close', () => {
            reject(new Error('Connection closed by server'));
        });

        ws.on('error', (err) => {
            reject(err);
        });
    });
}

const WORKFLOW_PATH = path.join(__dirname, "../workflow_api.json");

async function main() {
    const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH).toString());
    workflow["3"]["inputs"]["seed"] = Math.floor(Math.random() * 1000000000);
    const promptId = await executeWorkflow(workflow)
    const history = await getHistory(promptId);
    const imageInfo = history[promptId]["outputs"]["9"]["images"][0];
    const image = await getImage(imageInfo["filename"], imageInfo["subfolder"], imageInfo["type"]);
    saveImage(image, imageInfo["filename"]);
    console.log("Image saved to: " + imageInfo["filename"])
}
main()