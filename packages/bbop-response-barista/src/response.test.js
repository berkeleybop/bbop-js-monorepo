import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { assert } from "chai";
import us from "underscore";
import Response from "./response.js";

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

describe("barista response parsing", function () {
  it("accepts server exception envelopes that still have message fields", function () {
    var raw = {
      "message-type": "error",
      message: "Exception!",
      commentary: "blah",
    };

    var response = new Response(raw);

    assert.equal(response.okay(), true, "viable envelope");
    assert.equal(response.message_type(), "error", "message type preserved");
    assert.equal(response.message(), "Exception!", "message preserved");
    assert.equal(response.commentary(), "blah", "commentary preserved");
  });

  it("rejects missing and malformed top-level barista payloads", function () {
    var empty = new Response(null);
    var wrongType = new Response(42);
    var badString = new Response("nope");
    var missingMessage = new Response({ "message-type": "success" });
    var badCommentary = new Response({
      "message-type": "success",
      message: "ok",
      commentary: { nope: true },
    });
    var badData = new Response({
      "message-type": "success",
      message: "ok",
      data: [],
    });

    assert.equal(empty.okay(), false, "empty payload rejected");
    assert.equal(empty.message(), "empty response in handler", "empty payload message");
    assert.equal(wrongType.okay(), false, "wrong argument type rejected");
    assert.equal(wrongType.message(), "bad argument type in handler", "wrong type message");
    assert.equal(badString.okay(), false, "bad json string rejected");
    assert.match(
      badString.message(),
      /handler could not parse string response/,
      "parse failure message",
    );
    assert.equal(missingMessage.okay(), false, "missing message rejected");
    assert.equal(
      missingMessage.message(),
      "message and message_type must always exist",
      "missing message detail",
    );
    assert.equal(badCommentary.okay(), false, "non-string commentary rejected");
    assert.equal(badCommentary.message(), "commentary not string", "bad commentary detail");
    assert.equal(badData.okay(), false, "non-object data rejected");
    assert.equal(badData.message(), "data not object", "bad data detail");
  });
});

describe("barista model responses", function () {
  it("extracts model metadata from a simple model response", function () {
    var response = new Response(loadFixture("response-gomodel-55ad81df00000001-2015-08-07.json"));

    assert.equal(response.okay(), true, "response okay");
    assert.equal(response.user_id(), "GOC:kltm", "uid preserved");
    assert.equal(response.intention(), "query", "intention preserved");
    assert.equal(response.reasoner_p(), false, "reasoner flag preserved");
    assert.equal(response.signal(), "rebuild", "signal preserved");
    assert.equal(response.packet_id(), "2b54a15a3390a14", "packet id preserved");
    assert.equal(response.model_id(), "gomodel:55ad81df00000001", "model id extracted");
    assert.equal(response.modified_p(), true, "modified flag extracted");
    assert.equal(response.inconsistent_p(), false, "inconsistent defaults false");
    assert.equal(response.facts().length, 3, "facts exposed");
    assert.equal(response.properties().length, 3, "properties exposed");
    assert.equal(response.individuals().length, 5, "individuals exposed");
    assert.equal(response.annotations().length, 7, "annotations exposed");
    assert.equal(response.export_model(), "", "missing export model defaults empty string");
  });

  it("tracks action responses with groups and aliases", function () {
    var response = new Response(
      loadFixture("response-gomodel-55ad81df00000001-action-2016-11-01.json"),
    );

    assert.equal(response.okay(), true, "response okay");
    assert.deepEqual(response.groups(), ["http://geneontology.org"], "groups extracted");
    assert.deepEqual(response.provided_by(), response.groups(), "provided_by aliases groups");
    assert.equal(response.intention(), "action", "action intention preserved");
    assert.equal(response.signal(), "merge", "merge signal preserved");
  });

  it("handles missing groups in store-only meta dumps", function () {
    var response = new Response(loadFixture("response-meta-dump-2016-11-01.json"));

    assert.equal(response.okay(), true, "response okay");
    assert.equal(response.groups(), null, "groups absent");
    assert.equal(response.provided_by(), null, "provided_by absent");
    assert.equal(response.intention(), "query", "query intention preserved");
    assert.equal(response.message(), "Dumped all models to folder", "message preserved");
  });
});

describe("barista meta and validation helpers", function () {
  it("extracts meta payload sections", function () {
    var response = new Response(loadFixture("response-meta-2015-08-07.json"));
    var modelsMeta = response.models_meta();
    var readOnlyMeta = response.models_meta_read_only();
    var modelIds = response.model_ids();

    assert.isAbove(response.relations().length, 2, "relations exposed");
    assert.isAbove(response.evidence().length, 2, "evidence exposed");
    assert.isAbove(us.keys(modelsMeta).length, 20, "model metadata exposed");
    assert.equal(
      us.keys(readOnlyMeta).length,
      us.keys(modelsMeta).length,
      "read-only metadata aligns with metadata",
    );
    assert.equal(modelIds.length, us.keys(modelsMeta).length, "model_ids reflect models_meta keys");

    var firstReadOnly = readOnlyMeta[modelIds[0]];
    assert.equal(firstReadOnly["modified-p"], false, "read-only entry preserved");
  });

  it("exposes barista-specific validation helpers for invalid and valid models", function () {
    var invalid = new Response(loadFixture("response-gomodel-5d88482400000052-2019-09-25.json"));
    var valid = new Response(loadFixture("response-gomodel-R-HSA-159740-2019-09-26.json"));

    assert.equal(invalid.okay(), true, "invalid model response still parses");
    assert.equal(invalid.valid_p(), false, "overall invalid");
    assert.equal(invalid.valid_owl_p(), true, "owl valid");
    assert.equal(invalid.valid_shex_p(), false, "shex invalid");
    assert.equal(invalid.shex_violations().length, 2, "violations exposed");
    invalid.shex_violations().forEach(function (violation) {
      assert.isString(violation.node, "violation has node id");
      assert.isArray(violation.explanations, "violation has explanations");
    });

    assert.equal(valid.okay(), true, "valid model response parses");
    assert.equal(valid.valid_p(), true, "overall valid");
    assert.equal(valid.valid_owl_p(), true, "owl valid");
    assert.equal(valid.valid_shex_p(), true, "shex valid");
    assert.deepEqual(valid.shex_violations(), [], "no violations in valid model");
  });
});
