import { after, before, describe, it, mock } from "node:test";
import { assert } from "chai";
import express from "express";
import bodyParser from "body-parser";
import managers from "./manager.js";
import bbopRestResponse from "bbop-rest-response";

var manager_base = managers.base;
var manager_node = managers.node;
var manager_sync_request = managers.sync_request;
var manager_jquery = managers.jquery;

var response_base = bbopRestResponse.base;
var response_json = bbopRestResponse.json;

var target = null;
var test_server = null;
before(async function () {
  var app = express();
  app.use(
    bodyParser.json({
      type: ["application/json", "application/sparql-results+json"],
    }),
  );
  app.use(bodyParser.urlencoded({ extended: true }));
  app.get("/error", function (req, res) {
    var q = null;
    if (req && req.query && req.query.q) {
      q = req.query.q;
    }
    res.status(500);
    res.send({ text: "error", q: q, method: "GET" });
  });
  app.get("/", function (req, res) {
    var q = null;
    if (req && req.query && req.query.q) {
      q = req.query.q;
    }
    res.send({ text: "hello world", q: q, method: "GET" });
  });
  app.post("/", function (req, res) {
    var q = null;
    if (req && req.body && req.body.q) {
      q = req.body.q;
    }
    res.send({ text: "hello world", q: q, method: "POST" });
  });
  app.all("/headers", function (req, res) {
    res.send({
      head: { vars: ["rtcl"] },
      results: {
        bindings: [
          {
            rtcl: {
              type: "uri",
              value: "http://example.org/resource/1",
            },
          },
        ],
      },
      accept: req.get("accept") || null,
      method: req.method,
      query: req.query.query || null,
      posted_query: req.body?.query || null,
    });
  });

  await new Promise(function (resolve) {
    test_server = app.listen(0, resolve);
  });
  var port = test_server.address().port;
  target = "http://localhost:" + port;
});

after(async function () {
  if (test_server) {
    await new Promise(function (resolve, reject) {
      test_server.close(function (error) {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});

describe("bbop-rest-manager#base + bbop-rest-response#base", function () {
  it("basic sync (watch callback)", function () {
    var str = "";
    var m = new manager_base(response_base);
    m.register("success", function () {
      str = str + "A";
    });
    m.resource("foo");

    m.fetch();
    assert.equal(str, "A");
    m.fetch();
    assert.equal(str, "AA");
  });

  it("basic sync (watch response)", function () {
    var m = new manager_base(response_base);
    m.resource("foo");

    var r = m.fetch();
    assert.equal(r.okay(), true);
    assert.equal(r.message_type(), "success");
    assert.equal(r.message(), "empty");
  });

  it("basic async (watch callback)", async function () {
    var str = "";
    var m = new manager_base(response_base);
    m.register("success", function () {
      str = str + "A";
    });
    m.resource("foo");

    await m.start();
    assert.equal(str, "A");
    await m.start();
    assert.equal(str, "AA");
  });

  it("basic async (watch promise)", async function () {
    var m = new manager_base(response_base);
    m.resource("foo");

    var r = await m.start();
    assert.equal(r.okay(), true);
    assert.equal(r.message_type(), "success");
    assert.equal(r.message(), "empty");
  });
});

describe("bbop-rest-manager#base + bbop-rest-response#json", function () {
  it("mostly just testing the response here, tested manager above", async function () {
    var total = 0;
    var m = new manager_base(response_json);
    m.register("success", function (resp) {
      total += resp.raw().foo.bar;
    });

    await m.start("foo", { foo: { bar: 1 } });
    assert.equal(total, 1);
    await m.start();
    assert.equal(total, 2);
    await m.start("bar", { foo: { bar: 2 } });
    assert.equal(total, 4);
  });
});

describe("bbop-rest-manager#node + bbop-rest-response#json", function () {
  it("basic successful async (callbacks)", async function () {
    var path = "/";
    var seen = false;

    var m = new manager_node(response_json);
    m.register("success", function (resp) {
      seen = true;
      assert.equal(resp.raw().text, "hello world");
    });
    m.register("error", function () {
      assert.fail("error callback is not expected");
    });

    await m.start(target + path);
    assert.equal(seen, true);
  });

  it("basic successful async (promise)", async function () {
    var m = new manager_node(response_json);
    var resp = await m.start(target + "/");
    assert.equal(resp.raw().text, "hello world");
  });

  it("basic error async (callback)", async function () {
    var seen = false;
    var m = new manager_node(response_json);
    m.register("error", function () {
      seen = true;
    });

    await m.start(target + "/error");
    assert.equal(seen, true);
  });

  it("basic error async (promise)", async function () {
    var m = new manager_node(response_json);
    var resp = await m.start(target + "/error");
    assert.equal(resp.okay(), false);
  });

  it("see if we can actually supply payload arguments (GET)", async function () {
    var m = new manager_node(response_json);
    var resp = await m.start(target + "/", { q: "foo" }, "GET");
    assert.equal(resp.raw().q, "foo");
  });

  it("see if we can actually supply payload arguments (POST)", async function () {
    var m = new manager_node(response_json);
    var resp = await m.start(target + "/", { q: "foo" }, "POST");
    assert.equal(resp.raw().q, "foo");
  });
});

describe("bbop-rest-manager#sync_request compatibility", function () {
  it("fetch warns and returns null while starting async work", async function () {
    var warnings = [];
    var warn = mock.method(console, "warn", function (message) {
      warnings.push(message);
    });

    try {
      var m = new manager_sync_request(response_json);
      var seen = false;
      var completion = new Promise(function (resolve) {
        m.register("success", function (resp) {
          seen = true;
          assert.equal(resp.raw().text, "hello world");
          resolve();
        });
      });

      var result = m.fetch(target + "/");
      assert.equal(result, null);
      await completion;
      assert.equal(seen, true);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /deprecated/);
    } finally {
      warn.mock.restore();
    }
  });

  it("start warns and behaves asynchronously", async function () {
    var warnings = [];
    var warn = mock.method(console, "warn", function (message) {
      warnings.push(message);
    });

    try {
      var m = new manager_sync_request(response_json);
      var resp = await m.start(target + "/", { q: "foo" }, "POST");
      assert.equal(resp.raw().q, "foo");
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /deprecated/);
    } finally {
      warn.mock.restore();
    }
  });
});

describe("bbop-rest-manager#jquery compatibility", function () {
  it("uses fetch-backed transport for callback flow", async function () {
    var seen = false;
    var m = new manager_jquery(response_json);
    m.register("success", function (resp) {
      seen = true;
      assert.equal(resp.raw().text, "hello world");
    });

    await m.start(target + "/");
    assert.equal(seen, true);
  });

  it("supports GET and POST payloads", async function () {
    var m = new manager_jquery(response_json);
    var getResp = await m.start(target + "/", { q: "foo" }, "GET");
    assert.equal(getResp.raw().q, "foo");

    var postResp = await m.start(target + "/", { q: "bar" }, "POST");
    assert.equal(postResp.raw().q, "bar");
  });

  it("jsonp methods warn and are otherwise no-ops", function () {
    var warnings = [];
    var warn = mock.method(console, "warn", function (message) {
      warnings.push(message);
    });

    try {
      var m = new manager_jquery(response_json);
      assert.equal(m.use_jsonp(), false);
      assert.equal(m.jsonp_callback(), "json.wrf");
      assert.equal(m.use_jsonp(true), false);
      assert.equal(m.jsonp_callback("callback"), "json.wrf");
      assert.equal(warnings.length, 2);
      assert.match(warnings[0], /JSONP support has been removed/);
      assert.match(warnings[1], /JSONP support has been removed/);
    } finally {
      warn.mock.restore();
    }
  });
});

describe("header forwarding tests", function () {
  it("node GET forwards headers", async function () {
    var m = new manager_node(response_json);
    var resp = await m.start(target + "/headers?query=test-query", null, null, [
      ["accept", "application/sparql-results+json"],
    ]);
    assert.isDefined(resp.raw().head);
    assert.isDefined(resp.raw().results);
    assert.equal(resp.raw().accept, "application/sparql-results+json");
    assert.equal(resp.raw().method, "GET");
    assert.equal(resp.raw().query, "test-query");
  });

  it("node POST forwards headers", async function () {
    var m = new manager_node(response_json);
    var resp = await m.start(target + "/headers", { query: "test-query" }, "POST", [
      ["accept", "application/sparql-results+json"],
    ]);
    assert.isDefined(resp.raw().head);
    assert.isDefined(resp.raw().results);
    assert.equal(resp.raw().accept, "application/sparql-results+json");
    assert.equal(resp.raw().method, "POST");
    assert.equal(resp.raw().posted_query, "test-query");
  });

  it("jquery alias GET forwards headers", async function () {
    var m = new manager_jquery(response_json);
    var resp = await m.start(target + "/headers?query=test-query", null, null, [
      ["accept", "application/sparql-results+json"],
    ]);
    assert.isDefined(resp.raw().head);
    assert.isDefined(resp.raw().results);
    assert.equal(resp.raw().accept, "application/sparql-results+json");
    assert.equal(resp.raw().method, "GET");
    assert.equal(resp.raw().query, "test-query");
  });
});
