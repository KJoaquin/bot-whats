const dialogflow = require('@google-cloud/dialogflow');
const fs = require('fs')
const {nanoid} = require('nanoid')
//import { nanoid } from 'nanoid'
//const id = nanoid(length).toString();

/**
 * Debes de tener tu archivo con el nombre "chatbot-account.json" en la raíz del proyecto
 */

const KEEP_DIALOG_FLOW = (process.env.KEEP_DIALOG_FLOW === 'true')
let PROJECID;
let CONFIGURATION;
let sessionClient;

const checkFileCredentials = () => {
    if(!fs.existsSync(`${__dirname}/../chatbot-account.json`)){
        return false
    }

    const parseCredentials = JSON.parse(fs.readFileSync(`${__dirname}/../chatbot-account.json`));
    PROJECID = parseCredentials.project_id;
    CONFIGURATION = {
        credentials: {
            private_key: parseCredentials['private_key'],
            client_email: parseCredentials['client_email']
        }
    }
    sessionClient = new dialogflow.SessionsClient(CONFIGURATION);
}

// Create a new session
// Detect intent method
const detectIntent = async (queryText) => {
    let media   = null;
    let payload = null;

    let actionName = null;
    let intentName = null;

    const sessionId    = KEEP_DIALOG_FLOW ? 1 : nanoid();
    const sessionPath  = sessionClient.projectAgentSessionPath(PROJECID, sessionId);
    const languageCode = process.env.LANGUAGE
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: queryText,
                languageCode: languageCode,
            },
        },
    };

    const responses        = await sessionClient.detectIntent(request);
    const [singleResponse] = responses;
    const { queryResult }  = singleResponse
    const { intent }       = queryResult || { intent: {} }

    const parsePayload = queryResult['fulfillmentMessages'].find((a) => a.message === 'payload');
    const parameters   = queryResult['parameters'].fields;

    actionName = queryResult.action;

    if (intent) {
        intentName = intent['displayName'] || null
    }

    if (parsePayload && parsePayload.payload) {
        const { fields } = parsePayload.payload
        media = fields.media.stringValue || null
        payload = parsePayload['payload'].fields || null
    }
    
    const parseData = {
        replyMessage: queryResult.fulfillmentText,
        media,
        payload,
        actionName,
        intentName,
        parameters,
        trigger: null
    }

    //console.log("Action Name -------> ", actionName);
    //console.log("Intent Name--------> ", intentName);

    //console.log("Data------: ", parseData);
    //console.log("Response------: ", queryResult);
    
    return parseData
}

const getDataIa = (message = '', cb = () => { }) => {
    detectIntent(message).then((res) => {
        cb(res)
    })
}

checkFileCredentials();

module.exports = { getDataIa }
