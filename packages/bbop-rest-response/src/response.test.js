import { describe, it } from "node:test";
import { assert } from "chai";
import responseTypes from "./response.js";

var response = responseTypes.base;
var responseJson = responseTypes.json;

describe("base response", function () {
  it("treats present raw values as okay and empty values as not okay", function () {
    var okayResponse = new response("foo");
    var emptyResponse = new response(null);

    assert.isTrue(okayResponse.okay(), "string response is okay");
    assert.isFalse(emptyResponse.okay(), "null response is not okay");
    assert.equal(okayResponse.raw(), "foo", "raw string preserved");
    assert.equal(emptyResponse.raw(), null, "raw null preserved");
  });

  it("supports explicit okay and message setters", function () {
    var responseObject = new response("");

    responseObject.okay(true);
    responseObject.message("hello");
    responseObject.message_type("notice");

    assert.isTrue(responseObject.okay(), "explicit okay overrides automatic state");
    assert.equal(responseObject.message(), "hello", "message stored");
    assert.equal(responseObject.message_type(), "notice", "message type stored");
  });
});

describe("json response", function () {
  it("parses valid JSON strings", function () {
    var responseObject = new responseJson('{"foo":1, "bar": {"bib":"a", "bab":2}}');

    assert.isTrue(responseObject.okay(), "valid json is okay");
    assert.deepEqual(responseObject.raw().bar, { bib: "a", bab: 2 }, "json payload parsed");
  });

  it("accepts already parsed objects and arrays", function () {
    var objectResponse = new responseJson({ foo: 1 });
    var arrayResponse = new responseJson([1, 2, 3]);

    assert.isTrue(objectResponse.okay(), "object payload is okay");
    assert.deepEqual(objectResponse.raw(), { foo: 1 }, "object payload preserved");
    assert.isTrue(arrayResponse.okay(), "array payload is okay");
    assert.deepEqual(arrayResponse.raw(), [1, 2, 3], "array payload preserved");
  });

  it("keeps invalid JSON strings raw and marks them bad", function () {
    var invalidText = "foo";
    var malformedJson = '{"foo":1, "bar"}';

    var textResponse = new responseJson(invalidText);
    var malformedResponse = new responseJson(malformedJson);

    assert.isFalse(textResponse.okay(), "plain text is not okay json");
    assert.equal(textResponse.raw(), invalidText, "plain text preserved");
    assert.isFalse(malformedResponse.okay(), "malformed json is not okay");
    assert.equal(malformedResponse.raw(), malformedJson, "malformed json preserved");
  });

  it("treats null input as not okay", function () {
    var responseObject = new responseJson(null);

    assert.isFalse(responseObject.okay(), "null json input is not okay");
    assert.equal(responseObject.raw(), null, "null input preserved");
  });

  it("parses simple JSON scalar strings", function () {
    var responseObject = new responseJson('"foo"');

    assert.isTrue(responseObject.okay(), "json string scalar is okay");
    assert.equal(responseObject.raw(), "foo", "json string scalar parsed");
  });
});
