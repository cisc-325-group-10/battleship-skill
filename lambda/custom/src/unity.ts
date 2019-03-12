import "source-map-support/register";
import * as Alexa from 'ask-sdk';
import { HandlerInput } from "ask-sdk";
var AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
var alexaCookbook = require('./alexa-cookbook.js');
var alexaPlusUnityClass = require('alexaplusunity');
var alexaPlusUnity = new alexaPlusUnityClass("pub-c-fb2047b1-3026-4af9-8dc0-b80bdebbbca7", "sub-c-7b26c48a-4467-11e9-8534-9add990cf553", true);

const LaunchRequestHandler = {
    canHandle(handlerInput: HandlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    async handle(handlerInput: HandlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const responseBuilder = handlerInput.responseBuilder;

        var attributes = await attributesManager.getPersistentAttributes() || {};
        attributes = await setAttributes(attributes);

        if (attributes == null) {
            return ErrorHandler.handle(handlerInput, "Error setting attributes... Check logs");
        }

        var reprompt = " What shall we do?";
        var speechText = "Welcome to the Unity Plus Alexa Test!";

        var response = responseBuilder
            .speak(speechText + reprompt)
            .reprompt(reprompt)
            .getResponse();

        // Unity getting message history doesn't work right now
        // this means an established session cant't be joined by unity
        // so we are just going to go though the startup process every time for now
        if (attributes.SETUP_STATE == "STARTED" || true) {
            var launchSetUpResult = await launchSetUp(reprompt, handlerInput, attributes);
            attributes = launchSetUpResult.attributes;
            response = launchSetUpResult.response;
        }

        attributesManager.setPersistentAttributes(attributes);
        await attributesManager.savePersistentAttributes();
        return response;
    }
};

const DestroyIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'DestroyIntent';
    },
    async handle(handlerInput) {
        return await sendUnityMessage({
            type: "DestroyRequest"
        }, "What's next?", handlerInput);

    }
}

const StartGameIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'StartGameIntent';
    },
    async handle(handlerInput) {
        return await sendUnityMessage({
            type: "StartRequest"
        }, "What's next?", handlerInput);

    }
}

const NextGameIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'NextGame';
    },
    async handle(handlerInput) {
        return await sendUnityMessage({
            type: "NextGameRequest"
        }, "What's next?", handlerInput);

    }
}


const MathGameAnswerIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'MathGameAnswer';
    },
    async handle(handlerInput) {
        const answer = handlerInput.requestEnvelope.request.intent.slots.Answer.value;
        const payload = { type: "MathGameAnswer", answer: answer };
        return await sendUnityMessage(payload, "What's your answer?", handlerInput);
    }
};

const TicTacToeIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'TicTacToeAnswer';
    },
    async handle(handlerInput) {
        const answer = handlerInput.requestEnvelope.request.intent.slots.position.value;
        const payload = { type: "TicTacToeAnswer", position: answer };
        return await sendUnityMessage(payload, "What's your move?", handlerInput);
    }
};

const ColorGameAnswerIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'ColorGameAnswer';
    },
    async handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        const payload = {
            type: "ColorGameAnswer",
            color1: slots.ColorA.value,
            color2: slots.ColorB.value,
            color3: slots.ColorC.value,
            color4: slots.ColorD.value,
            color5: slots.ColorE.value
        };
        return await sendUnityMessage(payload, "What's your answer?", handlerInput);
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    async handle(handlerInput) {
        const payload = { type: "HelpRequest" };
        return await sendUnityMessage(payload, null, handlerInput);
    },
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speechText = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speechText)
            .withSimpleCard('Alexa Plus Unity Test', speechText)
            .getResponse();
    },
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

        return handlerInput.responseBuilder.getResponse();
    },
};


const speechOutputs = {
    errors: {
        speak: [
            "Error!",
            "There was an issue!"
        ],
        reprompt: [
            " Please try again.",
            " Please try again later."
        ]
    },
};
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);

        var errorReprompt = alexaCookbook.getRandomItem(speechOutputs.errors.reprompt);
        var errorSpeech = alexaCookbook.getRandomItem(speechOutputs.errors.speak) + errorReprompt;
        return handlerInput.responseBuilder
            .speak(errorSpeech)
            .reprompt(errorReprompt)
            .getResponse();
    },
};

const skillBuilder = Alexa.SkillBuilders.standard();

export const handler = skillBuilder
    .addRequestHandlers(
        LaunchRequestHandler,
        DestroyIntentHandler,
        StartGameIntentHandler,
        NextGameIntentHandler,
        MathGameAnswerIntentHandler,
        TicTacToeIntentHandler,
        ColorGameAnswerIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .withTableName('Battleship')
    .withAutoCreateTable(true)
    .lambda();


async function sendUnityMessage(payload: any, reprompt: string | null, handler: HandlerInput) {
    const attributes = await handler.attributesManager.getPersistentAttributes();
    const response = await alexaPlusUnity.publishMessageAndListenToResponse(payload, attributes.PUBNUB_CHANNEL, 4000).then((data) => {
        const speechText = data.message;
        return handler.responseBuilder
            .speak(speechText)
            .reprompt(reprompt ? reprompt : speechText)
            .getResponse();
    }).catch((err) => {
        return ErrorHandler.handle(handler, err);
    });
    return response;
}


async function launchSetUp(reprompt, handlerInput, attributes) {
    const responseBuilder = handlerInput.responseBuilder;

    let speechText = "Before we begin playing, we would normally need to go through some setup. You would receive a code to enter in the game to connect with the Alexa. For now there is no input screen so it is hardcoded." + reprompt;
    //let speechText = `<speak> Before we begin playing, we need to go through some setup. Your player ID is  <say-as interpret-as="spell-out">${attributes.PUBNUB_CHANNEL}</say-as>. You will need to input this ID in the game when prompted. ${reprompt} </speak>`
    var response = await alexaPlusUnity.addChannelToGroup(attributes.PUBNUB_CHANNEL, "Battleship").then(async (data) => {
        var responseToReturn = responseBuilder
            .speak(speechText)
            .reprompt(reprompt)
            .withSimpleCard('Alexa Plus Unity', "Here is your Player ID: " + attributes.PUBNUB_CHANNEL)
            .getResponse();

        var userId = handlerInput.requestEnvelope.session.user.userId;
        return await sendUserId(userId, attributes, handlerInput, responseToReturn);
    }).catch((err) => {
        return ErrorHandler.handle(handlerInput, err);
    });
    var result = {
        response: response,
        attributes: attributes
    }
    return result;
}

async function sendUserId(userId, attributes, handlerInput, response) {
    var payloadObj = {
        type: "AlexaUserId",
        message: userId
    };
    return await alexaPlusUnity.publishMessage(payloadObj, attributes.PUBNUB_CHANNEL).then((data) => {
        return response;
    }).catch((err) => {
        return ErrorHandler.handle(handlerInput, err);
    });
}

async function setAttributes(attributes) {
    if (Object.keys(attributes).length === 0) {
        attributes.SETUP_STATE = "STARTED";
        const newChannel = "XXXXX";
        //var newChannel = await alexaPlusUnity.uniqueQueueGenerator("AlexaPlusUnityTest");

        if (newChannel != null) {
            attributes.PUBNUB_CHANNEL = newChannel;
        } else {
            return null;
        }
        //Add more attributes here that need to be initalized at skill start
    }
    return attributes;
}