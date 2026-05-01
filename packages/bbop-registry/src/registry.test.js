import { describe, it } from "node:test";
import { assert } from "chai";
import { default as us } from "underscore";

import registry from "./registry.js";

describe("overall functionality", function () {
  it("basics", function () {
    // Absolute basics.
    var reg = new registry(["start", "stop", "reset"]);
    assert.equal(us.keys(reg.callback_registry).length, 3, "3 categories");
    assert.equal(us.keys(reg.callback_registry["reset"]).length, 0, "nothing in");

    // Create testable environment.
    var acc = 0;
    function plus(plus_val) {
      acc = acc + plus_val;
    }
    function mult(mult_val) {
      acc = acc * mult_val;
    }
    function sum(val1, val2) {
      acc = val1 + val2;
    }

    // Registration tests.
    reg.register("reset", plus, 0, "0");
    reg.register("reset", mult, 1, "1");
    assert.equal(reg.get_callbacks("reset").length, 2, "2 callbacks");
    reg.unregister("reset", "1");
    assert.equal(reg.get_callbacks("reset").length, 1, "now 1 callback");

    // Test apply.
    acc = 0;
    reg.register("start", plus, 0, "0");
    reg.register("start", mult, 1, "1");
    reg.apply_callbacks("start", [2]);
    assert.equal(acc, 2, "higher priority goes first");

    // Test apply and priority.
    acc = 0;
    reg.register("stop", plus, 1, "1");
    reg.register("stop", mult, 0, "0");
    reg.apply_callbacks("stop", [2]);
    assert.equal(acc, 4, "apply test 2");

    // Test multivalued apply.
    acc = 0;
    reg.unregister("stop", "0");
    reg.unregister("stop", "1");
    reg.register("stop", sum, -1, "-1");
    reg.apply_callbacks("stop", [2, 3]);
    assert.equal(acc, 5, "apply test 3");

    // is_registered
    assert.equal(null, reg.is_registered("foo", "bar"), "is_r? test 1");
    assert.isFalse(reg.is_registered("stop", "bar"), "is_r? test 2");
    assert.isTrue(reg.is_registered("stop", "-1"), "is_r? test 3");
  });

  it("implied ids work", function () {
    var reg = new registry(["start", "stop", "reset"]);
    var rid = reg.register("start", function () {});
    assert.isTrue(reg.is_registered("start", rid), "can see dynamic id");

    reg.unregister("start", rid);
    assert.isFalse(reg.is_registered("start", rid), "delete by dynamic id");
  });
});
