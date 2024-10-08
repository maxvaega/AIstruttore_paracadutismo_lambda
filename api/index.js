require("dotenv").config(); 

const express = require("express");
const { urlencoded, json } = require("body-parser");
const path = require("path");
const { checkEnvVars, verifySignature } = require("./actions");
const axios = require("axios");
const fetch = require("node-fetch-commonjs");
const fs = require("node:fs/promises");
const crypto = require("crypto");
const app = express();

// Parse application/x-www-form-urlencoded
app.use(
  urlencoded({
    extended: true,
  })
);

// Parse application/json. Verify that callback came from Facebook
app.use(json({ verify: verifySignature }));

checkEnvVars();

// simple test endpoint
app.get("/test", async function (req, res) {
  res.status(200).send({ msg: "Hi :)" });
});

// Add support for GET requests to our webhook
// test with curl -X GET "localhost:3000/messaging-webhook?hub.verify_token=FreeflyYourMind&hub.challenge=CHALLENGE_ACCEPTED&hub.mode=subscribe"
app.get("/messaging-webhook", (req, res) => {
  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else {
    console.log("missing 'mode' and 'token'");
    res.sendStatus(403);
  }
});

// app.post("/_messaging-webhook", (req, res) => {
//   console.log("received webook");

//   axios
//     .get("https://jsonplaceholder.typicode.com/todos/1")
//     .then(() => {
//       console.log("resposnse finalmente");
//       res.status(200).send("EVENT_RECEIVED");
//     })
//     .catch((err) => {
//       console.log("error");
//       res.status(200).send("EVENT_RECEIVED");
//     });
// });

app.post("/messaging-webhook", async (req, res) => {
  let body = req.body;
  console.log(`## Received webhook:`);

  if (body.object === "instagram") {
    res.status(200).send("EVENT_RECEIVED");

    body.entry.forEach(async function (entry) {
      entry.messaging.forEach(async function (webhookEvent) {
        // Discard uninteresting events
        if ("read" in webhookEvent) {
          console.log("Got a read event");
          return;
        } else if ("delivery" in webhookEvent) {
          console.log("Got a delivery event");
          return;
        } else if (webhookEvent.message && webhookEvent.message.is_echo) {
          console.log(
            "Got an echo of our send, mid = " + webhookEvent.message.mid
          );
          return;
        } else if (webhookEvent.message && webhookEvent.message.is_deleted) {
          console.log("Got a deleted messag");
          return;
        }
        if (!webhookEvent.message) {
          console.log("Cannot find message");
          return;
        }

        if (!webhookEvent.message.text) {
          console.log("cannot process not textual message");
          return;
        }

        console.dir(entry, { depth: null });

        // Get the sender PSID
        let senderPsid = webhookEvent.sender.id;
        if (!!senderPsid) {
          console.log("now I can analize event for psid", senderPsid);
          const msg = webhookEvent.message.text;

          axios
            .post(
              `https://graph.facebook.com/v20.0/${process.env.PAGE_ID}/messages`,
              {
                recipient: {
                  id: senderPsid,
                },
                messaging_type: "RESPONSE",
                message: {
                  text: msg,
                },
                access_token: process.env.ACCESS_TOKEN,
              }
            )
            .then(function (response) {
              console.log("SENDED PONG => OK :)");
            })
            .catch(function (error) {
              console.error("SENDED PON => KO ;(");
              console.error(error);
            });
        } else {
          console.log("### NOT FOUND PSID");
        }
      });
    });
  } else {
    res.sendStatus(404); 
  }
});

// start the server.
const listener = app.listen(3000, () => {
  console.log(`The app is listening on port ${listener.address().port}`);

  if (process.env.PAGE_ID) {
    console.log("Test your app by messaging:");
    console.log(`https://m.me/${process.env.PAGE_ID}`);
  }
});
