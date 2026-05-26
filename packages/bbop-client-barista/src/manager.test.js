import { after, before, describe, it } from "node:test";
import { assert } from "chai";
import http from "node:http";

import manager from "./manager.js";
import { Server } from "socket.io";

function waitForEvent(client, category, predicate) {
  return new Promise(function (resolve) {
    client.register(category, function (data) {
      if (!predicate || predicate(data)) {
        resolve(data);
      }
    });
  });
}

async function closeClient(client) {
  if (!client || !client.socket) {
    return;
  }

  await new Promise(function (resolve) {
    client.socket.once("disconnect", function () {
      resolve();
    });
    client.socket.close();
  });
}

describe("barista client can function minimally", function () {
  var httpServer = null;
  var io = null;
  var baseUrl = null;

  before(async function () {
    httpServer = http.createServer();
    io = new Server(httpServer);

    io.on("connection", function (socket) {
      socket.emit("initialization", {
        class: "initialization",
        model_id: "gomodel:test",
        message: "ready",
      });

      socket.on("relay", function (data) {
        socket.emit("relay", data);
      });

      socket.on("query", function (data) {
        socket.emit("query", data);
      });
    });

    await new Promise(function (resolve) {
      httpServer.listen(0, "127.0.0.1", function () {
        var address = httpServer.address();
        baseUrl = "http://127.0.0.1:" + address.port;
        resolve();
      });
    });
  });

  after(async function () {
    await new Promise(function (resolve, reject) {
      io.close(() => {
        if (!httpServer.listening) {
          resolve();
          return;
        }

        httpServer.close(function (error) {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    });
  });

  it("connects and receives initialization", async function () {
    var client = new manager(baseUrl, "test-token");
    client.logger(false);

    var connectPromise = waitForEvent(client, "connect");
    var initPromise = waitForEvent(client, "initialization");

    client.connect("gomodel:test");

    var connectData = await connectPromise;
    var initData = await initPromise;

    assert.isTrue(client.okay());
    assert.equal(connectData.model_id, "gomodel:test");
    assert.equal(connectData.token, "test-token");
    assert.equal(connectData.message_type, "success");
    assert.equal(initData.message, "ready");

    await closeClient(client);
  });

  it("relays messages scoped to the current model", async function () {
    var client = new manager(baseUrl, "relay-token");
    client.logger(false);

    var relayPromise = waitForEvent(client, "message", function (data) {
      return data.message === "hello world";
    });
    var connectPromise = waitForEvent(client, "connect");

    client.connect("gomodel:test");
    await connectPromise;

    client.message({
      message_type: "info",
      message: "hello world",
    });

    var relayData = await relayPromise;

    assert.equal(relayData.class, "message");
    assert.equal(relayData.message, "hello world");
    assert.equal(relayData.model_id, "gomodel:test");
    assert.equal(relayData.token, "relay-token");

    await closeClient(client);
  });

  it("queries and receives responses for the current model", async function () {
    var client = new manager(baseUrl, "query-token");
    client.logger(false);

    var queryPromise = waitForEvent(client, "query");
    var connectPromise = waitForEvent(client, "connect");

    client.connect("gomodel:test");
    await connectPromise;

    client.get_layout();

    var queryData = await queryPromise;

    assert.equal(queryData.class, "query");
    assert.equal(queryData.query, "layout");
    assert.equal(queryData.model_id, "gomodel:test");
    assert.equal(queryData.token, "query-token");

    await closeClient(client);
  });
});
