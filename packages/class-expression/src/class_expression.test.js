import { describe, it } from "node:test";
import { assert } from "chai";
import ClassExpression from "./class_expression.js";

describe("basic operations", function () {
  it("probes an empty expression", function () {
    var expression = new ClassExpression();

    assert.equal(expression.id().length, 36, "uuid-shaped id");
    assert.isFalse(expression.nested_p(), "not nested");
    assert.equal(expression.category(), "unknown", "unknown category");
    assert.isNull(expression.type(), "unknown type");
    assert.isNull(expression.class_id(), "no class id");
    assert.isNull(expression.class_label(), "no class label");
    assert.isNull(expression.svf_class_expression(), "no svf");
    assert.isNull(expression.complement_class_expression(), "no complement");
    assert.isNull(expression.property_id(), "no property id");
    assert.isNull(expression.property_label(), "no property label");
    assert.throws(
      () => expression.structure(),
      /unknown type in request processing: null/,
      "untyped expression cannot be serialized",
    );
  });

  it("supports string, object, and copy constructors", function () {
    var expressions = [
      new ClassExpression("GO:123"),
      new ClassExpression({ type: "class", id: "GO:123" }),
      new ClassExpression(new ClassExpression("GO:123")),
    ];

    expressions.forEach(function (expression, index) {
      assert.equal(expression.id().length, 36, `[${index}] uuid-shaped id`);
      assert.isFalse(expression.nested_p(), `[${index}] not nested`);
      assert.equal(expression.category(), "instance_of", `[${index}] class category`);
      assert.equal(expression.type(), "class", `[${index}] class type`);
      assert.equal(expression.class_id(), "GO:123", `[${index}] class id`);
      assert.equal(expression.class_label(), "GO:123", `[${index}] class label`);
      assert.isNull(expression.svf_class_expression(), `[${index}] no svf`);
      assert.isNull(expression.property_id(), `[${index}] no property id`);
      assert.isNull(expression.property_label(), `[${index}] no property label`);
      assert.deepEqual(
        expression.structure(),
        { type: "class", id: "GO:123" },
        `[${index}] structure`,
      );
    });
  });
});

describe("expression builders", function () {
  it("creates svf expressions after construction", function () {
    var expression = new ClassExpression(null);
    expression.as_svf("RO:456", "GO:123");

    assert.isTrue(expression.nested_p(), "svf is nested");
    assert.equal(expression.category(), "RO:456", "svf category uses property id");
    assert.equal(expression.type(), "svf", "svf type");
    assert.isNull(expression.class_id(), "svf has no direct class id");
    assert.equal(expression.property_id(), "RO:456", "property id");
    assert.equal(expression.property_label(), "RO:456", "property label falls back to id");
    assert.deepEqual(
      expression.svf_class_expression().structure(),
      { type: "class", id: "GO:123" },
      "filler structure",
    );
    assert.deepEqual(
      expression.structure(),
      {
        type: "svf",
        property: {
          type: "property",
          id: "RO:456",
        },
        filler: {
          type: "class",
          id: "GO:123",
        },
      },
      "svf structure",
    );
  });

  it("creates intersections and nests them inside svfs", function () {
    var intersection = new ClassExpression();
    intersection.as_set("intersection", ["GO:123", new ClassExpression("GO:456")]);

    assert.isTrue(intersection.nested_p(), "intersection is nested");
    assert.equal(intersection.category(), "intersection", "intersection category");
    assert.equal(intersection.type(), "intersection", "intersection type");
    assert.deepEqual(
      intersection.structure(),
      {
        type: "intersection",
        expressions: [
          { type: "class", id: "GO:123" },
          { type: "class", id: "GO:456" },
        ],
      },
      "intersection structure",
    );

    var nested = new ClassExpression();
    nested.as_svf("RO:123", intersection);

    assert.equal(nested.svf_class_expression().type(), "intersection", "nested filler type");
    assert.equal(nested.property_id(), "RO:123", "nested property id");
    assert.deepEqual(
      nested.structure(),
      {
        type: "svf",
        property: {
          type: "property",
          id: "RO:123",
        },
        filler: {
          type: "intersection",
          expressions: [
            { type: "class", id: "GO:123" },
            { type: "class", id: "GO:456" },
          ],
        },
      },
      "nested svf structure",
    );
  });

  it("creates complements", function () {
    var intersection = new ClassExpression();
    intersection.as_set("intersection", ["GO:123", "GO:456"]);
    var expression = new ClassExpression();
    expression.as_complement(intersection);

    assert.isTrue(expression.nested_p(), "complement is nested");
    assert.equal(expression.category(), "complement", "complement category");
    assert.equal(expression.type(), "complement", "complement type");
    assert.equal(
      expression.complement_class_expression().type(),
      "intersection",
      "complement filler type",
    );
    assert.deepEqual(
      expression.structure(),
      {
        type: "complement",
        filler: {
          type: "intersection",
          expressions: [
            { type: "class", id: "GO:123" },
            { type: "class", id: "GO:456" },
          ],
        },
      },
      "complement structure",
    );
  });
});

describe("string writers", function () {
  it("renders compact strings for nested expressions", function () {
    var intersection = new ClassExpression();
    intersection.as_set("intersection", ["GO:123", "GO:456"]);

    var complement = new ClassExpression();
    complement.as_complement(intersection);
    assert.equal(complement.to_string(), "NOT[intersection[2]]", "complement string form");

    var svf = new ClassExpression();
    svf.as_svf("RO:123", intersection);
    assert.equal(svf.to_string(), "svf[RO:123](intersection[2])", "svf string form");
  });

  it("renders labeled strings and string-plus output", function () {
    var plain = new ClassExpression("GO:0022008");
    assert.equal(plain.to_string(), "GO:0022008", "plain string form");
    assert.equal(plain.to_string_plus(), "GO:0022008", "plain string-plus form");

    var labeled = new ClassExpression({
      type: "class",
      id: "GO:0022008",
      label: "neurogenesis",
    });
    assert.equal(labeled.to_string(), "neurogenesis", "labeled string form");
    assert.equal(labeled.to_string_plus(), "[GO:0022008] neurogenesis", "labeled string-plus form");
  });
});

describe("static builders", function () {
  it("creates classes, unions, svfs, and complements", function () {
    var cls = ClassExpression.cls("GO:123");
    assert.equal(cls.type(), "class", "static class builder");

    var union = ClassExpression.union(["GO:123", "GO:456"]);
    assert.equal(union.type(), "union", "static union builder");
    assert.equal(union.frame().length, 2, "union frame size");

    var svf = ClassExpression.svf("RO:789", "GO:123");
    assert.equal(svf.type(), "svf", "static svf builder");
    assert.equal(svf.property_id(), "RO:789", "static svf property id");

    var complement = ClassExpression.complement("GO:123");
    assert.equal(complement.type(), "complement", "static complement builder");
    assert.equal(
      complement.complement_class_expression().class_id(),
      "GO:123",
      "static complement filler",
    );
  });

  it("produces stable signatures for identical structures", function () {
    var left = ClassExpression.svf("RO:123", ClassExpression.intersection(["GO:123", "GO:456"]));
    var right = new ClassExpression(left);

    assert.equal(left.signature(), right.signature(), "copied structures share signatures");
  });
});
