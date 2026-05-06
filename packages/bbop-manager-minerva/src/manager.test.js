import { describe, it } from "node:test";
import { assert } from "chai";

import manager from "./manager.js";

function makeResponse(seed) {
  return {
    message_type: function () {
      return seed.message_type;
    },
    message: function () {
      return seed.message;
    },
    signal: function () {
      return seed.signal;
    },
    relations: function () {
      return seed.relations || [];
    },
    models_meta: function () {
      return seed.models_meta || {};
    },
    model_ids: function () {
      return seed.model_ids || [];
    },
    evidence: function () {
      return seed.evidence || [];
    },
    individuals: function () {
      return seed.individuals || [];
    },
    facts: function () {
      return seed.facts || [];
    },
    model_id: function () {
      return seed.model_id || null;
    },
  };
}

function makeEngine() {
  var callbacks = {};
  var calls = [];

  return {
    calls: calls,
    callbacks: callbacks,
    register: function (name, fn) {
      callbacks[name] = fn;
    },
    fetch: function (resource, payload) {
      calls.push({ method: "fetch", resource: resource, payload: payload });
      return payload;
    },
    start: function (resource, payload) {
      calls.push({ method: "start", resource: resource, payload: payload });
      return Promise.resolve(payload);
    },
  };
}

describe("bbop-manager-minerva basics", function () {
  it("updates privileged URLs when a token is present", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");

    assert.equal(man._batch_url, "http://example.org/api/minerva_local/m3Batch");
    assert.equal(man._seed_url, "http://example.org/api/minerva_local/seed/fromProcess");

    man.user_token("tok123");

    assert.equal(man._batch_url, "http://example.org/api/minerva_local/m3BatchPrivileged");
    assert.equal(man._seed_url, "http://example.org/api/minerva_local/seed/fromProcessPrivileged");
  });

  it("tracks reasoner and groups settings", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");

    assert.equal(man.use_reasoner_p(), false);
    man.use_reasoner_p(true);
    assert.equal(man.use_reasoner_p(), true);

    assert.equal(man.use_groups(), null);
    man.use_groups(["group:a", "group:b"]);
    assert.deepEqual(man.use_groups(), ["group:a", "group:b"]);
    man.use_groups(false);
    assert.deepEqual(man.use_groups(), []);
  });
});

describe("bbop-manager-minerva request routing", function () {
  it("sends meta requests to the batch endpoint and encodes requests as JSON strings", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");

    var payload = man.get_meta();

    assert.equal(engine.calls.length, 1);
    assert.equal(engine.calls[0].method, "fetch");
    assert.equal(engine.calls[0].resource, "http://example.org/api/minerva_local/m3Batch");
    assert.equal(payload, engine.calls[0].payload);
    assert.isString(payload.requests);

    var decoded = JSON.parse(payload.requests);
    assert.equal(decoded.length, 1);
    assert.equal(decoded[0].entity, "meta");
    assert.equal(decoded[0].operation, "get");
  });

  it("sends seed requests to the seed endpoint", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");

    man.seed_from_process("GO:123", "NCBITaxon:9606");

    assert.equal(engine.calls.length, 1);
    assert.equal(engine.calls[0].resource, "http://example.org/api/minerva_local/seed/fromProcess");

    var decoded = JSON.parse(engine.calls[0].payload.requests);
    assert.equal(decoded[0].operation, "seed-from-process");
    assert.equal(decoded[0].arguments.process, "GO:123");
    assert.equal(decoded[0].arguments.taxon, "NCBITaxon:9606");
  });

  it("collapses provided-by arrays to the first value before dispatch", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");
    man.use_groups(["group:a", "group:b"]);

    man.get_meta();

    assert.equal(engine.calls[0].payload["provided-by"], "group:a");
  });

  it("adds the manager-wide reasoner flag to outgoing requests", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");
    man.use_reasoner_p(true);

    man.get_meta();

    assert.equal(engine.calls[0].payload["use-reasoner"], "true");
  });

  it("assembles fact and composite requests through minerva-requests", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");

    man.add_fact("gomodel:1", "s1", "o1", "RO:0002333");
    var factPayload = JSON.parse(engine.calls[0].payload.requests);
    assert.deepEqual(factPayload[0].arguments, {
      subject: "s1",
      object: "o1",
      predicate: "RO:0002333",
      "model-id": "gomodel:1",
    });

    man.add_simple_composite("gomodel:1", "GO:0003674", "MGI:123", "GO:0005737");
    var compositePayload = JSON.parse(engine.calls[1].payload.requests);
    assert.equal(compositePayload.length, 3);
    assert.equal(compositePayload[0].entity, "individual");
    assert.equal(compositePayload[1].operation, "add-type");
    assert.equal(compositePayload[2].operation, "add-type");
  });
});

describe("bbop-manager-minerva callback dispatch", function () {
  it("dispatches success responses by signal and always runs postrun", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");
    var events = [];

    man.register("merge", function (resp) {
      events.push(["merge", resp.signal()]);
    });
    man.register("postrun", function (resp) {
      events.push(["postrun", resp.signal()]);
    });

    var resp = makeResponse({ message_type: "success", message: "ok", signal: "merge" });
    engine.callbacks.success(resp, man);

    assert.deepEqual(events, [
      ["merge", "merge"],
      ["postrun", "merge"],
    ]);
  });

  it("dispatches warning and error responses", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");
    var warningSeen = false;
    var errorSeen = false;

    man.register("warning", function () {
      warningSeen = true;
    });
    man.register("error", function () {
      errorSeen = true;
    });

    engine.callbacks.success(
      makeResponse({ message_type: "warning", message: "careful", signal: null }),
      man,
    );
    engine.callbacks.success(
      makeResponse({ message_type: "error", message: "boom", signal: null }),
      man,
    );

    assert.equal(warningSeen, true);
    assert.equal(errorSeen, true);
  });

  it("wraps deep engine failures as manager_error responses when necessary", function () {
    var engine = makeEngine();
    var man = new manager("http://example.org", "minerva_local", null, engine, "sync");
    var seen = null;

    man.register("manager_error", function (resp) {
      seen = resp;
    });

    engine.callbacks.error(null, man);

    assert.isNotNull(seen);
    assert.equal(seen.message_type(), "error");
    assert.equal(seen.message(), "message and message_type must always exist");
  });
});
