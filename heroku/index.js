'use strict';

// FILL IN THESE VARS
const name = 'My Bot';
const avatarUrl = 'https://s.gravatar.com/avatar/f91b04087e0125153623a3778e819c0a?s=80';
// END VARS

const smoochBot = require('smooch-bot');
const MemoryLock = smoochBot.MemoryLock;
const SmoochApiStore = smoochBot.SmoochApiStore;
const SmoochApiBot = smoochBot.SmoochApiBot;
const StateMachine = smoochBot.StateMachine;
const app = require('../app');
const script = require('../script');
const SmoochCore = require('smooch-core');
const jwt = require('../jwt');

const store = new SmoochApiStore({
    jwt
});
const lock = new MemoryLock();

// API.ai config
var apiai = require('apiai');
var apiaiapp = apiai(process.env.APIAI_CLIENT_ACCESS_TOKEN);

console.log('APIAI Values %s:%s', apiai, apiaiapp);
// Smooch.io config
function createWebhook(smoochCore, target) {
    return smoochCore.webhooks.create({
        target,
        triggers: ['message:appUser']
    })
        .then((res) => {
            console.log('Smooch webhook created at target', res.webhook.target);
        })
        .catch((err) => {
            console.error('Error creating Smooch webhook:', err);
            console.error(err.stack);
        });
}

// Create a webhook if one doesn't already exist
if (process.env.SERVICE_URL) {
    const target = process.env.SERVICE_URL.replace(/\/$/, '') + '/webhook';
    const smoochCore = new SmoochCore({
        jwt
    });
    smoochCore.webhooks.list()
        .then((res) => {
            if (!res.webhooks.some((w) => w.target === target)) {
                createWebhook(smoochCore, target);
            }
        });
}

app.post('/webhook', function(req, res, next) {
    const messages = req.body.messages.reduce((prev, current) => {
        if (current.role === 'appUser') {
            prev.push(current);
        }
        return prev;
    }, []);

    if (messages.length === 0) {
        return res.end();
    }

    const appUser = req.body.appUser;
    const userId = appUser.userId || appUser._id;

    var apiairequest = apiaiapp.textRequest(messages[0].text);
    apiairequest.on('response', function(response) {
      const bot = new SmoochApiBot({
        name,
        avatarUrl,
        lock,
        store,
        userId
      });
      bot.say(response.result.fulfillment.speech);
      return res.end();
    });

    apiairequest.on('error', function(error) {
        res.send(error);
        res.sendStatus(500);
        return res.end();
    });

    apiairequest.end();
});

var server = app.listen(process.env.PORT || 8000, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Smooch Bot listening at http://%s:%s', host, port);
});
