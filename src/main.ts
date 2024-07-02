import axios, { isAxiosError } from 'axios';
import fs from 'fs';
import path from 'path';


const API_URL = "http://localhost:8188/prompt";

const WORKFLOW_PATH = path.join(__dirname, "../workflow_api.json");


async function main() {
    const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH).toString());
    console.log(workflow)
    try {
        const res = await axios.post(API_URL, {
            prompt: workflow
        });
        console.log(res.data);
    } catch (e) {
        if (isAxiosError(e)) {
            console.log(e.response?.data); 
        } else {
            console.log(e);
        }
    }
}

main()