'use strict';

process.env.DEBUG = 'actions-on-google:*';

const MongoClient = require('mongodb').MongoClient;
const http = require('http');
const xml2js = require('xml2js');
const moment = require('moment-timezone');

const {dialogflow} = require('actions-on-google');

// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

// Instantiate the Dialogflow client.
const app = dialogflow({debug: true});

// Connection URL
const MONGO_CONNECTION_URL = process.env.MONGO_CONNECTION_URL;
const MONGO_USERNAME = process.env.MONGO_USERNAME;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;

// Database Name
const DATABASE_NAME = 'babyfeed';
const COLLECTION_NAME = 'feedTimes';

// a. the action name from the make_name Dialogflow intent
const SAVE_FEED_TIME_ACTION = 'save_feed_time';
const DEFAULT = 'Default Welcome Intent';

const TIMEZONE = 'America/Los_Angeles';
const ERROR_MESSAGE = 'An error has occurred, please try again later';

app.intent(SAVE_FEED_TIME_ACTION, (conv, parameters) => {
    return new Promise((resolve, reject)  => {
        var feedAmount = parameters.feedAmount || 3;
        var feedTime = {
            feedTime: new Date(),
            feedAmount: feedAmount
        };

        saveNewFeedTime(feedTime).then((result) => {
            var time = getReadableTime(feedTime.feedTime);
            conv.close('Recording that you fed the baby ' + feedTime.feedAmount + ' ounces at at ' + time);
            resolve();
        }).catch((error) => {
            console.log(error);
            conv.close(ERROR_MESSAGE);
            resolve();
        });
    });
});

app.intent(DEFAULT, (conv) => {
    return new Promise(function(resolve, reject) {
        findLatestFeedTime().then((result) => {
            var time = getReadableTime(result.feedTime);
            conv.close('You last fed the baby ' + result.feedAmount + ' ounces at ' + time);
            resolve();
        }).catch((error) => {
            console.log(error);
            conv.close(ERROR_MESSAGE);
            resolve();
        });
    });
});

exports.babyFeed = functions.https.onRequest(app);

const getMongoCollection = () => {
    return new Promise((resolve, reject) => {
        var client =  new MongoClient(MONGO_CONNECTION_URL, {
            useNewUrlParser: true,
            auth : {
                user: MONGO_USERNAME,
                password: MONGO_PASSWORD
            }
        });
        client.connect(function (error) {
            if (error) {
                reject(error);
            } else {
                const db = client.db(DATABASE_NAME);

                const collection = db.collection(COLLECTION_NAME);

                resolve({
                    client: client,
                    collection: collection
                });
            }
        });
    });
};

const findLatestFeedTime = () => {
    return new Promise((resolve, reject) => {
        getMongoCollection().then((mongo) => {
            mongo.collection.find({}).sort("feedTime", -1).toArray(function (error, docs) {
                if (error) {
                    mongo.client.close();
                    reject(error);
                } else {
                    mongo.client.close();
                    resolve(docs[0]);
                }

            });
        }).catch((error) => {
            reject(error);
        });
    });
};

const saveNewFeedTime = (feedTime) => {
    return new Promise((resolve, reject) => {
        getMongoCollection().then((mongo) => {
            mongo.collection.insert(feedTime, function(error, result) {
                if (error || result.result.ok === 1) {
                    mongo.client.close();
                    reject(error);
                } else {
                    mongo.client.close();
                    resolve();
                }
            });
        }).catch((error) => {
            reject(error);
        });
    });
};

const getReadableTime = (time) => {
    return moment(time).tz(TIMEZONE).format('h:mma');
};