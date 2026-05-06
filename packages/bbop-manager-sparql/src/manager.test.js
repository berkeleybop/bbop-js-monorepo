import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { assert } from "chai";

import manager from "./manager.js";

function loadFixture(name) {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function makeResponse(seed) {
  return {
    message_type: function () {
      return seed.message_type;
    },
    message: function () {
      return seed.message;
    },
    raw: function () {
      return seed.raw || null;
    },
  };
}

function makeResponseHandler() {
  return function ResponseHandler(seed) {
    this._seed = seed;
    this.message_type = function () {
      return (seed && (seed.message_type || seed["message_type"])) || null;
    };
    this.message = function () {
      return (seed && seed.message) || null;
    };
  };
}

function makeEngine() {
  var callbacks = {};
  var calls = [];
  var currentMethod = null;

  return {
    calls: calls,
    callbacks: callbacks,
    register: function (name, fn) {
      callbacks[name] = fn;
    },
    method: function (nextMethod) {
      if (typeof nextMethod !== "undefined") {
        currentMethod = nextMethod;
      }
      return currentMethod;
    },
    fetch: function (resource, payload) {
      calls.push({ kind: "fetch", resource: resource, payload: payload, method: currentMethod });
      return payload;
    },
    start: function (resource, payload) {
      calls.push({ kind: "start", resource: resource, payload: payload, method: currentMethod });
      return Promise.resolve(payload);
    },
  };
}

describe("bbop-manager-sparql state", function () {
  it("gets and sets endpoint and prefixes", function () {
    var m = new manager("https://example.org/sparql", [["wd", "<http://x/>"]]);

    assert.equal(m.endpoint(), "https://example.org/sparql");
    m.endpoint("https://example.net/query");
    assert.equal(m.endpoint(), "https://example.net/query");

    assert.deepEqual(m.prefixes(), [["wd", "<http://x/>"]]);
    m.add_prefix("wdt", "<http://y/>");
    assert.deepEqual(m.prefixes(), [
      ["wd", "<http://x/>"],
      ["wdt", "<http://y/>"],
    ]);
  });
});

describe("bbop-manager-sparql query dispatch", function () {
  it("uses POST for shorter queries and prepends configured prefixes", function () {
    var engine = makeEngine();
    var ResponseHandler = makeResponseHandler();
    var m = new manager(
      "https://example.org/sparql",
      [["wd", "<http://www.wikidata.org/entity/>"]],
      ResponseHandler,
      engine,
      "sync",
    );

    var result = m.query("SELECT * WHERE { ?s ?p ?o . }");

    assert.equal(engine.calls.length, 1);
    assert.equal(engine.calls[0].kind, "fetch");
    assert.equal(engine.calls[0].method, "POST");
    assert.equal(engine.calls[0].resource, "https://example.org/sparql");
    assert.equal(
      engine.calls[0].payload.query,
      "PREFIX wd:<http://www.wikidata.org/entity/>\nSELECT * WHERE { ?s ?p ?o . }",
    );
    assert.equal(result, engine.calls[0].payload);
  });

  it("uses GET for longer queries", function () {
    var engine = makeEngine();
    var ResponseHandler = makeResponseHandler();
    var m = new manager("https://example.org/sparql", [], ResponseHandler, engine, "sync");
    var longQuery = "SELECT * WHERE { " + "?s ?p ?o . ".repeat(120) + "}";

    m.query(longQuery);

    assert.equal(engine.calls.length, 1);
    assert.equal(engine.calls[0].method, "GET");
  });

  it("throws if query is attempted without a transport engine", function () {
    var m = new manager("https://example.org/sparql", []);

    assert.throws(function () {
      m.query("SELECT * WHERE { ?s ?p ?o . }");
    }, /cannot query/);
  });
});

describe("bbop-manager-sparql templates", function () {
  it("renders a plain string template with inline prefixes", function () {
    var m = new manager();
    var output = m.template(loadFixture("template-01.yaml"), { pmid: "999" });

    assert.equal(
      output,
      `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>

SELECT ?rtcl ?title ?author ?journal ?date
WHERE
{
  ?rtcl wdt:P698 "999".
  OPTIONAL { ?rtcl wdt:P1476 ?title. }
  OPTIONAL { ?rtcl wdt:P2093 ?author. }
  OPTIONAL { ?rtcl wdt:P1433 ?journal. }
  OPTIONAL { ?rtcl wdt:P577 ?date. }
}
`,
    );
  });

  it("renders a template with manager-provided prefixes when yaml has none", function () {
    var m = new manager(undefined, [
      ["wd", "<http://www.wikidata.org/entity/>"],
      ["wdt", "<http://www.wikidata.org/prop/direct/>"],
    ]);
    var output = m.template(loadFixture("template-02.yaml"), { pmid: "999" });

    assert.equal(
      output,
      `SELECT ?rtcl ?title ?author ?journal ?date
WHERE
{
  ?rtcl wdt:P698 "999".
  OPTIONAL { ?rtcl wdt:P1476 ?title. }
  OPTIONAL { ?rtcl wdt:P2093 ?author. }
  OPTIONAL { ?rtcl wdt:P1433 ?journal. }
  OPTIONAL { ?rtcl wdt:P577 ?date. }
}
`,
    );
  });

  it("renders object and yaml prefix templates exactly as the legacy code produces", function () {
    var m = new manager();

    assert.equal(
      m.template(loadFixture("template-03.yaml"), { pmid: "999" }),
      `PREFIX wd:<http://www.wikidata.org/entity/> PREFIX wdt:<http://www.wikidata.org/prop/direct/> SELECT ?rtcl ?title ?author ?journal ?date
WHERE
{
  ?rtcl wdt:P698 "999".
  OPTIONAL { ?rtcl wdt:P1476 ?title. }
  OPTIONAL { ?rtcl wdt:P2093 ?author. }
  OPTIONAL { ?rtcl wdt:P1433 ?journal. }
  OPTIONAL { ?rtcl wdt:P577 ?date. }
}
`,
    );

    assert.equal(
      m.template(loadFixture("template-04.yaml"), { pmid: "999" }),
      `PREFIX wd:<http://www.wikidata.org/entity/> PREFIX wdt:<http://www.wikidata.org/prop/direct/> SELECT ?rtcl ?title ?author ?journal ?date
WHERE
{
  ?rtcl wdt:P698 "999".
  OPTIONAL { ?rtcl wdt:P1476 ?title. }
  OPTIONAL { ?rtcl wdt:P2093 ?author. }
  OPTIONAL { ?rtcl wdt:P1433 ?journal. }
  OPTIONAL { ?rtcl wdt:P577 ?date. }
}
`,
    );
  });

  it("renders template variables inside graph patterns", function () {
    var m = new manager();
    var output = m.template(loadFixture("template-05.yaml"), { model_id: "gomodel:123" });

    assert.equal(
      output,
      `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX gomodel: <http://model.geneontology.org/#>
SELECT * WHERE {
  GRAPH { gomodel:123
    ?sub ?pred ?obj .
  }
}
LIMIT 20
`,
    );
  });

  it("supports object templates and rejects unsupported object formats", function () {
    var m = new manager();
    var output = m.template(
      {
        prefixes: [{ prefix: "ex", expansion: "<http://example.org/>" }],
        query: "SELECT * WHERE { ex:{{ id }} ?p ?o . }",
      },
      { id: "foo" },
    );

    assert.equal(output, "PREFIX ex:<http://example.org/> SELECT * WHERE { ex:foo ?p ?o . }");
    assert.throws(function () {
      m.template({ title: "no query field" }, {});
    }, /does not support this object format/);
  });
});

describe("bbop-manager-sparql callback wiring", function () {
  it("forwards success and error callbacks from the engine", function () {
    var engine = makeEngine();
    var ResponseHandler = makeResponseHandler();
    var m = new manager("https://example.org/sparql", [], ResponseHandler, engine, "sync");
    var seen = [];

    m.register("success", function (resp) {
      seen.push(["success", resp.message()]);
    });
    m.register("error", function (resp) {
      seen.push(["error", resp.message()]);
    });

    engine.callbacks.success(makeResponse({ message_type: "success", message: "ok" }), m);
    engine.callbacks.error(makeResponse({ message_type: "error", message: "boom" }), m);

    assert.deepEqual(seen, [
      ["success", "ok"],
      ["error", "boom"],
    ]);
  });

  it("wraps missing error responses through the provided response handler", function () {
    var engine = makeEngine();
    var ResponseHandler = makeResponseHandler();
    var m = new manager("https://example.org/sparql", [], ResponseHandler, engine, "sync");
    var seen = null;

    m.register("error", function (resp) {
      seen = resp;
    });

    engine.callbacks.error(null, m);

    assert.isNotNull(seen);
    assert.equal(seen.message_type(), "error");
    assert.equal(seen.message(), "deep manager error");
  });
});
