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

        var response = responseBuilder
            .speak(reprompt)
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

const PlaceIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'PlaceIntent';
    },
    async handle(handlerInput) {
        const row = handlerInput.requestEnvelope.request.intent.slots.row.value;
        const col = handlerInput.requestEnvelope.request.intent.slots.col.value;
        const orientation = handlerInput.requestEnvelope.request.intent.slots.orientation.value;
        const ship = handlerInput.requestEnvelope.request.intent.slots.ship.value;
        const payload = { type: "PlaceRequest", row, col, orientation, ship };
        return await sendUnityMessage(payload, "What's next?", handlerInput);

    }
}

const ConfirmPlacementIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'ConfirmPlacementIntent';
    },
    async handle(handlerInput) {
        return await sendUnityMessage({
            type: "ConfirmPlacement"
        }, "What's next?", handlerInput);

    }
}

const FireIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'FireIntent';
    },
    async handle(handlerInput) {
        const row = handlerInput.requestEnvelope.request.intent.slots.row.value;
        const col = handlerInput.requestEnvelope.request.intent.slots.col.value;
        const payload = { type: "FireRequest", row, col };
        return await sendUnityMessage(payload, "What's next?", handlerInput);

    }
}

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
        PlaceIntentHandler,
        ConfirmPlacementIntentHandler,
        FireIntentHandler,
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

    let speechText = "Welcome to battleship!";
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